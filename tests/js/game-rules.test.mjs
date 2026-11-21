import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { MATCH_WINDOW_MS, changeDetail, feniceGames, feniceTeamId, form, gameStatus, isHome, lastPlayed, mapUrl, nextGame, outcome, refereesLabel, setScores } from "../../docs/game-rules.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const sample = load("data-sample.json");
const girone = load("data-64353.json");

test("fenice team id: resolved from team_cod, differs between fixtures", () => {
  assert.equal(feniceTeamId(sample), "232642");
  assert.equal(feniceTeamId(girone), "232645");
});

test("fenice games: only the games the team plays, in the file order", () => {
  assert.deepEqual(feniceGames(sample).map((g) => g.number), ["1168", "1169", "1170", "1171", "1172"]);
  const mine = feniceGames(girone);
  assert.equal(mine.length, 10);
  assert.ok(mine.every((g) => g.home_id === "232645" || g.away_id === "232645"));
  assert.ok(girone.games.length > mine.length);
});

test("is home: compares the home side with the team id", () => {
  const [first, , , fourth] = feniceGames(girone);
  assert.equal(isHome(first, "232645"), false);
  assert.equal(isHome(fourth, "232645"), false);
  assert.equal(isHome(feniceGames(girone)[1], "232645"), true);
});

test("next game: first unplayed game from now on, boundary included", () => {
  const games = feniceGames(girone);
  const before = new Date("2026-11-20T10:00:00Z");
  assert.equal(nextGame(games, before).number, "949");
  const atKickoff = new Date("2026-11-30T17:00:00Z"); // 18:00 in Rome, exactly the start
  assert.equal(nextGame(games, atKickoff).number, "949");
  const afterWindow = new Date("2026-11-30T20:00:01Z"); // 3 h and 1 s after the whistle
  assert.equal(nextGame(games, afterWindow).number, "953");
});

test("next game: null once the season is over", () => {
  const games = feniceGames(girone);
  assert.equal(nextGame(games, new Date("2027-06-01T00:00:00Z")), null);
});

test("next game: games without a date are left out, played games too", () => {
  const games = feniceGames(sample);
  // 1168 and 1169 are played, 1172 has no date: the first unplayed dated one is 1170
  assert.equal(nextGame(games, new Date("2026-11-20T10:00:00Z")).number, "1170");
  assert.equal(nextGame(games, new Date("2026-11-21T20:00:01+01:00")), null);
});

test("next game: a game just started stays the next one for the match window", () => {
  const games = feniceGames(girone);
  assert.equal(nextGame(games, new Date("2026-11-30T17:01:00Z")).number, "949");
  assert.equal(nextGame(games, new Date("2026-11-30T19:59:59Z")).number, "949");
});

test("next game: started 4 h ago and still not updated, moves on to the following one", () => {
  const games = feniceGames(girone);
  assert.equal(nextGame(games, new Date("2026-11-30T21:00:00Z")).number, "953");
});

test("next game: picks the earliest start even if the list is not in order", () => {
  const games = feniceGames(girone).slice(3).reverse();
  assert.equal(nextGame(games, new Date("2026-11-20T10:00:00Z")).number, "949");
});

test("outcome: won, lost or null from the team's perspective", () => {
  const [first, second] = feniceGames(girone);
  assert.equal(outcome(first, "232645"), "lost");
  assert.equal(outcome(first, "232550"), "won");
  assert.equal(outcome(second, "232645"), "lost");
  assert.equal(outcome(feniceGames(sample)[0], "232642"), "won");
  assert.equal(outcome(feniceGames(sample)[2], "232642"), null);
});

test("map url: Google Maps search on latitude and longitude", () => {
  const venue = { name: "P", address: null, city: null, lat: 39.2547576, lng: 9.1761296 };
  assert.equal(mapUrl(venue), "https://www.google.com/maps/search/?api=1&query=39.2547576,9.1761296");
});

test("map url: null without coordinates, but a zero coordinate is a coordinate", () => {
  assert.equal(mapUrl(feniceGames(sample)[0].venue), null);
  assert.equal(mapUrl({ lat: 39.2, lng: null }), null);
  assert.equal(mapUrl({ lat: 0, lng: 9.1 }), "https://www.google.com/maps/search/?api=1&query=0,9.1");
});

const FENICE = "232642";
const played = (id, sets_won) => ({ id, home_id: FENICE, away_id: "x", played: true, sets_won, sets: [] });

test("last played: the latest played game, null when none is played", () => {
  const games = [played("a", [3, 0]), played("b", [0, 3]), { id: "c", home_id: FENICE, away_id: "x", played: false, sets_won: null, sets: [] }];
  assert.equal(lastPlayed(games).id, "b");
  assert.equal(lastPlayed([games[2]]), null);
});

test("form: last 5 outcomes oldest first, from the team's perspective", () => {
  const games = ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => played(id, i % 2 ? [0, 3] : [3, 0]));
  assert.deepEqual(form(games, FENICE), ["won", "lost", "won", "lost", "won"]);
  assert.equal(form(games, FENICE).length, 5);
  assert.deepEqual(form([played("a", [3, 2])], FENICE), ["won"]);
  assert.deepEqual(form([{ ...played("a", [3, 2]), home_id: "x", away_id: FENICE }], FENICE), ["lost"]);
});

test("referees label: names when present, a fixed phrase when pending, null otherwise", () => {
  const base = { referees: [], referee_pending: false };
  assert.equal(refereesLabel({ ...base, referees: ["Marini Anna", "Rossi Luca"] }), "Arbitri: Marini Anna, Rossi Luca");
  assert.equal(refereesLabel({ ...base, referees: ["Marini Anna"] }), "Arbitro: Marini Anna");
  assert.equal(refereesLabel({ ...base, referee_pending: true }), "Arbitro da designare");
  assert.equal(refereesLabel(base), null);
});

test("changeDetail is the moved part only, null when nothing changed", () => {
  assert.equal(changeDetail({ changes: [] }), null);
  assert.equal(changeDetail({ changes: ["date", "time"] }), "cambiati data e ora");
});

test("fenice team id: null when team_cod names no team, and then the club has no games", () => {
  const unknown = { ...sample, team_cod: "000000000" };
  assert.equal(feniceTeamId(unknown), null);
  assert.deepEqual(feniceGames(unknown), []);
  assert.equal(feniceGames(sample).length, 5);
});

test("set scores: set by set from the team's side, empty for a game not played", () => {
  assert.deepEqual(setScores(feniceGames(sample)[0], "232642"), ["25-12", "25-19", "25-18"]);
  assert.deepEqual(setScores(feniceGames(girone)[0], "232645"), ["12-25", "19-25", "18-25"]);
  assert.deepEqual(setScores(feniceGames(sample)[2], "232642"), []);
});

test("changeDetail: none without the changes key, one known field, an unknown key as it is, three fields", () => {
  assert.equal(changeDetail({}), null);
  assert.equal(changeDetail({ changes: ["venue"] }), "cambiata la palestra");
  assert.equal(changeDetail({ changes: ["x"] }), "cambiata la x");
  assert.equal(changeDetail({ changes: ["date", "time", "venue"] }), "cambiati data, ora e palestra");
});

test("a postponed game played after later rounds is the last result and the newest in the form", () => {
  const at = (game, starts_at) => ({ ...game, starts_at });
  // round 2 was postponed: played on 30 Nov, after round 3 of 23 Nov
  const games = [at(played("r1", [3, 0]), "2026-11-09T18:00:00+01:00"), at(played("r2", [0, 3]), "2026-11-30T18:00:00+01:00"),
    at(played("r3", [3, 1]), "2026-11-23T18:00:00+01:00")];
  assert.equal(lastPlayed(games).id, "r2");
  assert.deepEqual(form(games, FENICE), ["won", "won", "lost"]);
  const inOrder = [games[0], games[2], games[1]];
  assert.equal(lastPlayed(inOrder).id, "r2");
});

// One unplayed game at 17:00 Rome time, seen at every edge of its lifecycle
const KICKOFF = "2026-11-21T17:00:00+01:00";
const at = (offsetMs) => new Date(Date.parse(KICKOFF) + offsetMs);
const unplayed = { played: false, starts_at: KICKOFF };

test("game status: upcoming before the whistle, live from the whistle to the end of the match window", () => {
  assert.equal(gameStatus(unplayed, at(-1)), "upcoming");
  assert.equal(gameStatus(unplayed, at(0)), "live");
  assert.equal(gameStatus(unplayed, at(MATCH_WINDOW_MS)), "live");
});

test("game status: past the match window without a result it is awaiting, never upcoming again", () => {
  assert.equal(gameStatus(unplayed, at(MATCH_WINDOW_MS + 1)), "awaiting");
  assert.equal(gameStatus(unplayed, at(30 * 24 * 3600e3)), "awaiting");
});

test("game status: a played game is played at any instant, a game without a start is unscheduled", () => {
  assert.equal(gameStatus({ played: true, starts_at: KICKOFF }, at(-1)), "played");
  assert.equal(gameStatus({ played: true, starts_at: null }, at(0)), "played");
  assert.equal(gameStatus({ played: false, starts_at: null }, at(0)), "unscheduled");
});

test("next game: exactly the games whose status is upcoming or live", () => {
  const games = feniceGames(sample);
  for (const offset of [-1, 0, MATCH_WINDOW_MS, MATCH_WINDOW_MS + 1]) {
    const next = nextGame(games, at(offset));
    const open = games.filter((g) => ["upcoming", "live"].includes(gameStatus(g, at(offset))));
    assert.equal(next === null, open.length === 0);
    if (next) assert.ok(open.includes(next));
  }
});

test("a played game without a date goes before the dated ones, so it is never the last result", () => {
  const undated = { ...played("x", [3, 0]), starts_at: null };
  const dated = { ...played("d", [0, 3]), starts_at: "2026-11-09T18:00:00+01:00" };
  assert.equal(lastPlayed([dated, undated]).id, "d");
  assert.equal(lastPlayed([undated, dated]).id, "d");
});
