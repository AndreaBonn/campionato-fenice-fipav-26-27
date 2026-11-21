// Content and wiring of the opponent card, a native <dialog> opened with showModal().
// Imperative shell over opponent-rules.js and team-rules.js; the markup builders return strings.
import { feniceTeamId } from "./game-rules.js";
import { headToHead } from "./opponent-rules.js";
import { homeAwayRecord, remainingGames } from "./team-rules.js";
import { positionRanges } from "./standings-math.js";
import { displayTeamName } from "./view-rules.js";
import { esc } from "./games-view.js";
import { crestFallbackHtml, installCrestFallback } from "./tables-view.js";

const NEXT_SHOWN = 5;
const CREST_SIZE = 40;
const TIME_ZONE = "Europe/Rome";

const nameOf = (team) => esc(displayTeamName(team.name));
const section = (title, body) => `<section class="opp-section"><h3>${title}</h3>${body}</section>`;
const dayText = (g) => (g.starts_at
  ? new Date(g.starts_at).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE })
  : "Data da definire");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function crestHtml(team) {
  if (!team.logo_url) return crestFallbackHtml(team.name);
  return `<img src="${esc(team.logo_url)}" alt="" data-crest-name="${esc(team.name)}" width="${CREST_SIZE}" height="${CREST_SIZE}">`;
}

// "Posizione finale possibile" line, only when the range is narrower than first-to-last
function rangeLine(data, teamId) {
  const ranges = positionRanges(data), range = ranges.get(teamId);
  if (!range || (range.best === 1 && range.worst === ranges.size)) return "";
  const span = range.best === range.worst ? `${range.best}°` : `tra il ${range.best}° e il ${range.worst}° posto`;
  return `<p class="opp-range">Posizione finale possibile: ${span}</p>`;
}

function headerHtml(data, team) {
  const pos = data.standings.find((r) => r.team_id === team.id)?.pos;
  const place = pos ? `<p>${pos}° in classifica</p>` : "";
  return `<header class="opp-head">${crestHtml(team)}<div><h2 id="opp-title">${nameOf(team)}</h2>${place}${rangeLine(data, team.id)}</div></header>`;
}

function headToHeadHtml(data, team) {
  const h = headToHead(feniceTeamId(data), team.id, data.games);
  if (!h.played.length && !h.upcoming.length) return section("Scontri diretti con la Fenice", "<p>Nessuno scontro in calendario.</p>");
  const played = h.played.map((p) => `<li>Giornata ${esc(p.game.round)}: <b>${esc(p.score)}</b> ${p.outcome === "won" ? "vinta" : "persa"} dalla Fenice<small> (${esc(p.sets.join(", "))})</small></li>`);
  const upcoming = h.upcoming.map((g) => `<li>Giornata ${esc(g.round)}: da giocare, ${esc(dayText(g))}</li>`);
  return section("Scontri diretti con la Fenice", `<ul>${[...played, ...upcoming].join("")}</ul>`);
}

function recordLine(label, r) {
  if (!r.played) return `<li>${label}: nessuna gara giocata</li>`;
  return `<li>${label}: ${plural(r.won, "vinta", "vinte")}, ${plural(r.lost, "persa", "perse")}, set ${r.setsWon}-${r.setsLost}, punti ${r.pointsFor}-${r.pointsAgainst}</li>`;
}

function recordHtml(data, team) {
  const rec = homeAwayRecord(team.id, data.games);
  return section("Rendimento in casa e in trasferta", `<ul>${recordLine("In casa", rec.home)}${recordLine("In trasferta", rec.away)}</ul>`);
}

function remainingRow(data, r) {
  const opp = data.teams.find((t) => t.id === r.opponentId);
  const place = r.opponentPos ? ` <small>(${r.opponentPos}°)</small>` : "";
  return `<li>${esc(dayText(r.game))}: ${opp ? nameOf(opp) : "Squadra sconosciuta"}${place}, ${r.home ? "in casa" : "in trasferta"}</li>`;
}

function remainingHtml(data, team) {
  const { games, averagePosition } = remainingGames(team.id, data.games, data.teams);
  if (!games.length) return section("Prossime gare", "<p>Nessuna gara da giocare.</p>");
  const rows = games.map((r) => remainingRow(data, r));
  const later = rows.length > NEXT_SHOWN
    ? `<details><summary>Le altre ${rows.length - NEXT_SHOWN} gare</summary><ul>${rows.slice(NEXT_SHOWN).join("")}</ul></details>` : "";
  const avg = averagePosition === null ? "" : `<p class="note">Posizione media delle avversarie da affrontare: ${averagePosition.toFixed(1).replace(".", ",")}°.</p>`;
  return section("Prossime gare", `<ul>${rows.slice(0, NEXT_SHOWN).join("")}</ul>${later}${avg}`);
}

const CLOSE = '<p class="opp-close"><button type="button" class="btn" data-close>Chiudi</button></p>';

// Whole card for one opponent; "" when the team is unknown or is the followed club itself
export function renderOpponent(data, teamId) {
  const team = data.teams.find((t) => t.id === teamId);
  if (!team || teamId === feniceTeamId(data)) return "";
  return [headerHtml(data, team), headToHeadHtml(data, team), recordHtml(data, team), remainingHtml(data, team), CLOSE].join("");
}

// One delegated click listener: [data-opponent] opens the card, [data-close] closes it, and closing
// gives the focus back to the control that opened it. getData() returns the loaded data or null.
export function installOpponentDialog(root, dialog, body, getData) {
  let trigger = null;
  installCrestFallback(body);
  dialog.addEventListener("close", () => trigger?.focus());
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return dialog.close();
    const opener = e.target.closest("[data-opponent]"), data = getData();
    if (!opener || !data) return undefined;
    const html = renderOpponent(data, opener.dataset.opponent);
    if (!html) return undefined;
    trigger = opener;
    body.innerHTML = html;
    return dialog.showModal();
  });
}
