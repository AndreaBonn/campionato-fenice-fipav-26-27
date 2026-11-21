import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { feniceGames, feniceTeamId } from "../../docs/game-rules.js";
import { DEFAULT_FILTER, andataGame, effectiveFilter, emptyMessage, filterGames, groupByMonth, roundLabel, roundsPerHalf, withChoice } from "../../docs/schedule-rules.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const NOW = new Date("2026-11-20T10:00:00Z");
const me = feniceTeamId(girone);
const mine = feniceGames(girone);
const ids = (list) => list.map((g) => g.id);

test("filterGames: Prossime keeps every game that is not played, Giocate the played ones, Tutte all", () => {
  const next = filterGames(mine, { when: "next", side: "all" }, me, NOW);
  const played = filterGames(mine, { when: "played", side: "all" }, me, NOW);
  assert.ok(next.length > 0 && played.length > 0);
  assert.ok(next.every((g) => !g.played) && played.every((g) => g.played));
  assert.equal(next.length + played.length, mine.length);
  assert.deepEqual(ids(filterGames(mine, { when: "all", side: "all" }, me, NOW)), ids(mine));
});

test("filterGames: Prossime includes unscheduled and awaiting games, not only the upcoming ones", () => {
  const base = mine.find((g) => !g.played);
  const undated = { ...base, id: "u", starts_at: null, date: null, time: null };
  const awaiting = { ...base, id: "w", starts_at: "2026-11-10T10:00:00+01:00" };
  assert.deepEqual(ids(filterGames([undated, awaiting], DEFAULT_FILTER, me, NOW)), ["u", "w"]);
  assert.deepEqual(filterGames([undated, awaiting], { when: "played", side: "all" }, me, NOW), []);
});

test("filterGames: side narrows to home or away games of the followed team, and the two sides add up", () => {
  const all = { when: "all", side: "all" };
  const home = filterGames(mine, { ...all, side: "home" }, me, NOW);
  const away = filterGames(mine, { ...all, side: "away" }, me, NOW);
  assert.ok(home.length > 0 && away.length > 0);
  assert.ok(home.every((g) => g.home_id === me) && away.every((g) => g.away_id === me));
  assert.equal(home.length + away.length, mine.length);
});

test("withChoice: changes one group, ignores unknown groups and values", () => {
  assert.deepEqual(withChoice(DEFAULT_FILTER, "when", "played"), { when: "played", side: "all" });
  assert.deepEqual(withChoice(DEFAULT_FILTER, "side", "away"), { when: "next", side: "away" });
  assert.equal(withChoice(DEFAULT_FILTER, "when", "nope"), DEFAULT_FILTER);
  assert.equal(withChoice(DEFAULT_FILTER, "color", "red"), DEFAULT_FILTER);
});

test("emptyMessage: a sentence for every combination", () => {
  assert.equal(emptyMessage({ when: "played", side: "all" }), "Nessuna partita giocata finora.");
  assert.equal(emptyMessage({ when: "played", side: "home" }), "Nessuna partita giocata in casa finora.");
  assert.equal(emptyMessage({ when: "next", side: "away" }), "Nessuna partita da giocare in trasferta.");
  assert.equal(emptyMessage({ when: "next", side: "all" }), "Nessuna partita da giocare.");
  assert.equal(emptyMessage({ when: "all", side: "home" }), "Nessuna partita in casa.");
});

test("groupByMonth: months in date order with a capital, undated games last in their own group", () => {
  const g = (id, starts_at) => ({ id, starts_at });
  const groups = groupByMonth([g("c", null), g("b", "2026-12-05T16:30:00+01:00"), g("a", "2026-11-21T17:00:00+01:00"), g("a2", "2026-11-29T15:00:00+01:00")]);
  assert.deepEqual(groups.map((x) => x.label), ["Novembre 2026", "Dicembre 2026", "Data da definire"]);
  assert.deepEqual(groups.map((x) => ids(x.games)), [["a", "a2"], ["b"], ["c"]]);
});

test("groupByMonth: the month is the Rome one, a game just after midnight on the 1st is not in the month before", () => {
  const groups = groupByMonth([{ id: "x", starts_at: "2026-11-30T23:30:00Z" }]);
  assert.equal(groups[0].label, "Dicembre 2026");
});

const teamsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));
const roundsOf = (...rounds) => rounds.map((round) => ({ round }));

test("roundsPerHalf: from the number of teams, even N gives N-1 rounds per half, odd N gives N", () => {
  assert.equal(roundsPerHalf({ teams: teamsOf(10), games: roundsOf(1, 18, 9) }), 9);
  assert.equal(roundsPerHalf({ teams: teamsOf(9), games: roundsOf(1, 9) }), 9);
});

test("roundsPerHalf: only the andata published (rounds 1-9 of 10 teams) still has 9 rounds per half", () => {
  assert.equal(roundsPerHalf({ teams: teamsOf(10), games: roundsOf(1, 5, 9) }), 9);
});

test("roundsPerHalf: null without teams or when a round is above two halves", () => {
  assert.equal(roundsPerHalf({ teams: [], games: roundsOf(1, 2) }), null);
  assert.equal(roundsPerHalf({ games: roundsOf(1, 2) }), null);
  assert.equal(roundsPerHalf({ teams: teamsOf(10), games: roundsOf(1, 19) }), null);
});

test("effectiveFilter: Prossime with no unplayed game at all shows Tutte, keeping the side", () => {
  const allPlayed = mine.map((g) => ({ ...g, played: true }));
  assert.deepEqual(effectiveFilter({ when: "next", side: "home" }, allPlayed, NOW), { when: "all", side: "home" });
  assert.deepEqual(effectiveFilter({ when: "played", side: "all" }, allPlayed, NOW), { when: "played", side: "all" });
});

test("effectiveFilter: Prossime stays when some game is not played, whatever the side", () => {
  const filter = { when: "next", side: "all" };
  assert.equal(effectiveFilter(filter, mine, NOW), filter);
});

test("roundLabel: andata, ritorno counted from 1, fallback to «Giornata N»", () => {
  assert.equal(roundLabel(3, 9), "3ª giornata di andata");
  assert.equal(roundLabel(9, 9), "9ª giornata di andata");
  assert.equal(roundLabel(10, 9), "1ª giornata di ritorno");
  assert.equal(roundLabel(18, 9), "9ª giornata di ritorno");
  assert.equal(roundLabel(4, null), "Giornata 4");
  assert.equal(roundLabel(19, 9), "Giornata 19");
});

test("andataGame: the played andata against the same opponent, only for a ritorno game", () => {
  const g = (id, round, home_id, away_id, played) => ({ id, round, home_id, away_id, played, sets_won: played ? [3, 1] : null });
  const list = [g("a1", 1, "F", "X", true), g("a2", 2, "Y", "F", false), g("r1", 10, "X", "F", false), g("r2", 11, "F", "Y", false)];
  assert.equal(andataGame(list[2], list, 9, "F").id, "a1");
  assert.equal(andataGame(list[3], list, 9, "F"), null); // the andata exists but is not played
  assert.equal(andataGame(list[0], list, 9, "F"), null); // an andata game has no andata
  assert.equal(andataGame(list[2], list, null, "F"), null);
});
