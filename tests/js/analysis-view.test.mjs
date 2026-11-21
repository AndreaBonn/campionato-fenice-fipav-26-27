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
  assert.match(html, /Punti medi per set<\/dt><dd>15,2 fatti, 25,0 subiti/);
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

test("the forfeit row appears only when a game was awarded at the table", () => {
  const data = structuredClone(girone);
  assert.doesNotMatch(renderAnalysis(data), /Gare a tavolino/);
  data.games.push({ ...data.games[0], home_id: "232645", played: true, sets: [], sets_won: [3, 0] });
  assert.match(renderAnalysis(data), /Gare a tavolino<\/dt><dd>1 gara decisa a tavolino/);
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
  assert.match(html, /<details><summary>Analisi completa \(punti per set, quinto set, casa e trasferta, set per set\)<\/summary><dl class="analysis">/);
  assert.equal(html.indexOf("<details"), html.lastIndexOf("<details"));
});

test("strip: a won game counts on the winning side and the sets span is left out when no set was played", () => {
  const data = structuredClone(girone);
  data.games = [{ ...data.games[0], home_id: "232645", played: true, sets: [], sets_won: [3, 0] }];
  const html = renderAnalysis(data);
  assert.match(html, /<b class="n">1-0<\/b> vinte e perse/);
  assert.equal(html.includes("> set<"), false);
});

test("comebacks count every win after losing the first set, and apart those from 0-2", () => {
  const data = structuredClone(girone);
  const last = data.games.find((g) => g.played && g.home_id === "232645");
  data.games.push(
    { ...last, id: "from-0-2", starts_at: "2027-03-01T18:00:00+01:00", sets: [[20, 25], [22, 25], [25, 20], [25, 18], [15, 10]], sets_won: [3, 2] },
    { ...last, id: "from-0-1", starts_at: "2027-03-08T18:00:00+01:00", sets: [[20, 25], [25, 20], [25, 20], [25, 18]], sets_won: [3, 1] },
  );
  const html = renderAnalysis(data);
  assert.match(html, /Rimonte<\/dt><dd>2 vittorie dopo aver perso il primo set, 1 da 0-2/);
  assert.match(html, /Serie in corso<\/dt><dd>2 vittorie di fila<\/dd>/);
});

test("a lone win after the losses is a streak of one, without «di fila»", () => {
  const data = structuredClone(girone);
  const last = data.games.find((g) => g.played && g.home_id === "232645");
  data.games.push({ ...last, id: "late", starts_at: "2027-03-01T18:00:00+01:00", sets: [[25, 20], [25, 20], [25, 20]], sets_won: [3, 0] });
  assert.match(renderAnalysis(data), /Serie in corso<\/dt><dd>1 vittoria<\/dd>/);
});

const FENICE = "232645";
// One Fenice home game against Selargius (232550): sets W W L L W, the fifth won 16-14, 3-2 overall
const lone = (data, opponent = "232550") => {
  const base = structuredClone(data);
  base.games = [{
    ...base.games[0], home_id: FENICE, away_id: opponent, played: true,
    sets: [[27, 25], [25, 23], [24, 26], [20, 25], [16, 14]], sets_won: [3, 2],
  }];
  return base;
};

test("tie-break row: the fifth set as Fenice-first score with the opponent, name escaped", () => {
  const data = structuredClone(girone);
  const g = data.games.find((x) => x.played && x.away_id === FENICE);
  g.sets = [[20, 25], [25, 20], [20, 25], [25, 20], [10, 15]];
  g.sets_won = [2, 3];
  data.teams.find((t) => t.id === g.home_id).name = "ASD <B> VSA";
  const html = renderAnalysis(data);
  assert.ok(html.includes("<dd>1 gara: 1 vinta, 0 perse; 15-10 con Asd &lt;b&gt; VSA</dd>"));
  assert.ok(!html.includes("scarto medio"));
});

test("tie-break row: with two fifth sets they are listed oldest first and the mean margin follows", () => {
  const data = structuredClone(girone);
  const first = data.games.find((x) => x.played && x.away_id === FENICE); // 2026-10-30, Selargius 232550
  first.sets = [[20, 25], [25, 20], [20, 25], [25, 20], [10, 15]];
  first.sets_won = [2, 3];
  const home = data.games.find((g) => g.played && g.home_id === FENICE);
  data.games.push({ ...home, id: "later", starts_at: "2027-03-01T18:00:00+01:00", away_id: "229802", sets: [[25, 20], [20, 25], [25, 20], [20, 25], [15, 13]], sets_won: [3, 2] });
  // margins +5 and +2 -> mean +3,5
  assert.ok(renderAnalysis(data).includes("<dd>2 gare: 2 vinte, 0 perse; 15-10 con Polisportiva Selargius 85 Asd, 15-13 con CUS Cagliari; scarto medio +3,5</dd>"));
});

test("tie-break row: two losses have a negative mean margin", () => {
  const data = lone(girone);
  data.games[0].sets = [[25, 20], [20, 25], [25, 20], [20, 25], [10, 15]];
  data.games[0].sets_won = [2, 3];
  data.games.push({ ...data.games[0], id: "later", sets: [[25, 20], [20, 25], [25, 20], [20, 25], [13, 15]] });
  assert.match(renderAnalysis(data), /scarto medio -3,5/);
});

test("tie-break row: an unknown opponent receives a fallback name", () => {
  assert.match(renderAnalysis(lone(girone, "missing")), /16-14 con Squadra sconosciuta/);
});

test("tie-break row: no fifth set played adds nothing to the existing sentence", () => {
  assert.ok(renderAnalysis(girone).includes("<dt>Quinto set</dt><dd>nessuna gara al quinto set</dd>"));
});

test("close sets row: won and lost sets decided by two points, extra points included", () => {
  // 27-25 W, 25-23 W, 24-26 L, 16-14 W; 20-25 is not close
  assert.ok(renderAnalysis(lone(girone)).includes("<dt>Set punto a punto</dt><dd>3 vinti, 1 perso</dd>"));
});

test("close sets row: only won close sets still show their count", () => {
  const data = lone(girone);
  data.games[0].sets = [[25, 23], [27, 25], [25, 20]];
  data.games[0].sets_won = [3, 0];
  assert.match(renderAnalysis(data), /Set punto a punto<\/dt><dd>2 vinti, 0 persi/);
});

test("close sets row: only lost close sets still show their count", () => {
  const data = lone(girone);
  data.games[0].sets = [[23, 25], [25, 27], [20, 25]];
  data.games[0].sets_won = [0, 3];
  assert.match(renderAnalysis(data), /Set punto a punto<\/dt><dd>0 vinti, 2 persi/);
});

test("close sets row: says so when no set was that tight", () => {
  assert.ok(renderAnalysis(girone).includes("<dt>Set punto a punto</dt><dd>nessun set punto a punto</dd>"));
});

test("run-in row: games left and the mean position of the opponents, one decimal with a comma", () => {
  // 7 games left against positions 5, 3, 4, 1, 2, 5, 3 -> 23 / 7 = 3,29
  assert.ok(renderAnalysis(girone).includes("<dt>Gare che restano</dt><dd>7 gare, avversarie in media al 3,3° posto</dd>"));
});

test("run-in row: a single game left names its opponent's position without an average", () => {
  const data = structuredClone(girone);
  data.games = data.games.filter((g) => g.played || !(g.home_id === FENICE || g.away_id === FENICE) || g.round === 6);
  assert.ok(renderAnalysis(data).includes("<dd>1 gara, avversaria al 4° posto</dd>"));
});

test("run-in row: no game left, and no position known", () => {
  const none = structuredClone(girone);
  none.games = none.games.filter((g) => g.played);
  assert.ok(renderAnalysis(none).includes("<dt>Gare che restano</dt><dd>nessuna gara da giocare</dd>"));
  const unknown = structuredClone(girone);
  unknown.standings = [];
  assert.ok(renderAnalysis(unknown).includes("<dt>Gare che restano</dt><dd>7 gare</dd>"));
});

test("home and away boxes: record and sets, text for screen readers, empty side says so", () => {
  const html = renderAnalysis(lone(girone));
  assert.ok(html.includes('<div class="box"><small>In casa</small><b>1-0<span class="sr-only"> (1 vinta, 0 perse)</span></b><small>set 3-2</small></div>'));
  assert.ok(html.includes('<div class="box"><small>In trasferta</small><b>-</b><small>nessuna gara giocata</small></div>'));
  assert.ok(html.includes('<h3 class="sr-only">Rendimento in casa e in trasferta</h3>'));
});

test("home and away boxes on the real girone: two home and one away game, all lost 0-3", () => {
  const html = renderAnalysis(girone);
  assert.ok(html.includes('<small>In casa</small><b>0-2<span class="sr-only"> (0 vinte, 2 perse)</span></b><small>set 0-6</small>'));
  assert.ok(html.includes('<small>In trasferta</small><b>0-1<span class="sr-only"> (0 vinte, 1 persa)</span></b><small>set 0-3</small>'));
});

test("sets by number: label, text and a decorative bar for each set, the fifth only when played", () => {
  const html = renderAnalysis(lone(girone));
  const item = (label, width, text) => `<li><span class="lbl">${label}</span><span class="bar" aria-hidden="true"><span style="width:${width}%"></span></span><span class="val">${text}</span></li>`;
  assert.ok(html.includes(`<ul class="set-bars">${item("1° set", 100, "1 su 1")}${item("2° set", 100, "1 su 1")}${item("3° set", 0, "0 su 1")}${item("4° set", 0, "0 su 1")}${item("5° set", 100, "1 su 1")}</ul>`));
  const real = renderAnalysis(girone);
  assert.ok(real.includes(item("3° set", 0, "0 su 3")));
  assert.ok(real.includes('<li><span class="lbl">4° set</span><span class="bar" aria-hidden="true"><span style="width:0%"></span></span><span class="val">nessuno</span></li>'));
  assert.ok(!real.includes("5° set"));
});

test("sets by number: the bar share is the rounded won share", () => {
  const data = lone(girone);
  data.games.push({ ...data.games[0], id: "g2", starts_at: "2027-03-01T18:00:00+01:00", sets: [[20, 25], [25, 20], [25, 20], [25, 20]], sets_won: [3, 1] });
  data.games.push({ ...data.games[0], id: "g3", starts_at: "2027-03-08T18:00:00+01:00", sets: [[20, 25], [20, 25], [20, 25]], sets_won: [0, 3] });
  // set 1: W (lone), L, L -> 1 of 3 = 33%; set 2: W, W, L -> 2 of 3 = 67%
  const html = renderAnalysis(data);
  assert.ok(html.includes('style="width:33%"></span></span><span class="val">1 su 3</span>'));
  assert.ok(html.includes('style="width:67%"></span></span><span class="val">2 su 3</span>'));
});

test("order inside the details: rows, then home and away boxes, then the sets by number", () => {
  const html = renderAnalysis(girone);
  const at = (s) => html.indexOf(s);
  assert.ok(at("</dl>") > at("Gare che restano") && at("class=\"split\"") > at("</dl>") && at("class=\"by-set\"") > at("class=\"split\""));
});

test("no set played: the boxes show but the sets by number are left out", () => {
  const data = structuredClone(girone);
  data.games = [{ ...data.games[0], home_id: FENICE, played: true, sets: [], sets_won: [3, 0] }];
  const html = renderAnalysis(data);
  assert.ok(!html.includes("by-set"));
  assert.ok(html.includes("<dt>Set punto a punto</dt><dd>nessun set punto a punto</dd>"));
});
