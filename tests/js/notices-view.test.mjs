import assert from "node:assert/strict";
import { test } from "node:test";

import { renderNotices } from "../../docs/notices-view.js";

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
    assert.match(html, /Nessuna notizia del Comitato FIPAV Cagliari sulla Seconda Divisione per ora\./);
    assert.match(html, /href="https:\/\/fipavcagliari\.it"/);
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
