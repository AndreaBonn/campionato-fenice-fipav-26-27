// Content and wiring of the opponent card, a native <dialog> opened with showModal().
// Imperative shell over opponent-rules.js and team-rules.js; the markup builders return strings.
import { feniceTeamId, gameStatus } from "./game-rules.js";
import { headToHead } from "./opponent-rules.js";
import { homeAwayRecord, remainingGames } from "./team-rules.js";
import { positionRanges } from "./standings-math.js";
import { TIME_ZONE, UNKNOWN_TEAM, displayTeamName, plural } from "./view-rules.js";
import { esc } from "./html.js";
import { crestHtml, installCrestFallback } from "./crest-view.js";

const NEXT_SHOWN = 5;
// team ids are FIPAV digits, but the selector must not break on anything else
const quoteAttr = (value) => String(value).replace(/["\\]/g, "\\$&");
const CREST_SIZE = 40;

const nameOf = (team) => esc(displayTeamName(team.name));
const section = (title, body) => `<section class="opp-section"><h3>${title}</h3>${body}</section>`;
const dayText = (g) => (g.starts_at
  ? new Date(g.starts_at).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE })
  : "Data da definire");

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
  return `<header class="opp-head">${crestHtml(team, CREST_SIZE)}<div><h2 id="opp-title">${nameOf(team)}</h2>${place}${rangeLine(data, team.id)}</div></header>`;
}

// Wording of a head-to-head game without a result, by its lifecycle status (gameStatus)
const PENDING_WORDS = { live: "in corso", awaiting: "risultato in arrivo" };
const pendingWord = (g, now) => PENDING_WORDS[gameStatus(g, now)] ?? "da giocare";

const box = (label, big, small) => `<div class="box"><small>${label}</small><b>${big}</b><small>${small}</small></div>`;
const srHeading = (title) => `<h3 class="sr-only">${title}</h3>`;

// "Andata: la Fenice in casa, ritorno: la Fenice in trasferta" when the two meet twice, by round; "" otherwise
function legsLine(games, meId) {
  if (games.length !== 2) return "";
  const [first, second] = [...games].sort((a, b) => a.round - b.round);
  const where = (g) => (g.home_id === meId ? "in casa" : "in trasferta");
  return `<small>Andata: la Fenice ${where(first)}, ritorno: la Fenice ${where(second)}</small>`;
}

// First box: scores of the played head-to-heads, else the day of the next one; the lines keep every detail
function headToHeadBox(data, team, now) {
  const meId = feniceTeamId(data);
  const h = headToHead(meId, team.id, data.games);
  const title = srHeading("Scontri diretti con la Fenice");
  if (!h.played.length && !h.upcoming.length) return `<section class="box">${title}<p>Nessuno scontro in calendario.</p></section>`;
  const played = h.played.map((p) => `<li>Giornata ${esc(p.game.round)}: <b>${esc(p.score)}</b> ${p.outcome === "won" ? "vinta" : "persa"} dalla Fenice${p.sets.length ? `<small> (${esc(p.sets.join(", "))})</small>` : ""}</li>`);
  const upcoming = h.upcoming.map((g) => `<li>Giornata ${esc(g.round)}: ${pendingWord(g, now)}, ${esc(dayText(g))}</li>`);
  const big = h.played.length ? h.played.map((p) => esc(p.score)).join(" · ") : esc(dayText(h.upcoming[0]));
  const legs = legsLine([...h.played.map((p) => p.game), ...h.upcoming], meId);
  return `<section class="box">${title}<small aria-hidden="true">Contro la Fenice</small><b>${big}</b><ul>${[...played, ...upcoming].join("")}</ul>${legs}</section>`;
}

function recordBox(label, r) {
  if (!r.played) return box(label, "-", "nessuna gara giocata");
  const big = `${r.won}-${r.lost}<span class="sr-only"> (${plural(r.won, "vinta", "vinte")}, ${plural(r.lost, "persa", "perse")})</span>`;
  return box(label, big, `set ${r.setsWon}-${r.setsLost}, punti ${r.pointsFor}-${r.pointsAgainst}`);
}

// The three boxes: against the Fenice, at home, away (headings stay for screen readers)
function boxesHtml(data, team, now) {
  const rec = homeAwayRecord(team.id, data.games);
  const record = `<div class="rec">${srHeading("Rendimento in casa e in trasferta")}${recordBox("In casa", rec.home)}${recordBox("In trasferta", rec.away)}</div>`;
  return `<div class="boxes">${headToHeadBox(data, team, now)}${record}</div>`;
}

function remainingRow(data, r) {
  const opp = data.teams.find((t) => t.id === r.opponentId);
  const place = r.opponentPos ? ` <small>(${r.opponentPos}°)</small>` : "";
  const tag = r.home ? '<span class="tag home">Casa</span>' : '<span class="tag away">Trasferta</span>';
  return `<li><span class="d">${esc(dayText(r.game))}</span><span>${opp ? nameOf(opp) : UNKNOWN_TEAM}${place}</span>${tag}</li>`;
}

const laterLabel = (n) => (n === 1 ? "L'altra gara" : `Le altre ${n} gare`);

function remainingHtml(data, team) {
  const { games, averagePosition } = remainingGames(team.id, data.games, data.standings);
  if (!games.length) return section("Prossime gare", "<p>Nessuna gara da giocare.</p>");
  const rows = games.map((r) => remainingRow(data, r));
  const later = rows.length > NEXT_SHOWN
    ? `<details><summary>${laterLabel(rows.length - NEXT_SHOWN)}</summary><ul class="orows">${rows.slice(NEXT_SHOWN).join("")}</ul></details>` : "";
  const avg = averagePosition === null ? "" : `<p class="note">Posizione media delle avversarie da affrontare: ${averagePosition.toFixed(1).replace(".", ",")}°.</p>`;
  return section("Prossime gare", `<ul class="orows">${rows.slice(0, NEXT_SHOWN).join("")}</ul>${later}${avg}`);
}

const X_CLOSE = '<button type="button" class="xclose" data-close aria-label="Chiudi">\u00d7</button>';
const CLOSE = '<p class="opp-close"><button type="button" class="btn" data-close>Chiudi</button></p>';

// Whole card for one opponent at the instant now; "" when the team is unknown or is the followed club itself
export function renderOpponent(data, teamId, now) {
  const team = data.teams.find((t) => t.id === teamId);
  if (!team || teamId === feniceTeamId(data)) return "";
  return [X_CLOSE, headerHtml(data, team), boxesHtml(data, team, now), remainingHtml(data, team), CLOSE].join("");
}

// One delegated click listener: [data-opponent] opens the card, [data-close] closes it, and closing
// gives the focus back to the control that opened it. getData() returns the loaded data or null, now() the clock.
export function installOpponentDialog(root, dialog, body, getData, now) {
  let trigger = null;
  installCrestFallback(body);
  // the clock can re-render the section that held the opener while the card is open: then its
  // replacement, the control of the same team, takes the focus back
  const focusTarget = () => (trigger?.isConnected ? trigger : root.querySelector(`[data-opponent="${quoteAttr(trigger.dataset.opponent)}"]`));
  dialog.addEventListener("close", () => trigger && focusTarget()?.focus());
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return dialog.close();
    const opener = e.target.closest("[data-opponent]"), data = getData();
    if (!opener || !data) return undefined;
    const html = renderOpponent(data, opener.dataset.opponent, now());
    if (!html) return undefined;
    trigger = opener;
    body.innerHTML = html;
    return dialog.showModal();
  });
}
