import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  averagePointsPerSet, closeSets, comebacks, forfeitCount, setStats, setsByNumber, streak, tieBreakDetail, tieBreakRecord,
} from "../../docs/fenice-rules.js";

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


test("setStats rounds five wins out of seventeen down to 29 percent", () => {
  const games = [game([[25, 20], [25, 20], [20, 25], [20, 25], [10, 15]]),
    game([[25, 20], [20, 25], [20, 25], [20, 25]]),
    game([[25, 20], [20, 25], [20, 25], [20, 25]]),
    game([[25, 20], [20, 25], [20, 25], [20, 25]])];
  assert.deepEqual(setStats(FENICE, games), { won: 5, lost: 12, total: 17, wonPct: 29 });
});

test("setStats rounds eleven wins out of seventeen up to 65 percent", () => {
  assert.equal(setStats(FENICE, synthetic).wonPct, 65);
});

test("streak follows the date the games were played, not their round", () => {
  const at = (g, starts_at) => ({ ...g, starts_at });
  const games = [at(sweep, "2026-11-09T18:00:00+01:00"), at(lateLoss, "2026-11-30T18:00:00+01:00"),
    at(sweep, "2026-11-23T18:00:00+01:00")];
  assert.deepEqual(streak(FENICE, games), { outcome: "lost", length: 1 });
  assert.deepEqual(streak(FENICE, [games[0], games[2]]), { outcome: "won", length: 2 });
});

// tieBreakDetail: comeback (home, fifth 15-12) then lateLoss (away, fifth stored 15-10 as home-away, so Fenice 10 vs 15)
test("tieBreakDetail lists each fifth set seen from the Fenice, with the opponent and the mean margin", () => {
  const detail = tieBreakDetail(FENICE, [comeback, lateLoss, sweep]);
  // margins +3 and -5 -> mean -1
  assert.deepEqual(detail, { sets: [{ opponentId: OTHER, mine: 15, theirs: 12 }, { opponentId: OTHER, mine: 10, theirs: 15 }], meanMargin: -1 });
});

test("tieBreakDetail has a mean margin only from two sets on, and nothing without a fifth set", () => {
  assert.deepEqual(tieBreakDetail(FENICE, [comeback]), { sets: [{ opponentId: OTHER, mine: 15, theirs: 12 }], meanMargin: null });
  assert.deepEqual(tieBreakDetail(FENICE, [sweep]), { sets: [], meanMargin: null });
});

test("tieBreakDetail ignores games awarded at the table and unplayed games", () => {
  const forfeit = { ...sweep, sets: [], sets_won: [3, 0] };
  assert.deepEqual(tieBreakDetail(FENICE, [forfeit, game([[25, 20]], { played: false })]), { sets: [], meanMargin: null });
});

test("setsByNumber counts sets won and played for each set number, the fifth only when played", () => {
  // set 1: comeback L, lateLoss W, sweep W, 3-1 game L -> 2/4; set 2: L W W W -> 3/4; set 3: W L W W -> 3/4;
  // set 4: comeback W, lateLoss L, 3-1 game W -> 2/3; set 5: comeback W, lateLoss L -> 1/2
  assert.deepEqual(setsByNumber(FENICE, synthetic), [
    { number: 1, won: 2, played: 4 }, { number: 2, won: 3, played: 4 }, { number: 3, won: 3, played: 4 },
    { number: 4, won: 2, played: 3 }, { number: 5, won: 1, played: 2 },
  ]);
});

test("setsByNumber stops at four sets without a tie-break, and is empty before any set or for forfeits only", () => {
  assert.deepEqual(setsByNumber(FENICE, [sweep]), [
    { number: 1, won: 1, played: 1 }, { number: 2, won: 1, played: 1 }, { number: 3, won: 1, played: 1 }, { number: 4, won: 0, played: 0 },
  ]);
  assert.deepEqual(setsByNumber(FENICE, [{ ...sweep, sets: [], sets_won: [3, 0] }, game([[25, 20]], { played: false })]), []);
});

test("setsByNumber on the real girone: three games lost 0-3, so 0 of 3 in each of the first three sets", () => {
  assert.deepEqual(setsByNumber(FENICE, girone.games).map((s) => [s.number, s.won, s.played]), [[1, 0, 3], [2, 0, 3], [3, 0, 3], [4, 0, 0]]);
});

test("closeSets counts sets decided by exactly two points, extra points included, either side of the court", () => {
  const home = game([[27, 25], [25, 23], [24, 26], [14, 16], [25, 10]]); // W W L L, last not close
  const away = game([[26, 24], [23, 25], [25, 20]], { home: false }); // W L, last not close
  const forfeit = { ...sweep, sets: [], sets_won: [3, 0] };
  assert.deepEqual(closeSets(FENICE, [home, away, forfeit, game([[25, 23]], { played: false })]), { won: 3, lost: 3 });
});

test("closeSets is zero when no set was that tight", () => {
  assert.deepEqual(closeSets(FENICE, [sweep, comeback]), { won: 0, lost: 0 });
});
