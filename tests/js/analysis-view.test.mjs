import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderAnalysis } from "../../docs/analysis-view.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const girone = load("data-64353.json");

test("before the first played game the section says the analysis will come", () => {
  const data = structuredClone(girone);
  data.games = data.games.map((g) => ({ ...g, played: false, sets_won: null, sets: [] }));
  const html = renderAnalysis(data);
  assert.match(html, /L'analisi comparirà dopo la prima partita/);
  assert.doesNotMatch(html, /Set vinti/);
});

test("with played games it shows sets, mean points, tie-break, comebacks and streak", () => {
  const html = renderAnalysis(girone);
  assert.match(html, /Set vinti e persi<\/dt><dd>0 vinti, 9 persi \(0%\)/);
  assert.match(html, /Punti medi per set<\/dt><dd>15,2 fatti, 2\d,\d subiti/);
  assert.match(html, /Quinto set<\/dt><dd>nessuna gara al quinto set/);
  assert.match(html, /Rimonte<\/dt><dd>0 vittorie dopo aver perso il primo set/);
  assert.match(html, /Serie in corso<\/dt><dd>3 sconfitte di fila/);
});

test("the tie-break is reported apart from the mean when a game went to five sets", () => {
  const data = structuredClone(girone);
  const g = data.games.find((x) => x.played && x.away_id === "232645");
  g.sets = [[20, 25], [25, 20], [20, 25], [25, 20], [10, 15]];
  g.sets_won = [2, 3];
  const html = renderAnalysis(data);
  assert.match(html, /Quinto set<\/dt><dd>1 gara: 1 vinta, 0 perse/);
  assert.match(html, /nel quinto set 15,0 fatti, 10,0 subiti/);
});

test("labels from the data are not injected as markup", () => {
  assert.doesNotMatch(renderAnalysis(girone), /<script/);
});
