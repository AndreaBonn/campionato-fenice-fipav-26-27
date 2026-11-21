import assert from "node:assert/strict";
import { test } from "node:test";

import { crestFallbackHtml, crestHtml, installCrestFallback } from "../../docs/crest-view.js";

test("crest fallback is a same-size initials badge, aria-hidden, escaped", () => {
  const html = crestFallbackHtml("ASD FENICE");
  assert.match(html, /^<span class="crest-fallback" aria-hidden="true">AF<\/span>$/);
  assert.equal(crestFallbackHtml("<b>x"), '<span class="crest-fallback" aria-hidden="true">B</span>');
});

test("a failed crest image is replaced by the initials; other errors are ignored", () => {
  const listeners = [];
  const root = { addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }) };
  installCrestFallback(root);
  assert.deepEqual(listeners.map((l) => [l.type, l.capture]), [["error", true]]);
  const calls = [];
  const img = { tagName: "IMG", dataset: { crestName: "ASD FENICE" }, insertAdjacentHTML: (...a) => calls.push(a), remove: () => calls.push("removed") };
  listeners[0].fn({ target: img });
  assert.deepEqual(calls, [["afterend", crestFallbackHtml("ASD FENICE")], "removed"]);
  const other = { tagName: "SCRIPT", dataset: {}, insertAdjacentHTML: () => assert.fail("touched"), remove: () => assert.fail("touched") };
  listeners[0].fn({ target: other });
});

test("crest errors ignore images without names and named non-images", () => {
  let listener;
  installCrestFallback({ addEventListener: (_, fn) => { listener = fn; } });
  const calls = [];
  const target = (tagName, dataset) => ({ tagName, dataset, insertAdjacentHTML: () => calls.push("insert"), remove: () => calls.push("remove") });
  listener({ target: target("IMG", {}) });
  listener({ target: target("DIV", { crestName: "Fenice" }) });
  assert.deepEqual(calls, []);
  listener({ target: target("IMG", { crestName: "Fenice" }) });
  assert.deepEqual(calls, ["insert", "remove"]);
});

test("crest image: the logo at the size asked, with the team name for the fallback; lazy only when asked", () => {
  const team = { name: "G.S. AQUILA", logo_url: "https://app.fipavonline.it/l.jpg" };
  assert.equal(crestHtml(team, 34), '<img src="https://app.fipavonline.it/l.jpg" alt="" data-crest-name="G.S. AQUILA" width="34" height="34">');
  assert.equal(crestHtml(team, 24, { lazy: true }), '<img src="https://app.fipavonline.it/l.jpg" alt="" data-crest-name="G.S. AQUILA" loading="lazy" width="24" height="24">');
});

test("crest image: a team without a logo gets the initials badge, null and empty alike", () => {
  for (const logo_url of [null, ""]) assert.equal(crestHtml({ name: "ASD FENICE", logo_url }, 40), crestFallbackHtml("ASD FENICE"));
});
