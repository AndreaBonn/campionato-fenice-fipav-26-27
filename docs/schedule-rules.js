// Pure rules of the schedule: which games the filters keep, how they group by month, andata and ritorno.
// No DOM, no browser API beyond Intl, tested with node --test.
import { gameStatus, isHome } from "./game-rules.js";
import { TIME_ZONE } from "./view-rules.js";

export const WHEN_OPTIONS = [["next", "Prossime"], ["played", "Giocate"], ["all", "Tutte"]];
export const SIDE_OPTIONS = [["all", "Casa e trasferta"], ["home", "Casa"], ["away", "Trasferta"]];
export const DEFAULT_FILTER = Object.freeze({ when: "next", side: "all" });
export const SHOW_ALL_FILTER = Object.freeze({ when: "all", side: "all" });
export const UNDATED_LABEL = "Data da definire";

const VALUES = { when: WHEN_OPTIONS.map(([v]) => v), side: SIDE_OPTIONS.map(([v]) => v) };

// New filter with one group changed; an unknown group or value leaves it as it was
export function withChoice(filter, group, value) {
  return VALUES[group]?.includes(value) ? { ...filter, [group]: value } : filter;
}

const keepsWhen = (g, when, now) => when === "all" || (gameStatus(g, now) === "played") === (when === "played");
const keepsSide = (g, side, teamId) => side === "all" || isHome(g, teamId) === (side === "home");

// Prossime = every game that is not played (unscheduled, upcoming, live, awaiting); Giocate = played
export const filterGames = (games, filter, teamId, now) =>
  games.filter((g) => keepsWhen(g, filter.when, now) && keepsSide(g, filter.side, teamId));

const EMPTY_WHEN = { next: "da giocare", played: "giocata", all: "" };
const EMPTY_SIDE = { all: "", home: " in casa", away: " in trasferta" };

// What the empty list says for this combination of filters
export function emptyMessage({ when, side }) {
  if (when === "all") return `Nessuna partita${EMPTY_SIDE[side]}.`;
  return `Nessuna partita ${EMPTY_WHEN[when]}${EMPTY_SIDE[side]}${when === "played" ? " finora" : ""}.`;
}

const monthLabel = (iso) => {
  const text = new Date(iso).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: TIME_ZONE });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Games by date (stable: equal dates keep their order), grouped by month of the kickoff; games without
// a start go last in one group: [{ label, games }]
export function groupByMonth(games) {
  const stamp = (g) => (g.starts_at ? Date.parse(g.starts_at) : Infinity);
  const groups = [];
  for (const g of [...games].sort((a, b) => stamp(a) - stamp(b))) {
    const label = g.starts_at ? monthLabel(g.starts_at) : UNDATED_LABEL;
    if (groups.at(-1)?.label === label) groups.at(-1).games.push(g);
    else groups.push({ label, games: [g] });
  }
  return groups;
}

// Rounds in each half of the season, from the teams of the girone: N-1 for an even N, N for an odd one (a rest
// round each). Not from the rounds published, which may be the andata only. null without teams or when a
// game sits above the second half; the views then fall back to «Giornata N»
export function roundsPerHalf(data) {
  const n = data.teams?.length ?? 0;
  if (n < 2) return null;
  const half = n % 2 === 0 ? n - 1 : n;
  return data.games.some((g) => Number(g.round) > 2 * half) ? null : half;
}

// Prossime with no game left to play at all (season over) would be an empty list: show Tutte instead
export function effectiveFilter(filter, games, now) {
  if (filter.when !== "next" || games.some((g) => gameStatus(g, now) !== "played")) return filter;
  return { ...filter, when: "all" };
}

// "3ª giornata di andata", "1ª giornata di ritorno"; "Giornata 3" when the halves are unknown or the round is outside them
export function roundLabel(round, half) {
  if (half && round >= 1 && round <= half) return `${round}ª giornata di andata`;
  if (half && round > half && round <= 2 * half) return `${round - half}ª giornata di ritorno`;
  return `Giornata ${round}`;
}

// The andata game against the same opponent as a ritorno game, only when it is played with a result; else null
export function andataGame(game, feniceGames, half, teamId) {
  if (!half || game.round <= half || game.round > 2 * half) return null;
  const opponent = isHome(game, teamId) ? game.away_id : game.home_id;
  const found = feniceGames.find((g) => g.round === game.round - half && (g.home_id === opponent || g.away_id === opponent));
  return found?.played && found.sets_won ? found : null;
}
