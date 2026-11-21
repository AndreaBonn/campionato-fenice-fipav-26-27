// HTML of the standings section as a string. No DOM access: everything comes in as arguments.
import { feniceTeamId } from "./game-rules.js";
import { tableFromGames } from "./standings-rules.js";
import { displayTeamName, teamInitials } from "./view-rules.js";
import { esc } from "./games-view.js";

const CREST_SIZE = 24;
const NO_VALUE = "-";
const TIE_BREAK_LABELS = { wins: "vittorie", set_ratio: "quoziente set", point_ratio: "quoziente punti" };

const ratioText = (v) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : NO_VALUE);

// Zone class of a row from the published formula; nothing while the formula is not published
function zoneClass(formula, pos, total) {
  if (!formula.published) return "";
  if (pos <= formula.promotion) return "zone-promotion";
  if (pos <= formula.promotion + formula.playoff) return "zone-playoff";
  if (pos > total - formula.relegation) return "zone-relegation";
  return "";
}

// Initials badge shown in place of a crest image that did not load (e.g. a 403 or a blocked response)
export const crestFallbackHtml = (name) => `<span class="crest-fallback" aria-hidden="true">${esc(teamInitials(name))}</span>`;

// Image error events do not bubble: one capturing listener on the container covers every crest
export function installCrestFallback(root) {
  root.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.crestName === undefined) return;
    img.insertAdjacentHTML("afterend", crestFallbackHtml(img.dataset.crestName));
    img.remove();
  }, true);
}

function teamCell(team, isMe) {
  const crest = team.logo_url ? `<img src="${esc(team.logo_url)}" alt="" data-crest-name="${esc(team.name)}" loading="lazy" width="${CREST_SIZE}" height="${CREST_SIZE}">` : "";
  const name = esc(displayTeamName(team.name));
  const label = isMe ? `${name}<span class="sr-only"> (la tua squadra)</span>` : `<span class="team" data-opponent="${esc(team.id)}">${name}</span>`;
  return `<td class="name">${crest}${label}</td>`;
}

function rowHtml(row, team, ctx) {
  const isMe = row.team_id === ctx.meId;
  const classes = [isMe ? "me" : "", zoneClass(ctx.formula, row.pos, ctx.total)].filter(Boolean);
  const cls = classes.length ? ` class="${classes.join(" ")}"` : "";
  return `<tr${cls}>` +
    `<td>${esc(row.pos)}</td>${teamCell(team, isMe)}<td>${esc(row.played)}</td><td><b>${esc(row.points)}</b></td>` +
    `<td>${esc(row.won)}</td><td>${esc(row.lost)}</td><td>${esc(row.sets_won)}-${esc(row.sets_lost)}</td>` +
    `<td>${ratioText(row.set_ratio)}</td><td>${ratioText(row.point_ratio)}</td></tr>`;
}

const HEAD = '<tr><th scope="col">Pos</th><th scope="col">Squadra</th><th scope="col">G</th><th scope="col">Pt</th><th scope="col">V</th><th scope="col">P</th>' +
  '<th scope="col">Set</th><th scope="col">Q. set</th><th scope="col">Q. punti</th></tr>';

const tieBreakNote = (tb) => (tb.provisional ? `<p class="note">Criterio di parità provvisorio: ${tb.criteria.map((c) => TIE_BREAK_LABELS[c] ?? c).join(", ")}</p>` : "");

export function renderStandings(data) {
  const table = data.standings.length ? data.standings : tableFromGames(data.games, data.teams);
  if (!table.length) return "";
  const byId = new Map(data.teams.map((t) => [t.id, t]));
  const ctx = { meId: feniceTeamId(data), formula: data.formula, total: table.length };
  const body = table.filter((r) => byId.has(r.team_id)).map((r) => rowHtml(r, byId.get(r.team_id), ctx)).join("");
  return `<div class="table-wrap" role="region" aria-label="Classifica, scorri in orizzontale per vedere tutte le colonne" tabindex="0">` +
    `<table class="standings"><caption class="sr-only">Classifica del girone</caption><thead>${HEAD}</thead><tbody>${body}</tbody></table></div>${tieBreakNote(data.tie_break)}`;
}
