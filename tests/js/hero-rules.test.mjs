import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { FENICE_LABEL, clipboardText, lastResultMeta, matchSides, matchTitle, opponentChipTexts, sharePayload, teamSummary } from "../../docs/hero-rules.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const sample = load("data-sample.json");
const girone = load("data-64353.json");
const FENICE = "232642";

const homeGame = sample.games.find((g) => g.id === "3");

test("match title: home side first, the Fenice as «ASD Fenice»", () => {
  assert.equal(matchTitle(sample, homeGame), "ASD Fenice - VSA");
  assert.equal(FENICE_LABEL, "ASD Fenice");
});

test("match title: an away game puts the opponent first", () => {
  const away = { ...homeGame, home_id: "232656", away_id: FENICE };
  assert.equal(matchTitle(sample, away), "VSA - ASD Fenice");
  assert.deepEqual(matchSides(sample, away).map((s) => s.isFenice), [false, true]);
});

test("match title: an unknown team reads «Squadra sconosciuta»", () => {
  assert.equal(matchTitle(sample, { ...homeGame, away_id: "999" }), "ASD Fenice - Squadra Sconosciuta");
});

test("share payload: title, text with day, time and place, and the page url", () => {
  const game = { ...homeGame, venue: { ...homeGame.venue, name: "PALASPORT BEATRICE LOPEZ", city: "QUARTUCCIU" } };
  const p = sharePayload(sample, game, "https://example.org/fenice/");
  assert.equal(p.title, "ASD Fenice - VSA");
  assert.equal(p.text, "ASD Fenice - VSA, sabato 21 novembre ore 17:00, Palasport Beatrice Lopez, Quartucciu");
  assert.equal(p.url, "https://example.org/fenice/");
});

test("share payload: no url key when the page address is unknown, no time says so", () => {
  const p = sharePayload(sample, { ...homeGame, time: null }, undefined);
  assert.equal("url" in p, false);
  assert.match(p.text, /sabato 21 novembre orario da definire/);
});

test("share payload: a venue with only a name drops the town", () => {
  assert.match(sharePayload(sample, homeGame, "https://x.test/").text, /ore 17:00, Palestra$/);
});

test("clipboard text: the text, then the url on its own line when there is one", () => {
  assert.equal(clipboardText({ text: "A - B", url: "https://x.test/" }), "A - B\nhttps://x.test/");
  assert.equal(clipboardText({ text: "A - B" }), "A - B");
});

test("team summary: a team that has not played reads zero games and no form", () => {
  const s = teamSummary(sample, "232656");
  assert.deepEqual([s.played, s.won, s.lost, s.form], [0, 0, 0, []]);
});

test("team summary: record and form from the games, position from the standings", () => {
  const data = structuredClone(girone);
  const opp = data.standings[1].team_id;
  const s = teamSummary(data, opp);
  // Sarroch (232139): round 1 home 2-3 lost, round 2 home 3-0 won, round 3 away 0-3 for the home side won
  assert.equal(opp, "232139");
  assert.equal(s.position, 2);
  assert.deepEqual([s.played, s.won, s.lost], [3, 2, 1]);
  assert.deepEqual(s.form, ["lost", "won", "won"]);
});

test("team summary: form keeps the last five, oldest first", () => {
  const games = Array.from({ length: 7 }, (_, i) => ({
    id: `x${i}`, home_id: "A", away_id: `B${i}`, played: true, starts_at: `2027-01-0${i + 1}T17:00:00+01:00`, sets: [],
    sets_won: i < 2 ? [0, 3] : [3, 0],
  }));
  const s = teamSummary({ games, standings: [], teams: [], team_cod: "" }, "A");
  assert.deepEqual(s.form, ["won", "won", "won", "won", "won"]);
  assert.deepEqual([s.played, s.won, s.lost], [7, 5, 2]);
  assert.equal(s.position, null);
});

test("team summary: form of mixed results is in play order, oldest first", () => {
  // outcomes in date order: won, lost, won, won, lost, lost; the last five are lost, won, won, lost, lost
  const sets = [[3, 0], [0, 3], [3, 0], [3, 0], [0, 3], [0, 3]];
  const games = sets.map((sets_won, i) => ({
    id: `m${i}`, home_id: "A", away_id: `B${i}`, played: true, starts_at: `2027-02-0${i + 1}T17:00:00+01:00`, sets: [], sets_won,
  }));
  const s = teamSummary({ games: [...games].reverse(), standings: [], teams: [], team_cod: "" }, "A");
  assert.deepEqual(s.form, ["lost", "won", "won", "lost", "lost"]);
  assert.deepEqual([s.played, s.won, s.lost], [6, 3, 3]);
});

test("chips: position, record in plural form, and the empty record", () => {
  assert.deepEqual(opponentChipTexts({ position: 6, played: 0, won: 0, lost: 0, form: [] }), ["6ª in classifica", "nessuna partita giocata"]);
  assert.deepEqual(opponentChipTexts({ position: 2, played: 3, won: 2, lost: 1, form: [] }), ["2ª in classifica", "2 vinte, 1 persa"]);
  assert.deepEqual(opponentChipTexts({ position: 1, played: 1, won: 1, lost: 0, form: [] }), ["1ª in classifica", "1 vinta, 0 perse"]);
});

test("chips: no position chip when the standings do not list the team", () => {
  assert.deepEqual(opponentChipTexts({ position: null, played: 0, won: 0, lost: 0, form: [] }), ["nessuna partita giocata"]);
});

test("last result meta: round, short day and the side", () => {
  const home = lastResultMeta({ round: 4, starts_at: "2026-12-12T19:00:00+01:00", home_id: FENICE, away_id: "x" }, FENICE);
  assert.equal(home, "4ª giornata, sab 12 dic · in casa");
  const away = lastResultMeta({ round: 5, starts_at: "2026-12-19T19:00:00+01:00", home_id: "x", away_id: FENICE }, FENICE);
  assert.match(away, /^5ª giornata, sab 19 dic · in trasferta$/);
});

test("last result meta: no day when the game has no date", () => {
  assert.equal(lastResultMeta({ round: 4, starts_at: null, home_id: FENICE, away_id: "x" }, FENICE), "4ª giornata · in casa");
});

test("share payload: a venue without name and town leaves the place out, no trailing comma", () => {
  const game = { ...homeGame, venue: { ...homeGame.venue, name: null, city: null } };
  assert.equal(sharePayload(sample, game, undefined).text, "ASD Fenice - VSA, sabato 21 novembre ore 17:00");
});

test("share payload: the day is the Rome one even on a clock in UTC", () => {
  const previous = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    const game = { ...homeGame, starts_at: "2026-11-21T00:30:00+01:00", time: "00:30" };
    assert.match(sharePayload(sample, game, undefined).text, /, sabato 21 novembre ore 00:30, /);
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});
