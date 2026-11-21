import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { homeAwayRecord, remainingGames } from "../../docs/team-rules.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const FENICE = "232645";
const AQUILA = "232223";
const SARROCH = "232139";

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
  const rem = remainingGames(FENICE, girone.games, girone.standings);
  assert.equal(rem.games.length, 7);
  assert.deepEqual(rem.games.map((r) => r.opponentPos), [5, 3, 4, 1, 2, 5, 3]);
  assert.deepEqual(rem.games.map((r) => r.home), [false, true, true, false, false, true, false]);
  assert.ok(Math.abs(rem.averagePosition - 23 / 7) < 1e-9);
});

test("remainingGames of a team with nothing left has no average", () => {
  const played = girone.games.map((g) => ({ ...g, played: true, sets_won: [3, 0], sets: [[25, 1], [25, 1], [25, 1]] }));
  const rem = remainingGames(FENICE, played, girone.standings);
  assert.deepEqual(rem, { games: [], averagePosition: null });
});

test("remainingGames takes opponent positions from the FIPAV standings, penalties included", () => {
  // A penalty on the leader: FIPAV publishes it 2nd, while the results alone would put it 1st
  const standings = girone.standings.map((r) =>
    r.team_id === AQUILA ? { ...r, pos: 2 } : r.team_id === SARROCH ? { ...r, pos: 1 } : r);
  const rem = remainingGames(FENICE, girone.games, standings);
  const posOf = (id) => rem.games.filter((r) => r.opponentId === id).map((r) => r.opponentPos);
  assert.deepEqual(posOf(AQUILA), [2]);
  assert.deepEqual(posOf(SARROCH), [1]);
});

test("remainingGames leaves the position empty for a team missing from the standings", () => {
  const rem = remainingGames(FENICE, girone.games, girone.standings.filter((r) => r.team_id !== AQUILA));
  assert.ok(rem.games.some((r) => r.opponentId === AQUILA && r.opponentPos === null));
});

test("remainingGames: the average ignores a team missing from the standings instead of counting it as 0", () => {
  // positions of the 7 opponents are [5, 3, 4, 1, 2, 5, 3]; without Aquila (1st) six are left: 22 / 6
  const rem = remainingGames(FENICE, girone.games, girone.standings.filter((r) => r.team_id !== AQUILA));
  assert.equal(rem.games.length, 7);
  assert.ok(Math.abs(rem.averagePosition - 22 / 6) < 1e-9);
  assert.ok(Math.abs(remainingGames(FENICE, girone.games, girone.standings).averagePosition - 23 / 7) < 1e-9);
});

test("homeAwayRecord counts a forfeit as a win but keeps it out of sets and points", () => {
  const index = girone.games.findIndex((g) => g.home_id === FENICE && !g.played);
  const forfeit = { ...girone.games[index], played: true, sets_won: [3, 0], sets: [] };
  const games = girone.games.with(index, forfeit);
  const rec = homeAwayRecord(FENICE, games);
  assert.deepEqual(rec.home, { played: 3, won: 1, lost: 2, setsWon: 0, setsLost: 6, pointsFor: 88, pointsAgainst: 150 });
});
