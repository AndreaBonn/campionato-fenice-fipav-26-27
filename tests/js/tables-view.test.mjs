import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderStandings } from "../../docs/tables-view.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const count = (html, needle) => html.split(needle).length - 1;
const rows = (html) => html.split("<tr").filter((r) => r.includes("<td"));

test("renders one body row per team with the club crest lazy-loaded at a fixed size", () => {
  const html = renderStandings(girone);
  assert.equal(rows(html).length, 6);
  assert.equal(count(html, 'loading="lazy" width="24" height="24"'), 6);
  assert.match(html, /<th scope="col">Pt<\/th>/);
});

test("highlights the Fenice row only, with a text marker besides the colour", () => {
  const html = renderStandings(girone);
  const fenice = rows(html).filter((r) => r.includes('class="me"'));
  assert.equal(fenice.length, 1);
  assert.match(fenice[0], /Asd Fenice/);
  assert.match(fenice[0], /la tua squadra/);
});

test("opponent names carry data-opponent with the team id and are not links or buttons", () => {
  const html = renderStandings(girone);
  assert.equal(count(html, 'data-opponent="232396"'), 1);
  assert.equal(count(html, "data-opponent="), 5);
  assert.equal(count(html, "<button"), 0);
  assert.equal(count(html, "<a "), 0);
});

test("shows the provisional tie-break note and no zone class while the formula is unpublished", () => {
  const html = renderStandings(girone);
  assert.match(html, /Criterio di parità provvisorio: vittorie, quoziente set, quoziente punti/);
  assert.equal(count(html, "zone-"), 0);
});

test("marks the promotion zone on the first row once the formula is published", () => {
  const data = { ...girone, formula: { published: true, promotion: 1, playoff: 0, relegation: 0 } };
  const r = rows(renderStandings(data));
  assert.match(r[0], /zone-promotion/);
  assert.doesNotMatch(r[1], /zone-/);
});

test("escapes team names and shows an empty ratio as a dash", () => {
  const data = structuredClone(girone);
  data.teams[1].name = "<b>X</b>";
  data.standings[0].set_ratio = null;
  const html = renderStandings(data);
  assert.equal(count(html, "<b>X"), 0);
  assert.match(html, /&lt;b&gt;/);
});

test("falls back to the table computed from the games when the file has no standings", () => {
  const data = { ...girone, standings: [] };
  assert.equal(rows(renderStandings(data)).length, 6);
});

test("returns nothing for a league without teams", () => {
  assert.equal(renderStandings({ ...girone, teams: [], standings: [], games: [] }), "");
});
