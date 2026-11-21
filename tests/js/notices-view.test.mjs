import assert from "node:assert/strict";
import { test } from "node:test";

import { NEW_NOTICE_DAYS, isNewNotice, newNoticesCount, noticeBadgeHtml, renderNotices } from "../../docs/notices-view.js";

const NOTICES = [
  { id: "1", title: "Indizione <b>Seconda</b> Divisione", url: "https://fipavcagliari.it/indizione-2027/", date: "2026-09-05", kind: "indizione" },
  { id: "2", title: "Gironi Seconda Divisione", url: "https://fipavcagliari.it/gironi/", date: "2026-10-12", kind: "seconda-divisione" },
];

test("notices: date in Italian, linked title opening in a new tab, kind label", () => {
  const html = renderNotices({ notices: NOTICES });
  assert.match(html, /5 settembre 2026/);
  assert.match(html, /12 ottobre 2026/);
  assert.match(html, /href="https:\/\/fipavcagliari\.it\/gironi\/" target="_blank" rel="noopener"/);
  assert.match(html, /\(si apre in una nuova scheda\)/);
  assert.match(html, /Indizione<\/span>/);
  assert.match(html, /Seconda Divisione<\/span>/);
  assert.equal(html.split("<li").length - 1, 2);
});

test("notices: titles are escaped", () => {
  const html = renderNotices({ notices: NOTICES });
  assert.match(html, /Indizione &lt;b&gt;Seconda&lt;\/b&gt; Divisione/);
  assert.equal(html.includes("<b>Seconda"), false);
});

test("notices: empty list gives an explicit state with a link to the committee site", () => {
  for (const data of [{ notices: [] }, {}]) {
    const html = renderNotices(data);
    assert.match(html, /<p class="note">Ancora nessuna notizia sulla Seconda Divisione\. <a href="https:\/\/fipavcagliari\.it" target="_blank" rel="noopener">Sito del Comitato FIPAV Cagliari<span class="sr-only"> \(si apre in una nuova scheda\)<\/span><\/a><\/p>/);
    assert.equal(html.includes("<strong"), false);
    assert.equal(html.includes("<li"), false);
  }
});

test("notices: an unknown or missing kind shows no tag, a known kind shows one", () => {
  const html = renderNotices({ notices: [
    { id: "1", title: "Una", url: "https://fipavcagliari.it/a/", date: "2026-09-05", kind: "altro" },
    { id: "2", title: "Due", url: "https://fipavcagliari.it/b/", date: "2026-09-06" },
    { id: "3", title: "Tre", url: "https://fipavcagliari.it/c/", date: "2026-09-07", kind: "indizione" },
  ] });
  assert.equal(html.split("<li").length - 1, 3);
  assert.equal(html.split('<span class="tag">').length - 1, 1);
  assert.match(html, /<time datetime="2026-09-07">7 settembre 2026<\/time> <span class="tag">Indizione<\/span>/);
  assert.match(html, /<time datetime="2026-09-05">5 settembre 2026<\/time><\/p>/);
  assert.match(html, /<time datetime="2026-09-06">6 settembre 2026<\/time><\/p>/);
});

const NOW = new Date("2026-11-21T10:00:00Z");

test("isNewNotice: dated within the last 7 days of now, by calendar day, never in the future", () => {
  assert.equal(NEW_NOTICE_DAYS, 7);
  assert.equal(isNewNotice({ date: "2026-11-21" }, NOW), true);
  assert.equal(isNewNotice({ date: "2026-11-14" }, NOW), true);
  assert.equal(isNewNotice({ date: "2026-11-13" }, NOW), false);
  assert.equal(isNewNotice({ date: "2026-11-22" }, NOW), false);
  assert.equal(isNewNotice({ date: "2026-11-21" }, new Date("2026-11-28T10:00:00Z")), true);
  assert.equal(isNewNotice({ date: "2026-11-21" }, new Date("2026-11-29T10:00:00Z")), false);
});

test("renderNotices: «Nuova» badge only on the recent notice", () => {
  const html = renderNotices({ notices: [
    { id: "1", title: "Vecchia", url: "https://fipavcagliari.it/a/", date: "2026-09-05", kind: "indizione" },
    { id: "2", title: "Recente", url: "https://fipavcagliari.it/b/", date: "2026-11-19", kind: "seconda-divisione" },
  ] }, NOW);
  assert.equal(html.split('<span class="tag newb">Nuova</span>').length - 1, 1);
  assert.match(html.split("<li")[2], /newb/);
  assert.doesNotMatch(html.split("<li")[1], /newb/);
  assert.equal(renderNotices({ notices: NOTICES }, NOW).includes("newb"), false);
});

test("newNoticesCount and noticeBadgeHtml: the count, and a badge a screen reader reads as «, 1 nuova»", () => {
  const data = { notices: [{ date: "2026-11-20" }, { date: "2026-11-21" }, { date: "2026-01-01" }] };
  assert.equal(newNoticesCount(data, NOW), 2);
  assert.equal(newNoticesCount({}, NOW), 0);
  assert.equal(noticeBadgeHtml(0), "");
  assert.equal(noticeBadgeHtml(1), '<span class="sr-only">, </span><span aria-hidden="true">1</span><span class="sr-only">1 nuova</span>');
  assert.match(noticeBadgeHtml(3), /3 nuove/);
});

test("a notice url with quotes cannot leave the href attribute", () => {
  const html = renderNotices({ notices: [{ ...NOTICES[0], url: 'https://fipavcagliari.it/a" onclick="x' }] }, new Date("2026-11-21T10:00:00Z"));
  assert.match(html, /href="https:\/\/fipavcagliari\.it\/a&quot; onclick=&quot;x"/);
  assert.doesNotMatch(html, /onclick="x/);
});

test("the age of a notice is counted in Rome days: after midnight in Rome the eighth day has begun", () => {
  const notice = { ...NOTICES[0], date: "2026-11-21" };
  // 23:30 UTC on the 28th is already the 29th in Rome: 8 days, no longer new
  assert.equal(isNewNotice(notice, new Date("2026-11-28T23:30:00Z")), false);
  assert.equal(isNewNotice(notice, new Date("2026-11-28T22:30:00Z")), true);
});
