import assert from "node:assert/strict";
import { test } from "node:test";

import { esc } from "../../docs/html.js";

test("escape: null and undefined become an empty string, other values their text", () => {
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
  assert.equal(esc(`a&b<c>"d'e`), "a&amp;b&lt;c&gt;&quot;d&#39;e");
});

test("escape: an already escaped entity is escaped again, so the page shows what the data says", () => {
  assert.equal(esc("&amp;"), "&amp;amp;");
});
