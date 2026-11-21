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

// "3-0 (25-12, 25-19, 25-18)" from the team's perspective; null for a game not played
export function setsLabel(game, teamId) {
  if (!game.played || !game.sets_won) return null;
  const [mine, theirs] = seenFrom(game.sets_won, game, teamId);
  const parts = game.sets.map((s) => seenFrom(s, game, teamId).join("-"));
  return `${mine}-${theirs} (${parts.join(", ")})`;
}

// "won" | "lost" for a played game, null otherwise
export function outcome(game, teamId) {
  if (!game.played || !game.sets_won) return null;
  const [mine, theirs] = seenFrom(game.sets_won, game, teamId);
  return mine > theirs ? "won" : "lost";
}

// Google Maps link on the venue coordinates; null when the venue has none
export const mapUrl = (venue) => (venue.lat == null || venue.lng == null ? null : `${MAPS_SEARCH}${venue.lat},${venue.lng}`);
