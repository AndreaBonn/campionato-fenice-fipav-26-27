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

test("a lone game awarded at the table is not empty and says so", () => {
  const data = structuredClone(girone);
  data.games = [{ ...data.games[0], home_id: "232645", played: true, sets: [], sets_won: [3, 0] }];
  const html = renderAnalysis(data);
  assert.doesNotMatch(html, /L'analisi comparirà/);
  assert.match(html, /Gare a tavolino<\/dt><dd>1 gara decisa a tavolino/);
  assert.match(html, /Set vinti e persi<\/dt><dd>nessun set giocato/);
  assert.match(html, /Punti medi per set<\/dt><dd>nessun parziale/);
});

test("games awarded at the table are listed beside played ones without skewing sets", () => {
  const data = structuredClone(girone);
  data.games.push({ ...data.games[0], home_id: "232645", played: true, sets: [], sets_won: [3, 0] });
  const html = renderAnalysis(data);
  assert.match(html, /Set vinti e persi<\/dt><dd>0 vinti, 9 persi \(0%\)/);
  assert.match(html, /1 gara decisa a tavolino/);
});

test("strip: record, sets and the form letters (V or P as text, not only a colour) lead the section", () => {
  const html = renderAnalysis(girone);
  assert.match(html, /<div class="strip"><span><b class="n">0-3<\/b> vinte e perse<\/span><span><b class="n">0-9<\/b> set<\/span>/);
  assert.equal(html.split('class="f lost">P<').length - 1, 3);
  assert.equal(html.split('class="f won">V<').length - 1, 0);
  assert.match(html, /aria-label="Forma delle ultime partite/);
});

test("strip: the full analysis sits in a details element titled «Analisi completa»", () => {
  const html = renderAnalysis(girone);
  assert.match(html, /<details><summary>Analisi completa \(punti per set, quinto set, rimonte\)<\/summary><dl class="analysis">/);
  assert.equal(html.indexOf("<details"), html.lastIndexOf("<details"));
});

test("strip: a won game counts on the winning side and the sets span is left out when no set was played", () => {
  const data = structuredClone(girone);
  data.games = [{ ...data.games[0], home_id: "232645", played: true, sets: [], sets_won: [3, 0] }];
  const html = renderAnalysis(data);
  assert.match(html, /<b class="n">1-0<\/b> vinte e perse/);
  assert.equal(html.includes("> set<"), false);
});
