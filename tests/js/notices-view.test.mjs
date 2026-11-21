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
