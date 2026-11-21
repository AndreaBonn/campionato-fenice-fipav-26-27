import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { feniceGames } from "../../docs/game-rules.js";
import { errorCause, renderCalendarFeed, renderChecked, renderEmpty, renderError, renderHero, renderLastResult, renderSchedule } from "../../docs/games-view.js";

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
  const over = { ...girone, games: girone.games.map((g) => ({ ...g, played: true })) };
  const html = renderHero(over, new Date("2027-06-01T00:00:00Z"));
  assert.match(html, /Stagione regolare conclusa/);
  assert.equal(count(html, "Domani"), 0);
});

test("hero: empty string when the club has no games, the page hides the box", () => {
  assert.equal(renderHero({ ...girone, games: [] }, new Date("2026-11-20T10:00:00Z")), "");
});

test("hero: 60 s after the whistle of the only unplayed game says «In corso», not season over", () => {
  const one = { ...sample, games: [sample.games[2]] };
  const html = renderHero(one, new Date("2026-11-21T17:01:00+01:00"));
  assert.match(html, /<b>In corso<\/b>/);
  assert.equal(count(html, "Stagione regolare conclusa"), 0);
  assert.equal(count(html, "0 minuti"), 0);
});

test("hero: at the exact whistle the countdown says «In corso»", () => {
  const one = { ...sample, games: [sample.games[2]] };
  assert.match(renderHero(one, new Date("2026-11-21T17:00:00+01:00")), /<b>In corso<\/b>/);
});

test("hero: an old unplayed game not yet updated is not «Stagione conclusa»", () => {
  const one = { ...sample, games: [sample.games[2]] };
  const html = renderHero(one, new Date("2026-11-21T22:00:00+01:00"));
  assert.equal(count(html, "Stagione regolare conclusa"), 0);
  assert.match(html, /Risultato in aggiornamento/);
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

test("schedule: a played game without sets (forfeit) shows the score and no empty «Set:» line", () => {
  const forfeit = structuredClone(girone);
  for (const g of forfeit.games.filter((x) => x.played)) g.sets = [];
  const html = renderSchedule(forfeit, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /<b>0-3<\/b>/);
  assert.equal(count(html, "Set:"), 0);
});

test("schedule: a game with a date but no time says the time is to be defined", () => {
  const notime = structuredClone(girone);
  const next = feniceGames(notime).find((x) => !x.played && x.starts_at);
  notime.games.find((x) => x.id === next.id).time = null;
  const html = renderSchedule(notime, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /orario da definire/);
  assert.equal(count(html, "ore null"), 0);
});

test("schedule: the round heading and the venue parts are escaped, and shown escaped", () => {
  const evil = structuredClone(girone);
  const mine = evil.games.find((g) => g.id === feniceGames(evil)[0].id);
  mine.round = "<script>r</script>";
  Object.assign(mine.venue, { name: "<script>n</script>", address: "<script>a</script>", city: "<script>c</script>" });
  const html = renderSchedule(evil, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, "<script"), 0);
  assert.match(html, /&lt;script&gt;r/);
  for (const part of ["n", "a", "c"]) assert.match(html, new RegExp(`&lt;script&gt;${part}&lt;/script&gt;`, "i"));
});

test("schedule: every string from the data is escaped", () => {
  const evil = structuredClone(girone);
  evil.teams.find((t) => t.id === "232396").name = "<img src=x onerror=alert(1)>";
  evil.games.find((g) => g.number === "949").venue.name = '"><script>x</script>';
  const html = renderSchedule(evil, new Date("2026-11-20T10:00:00Z")) + renderHero(evil, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, "<img"), 0);
  assert.equal(count(html, "<script"), 0);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/i);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/); // venue.name, the positive case beside the negative one
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

test("last result: score, sets and verdict from the club side", () => {
  const html = renderLastResult(girone);
  assert.match(html, /Ultimo risultato/);
  assert.match(html, /Sarlux Volley Sarroch/);
  assert.match(html, /<b>0-3<\/b>/);
  assert.match(html, /10-25, 18-25, 19-25/);
  assert.match(html, /Persa/);
});

test("last result: form strip carries V or P as text for every game, not only a colour", () => {
  const html = renderLastResult(girone);
  assert.equal(count(html, 'class="f lost">P<'), 3);
  assert.equal(count(html, 'class="f won">V<'), 0);
  const won = renderLastResult(sample);
  assert.equal(count(won, 'class="f won">V<'), 2);
  assert.match(won, /aria-label="Forma delle ultime partite/);
});

test("last result: empty string when no game was played", () => {
  assert.equal(renderLastResult({ ...girone, games: girone.games.map((g) => ({ ...g, played: false, sets_won: null, sets: [] })) }), "");
});

test("schedule: live link only on the game with a live_url, opening in a new tab safely", () => {
  const html = renderSchedule(sample, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, ">Diretta<"), 1);
  assert.match(html, /href="https:\/\/example\.com\/live" target="_blank" rel="noopener">Diretta/);
});

test("schedule: referee names, or «Arbitro da designare» when pending", () => {
  const named = renderSchedule(girone, new Date("2026-11-20T10:00:00Z"));
  assert.match(named, /Arbitro: Marini Anna/);
  assert.match(named, /Arbitro da designare/);
  assert.equal(count(renderSchedule(sample, new Date("2026-11-20T10:00:00Z")), "Arbitro da designare"), 1);
});

test("schedule: referee names go through escaping", () => {
  const data = structuredClone(sample);
  data.games[0].referees = ["<i>Mario</i>"];
  const html = renderSchedule(data, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, "<i>Mario"), 0);
  assert.match(html, /&lt;i&gt;Mario/);
});

test("schedule: «Aggiungi a Google Calendar» only on future games with a start", () => {
  const html = renderSchedule(sample, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, "calendar.google.com/calendar/render"), 2);
  assert.match(html, /dates=20261121T160000Z%2F20261121T180000Z/);
  assert.match(html, /Aggiungi a Google Calendar<span class="sr-only"> la partita contro/);
});

test("calendar feed block: webcal subscribe link and https download link", () => {
  const html = renderCalendarFeed(sample);
  assert.match(html, /Aggiungi al calendario/);
  assert.match(html, /href="webcal:\/\/andreabonn\.github\.io\/campionato-fenice-fipav-26-27\/calendario\.ics"/);
  assert.match(html, /href="https:\/\/andreabonn\.github\.io\/campionato-fenice-fipav-26-27\/calendario\.ics" download/);
  assert.equal(renderCalendarFeed({ ...sample, games: [] }), "");
});

test("schedule: moved game shows the «Spostata» badge with what changed, others show none", () => {
  const data = structuredClone(sample);
  data.games[1].changes = ["time", "venue"];
  const html = renderSchedule(data, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, 'class="tag moved-tag">Spostata<'), 2);
  assert.match(html, /cambiata la data/);
  assert.match(html, /cambiati ora e palestra/);
});

test("schedule: no badge when no game moved", () => {
  assert.equal(count(renderSchedule(girone, new Date("2026-11-20T10:00:00Z")), "Spostata"), 0);
});

test("the next game box has a button that opens the opponent card", () => {
  const html = renderHero(girone, new Date("2026-11-21T12:00:00+01:00"));
  assert.match(html, /<button type="button" class="btn" data-opponent="\d+">Scheda avversaria<span class="sr-only"> di [^<]+<\/span><\/button>/);
  assert.equal(html.split("data-opponent=").length - 1, 1);
});

test("the next game box has no opponent button when the opponent is not among the teams", () => {
  const data = structuredClone(girone);
  const now = new Date("2026-11-21T12:00:00+01:00");
  const next = feniceGames(data).find((g) => !g.played && g.starts_at);
  const opponent = next.home_id === "232645" ? next.away_id : next.home_id;
  data.teams = data.teams.filter((t) => t.id !== opponent);
  const html = renderHero(data, now);
  assert.match(html, /Squadra Sconosciuta/);
  assert.equal(count(html, "data-opponent="), 0);
  assert.equal(count(renderHero(girone, now), "data-opponent="), 1);
});
