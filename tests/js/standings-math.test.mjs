import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { positionRanges, decidedFacts } from "../../docs/standings-math.js";

const outcomes = [[3, 0], [2, 1], [1, 2], [0, 3]];
const scores = [[3, 0], [3, 2], [2, 3], [0, 3]];
const teams = ["A", "B", "C", "D"].map((id) => ({ id }));
const ratio = (a, b) => b ? a / b : a ? Infinity : 0;
const random = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function seasons() {
  const rand = random(731);
  return Array.from({ length: 50 }, () => {
    const games = [];
    for (let round = 0; round < 2; round++) for (let h = 0; h < 4; h++) for (let a = h + 1; a < 4; a++) {
      const score = scores[Math.floor(rand() * 4)];
      games.push({ home_id: teams[h].id, away_id: teams[a].id, played: true, sets_won: score,
        sets: Array.from({ length: score[0] + score[1] }, () => [10 + Math.floor(rand() * 16), 10 + Math.floor(rand() * 16)]) });
    }
    const order = games.map((_, i) => i).sort(() => rand() - 0.5);
    for (const i of order.slice(0, 2 + Math.floor(rand() * 5))) games[i].played = false;
    return { teams, games };
  });
}

function initialRows(data) {
  const rows = new Map(data.teams.map(({ id }) => [id, { id, points: 0, wins: 0, sw: 0, sl: 0, pf: 0, pa: 0, pending: 0 }]));
  for (const g of data.games) {
    const h = rows.get(g.home_id), a = rows.get(g.away_id);
    if (!g.played) { h.pending++; a.pending++; continue; }
    const [hs, as] = g.sets_won, tight = Math.min(hs, as) === 2;
    h.points += hs > as ? (tight ? 2 : 3) : (tight ? 1 : 0);
    a.points += as > hs ? (tight ? 2 : 3) : (tight ? 1 : 0);
    h.wins += Number(hs > as); a.wins += Number(as > hs);
    h.sw += hs; h.sl += as; a.sw += as; a.sl += hs;
    for (const [hp, ap] of g.sets) { h.pf += hp; h.pa += ap; a.pf += ap; a.pa += hp; }
  }
  return [...rows.values()];
}

function recordScenario(rows, ranges) {
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins);
  for (let start = 0; start < rows.length;) {
    let end = start + 1;
    while (end < rows.length && rows[end].points === rows[start].points && rows[end].wins === rows[start].wins) end++;
    const group = rows.slice(start, end);
    if (group.every((r) => !r.pending)) group.sort((a, b) => ratio(b.sw, b.sl) - ratio(a.sw, a.sl) || ratio(b.pf, b.pa) - ratio(a.pf, a.pa));
    for (const r of group) {
      const tied = group.some((x) => x.pending) ? group : group.filter((x) => ratio(x.sw, x.sl) === ratio(r.sw, r.sl) && ratio(x.pf, x.pa) === ratio(r.pf, r.pa));
      const first = start + group.indexOf(tied[0]) + 1, last = first + tied.length - 1;
      const range = ranges.get(r.id); range.best = Math.min(range.best, first); range.worst = Math.max(range.worst, last);
    }
    start = end;
  }
}

function brute(data) {
  const initial = initialRows(data), pending = data.games.filter((g) => !g.played);
  const ranges = new Map(data.teams.map(({ id }) => [id, { best: Infinity, worst: 0 }]));
  for (let scenario = 0; scenario < 4 ** pending.length; scenario++) {
    const rows = initial.map((r) => ({ ...r })), byId = new Map(rows.map((r) => [r.id, r]));
    let value = scenario;
    for (const g of pending) {
      const outcome = value % 4; value = Math.floor(value / 4);
      const h = byId.get(g.home_id), a = byId.get(g.away_id);
      h.points += outcomes[outcome][0]; a.points += outcomes[outcome][1];
      h.wins += Number(outcome < 2); a.wins += Number(outcome >= 2);
    }
    recordScenario(rows, ranges);
  }
  return ranges;
}

const synthetic = seasons();
test("ranges agree with independent brute force across 50 seasons", () => {
  for (const data of synthetic) assert.deepEqual(positionRanges(data), brute(data));
});

test("fallback contains exact ranges and can be wider", () => {
  let wider = false;
  for (const data of synthetic) for (const [id, exact] of brute(data)) {
    const bound = positionRanges(data, { maxEnumerated: 0 }).get(id);
    assert.ok(bound.best <= exact.best && bound.worst >= exact.worst);
    wider ||= bound.best < exact.best || bound.worst > exact.worst;
  }
  assert.ok(wider);
});

test("a leader seven points clear with two games left is first even in fallback", () => {
  const game = (home_id, away_id, played = true) => ({ home_id, away_id, played, sets_won: [3, 0], sets: [[25, 10], [25, 10], [25, 10]] });
  const tight = { home_id: "B", away_id: "C", played: true, sets_won: [3, 2], sets: [[25, 20]] };
  const data = { teams: teams.slice(0, 3), games: [game("A", "B"), game("A", "B"), game("A", "C"), tight, game("B", "C", false), game("B", "C", false)] };
  for (const options of [{}, { maxEnumerated: 0 }]) {
    const ranges = positionRanges(data, options);
    assert.deepEqual(ranges.get("A"), { best: 1, worst: 1 });
    assert.deepEqual(decidedFacts(ranges, { published: false }), [{ team_id: "A", position: 1 }]);
  }
});

test("ties remain open with pending games and close on current ratios when finished", () => {
  const pending = { teams: teams.slice(0, 2), games: [{ home_id: "A", away_id: "B", played: false }] };
  assert.deepEqual([...positionRanges(pending).values()], [{ best: 1, worst: 2 }, { best: 1, worst: 2 }]);
  const closed = { teams: teams.slice(0, 3), games: [
    { home_id: "A", away_id: "C", played: true, sets_won: [3, 0], sets: [[25, 10]] },
    { home_id: "B", away_id: "C", played: true, sets_won: [3, 0], sets: [[25, 20]] },
  ] };
  assert.deepEqual(positionRanges(closed).get("A"), { best: 1, worst: 1 });
  assert.deepEqual(positionRanges(closed).get("B"), { best: 2, worst: 2 });
});

test("decided facts use exact positions and published zones", () => {
  const ranges = new Map([["B", { best: 2, worst: 3 }], ["A", { best: 1, worst: 1 }], ["C", { best: 4, worst: 4 }], ["D", { best: 2, worst: 3 }]]);
  assert.deepEqual(decidedFacts(ranges, { published: false }), [{ team_id: "A", position: 1 }, { team_id: "C", position: 4 }]);
  assert.deepEqual(decidedFacts(ranges, { published: true, promotion: 1, playoff: 1, relegation: 1 }).find((f) => f.team_id === "A"),
    { team_id: "A", position: 1, promotion: true, playoff: false, relegation: false });
});

test("large fixture returns valid ranges promptly", () => {
  const data = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
  const ranges = positionRanges(data);
  assert.equal(ranges.size, 6);
  for (const { best, worst } of ranges.values()) assert.ok(1 <= best && best <= worst && worst <= 6);
});

test("ranges start from the official standings, which can carry a penalty the games do not show", () => {
  const win = (home_id, away_id) => ({ home_id, away_id, played: true, sets_won: [3, 0], sets: [[25, 10], [25, 10], [25, 10]] });
  const data = { teams: teams.slice(0, 3), games: [win("A", "B"), win("A", "C"), { home_id: "B", away_id: "C", played: false, sets_won: null, sets: [] }] };
  assert.deepEqual(positionRanges(data).get("A"), { best: 1, worst: 1 }); // 6 points against a best case of 3
  const row = (team_id, points, won, set_ratio) => ({ team_id, points, won, set_ratio, point_ratio: set_ratio });
  data.standings = [row("A", 2, 2, 3), row("B", 0, 0, 0), row("C", 0, 0, 0)]; // A carries a 4 point penalty
  assert.deepEqual(positionRanges(data).get("A"), { best: 1, worst: 2 });
  assert.deepEqual(positionRanges({ ...data, standings: [] }).get("A"), { best: 1, worst: 1 });
});

test("six teams with two out of contention match brute force, fixed games included", () => {
  const ids = ["A", "B", "C", "D", "E", "F"], six = ids.map((id) => ({ id }));
  const played = (home_id, away_id, sets_won) => ({ home_id, away_id, played: true, sets_won, sets: Array.from({ length: sets_won[0] + sets_won[1] }, (_, i) => (i < sets_won[0] ? [25, 18] : [18, 25])) });
  const open = (home_id, away_id) => ({ home_id, away_id, played: false, sets_won: null, sets: [] });
  const games = [
    ...["A", "B", "C", "D"].flatMap((top) => [played(top, "E", [3, 0]), played("F", top, [0, 3])]),
    played("A", "B", [3, 1]), played("C", "D", [3, 2]), played("A", "C", [3, 0]), played("B", "D", [3, 0]),
    open("A", "D"), open("B", "C"), open("E", "F"), open("F", "E"),
  ];
  const data = { teams: six, games };
  const exact = brute(data), ranges = positionRanges(data);
  assert.deepEqual(ranges, exact);
  assert.deepEqual(ranges.get("E").worst, 6);
  // A-D and B-C are the only games that can matter: fixed games must not count against the enumeration limit
  assert.deepEqual(positionRanges(data, { maxEnumerated: 2 }).get("A"), exact.get("A"));
  assert.ok(ranges.get("A").best === 1 && ranges.get("F").best >= 5);
});
