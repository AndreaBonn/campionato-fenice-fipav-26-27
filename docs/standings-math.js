import { tableFromGames } from "./standings-rules.js";

const WIN_FULL = 3;
const OUTCOMES = [[3, 0], [2, 1], [1, 2], [0, 3]];
export const MAX_ENUMERATED_GAMES = 9;

// Points and wins come from the official standings when published (they can include penalties the games do not
// show); the games only tell which fixtures are still to play
function leagueState(data) {
  const rows = data.standings?.length ? data.standings : tableFromGames(data.games, data.teams);
  const index = new Map(rows.map((row, i) => [row.team_id, i]));
  const remaining = data.games.filter((g) => !g.played && index.has(g.home_id) && index.has(g.away_id))
    .map((g) => [index.get(g.home_id), index.get(g.away_id)]);
  const pending = rows.map(() => 0);
  for (const [home, away] of remaining) { pending[home]++; pending[away]++; }
  return { rows, remaining, pending };
}

function limits(team, state) {
  const max = (i) => state.rows[i].points + WIN_FULL * state.pending[i];
  const settled = new Set();
  let above = 0, below = 0;
  state.rows.forEach((row, i) => {
    if (row.points > max(team)) { above++; settled.add(i); }
    if (max(i) < state.rows[team].points) { below++; settled.add(i); }
  });
  return { bound: { best: above + 1, worst: state.rows.length - below }, settled };
}

function rank(team, points, wins, state) {
  let above = 0;
  const tied = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i] > points[team] || (points[i] === points[team] && wins[i] > wins[team])) above++;
    else if (points[i] === points[team] && wins[i] === wins[team]) tied.push(i);
  }
  if (tied.some((i) => state.pending[i])) return [above + 1, above + tied.length];
  const row = state.rows[team];
  let equal = 0;
  for (const i of tied) {
    const other = state.rows[i];
    if (other.set_ratio > row.set_ratio || (other.set_ratio === row.set_ratio && other.point_ratio > row.point_ratio)) above++;
    else if (other.set_ratio === row.set_ratio && other.point_ratio === row.point_ratio) equal++;
  }
  return [above + 1, above + equal];
}

function award(points, wins, game, outcome, sign) {
  const [home, away] = game, [hp, ap] = OUTCOMES[outcome];
  points[home] += sign * hp; points[away] += sign * ap;
  wins[outcome < 2 ? home : away] += sign;
}

function enumerate(team, state, relevant, fixed, bound) {
  const points = state.rows.map((r) => r.points), wins = state.rows.map((r) => r.won);
  const digits = relevant.map(() => 0);
  for (const game of [...fixed, ...relevant]) award(points, wins, game, 0, 1);
  let best = Infinity, worst = 0;
  for (let step = 0; step < 4 ** relevant.length; step++) {
    const [low, high] = rank(team, points, wins, state);
    best = Math.min(best, low); worst = Math.max(worst, high);
    if (best === bound.best && worst === bound.worst) break;
    for (let i = 0; i < digits.length; i++) {
      award(points, wins, relevant[i], digits[i], -1);
      digits[i] = (digits[i] + 1) % OUTCOMES.length;
      award(points, wins, relevant[i], digits[i], 1);
      if (digits[i]) break;
    }
  }
  return { best, worst };
}

function teamRange(team, state, maxEnumerated) {
  const { bound, settled } = limits(team, state);
  const relevant = [], fixed = [];
  for (const game of state.remaining) {
    (settled.has(game[0]) && settled.has(game[1]) ? fixed : relevant).push(game);
  }
  return relevant.length > maxEnumerated ? bound : enumerate(team, state, relevant, fixed, bound);
}

export function positionRanges(data, { maxEnumerated = MAX_ENUMERATED_GAMES } = {}) {
  const state = leagueState(data);
  return new Map(state.rows.map((row, i) => [row.team_id, teamRange(i, state, maxEnumerated)]));
}

function zone(best, worst, first, last) {
  if (first > last) return null;
  return best >= first && worst <= last ? true : worst < first || best > last ? false : null;
}

export function decidedFacts(ranges, formula) {
  const total = ranges.size;
  return [...ranges].map(([team_id, { best, worst }]) => {
    const fact = { team_id, position: best === worst ? best : null };
    if (formula.published) Object.assign(fact, {
      promotion: zone(best, worst, 1, formula.promotion),
      playoff: zone(best, worst, formula.promotion + 1, formula.promotion + formula.playoff),
      relegation: zone(best, worst, total - formula.relegation + 1, total),
    });
    return fact;
  }).filter((fact) => fact.position !== null || (formula.published && [fact.promotion, fact.playoff, fact.relegation].some((value) => value !== null)))
    .sort((a, b) => (ranges.get(a.team_id).best - ranges.get(b.team_id).best) || (ranges.get(a.team_id).worst - ranges.get(b.team_id).worst));
}
