// Pure rules over the games of data.json (schema_version 1): no DOM, no browser API, tested with node --test.

const MAPS_SEARCH = "https://www.google.com/maps/search/?api=1&query=";

// Team id of the club this page follows: data.team_cod names it, the games speak in team ids
export const feniceTeamId = (data) => data.teams.find((t) => t.cod === data.team_cod)?.id ?? null;

export const isHome = (game, teamId) => game.home_id === teamId;

// The games of the followed club, in the file order (round, then start)
export function feniceGames(data) {
  const id = feniceTeamId(data);
  return id === null ? [] : data.games.filter((g) => g.home_id === id || g.away_id === id);
}

// A volleyball match is over well within this window after the first whistle
export const MATCH_WINDOW_MS = 3 * 60 * 60e3;

// First unplayed game that has not started yet or started less than the match window ago;
// games without a start are left out
export function nextGame(games, now) {
  const upcoming = games
    .filter((g) => !g.played && g.starts_at !== null && new Date(g.starts_at) >= now - MATCH_WINDOW_MS)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return upcoming[0] ?? null;
}

// [mine, theirs] pair from a [home, away] pair, seen from the team's side
const seenFrom = (pair, game, teamId) => (isHome(game, teamId) ? pair : [pair[1], pair[0]]);

// "3-0" from the team's perspective; null for a game not played
export function scoreLabel(game, teamId) {
  if (!game.played || !game.sets_won) return null;
  return seenFrom(game.sets_won, game, teamId).join("-");
}

// ["25-12", "25-19"] set by set from the team's perspective; empty for a forfeit or a game not played
export const setScores = (game, teamId) => (game.played ? game.sets.map((s) => seenFrom(s, game, teamId).join("-")) : []);

// "3-0 (25-12, 25-19, 25-18)"; the part in brackets is left out when there are no sets
export function setsLabel(game, teamId) {
  const score = scoreLabel(game, teamId);
  if (score === null) return null;
  const parts = setScores(game, teamId);
  return parts.length ? `${score} (${parts.join(", ")})` : score;
}

// "won" | "lost" for a played game, null otherwise
export function outcome(game, teamId) {
  if (!game.played || !game.sets_won) return null;
  const [mine, theirs] = seenFrom(game.sets_won, game, teamId);
  return mine > theirs ? "won" : "lost";
}

// Google Maps link on the venue coordinates; null when the venue has none
export const mapUrl = (venue) => (venue.lat == null || venue.lng == null ? null : `${MAPS_SEARCH}${venue.lat},${venue.lng}`);

const FORM_LENGTH = 5;
const CHANGE_NOUNS = { date: "data", time: "ora", venue: "palestra" };

const startTime = (g) => (g.starts_at ? Date.parse(g.starts_at) : -Infinity);

// Played games with a result, oldest first by the date they were played: a postponed game
// counts when it was played, not in its round. The sort is stable, so games without a date
// keep the file order
export const playedInOrder = (games) => games.filter((g) => g.played && g.sets_won).sort((a, b) => startTime(a) - startTime(b));

// Last played game by play date; null when none is played
export const lastPlayed = (games) => playedInOrder(games).at(-1) ?? null;

// Outcomes of the last FORM_LENGTH played games, oldest first: ["won", "lost", ...]
export const form = (games, teamId) =>
  playedInOrder(games).slice(-FORM_LENGTH).map((g) => outcome(g, teamId));

// "Arbitri: A, B" / "Arbitro: A" from the names, "Arbitro da designare" while pending, null otherwise
export function refereesLabel(game) {
  if (game.referees.length) return `${game.referees.length > 1 ? "Arbitri" : "Arbitro"}: ${game.referees.join(", ")}`;
  return game.referee_pending ? "Arbitro da designare" : null;
}

// "cambiati data e palestra": what moved, without the "Spostata" lead; null for a game that did not move
export function changeDetail(game) {
  const nouns = (game.changes ?? []).map((c) => CHANGE_NOUNS[c] ?? c);
  if (!nouns.length) return null;
  const list = nouns.length > 1 ? `${nouns.slice(0, -1).join(", ")} e ${nouns.at(-1)}` : nouns[0];
  return `${nouns.length > 1 ? "cambiati" : "cambiata la"} ${list}`;
}
