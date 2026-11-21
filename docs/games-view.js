// HTML of the page sections as strings: hero, schedule and the load states. No DOM access here,
// everything comes in as arguments, so the output is tested with node --test.
import { FEED_HTTPS_URL, FEED_WEBCAL_URL, googleCalendarUrl, teamsById } from "./calendar-rules.js";
import { changeLabel, feniceGames, feniceTeamId, form, isHome, lastPlayed, mapUrl, nextGame, outcome, refereesLabel, scoreLabel, setScores } from "./game-rules.js";
import { countdownText, displayTeamName, relativeAge } from "./view-rules.js";

const TIME_ZONE = "Europe/Rome";
const HTTP_STATUS = /^HTTP (\d+)$/;

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
// Every string that comes from the data goes through here before it is put in markup
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const fmt = (iso, options) => new Date(iso).toLocaleDateString("it-IT", { ...options, timeZone: TIME_ZONE });
const longWhen = (g) => `${fmt(g.starts_at, { weekday: "long", day: "numeric", month: "long" })}, ${g.time ? `ore ${g.time}` : "orario da definire"}`;
const shortDay = (g) => fmt(g.starts_at, { weekday: "short", day: "numeric", month: "short" });
const shortWhen = (g) => (g.starts_at ? `${shortDay(g)}, ${g.time ? `ore ${g.time}` : "orario da definire"}` : "Data da definire");

const teamName = (data, id) => displayTeamName(data.teams.find((t) => t.id === id)?.name ?? "Squadra sconosciuta");
const side = (g, teamId) => (isHome(g, teamId) ? "In casa" : "In trasferta");
const sideTag = (g, teamId) => `<span class="tag ${isHome(g, teamId) ? "home" : "away"}">${side(g, teamId)}</span>`;
const opponentId = (g, teamId) => (isHome(g, teamId) ? g.away_id : g.home_id);

// "Pal. Ist. Euclide, Via Araolla, Selargius": the parts the venue has, in capitals only where due
const venueLine = (v) => [v.name, v.address, v.city].filter(Boolean).map(displayTeamName).map(esc).join(", ");

function venueHtml(g) {
  const url = mapUrl(g.venue);
  const link = url ? ` <a href="${esc(url)}" target="_blank" rel="noopener">Apri la mappa<span class="sr-only"> (si apre in una nuova scheda)</span></a>` : "";
  return `<p class="venue">${venueLine(g.venue)}${link}</p>`;
}

function stateHtml(title, text) {
  return `<p class="state"><strong>${esc(title)}</strong>${esc(text)}</p>`;
}

export function renderHero(data, now) {
  const teamId = feniceTeamId(data), games = feniceGames(data), g = nextGame(games, now);
  if (!games.length) return "";
  if (!g) {
    if (games.some((x) => !x.played && x.starts_at !== null)) return stateHtml("Risultato in aggiornamento", "L'ultima partita è finita da poco: il risultato apparirà appena la FIPAV lo pubblica.");
    const open = games.some((x) => !x.played && x.starts_at === null);
    return open
      ? stateHtml("Prossima partita da definire", "La FIPAV non ha ancora fissato data e ora delle gare che restano.")
      : stateHtml("Stagione regolare conclusa", "Non ci sono altre partite in calendario.");
  }
  const c = countdownText(g.starts_at, now);
  const live = g.live_url ? `<p class="live"><a href="${esc(g.live_url)}" target="_blank" rel="noopener">Segui la diretta</a></p>` : "";
  return `<p class="eyebrow">Prossima partita ${sideTag(g, teamId)}</p>
<p class="opp">${esc(teamName(data, opponentId(g, teamId)))}</p>
<p class="when">${esc(longWhen(g))}</p>
${venueHtml(g)}${live}
<p class="countdown">${c.lead ? `<span class="lead">${c.lead}</span>` : ""}<b>${esc(c.main)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</p>`;
}

function resultHtml(g, teamId) {
  const won = outcome(g, teamId) === "won";
  return `<div class="res"><b>${esc(scoreLabel(g, teamId))}</b><span class="verdict ${won ? "won" : "lost"}">${won ? "Vinta" : "Persa"}</span></div>`;
}

const refsHtml = (g) => (refereesLabel(g) ? `<p class="refs">${esc(refereesLabel(g))}</p>` : "");
const movedHtml = (g) => (changeLabel(g) ? `<p class="moved"><span class="tag moved-tag">Spostata</span> ${esc(changeLabel(g).replace("Spostata: ", ""))}</p>` : "");

function addToCalendarHtml(data, g, teamId) {
  const url = g.played ? null : googleCalendarUrl(g, teamsById(data));
  if (!url) return "";
  const who = esc(teamName(data, opponentId(g, teamId)));
  return `<p class="addcal"><a href="${esc(url)}" target="_blank" rel="noopener">Aggiungi a Google Calendar<span class="sr-only"> la partita contro ${who} (si apre in una nuova scheda)</span></a></p>`;
}

function rowHtml(data, g, teamId, isNext) {
  const score = scoreLabel(g, teamId), parts = setScores(g, teamId);
  const live = !g.played && g.live_url ? ` <a href="${esc(g.live_url)}" target="_blank" rel="noopener">Diretta</a>` : "";
  const right = score ? resultHtml(g, teamId) : `<div class="res"><span class="pending">Da giocare</span>${live}</div>`;
  return `<li class="game${isNext ? " next" : ""}"><p class="opp">${esc(teamName(data, opponentId(g, teamId)))} ${sideTag(g, teamId)}</p>
<p class="meta">${esc(shortWhen(g))} · ${venueLine(g.venue)}</p>${movedHtml(g)}${refsHtml(g)}${addToCalendarHtml(data, g, teamId)}${right}${parts.length ? `<p class="sets">Set: ${esc(parts.join(", "))}</p>` : ""}</li>`;
}

// Games grouped by round, in the file order; the next game stands out
export function renderSchedule(data, now) {
  const games = feniceGames(data);
  if (!games.length) return renderEmpty();
  const teamId = feniceTeamId(data), next = nextGame(games, now), rounds = new Map();
  for (const g of games) rounds.set(g.round, [...(rounds.get(g.round) ?? []), g]);
  return [...rounds].map(([round, list]) =>
    `<section class="round"><h3>Giornata ${esc(round)}</h3><ul>${list.map((g) => rowHtml(data, g, teamId, g === next)).join("")}</ul></section>`).join("");
}

// A failed load, in plain words: network down, server error, or a page opened as a local file
export function errorCause(err, protocol) {
  const status = HTTP_STATUS.exec(err?.message ?? "");
  if (status) return `Il server ha risposto con un errore (${status[1]}). Riprova tra poco.`;
  const local = protocol === "file:" ? " La pagina è aperta come file locale e il browser blocca la lettura dei dati: aprila dal sito pubblicato o con un server locale." : "";
  return err instanceof TypeError ? `Connessione non riuscita: controlla la rete e riprova.${local}` : `I dati ricevuti non sono leggibili. Riprova tra poco.${local}`;
}

const RETRY = '<button type="button" class="btn" id="retry">Riprova</button>';

export const renderError = (err, protocol) =>
  `<div class="state err"><strong>Impossibile caricare i dati delle partite.</strong>${esc(errorCause(err, protocol))}<br>${RETRY}</div>`;

export const renderEmpty = () =>
  `<div class="state"><strong>Calendario non ancora disponibile</strong>La FIPAV non ha ancora pubblicato le partite dell'Asd Fenice per questo girone.<br>${RETRY}</div>`;

export const renderLoading = () =>
  '<div class="state" role="status"><span class="sr-only">Caricamento dei dati in corso</span><div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div></div>';

export const renderChecked = (iso, now) => `Ultimo controllo su FIPAV Online: ${relativeAge(iso, now)}`;

const FORM_TEXT = { won: "V", lost: "P" };

// Last played game with its sets, plus the strip of the last five outcomes (letters, not only colours)
export function renderLastResult(data) {
  const teamId = feniceTeamId(data), games = feniceGames(data), g = lastPlayed(games);
  if (!g) return "";
  const parts = setScores(g, teamId), won = outcome(g, teamId) === "won";
  const strip = form(games, teamId).map((o) => `<li class="f ${o}">${FORM_TEXT[o]}</li>`).join("");
  return `<p class="eyebrow">Ultimo risultato</p>
<p class="opp">${esc(teamName(data, opponentId(g, teamId)))} ${sideTag(g, teamId)}</p>
<p class="when">${esc(shortWhen(g))}</p>
<p class="score"><b>${esc(scoreLabel(g, teamId))}</b> <span class="verdict ${won ? "won" : "lost"}">${won ? "Vinta" : "Persa"}</span></p>${parts.length ? `<p class="sets">Set: ${esc(parts.join(", "))}</p>` : ""}
<ol class="form" aria-label="Forma delle ultime partite, dalla più vecchia alla più recente. V vinta, P persa">${strip}</ol>`;
}

// Subscribe to the ICS feed (webcal) or download the file; nothing for a club without games
export const renderCalendarFeed = (data) => (!feniceGames(data).length ? "" :
  `<div class="feed"><h3>Aggiungi al calendario</h3><p>Tutte le partite della Fenice, con gli aggiornamenti di data e palestra.</p>
<p><a href="${FEED_WEBCAL_URL}">Iscriviti al calendario</a> <a href="${FEED_HTTPS_URL}" download>Scarica il file .ics</a></p></div>`);
