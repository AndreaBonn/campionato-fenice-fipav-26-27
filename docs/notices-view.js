// HTML of the committee notices section. No DOM access, everything comes in as arguments.
import { esc } from "./games-view.js";
import { TIME_ZONE } from "./view-rules.js";

const COMMITTEE_URL = "https://fipavcagliari.it";
const KIND_LABELS = { indizione: "Indizione", "seconda-divisione": "Seconda Divisione" };
const EMPTY_TEXT = "Nessuna notizia del Comitato FIPAV Cagliari sulla Seconda Divisione per ora.";

const dateText = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });

function noticeHtml(n) {
  const kind = KIND_LABELS[n.kind] ?? "";
  return `<li class="notice"><p class="meta"><time datetime="${esc(n.date)}">${esc(dateText(n.date))}</time>${kind ? ` <span class="tag">${esc(kind)}</span>` : ""}</p>
<p class="opp"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}<span class="sr-only"> (si apre in una nuova scheda)</span></a></p></li>`;
}

export function renderNotices(data) {
  const notices = data.notices ?? [];
  if (!notices.length) {
    return `<p class="state"><strong>${esc(EMPTY_TEXT)}</strong><a href="${COMMITTEE_URL}" target="_blank" rel="noopener">Vai al sito del Comitato<span class="sr-only"> (si apre in una nuova scheda)</span></a></p>`;
  }
  return `<ul class="notices">${notices.map(noticeHtml).join("")}</ul>`;
}
