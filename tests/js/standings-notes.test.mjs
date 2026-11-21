import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { TIE_BREAK_LABELS, howToRead, lastFive, preseasonNote } from "../../docs/standings-notes.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const FENICE = "232645";
const zeroRows = [{ team_id: "a", played: 0 }, { team_id: "b", played: 0 }];
const game = (home, away, startsAt, sets, played = true) => ({ home_id: home, away_id: away, starts_at: startsAt, played, sets_won: played ? sets : null, sets: [] });

test("preseason note names the earliest start in Rome time while nobody has played", () => {
  const games = [game("a", "b", "2026-11-28T18:00:00+01:00", null, false), game("b", "a", "2026-11-21T23:30:00+01:00", null, false)];
  assert.equal(
    preseasonNote(zeroRows, games),
    "Il campionato parte sabato 21 novembre: finché nessuno ha giocato tutte le squadre hanno 0 punti e l'ordine non è ancora una graduatoria.",
  );
});

test("preseason note without any start date drops the date clause", () => {
  const note = preseasonNote(zeroRows, [game("a", "b", null, null, false)]);
  assert.equal(note, "Finché nessuno ha giocato tutte le squadre hanno 0 punti e l'ordine non è ancora una graduatoria.");
  assert.equal(preseasonNote(zeroRows, []), note);
});

test("preseason note is empty as soon as one team has played, or without rows", () => {
  const games = [game("a", "b", "2026-11-21T18:00:00+01:00", null, false)];
  assert.equal(preseasonNote([{ team_id: "a", played: 0 }, { team_id: "b", played: 1 }], games), "");
  assert.equal(preseasonNote([], games), "");
  assert.notEqual(preseasonNote(zeroRows, games), "");
});

test("last five: V/P outcomes of the team's last five played games, oldest first, by play date", () => {
  const games = [
    game("a", "b", "2026-10-01T18:00:00+02:00", [3, 0]),
    game("c", "a", "2026-10-08T18:00:00+02:00", [3, 1]),
    game("a", "d", "2026-10-15T18:00:00+02:00", [3, 2]),
    game("e", "a", "2026-10-22T18:00:00+02:00", [0, 3]),
    game("a", "f", "2026-10-29T18:00:00+01:00", [1, 3]),
    game("g", "a", "2026-11-05T18:00:00+01:00", [3, 2]),
    game("b", "c", "2026-11-06T18:00:00+01:00", [3, 0]),
    game("a", "h", "2026-11-12T18:00:00+01:00", null, false),
  ];
  const expected = ["lost", "won", "won", "lost", "lost"];
  assert.deepEqual(lastFive(games, "a"), expected);
  assert.deepEqual(lastFive([...games].reverse(), "a"), expected);
  assert.deepEqual(lastFive(games, "b"), ["lost", "won"]);
});

test("last five is empty for a team with no played game, and ignores unplayed games", () => {
  assert.deepEqual(lastFive([game("a", "b", "2026-11-12T18:00:00+01:00", null, false)], "a"), []);
  assert.deepEqual(lastFive([], "a"), []);
});

test("last five on the real fixture: at most five V/P letters for the Fenice", () => {
  const played = girone.games.filter((g) => g.played && [g.home_id, g.away_id].includes(FENICE));
  const outcomes = lastFive(girone.games, FENICE);
  assert.equal(outcomes.length, Math.min(5, played.length));
  assert.ok(outcomes.length > 0);
  assert.ok(outcomes.every((o) => o === "won" || o === "lost"));
});

test("how-to items: Pt rule, G/V/P, Set and the two ratios, plus the Fenice highlight", () => {
  const { items } = howToRead({ tieBreak: girone.tie_break, showPossible: false });
  const byTerm = Object.fromEntries(items.map((i) => [i.term, i.text]));
  assert.match(byTerm.Pt, /3 per una vittoria 3-0 o 3-1, 2 per un 3-2, 1 per una sconfitta 2-3/);
  assert.ok(byTerm["G, V, P"]);
  assert.ok(byTerm.Set);
  assert.ok(byTerm["Q. set"]);
  assert.ok(byTerm["Q. punti"]);
  assert.match(byTerm.Fenice, /evidenziata/);
  assert.equal("Poss." in byTerm, false);
});

test("how-to explains Poss. only when that column is shown", () => {
  const withPoss = howToRead({ tieBreak: girone.tie_break, showPossible: true }).items.map((i) => i.term);
  assert.ok(withPoss.includes("Poss."));
  assert.ok(withPoss.includes("Pt"));
});

test("tie-break sentence lists the criteria in order with their labels; provisional adds the Comitato line", () => {
  const provisional = howToRead({ tieBreak: { provisional: true, criteria: ["wins", "set_ratio", "point_ratio"] }, showPossible: false }).tieBreak;
  assert.equal(
    provisional,
    "A parità di punti si guarda, nell'ordine: vittorie, quoziente set, quoziente punti. Criterio provvisorio finché il Comitato non pubblica l'indizione.",
  );
  const official = howToRead({ tieBreak: { provisional: false, criteria: ["wins"] }, showPossible: false }).tieBreak;
  assert.equal(official, "A parità di punti si guarda, nell'ordine: vittorie.");
  const unknown = howToRead({ tieBreak: { provisional: false, criteria: ["wins", "custom"] }, showPossible: false }).tieBreak;
  assert.match(unknown, /vittorie, custom\./);
  assert.equal(TIE_BREAK_LABELS.wins, "vittorie");
});
