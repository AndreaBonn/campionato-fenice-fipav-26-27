// Pure statistics of the followed club over its played games: no DOM, tested with node --test.
import { isHome, outcome } from "./game-rules.js";

const TIE_BREAK_SET = 5;
const PERCENT = 100;

const involves = (game, teamId) => game.home_id === teamId || game.away_id === teamId;
const results = (teamId, games) => games.filter((g) => involves(g, teamId) && g.played && g.sets_won);
// [mine, theirs] pairs of every set, seen from the team's side
const setPairs = (game, teamId) => game.sets.map(([h, a]) => (isHome(game, teamId) ? [h, a] : [a, h]));
const sum = (pairs, index) => pairs.reduce((total, pair) => total + pair[index], 0);

// Sets won and lost over the played games, and the share of sets won (rounded; null before any set)
export function setStats(teamId, games) {
  let won = 0, lost = 0;
  for (const g of results(teamId, games)) {
    const [mine, theirs] = isHome(g, teamId) ? g.sets_won : [g.sets_won[1], g.sets_won[0]];
    won += mine;
    lost += theirs;
  }
  const total = won + lost;
  return { won, lost, total, wonPct: total ? Math.round((won / total) * PERCENT) : null };
}

// Mean points scored and conceded per set. The fifth set is played to 15, so it is kept out of the mean and
// reported apart as tieBreak; null when no set has been played
export function averagePointsPerSet(teamId, games) {
  const regular = [], decider = [];
  for (const g of results(teamId, games)) {
    setPairs(g, teamId).forEach((pair, i) => (i + 1 === TIE_BREAK_SET ? decider : regular).push(pair));
  }
  if (!regular.length && !decider.length) return null;
  const mean = (pairs, index) => (pairs.length ? sum(pairs, index) / pairs.length : null);
  return {
    sets: regular.length, scored: mean(regular, 0), conceded: mean(regular, 1),
    tieBreak: decider.length ? { sets: decider.length, scored: mean(decider, 0), conceded: mean(decider, 1) } : null,
  };
}

const wentToTieBreak = (g) => g.sets_won[0] + g.sets_won[1] === TIE_BREAK_SET;

// Games decided in the fifth set, with wins and losses
export function tieBreakRecord(teamId, games) {
  const decided = results(teamId, games).filter(wentToTieBreak);
  const won = decided.filter((g) => outcome(g, teamId) === "won").length;
  return { played: decided.length, won, lost: decided.length - won };
}

// Wins after losing the first set, and among them those after trailing 0-2
export function comebacks(teamId, games) {
  const won = results(teamId, games).filter((g) => outcome(g, teamId) === "won" && g.sets.length)
    .map((g) => setPairs(g, teamId)).filter((pairs) => pairs[0][0] < pairs[0][1]);
  return { won: won.length, fromTwoZero: won.filter((pairs) => pairs[1][0] < pairs[1][1]).length };
}

// Current run of equal outcomes, newest game last in the file order; null with no result
export function streak(teamId, games) {
  const outcomes = results(teamId, games).map((g) => outcome(g, teamId));
  if (!outcomes.length) return null;
  const last = outcomes.at(-1);
  let length = 0;
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === last; i -= 1) length += 1;
  return { outcome: last, length };
}
