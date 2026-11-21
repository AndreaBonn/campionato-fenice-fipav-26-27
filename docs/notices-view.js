// HTML of the committee notices section. No DOM access, everything comes in as arguments.
import { esc } from "./html.js";
import { TIME_ZONE } from "./view-rules.js";

const KIND_LABELS = { indizione: "Indizione", "seconda-divisione": "Seconda Divisione" };
export const NEW_NOTICE_DAYS = 7;
const DAY_MS = 24 * 60 * 60e3;

const dateText = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });

// Calendar day of an instant in the club's time zone, "2026-11-21"
const dayOf = (date) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

// A notice dated within the last NEW_NOTICE_DAYS days of now, by calendar day; a future date is not new
export function isNewNotice(notice, now) {
  const age = (Date.parse(dayOf(now)) - Date.parse(notice.date)) / DAY_MS;
  return age >= 0 && age <= NEW_NOTICE_DAYS;
}

export const newNoticesCount = (data, now) => (data.notices ?? []).filter((n) => isNewNotice(n, now)).length;

// Content of the nav badge: the number for the eye, "1 nuova" for a screen reader after the link text "Notizie"
export function noticeBadgeHtml(count) {
  if (!count) return "";
  return `<span class="sr-only">, </span><span aria-hidden="true">${count}</span><span class="sr-only">${count} ${count === 1 ? "nuova" : "nuove"}</span>`;
}

function noticeHtml(n, now) {
  const kind = KIND_LABELS[n.kind] ?? "";
  const fresh = isNewNotice(n, now) ? ' <span class="tag newb">Nuova</span>' : "";
  return `<li class="notice"><p class="meta"><time datetime="${esc(n.date)}">${esc(dateText(n.date))}</time>${kind ? ` <span class="tag">${esc(kind)}</span>` : ""}${fresh}</p>
<p class="opp"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}<span class="sr-only"> (si apre in una nuova scheda)</span></a></p></li>`;
}

// No notices, no markup: the page hides the section and its nav link (the committee site is linked in the footer)
export function renderNotices(data, now = new Date()) {
  const notices = data.notices ?? [];
  if (!notices.length) return "";
  return `<ul class="notices">${notices.map((n) => noticeHtml(n, now)).join("")}</ul>`;
}
