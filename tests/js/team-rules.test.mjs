import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { form, homeAwayRecord, remainingGames } from "../../docs/team-rules.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const FENICE = "232645";
const AQUILA = "232223";

test("homeAwayRecord splits wins, sets and points between home and away games", () => {
  const rec = homeAwayRecord(FENICE, girone.games);
  assert.deepEqual(rec.home, { played: 2, won: 0, lost: 2, setsWon: 0, setsLost: 6, pointsFor: 88, pointsAgainst: 150 });
  assert.deepEqual(rec.away, { played: 1, won: 0, lost: 1, setsWon: 0, setsLost: 3, pointsFor: 49, pointsAgainst: 75 });
});

test("homeAwayRecord counts a team that won away", () => {
  const rec = homeAwayRecord(AQUILA, girone.games);
  assert.equal(rec.away.won, 3);
  assert.equal(rec.home.played, 0);
  assert.equal(rec.away.setsWon, 9 + 0);
});

test("remainingGames lists the unplayed games with the opponent's current position", () => {
  const rem = remainingGames(FENICE, girone.games, girone.teams);
  assert.equal(rem.games.length, 7);
  assert.deepEqual(rem.games.map((r) => r.opponentPos), [5, 3, 4, 1, 2, 5, 3]);
  assert.deepEqual(rem.games.map((r) => r.home), [false, true, true, false, false, true, false]);
  assert.ok(Math.abs(rem.averagePosition - 23 / 7) < 1e-9);
});

test("remainingGames of a team with nothing left has no average", () => {
  const played = girone.games.map((g) => ({ ...g, played: true, sets_won: [3, 0], sets: [[25, 1], [25, 1], [25, 1]] }));
  const rem = remainingGames(FENICE, played, girone.teams);
  assert.deepEqual(rem, { games: [], averagePosition: null });
});

test("form returns the outcomes of the last n played games, oldest first", () => {
  assert.deepEqual(form(FENICE, girone.games), ["lost", "lost", "lost"]);
  assert.deepEqual(form(AQUILA, girone.games), ["won", "won", "won"]);
  assert.deepEqual(form(AQUILA, girone.games, 2), ["won", "won"]);
  assert.deepEqual(form("999", girone.games), []);
});
