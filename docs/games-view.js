// HTML of the games sections as strings: hero, schedule, last result and calendar feed. No DOM access here,
// everything comes in as arguments, so the output is tested with node --test.
import { feedUrls, googleCalendarUrl, teamsById } from "./calendar-rules.js";
import { esc } from "./html.js";
import { crestHtml } from "./crest-view.js";
import { renderEmpty } from "./states-view.js";
import { changeDetail, feniceGames, feniceTeamId, gameStatus, isHome, lastPlayed, mapUrl, nextGame, outcome, refereesLabel, scoreLabel, setScores } from "./game-rules.js";
import { lastResultMeta, matchSides, matchTitle, opponentChipTexts, teamSummary } from "./hero-rules.js";
import { DEFAULT_FILTER, SIDE_OPTIONS, WHEN_OPTIONS, andataGame, effectiveFilter, emptyMessage, filterGames, groupByMonth, roundLabel, roundsPerHalf } from "./schedule-rules.js";
import { ICON_CALENDAR, ICON_MAP_PIN, ICON_SHARE } from "./icons.js";
import { OUTCOME_LETTERS, TIME_ZONE, countdownText, displayTeamName, teamNameOrUnknown } from "./view-rules.js";

const fmt = (iso, options) => new Date(iso).toLocaleDateString("it-IT", { ...options, timeZone: TIME_ZONE });
const longWhen = (g) => `${fmt(g.starts_at, { weekday: "long", day: "numeric", month: "long" })}, ${g.time ? `ore ${g.time}` : "orario da definire"}`;

const teamName = (data, id) => teamNameOrUnknown(data.teams.find((t) => t.id === id)?.name);
const side = (g, teamId) => (isHome(g, teamId) ? "In casa" : "In trasferta");
const sideTag = (g, teamId) => `<span class="tag ${isHome(g, teamId) ? "home" : "away"}">${side(g, teamId)}</span>`;
const opponentId = (g, teamId) => (isHome(g, teamId) ? g.away_id : g.home_id);

// "Pal. Ist. Euclide, Via Araolla, Selargius": the parts the venue has, in capitals only where due
const venueLine = (v) => [v.name, v.address, v.city].filter(Boolean).map(displayTeamName).map(esc).join(", ");

// Row meta: the venue name stands out, address and city come after it in a smaller muted voice
function rowVenueHtml(v) {
  const rest = [v.address, v.city].filter(Boolean).map(displayTeamName).map(esc).join(", ");
  return `<span class="vname">${esc(displayTeamName(v.name ?? ""))}</span>${rest ? `, <span class="vaddr">${rest}</span>` : ""}`;
}

const venueHtml = (g) => `<p class="venue">${venueLine(g.venue)}</p>`;

// The poster image, linked to the full size; width and height are the real ones so the page does not jump on load
function posterHtml(data, g) {
  const p = g.poster;
  if (!p) return "";
  const alt = `Locandina della gara ${teamName(data, g.home_id)} - ${teamName(data, g.away_id)}`;
  return `<p class="poster"><a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" width="${esc(p.width)}" height="${esc(p.height)}" loading="lazy" alt="${esc(alt)}"><span class="sr-only"> (si apre in una nuova scheda)</span></a></p>`;
}

function stateHtml(title, text) {
  return `<p class="state"><strong>${esc(title)}</strong>${esc(text)}</p>`;
}

const CREST_SIZE = 34;

// Crest of one side of the title: the local logo for the Fenice, the FIPAV image of the opponent
// (data-crest-name lets installCrestFallback swap in the initials when it does not load), nothing for an unknown team
function sideCrestHtml(data, side) {
  if (side.isFenice) return `<img src="logo-fenice.png" alt="" width="${CREST_SIZE}" height="${CREST_SIZE}">`;
  const team = data.teams.find((t) => t.id === side.id);
  return team ? crestHtml(team, CREST_SIZE) : "";
}

// Home side first; the dash is dropped on a narrow screen (the sides stack), so a screen reader gets "contro"
function matchHtml(data, g) {
  const sides = matchSides(data, g).map((s) => `<span class="tm">${sideCrestHtml(data, s)}<span class="nm">${esc(s.name)}</span></span>`);
  return `<p class="match">${sides.join('<span class="vs" aria-hidden="true">-</span><span class="sr-only"> contro </span>')}</p>`;
}

// The countdown, top right of the box: "tra" / "Domani" / "2 giorni" with the time under it
function countdownHtml(c) {
  return `<p class="cd-top">${c.lead ? `<span class="lead">${esc(c.lead)}</span>` : ""}<b>${esc(c.main)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</p>`;
}

// Letters, not only colours: the outcomes of a team's last games, oldest first
export const formListHtml = (outcomes, label) =>
  `<ol class="form" aria-label="${esc(label)}">${outcomes.map((o) => `<li class="f ${o}">${OUTCOME_LETTERS[o]}</li>`).join("")}</ol>`;

// "Avversaria": standing, record and last outcomes of the team the Fenice plays next
function opponentLineHtml(data, oppId) {
  const summary = teamSummary(data, oppId);
  const chips = opponentChipTexts(summary).map((t) => `<span class="chipx">${esc(t)}</span>`).join(" ");
  const recent = summary.form.length ? formListHtml(summary.form, "Ultime partite dell'avversaria, dalla più vecchia alla più recente. V vinta, P persa") : "";
  return `<div class="opprow"><b>Avversaria</b> ${chips}${recent}</div>`;
}

const newTab = '<span class="sr-only"> (si apre in una nuova scheda)</span>';

// Primary actions (directions, calendar) and secondary ones (share, opponent card) of the next game
function actionsHtml(data, g, oppId, now, pageUrl) {
  const map = mapUrl(g.venue);
  const calendar = gameStatus(g, now) === "upcoming" ? googleCalendarUrl(g, teamsById(data), pageUrl) : null;
  const link = (url, icon, label) => `<a class="ab" href="${esc(url)}" target="_blank" rel="noopener">${icon}${label}${newTab}</a>`;
  const parts = [
    map ? link(map, ICON_MAP_PIN, "Indicazioni") : "",
    calendar ? link(calendar, ICON_CALENDAR, "Calendario") : "",
    `<button type="button" class="ab sec" data-share>${ICON_SHARE}Condividi</button>`,
    data.teams.some((t) => t.id === oppId) ? `<button type="button" class="ab sec" data-opponent="${esc(oppId)}">Scheda avversaria<span class="sr-only"> di ${esc(teamName(data, oppId))}</span></button>` : "",
  ];
  return `<div class="acts">${parts.join("")}</div>`;
}

// pageUrl: location.href, for the link back to the page in the calendar entry
export function renderHero(data, now, pageUrl = globalThis.location?.href) {
  const teamId = feniceTeamId(data), games = feniceGames(data), g = nextGame(games, now);
  if (!games.length) return "";
  if (!g) {
    if (games.some((x) => gameStatus(x, now) === "awaiting")) return stateHtml("Risultato in aggiornamento", "Il risultato dell'ultima partita giocata apparirà appena la FIPAV lo pubblica.");
    const open = games.some((x) => gameStatus(x, now) === "unscheduled");
    return open
      ? stateHtml("Prossima partita da definire", "La FIPAV non ha ancora fissato data e ora delle gare che restano.")
      : stateHtml("Stagione regolare conclusa", "Non ci sono altre partite in calendario.");
  }
  const oppId = opponentId(g, teamId);
  const live = g.live_url ? `<p class="live"><a href="${esc(g.live_url)}" target="_blank" rel="noopener">Segui la diretta</a></p>` : "";
  return `<div class="hero-top">
<p class="eyebrow">Prossima partita ${sideTag(g, teamId)}</p>
${countdownHtml(countdownText(g.starts_at, now))}
${matchHtml(data, g)}
<p class="when">${esc(longWhen(g))}</p>
${venueHtml(g)}
${opponentLineHtml(data, oppId)}
</div>
${actionsHtml(data, g, oppId, now, pageUrl)}
${live}${posterHtml(data, g)}`;
}

// Chip and large score beside the row; the sets go under the body (setsLineHtml), none for a forfeit
function resultHtml(g, teamId) {
  const won = outcome(g, teamId) === "won";
  return `<div class="res"><span class="vchip ${won ? "won" : "lost"}">${won ? "Vinta" : "Persa"}</span> <b class="score">${esc(scoreLabel(g, teamId))}</b></div>`;
}

const setsLineHtml = (g, teamId) => {
  const parts = setScores(g, teamId);
  return parts.length ? `<p class="sets">Set: ${esc(parts.join(", "))}</p>` : "";
};

// "Arbitro da designare" only says something on the next game; the other rows show names when there are some
const refsText = (g, isNext) => (isNext ? refereesLabel(g) : g.referees.length ? refereesLabel(g) : null);
const refsHtml = (g, isNext) => (refsText(g, isNext) ? `<p class="refs">${esc(refsText(g, isNext))}</p>` : "");
const movedHtml = (g) => (changeDetail(g) ? `<p class="moved"><span class="tag moved-tag">Spostata</span> ${esc(changeDetail(g))}</p>` : "");

// Map (not for a played game) and Google Calendar (only for a game still to come: after the whistle it would
// add a past event) as compact buttons; the hidden text names the opponent
function miniButtonsHtml(data, g, teamId, now, pageUrl) {
  const map = gameStatus(g, now) === "played" ? null : mapUrl(g.venue);
  const calendar = gameStatus(g, now) === "upcoming" ? googleCalendarUrl(g, teamsById(data), pageUrl) : null;
  const who = esc(teamName(data, opponentId(g, teamId)));
  const mini = (url, icon, label, what) => `<a class="mini" href="${esc(url)}" target="_blank" rel="noopener">${icon}${label}<span class="sr-only"> ${what} contro ${who} (si apre in una nuova scheda)</span></a>`;
  const buttons = [map ? mini(map, ICON_MAP_PIN, "Mappa", "per la partita") : "", calendar ? mini(calendar, ICON_CALENDAR, "Calendario", "la partita") : ""].join("");
  return buttons ? `<p class="minis">${buttons}</p>` : "";
}

// Label of a game that is under way or waiting for its result; upcoming and unscheduled games carry none
const PENDING_LABELS = { live: "In corso", awaiting: "Risultato in arrivo" };

function pendingHtml(g, now) {
  const label = PENDING_LABELS[gameStatus(g, now)];
  // kept on every status: the live score page can show the final score before FIPAV publishes it
  const live = g.live_url ? `${label ? " " : ""}<a href="${esc(g.live_url)}" target="_blank" rel="noopener">Diretta</a>` : "";
  return label || live ? `<div class="res">${label ? `<span class="pending">${label}</span>` : ""}${live}</div>` : "";
}

// Left column: weekday, day number and time; "da definire" for a game without a start
function dateColumnHtml(g) {
  if (!g.starts_at) return '<div class="dcol"><span class="tbd">da definire</span></div>';
  const part = (options) => fmt(g.starts_at, options).replace(/\.$/, "");
  const time = g.time ? `<span class="hm">${esc(g.time)}</span>` : '<span class="hm tbd">orario da definire</span>';
  return `<div class="dcol"><span class="wd">${esc(part({ weekday: "short" }))}</span> <b>${esc(part({ day: "numeric" }))}</b> ${time}</div>`;
}

// Ritorno rows: the score of the andata against the same opponent, home side first as it was written
function andataHtml(data, g, ctx) {
  const first = andataGame(g, ctx.mine, ctx.half, ctx.teamId);
  if (!first) return "";
  return `<p class="andata">All'andata: ${esc(matchTitle(data, first))} ${esc(first.sets_won.join("-"))}</p>`;
}

const nextTagHtml = '<span class="tag nexttag">Prossima</span> ';

function rowHtml(g, ctx) {
  const { data, teamId, now, pageUrl } = ctx, score = scoreLabel(g, teamId), isNext = g === ctx.next;
  const right = score ? resultHtml(g, teamId) : pendingHtml(g, now);
  const body = `<p class="rlabel">${esc(roundLabel(g.round, ctx.half))}</p>
<p class="opp">${isNext ? nextTagHtml : ""}${esc(teamName(data, opponentId(g, teamId)))} ${sideTag(g, teamId)}</p>
<p class="meta">${rowVenueHtml(g.venue)}</p>${andataHtml(data, g, ctx)}${movedHtml(g)}${refsHtml(g, isNext)}${posterHtml(data, g)}${miniButtonsHtml(data, g, teamId, now, pageUrl)}${score ? setsLineHtml(g, teamId) : ""}`;
  return `<li class="game ${isHome(g, teamId) ? "home" : "away"}${isNext ? " next" : ""}">${dateColumnHtml(g)}<div class="gbody">${body}</div>${right}</li>`;
}

const pressed = (current, value) => (current === value ? "true" : "false");
const segmentHtml = (group, label, options, current) =>
  `<div class="seg2" role="group" aria-label="${label}">${options.map(([value, text]) => `<button type="button" data-filter="${group}" data-value="${value}" aria-pressed="${pressed(current, value)}">${text}</button>`).join("")}</div>`;

// Two groups of buttons above the list: which games, and home or away
const filtersHtml = (filter) =>
  `<div class="filters">${segmentHtml("when", "Quali partite", WHEN_OPTIONS, filter.when)}${segmentHtml("side", "Casa o trasferta", SIDE_OPTIONS, filter.side)}</div>`;

const emptyFilteredHtml = (filter) =>
  `<div class="state"><strong>${esc(emptyMessage(filter))}</strong>Cambia i filtri per vedere le altre partite.<br><button type="button" class="btn" data-filter-reset>Mostra tutte</button></div>`;

// Games grouped by month of the kickoff, in date order, after the filters; the next game stands out.
// filter: { when, side } from schedule-rules.js; pageUrl: location.href, for the link back to the page in the calendar entry
export function renderSchedule(data, now, pageUrl = globalThis.location?.href, filter = DEFAULT_FILTER) {
  const mine = feniceGames(data);
  if (!mine.length) return renderEmpty();
  const teamId = feniceTeamId(data), chosen = effectiveFilter(filter, mine, now), shown = filterGames(mine, chosen, teamId, now);
  const ctx = { data, teamId, now, pageUrl, mine, next: nextGame(mine, now), half: roundsPerHalf(data) };
  const groups = groupByMonth(shown).map(({ label, games }) =>
    `<section class="round"><h3 class="month">${esc(label)}</h3><ul>${games.map((g) => rowHtml(g, ctx)).join("")}</ul></section>`);
  return filtersHtml(chosen) + (groups.length ? groups.join("") : emptyFilteredHtml(chosen));
}

// Last played game as one compact row: verdict chip, where it sits in the season, the two sides home first,
// the sets, and the score on the right. The form strip lives in the "Andamento" section (analysis-view.js)
export function renderLastResult(data) {
  const teamId = feniceTeamId(data), g = lastPlayed(feniceGames(data));
  if (!g) return "";
  const parts = setScores(g, teamId), won = outcome(g, teamId) === "won", cls = won ? "won" : "lost";
  const title = matchTitle(data, g);
  return `<div class="resbox ${cls}"><span class="vchip ${cls}">${won ? "Vinta" : "Persa"}</span>
<div><p class="small">Ultimo risultato · ${esc(lastResultMeta(g, teamId))}</p><p class="teams"><b>${esc(title)}</b></p>${parts.length ? `<p class="small">Set: ${esc(parts.join(", "))}</p>` : ""}</div>
<p class="big">${esc(scoreLabel(g, teamId))}</p></div>`;
}

// Subscribe to the ICS feed (webcal) or download the file; nothing for a club without games or an unknown page url
export function renderCalendarFeed(data, pageUrl = globalThis.location?.href) {
  const feed = feedUrls(pageUrl);
  if (!feniceGames(data).length || !feed) return "";
  return `<div class="feed"><h3>Tutte le partite nel calendario del telefono</h3><p>Ti iscrivi una volta: date, orari e palestre si aggiornano da soli se la FIPAV sposta una partita.</p>
<p class="acts"><a class="ab" href="${esc(feed.webcal)}">${ICON_CALENDAR}Aggiungi al calendario del telefono</a><a class="ab sec" href="${esc(feed.https)}" download>Scarica il file</a></p></div>`;
}
