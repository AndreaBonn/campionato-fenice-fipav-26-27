import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { averagePointsPerSet, comebacks, forfeitCount, setStats, streak, tieBreakRecord } from "../../docs/fenice-rules.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const FENICE = "232645";
const OTHER = "x";

// Fenice at home or away, from [fenice, other] set scores; sets_won is derived
function game(sets, { home = true, played = true } = {}) {
  const pairs = sets.map(([f, o]) => (home ? [f, o] : [o, f]));
  const won = [pairs.filter(([h, a]) => h > a).length, pairs.filter(([h, a]) => a > h).length];
  return { home_id: home ? FENICE : OTHER, away_id: home ? OTHER : FENICE, played, sets: pairs, sets_won: played ? won : null };
}

const comeback = game([[20, 25], [18, 25], [25, 20], [25, 22], [15, 12]]); // 3-2 from 0-2
const lateLoss = game([[25, 20], [25, 22], [20, 25], [20, 25], [10, 15]], { home: false }); // 2-3 after leading
const sweep = game([[25, 10], [25, 12], [25, 14]]);
const synthetic = [comeback, lateLoss, sweep, game([[20, 25], [25, 20], [25, 20], [25, 20]]), game([[25, 20]], { played: false })];

test("setStats on the real girone: 0 sets won, 9 lost, 0% won", () => {
  assert.deepEqual(setStats(FENICE, girone.games), { won: 0, lost: 9, total: 9, wonPct: 0 });
});

test("setStats on a synthetic season counts sets and the won share", () => {
  // comeback 3-2, lateLoss 2-3, sweep 3-0, game 3-1 -> won 11, lost 6
  assert.deepEqual(setStats(FENICE, synthetic), { won: 11, lost: 6, total: 17, wonPct: 65 });
});

test("setStats has no percentage before any set is played", () => {
  assert.deepEqual(setStats(FENICE, []), { won: 0, lost: 0, total: 0, wonPct: null });
});

test("averagePointsPerSet on the real girone gives 15.2 scored over 9 sets", () => {
  const avg = averagePointsPerSet(FENICE, girone.games);
  assert.equal(avg.sets, 9);
  assert.equal(avg.scored.toFixed(1), "15.2");
  assert.equal(avg.tieBreak, null);
});

test("averagePointsPerSet leaves the tie-break out of the mean and reports it apart", () => {
  const avg = averagePointsPerSet(FENICE, [comeback, lateLoss]);
  assert.equal(avg.sets, 8);
  // regular sets: 20+18+25+25 + 25+25+20+20 = 178 scored; 25+25+20+22 + 20+22+25+25 = 184 conceded
  assert.equal(avg.scored, 178 / 8);
  assert.equal(avg.conceded, 184 / 8);
  assert.deepEqual(avg.tieBreak, { sets: 2, scored: 12.5, conceded: 13.5 });
});

test("averagePointsPerSet is null without sets", () => {
  assert.equal(averagePointsPerSet(FENICE, []), null);
});

test("tieBreakRecord counts the games that went to a fifth set", () => {
  assert.deepEqual(tieBreakRecord(FENICE, synthetic), { played: 2, won: 1, lost: 1 });
  assert.deepEqual(tieBreakRecord(FENICE, girone.games), { played: 0, won: 0, lost: 0 });
});

test("comebacks counts wins after losing the first set, and those from 0-2", () => {
  assert.deepEqual(comebacks(FENICE, synthetic), { won: 2, fromTwoZero: 1 });
  assert.deepEqual(comebacks(FENICE, girone.games), { won: 0, fromTwoZero: 0 });
});

test("streak is the current run of equal outcomes, null with no result", () => {
  assert.deepEqual(streak(FENICE, [sweep, lateLoss, comeback, sweep]), { outcome: "won", length: 2 });
  assert.deepEqual(streak(FENICE, girone.games), { outcome: "lost", length: 3 });
  assert.equal(streak(FENICE, []), null);
});

const forfeit = { home_id: FENICE, away_id: OTHER, played: true, sets: [], sets_won: [3, 0] };

test("a game awarded at the table adds no sets to setStats and is counted apart", () => {
  assert.deepEqual(setStats(FENICE, [forfeit]), { won: 0, lost: 0, total: 0, wonPct: null });
  assert.deepEqual(setStats(FENICE, [sweep, forfeit]), { won: 3, lost: 0, total: 3, wonPct: 100 });
  assert.equal(forfeitCount(FENICE, [sweep, forfeit, forfeit]), 2);
  assert.equal(forfeitCount(FENICE, [sweep]), 0);
});

test("a game awarded at the table still counts in the streak", () => {
  assert.deepEqual(streak(FENICE, [lateLoss, forfeit]), { outcome: "won", length: 1 });
});
