import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { headToHead, opponentSchedule } from "../../docs/opponent-rules.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const FENICE = "232645";
const AQUILA = "232223";

test("headToHead reports the played game from the Fenice side with set partials", () => {
  const h2h = headToHead(FENICE, AQUILA, girone.games);
  assert.equal(h2h.played.length, 1);
  assert.equal(h2h.played[0].score, "0-3");
  assert.deepEqual(h2h.played[0].sets, ["8-25", "17-25", "16-25"]);
  assert.deepEqual({ won: h2h.won, lost: h2h.lost, setsWon: h2h.setsWon, setsLost: h2h.setsLost }, { won: 0, lost: 1, setsWon: 0, setsLost: 3 });
});

test("headToHead lists the games still to play between the two", () => {
  const h2h = headToHead(FENICE, AQUILA, girone.games);
  assert.equal(h2h.upcoming.length, 1);
  assert.equal(h2h.upcoming[0].round, 7);
});

test("headToHead ignores games that involve a third team", () => {
  const h2h = headToHead(FENICE, "999", girone.games);
  assert.deepEqual(h2h, { played: [], upcoming: [], won: 0, lost: 0, setsWon: 0, setsLost: 0 });
});

test("opponentSchedule splits played and remaining games of a team, from its side", () => {
  const s = opponentSchedule(AQUILA, girone.games);
  assert.deepEqual(s.played.map((p) => [p.opponentId, p.score, p.outcome]), [
    ["232139", "3-2", "won"], ["232645", "3-0", "won"], ["232550", "3-0", "won"],
  ]);
  assert.equal(s.remaining.length, 7);
  assert.deepEqual(s.remaining[0], { game: girone.games[8], opponentId: "229802", home: true });
});

const SELARGIUS = "232550";
const SU_PLANU = "232396";

test("headToHead: a game played by the Fenice away is seen from the Fenice side", () => {
  const h2h = headToHead(FENICE, SELARGIUS, girone.games); // Selargius at home won 3-0 in round 1
  assert.equal(h2h.played.length, 1);
  assert.equal(h2h.played[0].score, "0-3");
  assert.deepEqual(h2h.played[0].sets, ["12-25", "19-25", "18-25"]);
  assert.equal(h2h.played[0].outcome, "lost");
  assert.deepEqual({ won: h2h.won, lost: h2h.lost, setsWon: h2h.setsWon, setsLost: h2h.setsLost }, { won: 0, lost: 1, setsWon: 0, setsLost: 3 });
});

test("headToHead: two played games, one at home and one away, add up wins, losses and sets", () => {
  const game = (id, home, away, sets_won) => ({ id, home_id: home, away_id: away, played: true, sets_won, sets: [] });
  const games = [game("a", FENICE, "x", [3, 1]), game("b", "x", FENICE, [3, 2])];
  const h2h = headToHead(FENICE, "x", games);
  assert.deepEqual(h2h.played.map((p) => [p.score, p.outcome]), [["3-1", "won"], ["2-3", "lost"]]);
  assert.deepEqual({ won: h2h.won, lost: h2h.lost, setsWon: h2h.setsWon, setsLost: h2h.setsLost }, { won: 1, lost: 1, setsWon: 5, setsLost: 4 });
});

test("opponentSchedule: a remaining game away has home false, one at home has home true", () => {
  const { remaining } = opponentSchedule(FENICE, girone.games);
  assert.equal(remaining[0].game.id, "12995184"); // round 4 at Su Planu
  assert.equal(remaining[0].opponentId, SU_PLANU);
  assert.equal(remaining[0].home, false);
  assert.equal(remaining[1].game.id, "12995188"); // round 5 at home against CUS
  assert.equal(remaining[1].opponentId, "229802");
  assert.equal(remaining[1].home, true);
});
