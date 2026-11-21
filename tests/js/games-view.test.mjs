import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { errorCause, renderChecked, renderEmpty, renderError, renderHero, renderSchedule } from "../../docs/games-view.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const sample = load("data-sample.json");
const girone = load("data-64353.json");
const count = (html, needle) => html.split(needle).length - 1;

// 18 Fenice games alternating home and away, like the real girone, with the fixture's teams as opponents
function season18() {
  const opponents = girone.teams.filter((t) => t.id !== "232645");
  const games = Array.from({ length: 18 }, (_, i) => {
    const home = i % 2 === 0, opp = opponents[i % opponents.length].id;
    const day = String(1 + i).padStart(2, "0");
    return {
      ...girone.games[0], id: `g${i + 1}`, number: String(2000 + i), round: i + 1,
      date: `2027-02-${day}`, time: "17:00", starts_at: `2027-02-${day}T17:00:00+01:00`,
      home_id: home ? "232645" : opp, away_id: home ? opp : "232645",
      played: false, official: false, sets_won: null, sets: [],
    };
  });
  return { ...girone, games };
}

test("hero: opponent, home tag, date, time and countdown of the next game", () => {
  const html = renderHero(sample, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /VSA/);
  assert.match(html, /In casa/);
  assert.match(html, /sabato 21 novembre, ore 17:00/);
  assert.match(html, /<b>Domani<\/b>/);
});

test("hero: away game shows the venue with a Google Maps link", () => {
  const html = renderHero(girone, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /Asd Sporting Club Su Planu/);
  assert.match(html, /In trasferta/);
  assert.match(html, /Pal\. Ist\. Euclide, Via Araolla, Selargius/);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=39\.252413,9\.1108387"/);
  assert.match(html, /ore 18:00/);
});

test("hero: no map link when the venue has no coordinates", () => {
  const html = renderHero(sample, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /Palestra/);
  assert.equal(count(html, "google.com/maps"), 0);
});

test("hero: season over states it plainly", () => {
  const html = renderHero(girone, new Date("2027-06-01T00:00:00Z"));
  assert.match(html, /Stagione regolare conclusa/);
  assert.equal(count(html, "Domani"), 0);
});

test("hero: empty string when the club has no games, the page hides the box", () => {
  assert.equal(renderHero({ ...girone, games: [] }, new Date("2026-11-20T10:00:00Z")), "");
});

test("hero: unplayed games without a date read «da definire», not season over", () => {
  const undated = { ...sample, games: [sample.games[4]] };
  const html = renderHero(undated, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /Prossima partita da definire/);
  assert.equal(count(html, "Stagione regolare conclusa"), 0);
});

test("schedule: 18 rows grouped under 18 round headings", () => {
  const html = renderSchedule(season18(), new Date("2027-01-01T00:00:00Z"));
  assert.equal(count(html, '<li class="game'), 18);
  assert.equal(count(html, "<h3>"), 18);
  assert.match(html, /<h3>Giornata 1<\/h3>/);
  assert.match(html, /<h3>Giornata 18<\/h3>/);
  assert.equal(count(html, "game next"), 1);
});

test("schedule: a played game shows the result and the sets from the Fenice side", () => {
  const html = renderSchedule(girone, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /<b>0-3<\/b>/);
  assert.match(html, /12-25, 19-25, 18-25/);
  assert.match(html, /Persa/);
  assert.equal(count(html, "Da giocare"), 7);
});

test("schedule: a game without a date says so", () => {
  const html = renderSchedule(sample, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /Data da definire/);
});

test("schedule: every string from the data is escaped", () => {
  const evil = structuredClone(girone);
  evil.teams.find((t) => t.id === "232396").name = "<img src=x onerror=alert(1)>";
  evil.games.find((g) => g.number === "949").venue.name = '"><script>x</script>';
  const html = renderSchedule(evil, new Date("2026-11-20T10:00:00Z")) + renderHero(evil, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, "<img"), 0);
  assert.equal(count(html, "<script"), 0);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/i);
});

test("error: plain cause and a Riprova button, never a stack trace", () => {
  const html = renderError(new TypeError("Failed to fetch"), "https:");
  assert.match(html, /Impossibile caricare i dati/);
  assert.match(html, /Connessione non riuscita/);
  assert.match(html, /<button[^>]*id="retry"[^>]*>Riprova<\/button>/);
  assert.equal(count(html, "Failed to fetch"), 0);
});

test("error cause: server status, and the local file hint only on file:", () => {
  assert.equal(errorCause(new Error("HTTP 404"), "https:"), "Il server ha risposto con un errore (404). Riprova tra poco.");
  assert.match(errorCause(new TypeError("x"), "file:"), /server locale/);
  assert.equal(count(errorCause(new TypeError("x"), "https:"), "server locale"), 0);
});

test("empty: no Fenice games gives a headline and a Riprova button", () => {
  const html = renderEmpty();
  assert.match(html, /Calendario non ancora disponibile/);
  assert.match(html, /<button[^>]*id="retry"[^>]*>Riprova<\/button>/);
});

test("schedule: no games for the club renders the empty state", () => {
  const html = renderSchedule({ ...girone, games: [] }, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /Calendario non ancora disponibile/);
});

test("checked line: relative age of the last successful sync", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  assert.equal(renderChecked("2026-11-21T09:30:00Z", now), "Ultimo controllo su FIPAV Online: 2 ore fa");
});
