// HTML of the standings section as a string. No DOM access: everything comes in as arguments.
import { feniceTeamId } from "./game-rules.js";
import { tableFromGames } from "./standings-rules.js";
import { OUTCOME_LETTERS, displayTeamName } from "./view-rules.js";
import { crestHtml } from "./crest-view.js";
import { esc } from "./html.js";
import { decidedFacts, positionRanges } from "./standings-math.js";
import { howToRead, lastFive, preseasonNote } from "./standings-notes.js";

const CREST_SIZE = 24;
const NO_VALUE = "-";

const ratioText = (v) => (Number.isFinite(v) ? v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : NO_VALUE);

// Zone class of a row from the published formula; nothing while the formula is not published
function zoneClass(formula, pos, total) {
  if (!formula.published) return "";
  if (pos <= formula.promotion) return "zone-promotion";
  if (pos <= formula.promotion + formula.playoff) return "zone-playoff";
  if (pos > total - formula.relegation) return "zone-relegation";
  return "";
}

function teamCell(team, isMe) {
  const crest = crestHtml(team, CREST_SIZE, { lazy: true });
  const name = esc(displayTeamName(team.name));
  const label = isMe ? `<span>${name}<span class="sr-only"> (la tua squadra)</span></span>` : `<button type="button" class="team" data-opponent="${esc(team.id)}">${name}</button>`;
  return `<td class="name"><span class="nm">${crest}${label}</span></td>`;
}

// "1°-3°", or "2°" when the position is settled
const rangeText = ({ best, worst }) => (best === worst ? `${best}°` : `${best}°-${worst}°`);

// The column and the block are worth showing only once some range is narrower than first-to-last
const hasNarrowRange = (ranges) => [...ranges.values()].some(({ best, worst }) => best > 1 || worst < ranges.size);

const ZONE_LABELS = [["promotion", "promozione"], ["playoff", "playoff"], ["relegation", "retrocessione"]];

function factText(fact, name) {
  const parts = [];
  if (fact.position !== null) parts.push(`${fact.position}° posto`);
  for (const [key, label] of ZONE_LABELS) if (fact[key] === true) parts.push(label);
  return `<li><b>${esc(name)}</b>: ${esc(parts.join(", "))}</li>`;
}

function decidedBlock(ranges, formula, byId) {
  const items = decidedFacts(ranges, formula).filter((f) => byId.has(f.team_id))
    .map((f) => factText(f, displayTeamName(byId.get(f.team_id).name)));
  return items.length ? `<div class="decided"><h3>Già deciso</h3><ul>${items.join("")}</ul></div>` : "";
}

// Last five games of the row's team as coloured V/P letters, oldest first; a dash when it has not played
function formCell(teamId, games) {
  const letters = lastFive(games, teamId).map((o) => `<span class="l5 ${o}">${OUTCOME_LETTERS[o]}</span>`);
  return `<td class="c-x">${letters.length ? letters.join("") : NO_VALUE}</td>`;
}

function rowHtml(row, team, ctx) {
  const isMe = row.team_id === ctx.meId;
  const classes = [isMe ? "me" : "", zoneClass(ctx.formula, row.pos, ctx.total)].filter(Boolean);
  const cls = classes.length ? ` class="${classes.join(" ")}"` : "";
  const possible = ctx.ranges ? `<td class="c-x">${rangeText(ctx.ranges.get(row.team_id))}</td>` : "";
  return `<tr${cls}>` +
    `<td>${esc(row.pos)}</td>${teamCell(team, isMe)}<td><b>${esc(row.points)}</b></td><td>${esc(row.played)}</td>` +
    `<td>${esc(row.won)}</td><td>${esc(row.lost)}</td><td class="c-x">${esc(row.sets_won)}-${esc(row.sets_lost)}</td>` +
    `<td class="c-x">${ratioText(row.set_ratio)}</td><td class="c-x">${ratioText(row.point_ratio)}</td>${possible}${formCell(row.team_id, ctx.games)}</tr>`;
}

const EXTRA_HEAD = (label) => `<th scope="col" class="c-x">${label}</th>`;
const HEAD = ["Pos", "Squadra", "Pt", "G", "V", "P"].map((l) => `<th scope="col">${l}</th>`).join("") +
  ["Set", "Q. set", "Q. punti"].map(EXTRA_HEAD).join("");

// "Come leggere la classifica", closed by default; the tie-break sentence closes it
function howToHtml(data, showPossible) {
  const { items, tieBreak } = howToRead({ tieBreak: data.tie_break, showPossible });
  const terms = items.map((i) => `<dt>${esc(i.term)}</dt><dd>${esc(i.text)}</dd>`).join("");
  return `<details class="howto"><summary>Come leggere la classifica</summary><dl>${terms}</dl><p class="note">${esc(tieBreak)}</p></details>`;
}

export function renderStandings(data) {
  const table = data.standings.length ? data.standings : tableFromGames(data.games, data.teams);
  if (!table.length) return "";
  const byId = new Map(data.teams.map((t) => [t.id, t]));
  const allRanges = positionRanges(data);
  const ranges = hasNarrowRange(allRanges) ? allRanges : null;
  const ctx = { meId: feniceTeamId(data), formula: data.formula, total: table.length, ranges, games: data.games };
  const body = table.filter((r) => byId.has(r.team_id)).map((r) => rowHtml(r, byId.get(r.team_id), ctx)).join("");
  const pre = preseasonNote(table, data.games);
  const intro = `${pre ? `<p class="preseason">${esc(pre)}</p>` : ""}<p class="note tap-hint">Tocca una squadra per vedere la sua scheda.</p>`;
  const head = `${HEAD}${ranges ? EXTRA_HEAD("Poss.") : ""}${EXTRA_HEAD("Ultime 5")}`;
  return `${intro}<div class="table-wrap" role="region" aria-label="Classifica del girone" tabindex="0">` +
    `<table class="standings"><caption class="sr-only">Classifica del girone</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    `${ranges ? decidedBlock(ranges, data.formula, byId) : ""}${howToHtml(data, ranges !== null)}`;
}
