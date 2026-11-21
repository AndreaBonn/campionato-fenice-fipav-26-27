// Pure rules of the next-game box and the last-result row: titles, share text, opponent chips. No DOM.
import { feniceTeamId, form, isHome, outcome, playedInOrder } from "./game-rules.js";
import { TIME_ZONE, displayTeamName, plural } from "./view-rules.js";

// The club as the page writes it in titles; displayTeamName would give "Asd Fenice"
export const FENICE_LABEL = "ASD Fenice";

const fmt = (iso, options) => new Date(iso).toLocaleDateString("it-IT", { ...options, timeZone: TIME_ZONE });

const teamLabel = (data, id) => (id === feniceTeamId(data) ? FENICE_LABEL : displayTeamName(data.teams.find((t) => t.id === id)?.name ?? "Squadra sconosciuta"));

// The two sides in the order they are written, home first: [{ id, name, isFenice }, { ... }]
export function matchSides(data, game) {
  const me = feniceTeamId(data);
  return [game.home_id, game.away_id].map((id) => ({ id, name: teamLabel(data, id), isFenice: id === me }));
}

// "ASD Fenice - Santandreasulcis"
export const matchTitle = (data, game) => matchSides(data, game).map((s) => s.name).join(" - ");

// "sabato 21 novembre ore 17:00", the time only when known
function whenText(game) {
  if (!game.starts_at) return "data da definire";
  const day = fmt(game.starts_at, { weekday: "long", day: "numeric", month: "long" });
  return `${day} ${game.time ? `ore ${game.time}` : "orario da definire"}`;
}

// Name and town of the venue, in capitals only where due
const placeText = (v) => [v.name, v.city].filter(Boolean).map(displayTeamName).join(", ");

// Share payload of a game: { title, text, url }; the url is left out when the page address is unknown
export function sharePayload(data, game, pageUrl) {
  const title = matchTitle(data, game);
  const text = [title, whenText(game), placeText(game.venue)].filter(Boolean).join(", ");
  return pageUrl ? { title, text, url: pageUrl } : { title, text };
}

// What the clipboard gets when the browser cannot open a share sheet
export const clipboardText = ({ text, url }) => (url ? `${text}\n${url}` : text);

const involves = (game, teamId) => game.home_id === teamId || game.away_id === teamId;

// Standing, record and last outcomes of a team, from the FIPAV standings and the games of data.json:
// { position: number | null, played, won, lost, form: ["won" | "lost", ...] oldest first, at most five }
export function teamSummary(data, teamId) {
  const games = data.games.filter((g) => involves(g, teamId));
  const results = playedInOrder(games).map((g) => outcome(g, teamId));
  return {
    position: data.standings.find((r) => r.team_id === teamId)?.pos ?? null,
    played: results.length,
    won: results.filter((o) => o === "won").length,
    lost: results.filter((o) => o === "lost").length,
    form: form(games, teamId),
  };
}

// Text of the chips of the "Avversaria" line, in the order shown
export function opponentChipTexts(summary) {
  const chips = [];
  if (summary.position !== null) chips.push(`${summary.position}ª in classifica`);
  chips.push(summary.played ? `${plural(summary.won, "vinta", "vinte")}, ${plural(summary.lost, "persa", "perse")}` : "nessuna partita giocata");
  return chips;
}

// "4ª giornata, sab 12 dic · in casa": where the last result sits in the season, without the time
export function lastResultMeta(game, teamId) {
  const day = game.starts_at ? `, ${fmt(game.starts_at, { weekday: "short", day: "numeric", month: "short" })}` : "";
  return `${game.round}ª giornata${day} · ${isHome(game, teamId) ? "in casa" : "in trasferta"}`;
}
