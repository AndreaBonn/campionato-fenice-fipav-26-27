import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { matchPoints, tableFromGames } from "../../docs/standings-rules.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const INT_FIELDS = ["played", "points", "won", "lost", "sets_won", "sets_lost", "points_for", "points_against"];

test("matchPoints gives 3-0 and 3-1 as 3/0 and 3-2 as 2/1, from either side", () => {
  assert.deepEqual(matchPoints([3, 0]), [3, 0]);
  assert.deepEqual(matchPoints([1, 3]), [0, 3]);
  assert.deepEqual(matchPoints([3, 2]), [2, 1]);
  assert.deepEqual(matchPoints([2, 3]), [1, 2]);
});

test("tableFromGames matches the API standings for all 6 teams", () => {
  const table = tableFromGames(girone.games, girone.teams);
  assert.equal(table.length, 6);
  for (const api of girone.standings) {
    const mine = table.find((r) => r.team_id === api.team_id);
    for (const f of INT_FIELDS) assert.equal(mine[f], api[f], `${api.team_id} ${f}`);
  }
});

test("tableFromGames orders by points, then wins, then set ratio, then point ratio, and numbers the positions", () => {
  const t = (id) => ({ id, cod: id, name: id, logo_url: null });
  const g = (home_id, away_id, sets_won, sets) => ({ home_id, away_id, played: true, sets_won, sets });
  // A, B, C all 3 points won; A and B beat the same ones, set ratio splits B above A, C last on wins
  const games = [
    g("A", "D", [3, 1], [[25, 20], [25, 20], [20, 25], [25, 20]]),
    g("B", "D", [3, 0], [[25, 10], [25, 10], [25, 10]]),
    g("C", "D", [2, 3], [[25, 20], [25, 20], [20, 25], [20, 25], [10, 15]]),
    g("C", "D", [2, 3], [[25, 20], [25, 20], [20, 25], [20, 25], [10, 15]]),
  ];
  const table = tableFromGames(games, [t("A"), t("B"), t("C"), t("D")]);
  assert.deepEqual(table.map((r) => [r.team_id, r.pos, r.points]), [["D", 1, 4], ["B", 2, 3], ["A", 3, 3], ["C", 4, 2]]);
});

test("point ratio breaks a tie on wins and set ratio; a zero denominator is Infinity", () => {
  const t = (id) => ({ id, cod: id, name: id, logo_url: null });
  const g = (home_id, away_id, pts) => ({ home_id, away_id, played: true, sets_won: [3, 0], sets: pts });
  const games = [
    g("A", "X", [[25, 10], [25, 10], [25, 10]]),
    g("B", "X", [[25, 20], [25, 20], [25, 20]]),
  ];
  const table = tableFromGames(games, [t("B"), t("A"), t("X")]);
  assert.deepEqual(table.map((r) => r.team_id), ["A", "B", "X"]);
  assert.equal(table[0].set_ratio, Infinity);
  assert.equal(table[0].point_ratio, 75 / 30);
});

test("games not played are ignored", () => {
  const t = (id) => ({ id, cod: id, name: id, logo_url: null });
  const games = [{ home_id: "A", away_id: "B", played: false, sets_won: null, sets: [] }];
  assert.deepEqual(tableFromGames(games, [t("A"), t("B")]).map((r) => r.played), [0, 0]);
});

const team = (id) => ({ id, name: `T${id}` });
const game = (home_id, away_id, sets_won, sets) => ({ played: true, home_id, away_id, sets_won, sets });

test("a team with no sets played ranks below one that lost 0-3 at equal points", () => {
  const table = tableFromGames([game("a", "b", [3, 0], [[25, 10], [25, 10], [25, 10]])], [team("c"), team("b"), team("a")]);
  assert.deepEqual(table.map((r) => r.team_id), ["a", "b", "c"]);
  assert.equal(table[2].set_ratio, 0);
  assert.equal(table[2].point_ratio, 0);
});

test("a ratio keeps Infinity when sets were won and none lost", () => {
  const table = tableFromGames([game("a", "b", [3, 0], [[25, 10], [25, 10], [25, 10]])], [team("a"), team("b")]);
  assert.equal(table[0].set_ratio, Infinity);
});

test("a game with a team missing from the teams list is skipped, not a crash", () => {
  const sets = [[25, 10], [25, 10], [25, 10]];
  const table = tableFromGames([game("a", "ghost", [3, 0], sets), game("ghost", "b", [3, 0], sets)], [team("a"), team("b")]);
  assert.equal(table.find((r) => r.team_id === "a").played, 0);
  assert.equal(table.find((r) => r.team_id === "b").played, 0);
});


test("more wins break a points tie before set ratio", () => {
  // a: 1 win, sets 3-5 (0.6); b: 0 wins, sets 4-6 (0.67). Wins must win over the better set ratio
  const games = [
    game("a", "x", [3, 2], []),
    game("a", "x", [0, 3], []),
    game("b", "x", [2, 3], []),
    game("b", "x", [2, 3], []),
  ];
  const table = tableFromGames(games, [team("b"), team("a"), team("x")]);
  assert.deepEqual(table.filter((r) => ["a", "b"].includes(r.team_id)).map((r) => [r.team_id, r.points, r.won]), [["a", 2, 1], ["b", 2, 0]]);
});

test("played games without set scores are skipped while valid games count", () => {
  const games = [game("a", "b", null, []), game("a", "b", [3, 0], [[25, 10], [25, 10], [25, 10]])];
  assert.deepEqual(tableFromGames(games, [team("a"), team("b")]).map((r) => [r.team_id, r.played, r.points]), [["a", 1, 3], ["b", 1, 0]]);
});
