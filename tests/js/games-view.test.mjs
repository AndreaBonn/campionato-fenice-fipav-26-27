import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { feniceGames, mapUrl } from "../../docs/game-rules.js";
import { groupByMonth } from "../../docs/schedule-rules.js";
import { errorCause, esc, renderCalendarFeed, renderChecked, renderEmpty, renderError, renderHero, renderLastResult, renderSchedule } from "../../docs/games-view.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const sample = load("data-sample.json");
const girone = load("data-64353.json");
const ALL = { when: "all", side: "all" };
const DEFAULT = { when: "next", side: "all" };
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
  const teams = [...girone.teams, ...Array.from({ length: 4 }, (_, i) => ({ ...girone.teams[0], id: `x${i}`, name: `Extra ${i}` }))];
  return { ...girone, teams, games };
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

test("schedule: 18 rows grouped under one month heading, with the andata and ritorno labels", () => {
  const html = renderSchedule(season18(), new Date("2027-01-01T00:00:00Z"));
  assert.equal(count(html, '<li class="game'), 18);
  assert.equal(count(html, "<h3"), 1);
  assert.match(html, /<h3 class="month">Febbraio 2027<\/h3>/);
  assert.equal(count(html, "Giornata"), 0);
  for (const label of ["1ª giornata di andata", "9ª giornata di andata", "1ª giornata di ritorno", "9ª giornata di ritorno"]) assert.equal(count(html, `>${label}<`), 1);
  assert.equal(count(html, " next\""), 1);
});

test("schedule: a played game shows the result and the sets from the Fenice side", () => {
  const html = renderSchedule(girone, new Date("2026-11-20T10:00:00Z"), undefined, ALL);
  assert.match(html, /<b class="score">0-3<\/b>/);
  assert.match(html, /<p class="sets">Set: 12-25, 19-25, 18-25<\/p>/);
  assert.match(html, /<span class="vchip lost">Persa<\/span>/);
  assert.equal(count(html, "Da giocare"), 0); // K8: no label on a game still to come
});

test("schedule: a game without a date says so", () => {
  const html = renderSchedule(sample, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /Data da definire/);
});

test("schedule: a played game without sets (forfeit) shows the bare score, no empty brackets", () => {
  const forfeit = structuredClone(girone);
  for (const g of forfeit.games.filter((x) => x.played)) g.sets = [];
  const html = renderSchedule(forfeit, new Date("2026-11-20T10:00:00Z"), undefined, ALL);
  assert.match(html, /<span class="vchip lost">Persa<\/span> <b class="score">0-3<\/b>/);
  assert.equal(count(html, 'class="sets"'), 0);
  assert.equal(count(html, "()"), 0);
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
  const html = renderSchedule(evil, new Date("2026-11-20T10:00:00Z"), undefined, ALL);
  assert.equal(count(html, "<script"), 0);
  assert.match(html, /&lt;script&gt;r/);
  for (const part of ["n", "a", "c"]) assert.match(html, new RegExp(`&lt;script&gt;${part}&lt;/script&gt;`, "i"));
});

test("schedule: every string from the data is escaped", () => {
  const evil = structuredClone(girone);
  evil.teams.find((t) => t.id === "232396").name = "<img src=x onerror=alert(1)>";
  evil.games.find((g) => g.number === "949").venue.name = '"><script>x</script>';
  const html = renderSchedule(evil, new Date("2026-11-20T10:00:00Z")) + renderHero(evil, new Date("2026-11-20T10:00:00Z"));
  // the hero now has crest images of its own: what must not appear is the injected tag
  assert.equal(count(html, "<img src=x"), 0);
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
  assert.equal(renderChecked("2026-11-21T09:30:00Z", now), "Dati FIPAV controllati 2 ore fa");
});

test("last result: score, sets and verdict from the club side", () => {
  const html = renderLastResult(girone);
  assert.match(html, /Ultimo risultato · \d+ª giornata, [a-z]{3} \d+ \w+ · in (casa|trasferta)/);
  assert.match(html, /Sarlux Volley Sarroch/);
  assert.match(html, /<p class="big">0-3<\/p>/);
  assert.match(html, /10-25, 18-25, 19-25/);
  assert.match(html, /<span class="vchip lost">Persa<\/span>/);
  assert.equal(count(html, "<ol"), 0); // the form strip moved to the Andamento section
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
  const named = renderSchedule(girone, new Date("2026-11-20T10:00:00Z"), undefined, ALL);
  assert.match(named, /Arbitro: Marini Anna/);
  assert.equal(count(renderSchedule(sample, new Date("2026-11-20T10:00:00Z")), "Arbitro da designare"), 1);
});

test("schedule: referee names go through escaping", () => {
  const data = structuredClone(sample);
  data.games[0].referees = ["<i>Mario</i>"];
  const html = renderSchedule(data, new Date("2026-11-20T10:00:00Z"), undefined, ALL);
  assert.equal(count(html, "<i>Mario"), 0);
  assert.match(html, /&lt;i&gt;Mario/);
});

test("schedule: «Aggiungi a Google Calendar» only on future games with a start", () => {
  const html = renderSchedule(sample, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(html, "calendar.google.com/calendar/render"), 2);
  assert.match(html, /dates=20261121T160000Z%2F20261121T180000Z/);
  assert.match(html, /<a class="mini" href="https:\/\/calendar\.google\.com[^"]*" target="_blank" rel="noopener"><svg [^>]*aria-hidden="true"[^>]*>.*<\/svg>Calendario<span class="sr-only"> la partita contro [^<]+ \(si apre in una nuova scheda\)<\/span><\/a>/);
});

test("schedule: no «Aggiungi a Google Calendar» once the game has started, even without a result", () => {
  const html = renderSchedule(sample, new Date("2026-11-21T16:30:00Z"));
  assert.equal(count(html, "calendar.google.com/calendar/render"), 0);
  assert.equal(count(html, ">Calendario<"), 0);
});

const PAGES = "https://andreabonn.github.io/campionato-fenice-fipav-26-27/";

test("calendar feed block: webcal subscribe link and https download link, from the page url", () => {
  const html = renderCalendarFeed(sample, PAGES);
  assert.match(html, /<h3>Tutte le partite nel calendario del telefono<\/h3>/);
  assert.match(html, /Ti iscrivi una volta: date, orari e palestre si aggiornano da soli se la FIPAV sposta una partita\./);
  assert.match(html, /<a class="ab" href="webcal:[^"]*"><svg [^>]*aria-hidden="true"[^>]*>.*<\/svg>Aggiungi al calendario del telefono<\/a>/);
  assert.match(html, /<a class="ab sec" href="https:[^"]*calendario\.ics" download>Scarica il file<\/a>/);
  assert.match(html, /href="webcal:\/\/andreabonn\.github\.io\/campionato-fenice-fipav-26-27\/calendario\.ics"/);
  assert.match(html, /href="https:\/\/andreabonn\.github\.io\/campionato-fenice-fipav-26-27\/calendario\.ics" download/);
  assert.match(renderCalendarFeed(sample, "http://127.0.0.1:8000/"), /href="webcal:\/\/127\.0\.0\.1:8000\/calendario\.ics"/);
  assert.equal(renderCalendarFeed({ ...sample, games: [] }, PAGES), "");
});

test("calendar feed block: hidden when the page url is unknown", () => {
  assert.equal(renderCalendarFeed(sample, null), "");
});

test("schedule: the Google Calendar details link back to the page it is given", () => {
  const html = renderSchedule(sample, new Date("2026-11-20T10:00:00Z"), "http://127.0.0.1:8000/");
  assert.match(html, /127\.0\.0\.1%3A8000/);
});

test("schedule: moved game shows the «Spostata» badge with what changed, others show none", () => {
  const data = structuredClone(sample);
  data.games[1].changes = ["time", "venue"];
  const html = renderSchedule(data, new Date("2026-11-20T10:00:00Z"), undefined, ALL);
  assert.equal(count(html, 'class="tag moved-tag">Spostata<'), 2);
  assert.match(html, /cambiata la data/);
  assert.match(html, /cambiati ora e palestra/);
});

test("schedule: no badge when no game moved", () => {
  assert.equal(count(renderSchedule(girone, new Date("2026-11-20T10:00:00Z")), "Spostata"), 0);
});

test("the next game box has a button that opens the opponent card", () => {
  const html = renderHero(girone, new Date("2026-11-21T12:00:00+01:00"));
  assert.match(html, /<button type="button" class="ab sec" data-opponent="\d+">Scheda avversaria<span class="sr-only"> di [^<]+<\/span><\/button>/);
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

const POSTER = { url: "https://fipavcagliari.it/wp-content/uploads/locandina.jpg", width: 800, height: 1131 };
const withPoster = (data, poster) => ({ ...data, games: data.games.map((g, i) => (i === data.games.indexOf(feniceGames(data).find((x) => !x.played)) ? { ...g, poster } : g)) });

test("poster: hero and schedule row link a lazy image with explicit size and alt", () => {
  const data = withPoster(sample, POSTER), now = new Date("2026-11-20T10:00:00Z");
  for (const html of [renderHero(data, now), renderSchedule(data, now)]) {
    assert.match(html, /<a href="https:\/\/fipavcagliari\.it\/wp-content\/uploads\/locandina\.jpg" target="_blank" rel="noopener"><img /);
    const img = /<img [^>]*alt="Locandina[^>]*>/.exec(html)[0];
    assert.match(img, /src="https:\/\/fipavcagliari\.it\/wp-content\/uploads\/locandina\.jpg"/);
    assert.match(img, /width="800"/);
    assert.match(img, /height="1131"/);
    assert.match(img, /loading="lazy"/);
    assert.match(img, /alt="Locandina della gara Asd Fenice - VSA"/);
  }
});

test("poster: the alt text is escaped", () => {
  const data = withPoster(sample, POSTER), now = new Date("2026-11-20T10:00:00Z");
  data.teams = data.teams.map((t) => (t.name.includes("VSA") ? { ...t, name: 'A"B<' } : t));
  const html = renderSchedule(data, now);
  assert.match(/<img [^>]*>/.exec(html)[0], /alt="Locandina della gara [^"<]*&quot;[^"<]*"/);
});

test("poster: no element when poster is null", () => {
  const now = new Date("2026-11-20T10:00:00Z"), bare = { ...sample, games: sample.games.map((g) => ({ ...g, poster: null })) };
  assert.equal(count(renderHero(bare, now), "Locandina"), 0);
  assert.equal(count(renderSchedule(bare, now), "Locandina"), 0);
});

const NOW_BEFORE = new Date("2026-11-20T10:00:00Z");
// sample: games 1 and 2 are played by the Fenice at home and won (3-0, 3-2); game 3 is the next one
const lostAtHome = () => {
  const data = structuredClone(sample);
  data.games.find((g) => g.id === "2").sets_won = [2, 3];
  return data;
};

test("schedule: a game won by the Fenice reads «Vinta» with the won class, a lost one «Persa» with the lost class", () => {
  const html = renderSchedule(lostAtHome(), NOW_BEFORE, undefined, ALL);
  assert.equal(count(html, '<span class="vchip won">Vinta</span>'), 1);
  assert.equal(count(html, '<span class="vchip lost">Persa</span>'), 1);
  assert.equal(count(html, "Vinta"), 1);
  assert.equal(count(html, "Persa"), 1);
});

test("last result: a game won by the Fenice reads «Vinta», the score and every set from its side", () => {
  const html = renderLastResult(sample);
  assert.match(html, /<span class="vchip won">Vinta<\/span>/);
  assert.match(html, /<p class="big">3-2<\/p>/);
  assert.match(html, /<p class="small">Set: 25-20, 20-25, 25-19, 22-25, 15-13<\/p>/);
  assert.match(html, /<b>ASD Fenice - /); // home side first
  assert.equal(count(html, "Persa"), 0);
});

test("last result: a game lost by the Fenice reads «Persa» with the lost class, never «Vinta»", () => {
  const html = renderLastResult(lostAtHome());
  assert.match(html, /<span class="vchip lost">Persa<\/span>/);
  assert.match(html, /<p class="big">2-3<\/p>/);
  assert.match(html, /resbox lost/);
  assert.equal(count(html, "Vinta"), 0);
});

test("last result: a game awarded at the table (no sets) shows the score and no «Set:» line", () => {
  const forfeit = structuredClone(sample);
  Object.assign(forfeit.games.find((g) => g.id === "2"), { sets_won: [3, 0], sets: [] });
  assert.match(renderLastResult(forfeit), /<p class="big">3-0<\/p>/);
  assert.equal(count(renderLastResult(forfeit), "Set:"), 0);
  assert.equal(count(renderLastResult(sample), "Set:"), 1);
});

test("hero: the next game with a live_url links «Segui la diretta» in a new tab, one without shows no link", () => {
  const live = structuredClone(sample);
  live.games.find((g) => g.id === "3").live_url = "https://example.com/live3";
  assert.match(renderHero(live, NOW_BEFORE), /<a href="https:\/\/example\.com\/live3" target="_blank" rel="noopener">Segui la diretta<\/a>/);
  assert.equal(count(renderHero(sample, NOW_BEFORE), "Segui la diretta"), 0);
});

test("hero: a next game without a time says «orario da definire», one with a time says «ore 17:00»", () => {
  const notime = structuredClone(sample);
  notime.games.find((g) => g.id === "3").time = null;
  assert.match(renderHero(notime, NOW_BEFORE), /sabato 21 novembre, orario da definire/);
  assert.equal(count(renderHero(notime, NOW_BEFORE), "ore null"), 0);
  assert.match(renderHero(sample, NOW_BEFORE), /sabato 21 novembre, ore 17:00/);
});

test("error cause: a failure that is not a network error says the data is not readable", () => {
  const unreadable = "I dati ricevuti non sono leggibili. Riprova tra poco.";
  assert.equal(errorCause(new SyntaxError("Unexpected token"), "https:"), unreadable);
  assert.equal(errorCause(new Error("boom"), "https:"), unreadable);
  assert.equal(errorCause(undefined, "https:"), unreadable);
  assert.equal(errorCause(new TypeError("x"), "https:"), "Connessione non riuscita: controlla la rete e riprova.");
});

test("escape: null and undefined become an empty string, other values their text", () => {
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
  assert.equal(esc(`a&b<c>"d'e`), "a&amp;b&lt;c&gt;&quot;d&#39;e");
});

test("escape: quotes and ampersands in live_url and poster url cannot leave the attribute", () => {
  const evil = structuredClone(sample);
  const game = evil.games.find((g) => g.id === "3");
  game.live_url = 'https://example.com/live?a=1&b="x';
  game.poster = { url: 'https://example.com/p.jpg?a=1&b="y', width: 800, height: 600 };
  for (const html of [renderHero(evil, NOW_BEFORE), renderSchedule(evil, NOW_BEFORE)]) {
    assert.match(html, /<a href="https:\/\/example\.com\/p\.jpg\?a=1&amp;b=&quot;y" target="_blank" rel="noopener"><img src="https:\/\/example\.com\/p\.jpg\?a=1&amp;b=&quot;y"/);
    assert.equal(count(html, 'b="'), 0);
  }
  assert.match(renderHero(evil, NOW_BEFORE), /href="https:\/\/example\.com\/live\?a=1&amp;b=&quot;x"/);
});

test("schedule: rows of games to play link the venue map, played games do not (R7)", () => {
  const items = renderSchedule(girone, new Date("2026-11-20T10:00:00Z"), undefined, ALL).split('<li class="game').slice(1);
  const ours = groupByMonth(feniceGames(girone)).flatMap((x) => x.games); // rows come in date order
  assert.equal(items.length, ours.length);
  const linked = ours.map((g, i) => [g.id, items[i].includes(">Mappa<")]);
  const expected = ours.map((g) => [g.id, !g.played && mapUrl(g.venue) !== null]);
  assert.deepEqual(linked, expected);
  assert.ok(expected.some(([, has]) => has) && expected.some(([, has]) => !has));
  const first = ours.findIndex((g) => !g.played && mapUrl(g.venue));
  assert.ok(items[first].includes(`href="${esc(mapUrl(ours[first].venue))}"`));
});

// sample game 3 (id "3", vs 232656) kicks off 2026-11-21 17:00 Rome time and is not played
const rowOf = (html, opponent) => html.split('<li class="game').find((row) => row.includes(opponent));
const onlyThird = () => ({ ...sample, games: [sample.games[2]] });

test("schedule: the row of a game being played says «In corso», not «Da giocare»", () => {
  const row = rowOf(renderSchedule(onlyThird(), new Date("2026-11-21T17:30:00+01:00")), "VSA");
  assert.match(row, /<span class="pending">In corso<\/span>/);
  assert.equal(count(row, "Da giocare"), 0);
});

test("schedule: a game over without a published result says «Risultato in arrivo»", () => {
  const html = renderSchedule(onlyThird(), new Date("2026-11-23T10:00:00+01:00"));
  assert.match(html, /<span class="pending">Risultato in arrivo<\/span>/);
  assert.equal(count(html, "Da giocare"), 0);
});

test("schedule: before the whistle the row carries no status label at all (K8)", () => {
  const html = renderSchedule(onlyThird(), new Date("2026-11-21T16:59:00+01:00"));
  assert.match(html, /<li class="game (home|away) next">/);
  assert.equal(count(html, "Da giocare"), 0);
  assert.equal(count(html, 'class="pending"'), 0);
  assert.equal(count(html, 'class="res"'), 0);
});

test("schedule: an unscheduled game carries no label either, and keeps the Diretta link when it has one", () => {
  const g = { ...sample.games[2], starts_at: null, date: null, time: null };
  assert.equal(count(renderSchedule({ ...sample, games: [g] }, NOW_BEFORE), "pending"), 0);
  const live = renderSchedule({ ...sample, games: [{ ...g, live_url: "https://example.com/live" }] }, NOW_BEFORE);
  assert.match(live, /<div class="res"><a href="https:\/\/example\.com\/live"[^>]*>Diretta<\/a><\/div>/);
});

test("hero: a result still missing weeks later is not described as just finished", () => {
  const html = renderHero(onlyThird(), new Date("2026-12-20T10:00:00+01:00"));
  assert.match(html, /Risultato in aggiornamento/);
  assert.equal(count(html, "da poco"), 0);
});

test("error box: announced as an alert, the calendar list itself is not a live region", () => {
  assert.match(renderError(new TypeError("x"), "https:"), /^<div class="state err" role="alert">/);
});

test("hero: the title is home side first with crests, the Fenice with the local logo", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  const home = renderHero(sample, now);
  assert.match(home, /<p class="match"><span class="tm"><img src="logo-fenice\.png" alt="" width="34" height="34"><span class="nm">ASD Fenice<\/span><\/span><span class="vs" aria-hidden="true">-<\/span><span class="sr-only"> contro <\/span><span class="tm"><img src="https:\/\/app\.fipavonline\.it[^"]*" alt="" data-crest-name="VSA"[^>]*><span class="nm">VSA<\/span>/);
  const away = renderHero(girone, now);
  assert.ok(away.indexOf('class="nm">Asd Sporting Club Su Planu') < away.indexOf('class="nm">ASD Fenice'));
});

test("hero: an opponent without a logo url shows the initials badge instead of an image", () => {
  const data = structuredClone(sample);
  data.teams.find((t) => t.id === "232656").logo_url = null;
  const html = renderHero(data, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /<span class="crest-fallback" aria-hidden="true">V<\/span><span class="nm">VSA/);
});

test("hero: the countdown is at the top right and there is no countdown row at the bottom", () => {
  const html = renderHero(sample, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /<p class="cd-top"><b>Domani<\/b><small>ore 17:00<\/small><\/p>/);
  assert.equal(count(html, 'class="countdown"'), 0);
  assert.equal(count(html, "Domani"), 1);
  const far = renderHero(girone, new Date("2026-11-01T10:00:00Z"));
  assert.match(far, /<span class="lead">tra<\/span><b>\d+ giorni<\/b>/);
});

test("hero: directions and calendar are primary buttons, share and the opponent card secondary, no inline map link", () => {
  const html = renderHero(girone, new Date("2026-11-20T10:00:00Z"), "https://example.org/fenice/");
  assert.match(html, /<a class="ab" href="https:\/\/www\.google\.com\/maps\/search[^"]*" target="_blank" rel="noopener"><svg [^>]*aria-hidden="true"/);
  assert.match(html, /Indicazioni<span class="sr-only"> \(si apre in una nuova scheda\)<\/span><\/a>/);
  assert.match(html, /<a class="ab" href="https:\/\/calendar\.google\.com\/calendar\/render\?[^"]*"[^>]*>.*Calendario/);
  assert.match(html, /<button type="button" class="ab sec" data-share>.*Condividi<\/button>/);
  assert.match(html, /class="ab sec" data-opponent=/);
  assert.equal(count(html, "Apri la mappa"), 0);
  assert.equal(count(html, "Aggiungi a Google Calendar"), 0);
});

test("hero: no directions without coordinates, no calendar once the game is live", () => {
  const noMap = renderHero(sample, new Date("2026-11-20T10:00:00Z"));
  assert.equal(count(noMap, "Indicazioni"), 0);
  assert.match(noMap, /Calendario/);
  const live = renderHero(sample, new Date("2026-11-21T17:30:00+01:00"));
  assert.equal(count(live, "calendar.google.com"), 0);
  assert.match(live, /Condividi/);
});

test("hero: the Avversaria line has position, record and the opponent's last outcomes as letters", () => {
  const data = structuredClone(girone);
  const html = renderHero(data, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /<div class="opprow"><b>Avversaria<\/b> <span class="chipx">\d+ª in classifica<\/span> <span class="chipx">[^<]+<\/span>/);
  const none = renderHero(sample, new Date("2026-11-20T10:00:00Z"));
  assert.match(none, /<span class="chipx">nessuna partita giocata<\/span>/);
  assert.equal(count(none, "<ol"), 0);
});

// UX K-a: filters, month groups, date column, "Prossima" tag, andata line
const pressedButtons = (html) => [...html.matchAll(/data-filter="(\w+)" data-value="(\w+)" aria-pressed="true"/g)].map((m) => `${m[1]}:${m[2]}`);

test("filters: two groups of buttons with aria-pressed, Prossime and Casa e trasferta by default", () => {
  const html = renderSchedule(girone, NOW_BEFORE);
  assert.deepEqual(pressedButtons(html), ["when:next", "side:all"]);
  assert.equal(count(html, "<button"), 6);
  for (const text of ["Prossime", "Giocate", "Tutte", "Casa e trasferta", "Casa", "Trasferta"]) assert.match(html, new RegExp(`aria-pressed="(true|false)">${text}</button>`));
  assert.match(html, /<div class="seg2" role="group" aria-label="Quali partite">/);
});

test("filters: the pressed button follows the filter given", () => {
  const html = renderSchedule(girone, NOW_BEFORE, undefined, { when: "played", side: "away" });
  assert.deepEqual(pressedButtons(html), ["when:played", "side:away"]);
});

test("filters: Giocate lists only played games, Prossime only the others, each game in exactly one", () => {
  const played = renderSchedule(girone, NOW_BEFORE, undefined, { when: "played", side: "all" });
  const next = renderSchedule(girone, NOW_BEFORE, undefined, DEFAULT);
  const total = feniceGames(girone).length, done = feniceGames(girone).filter((g) => g.played).length;
  assert.equal(count(played, '<li class="game'), done);
  assert.equal(count(next, '<li class="game'), total - done);
  assert.equal(count(played, 'class="vchip'), done);
  assert.equal(count(next, 'class="vchip'), 0);
});

test("filters: Casa and Trasferta keep the games of that side only", () => {
  const home = renderSchedule(girone, NOW_BEFORE, undefined, { when: "all", side: "home" });
  const away = renderSchedule(girone, NOW_BEFORE, undefined, { when: "all", side: "away" });
  assert.equal(count(home, "tag away"), 0);
  assert.equal(count(away, "tag home"), 0);
  assert.equal(count(home, '<li class="game') + count(away, '<li class="game'), feniceGames(girone).length);
  assert.ok(count(home, "tag home") > 0 && count(away, "tag away") > 0);
});

test("filters: an empty combination says so and offers «Mostra tutte»", () => {
  const nothingPlayed = { ...girone, games: girone.games.map((g) => ({ ...g, played: false, sets_won: null, sets: [] })) };
  const html = renderSchedule(nothingPlayed, NOW_BEFORE, undefined, { when: "played", side: "all" });
  assert.match(html, /<strong>Nessuna partita giocata finora\.<\/strong>/);
  assert.match(html, /<button type="button" class="btn" data-filter-reset>Mostra tutte<\/button>/);
  assert.equal(count(html, '<li class="game'), 0);
  assert.match(renderSchedule(nothingPlayed, NOW_BEFORE, undefined, { when: "played", side: "away" }), /Nessuna partita giocata in trasferta finora\./);
  const awayDone = { ...girone, games: girone.games.map((g) => (g.away_id === "232645" ? { ...g, played: true, sets_won: [3, 0], sets: [] } : g)) };
  assert.match(renderSchedule(awayDone, NOW_BEFORE, undefined, { when: "next", side: "away" }), /Nessuna partita da giocare in trasferta\./);
  assert.equal(count(renderSchedule(girone, NOW_BEFORE, undefined, ALL), "data-filter-reset"), 0); // a list with games has no reset
});

test("rows: month headings, a date column and the round label above the opponent; date and time leave the meta line", () => {
  const html = renderSchedule(sample, NOW_BEFORE, undefined, ALL);
  assert.match(html, /<h3 class="month">Novembre 2026<\/h3>/);
  assert.match(html, /<div class="dcol"><span class="wd">sab<\/span> <b>21<\/b> <span class="hm">17:00<\/span><\/div>/);
  assert.match(html, /<p class="rlabel">1ª giornata di andata<\/p>\n<p class="opp">/); // 5 teams: 5 rounds per half
  assert.equal(count(html, "ore 17:00"), 0);
  assert.match(html, /<p class="meta"><span class="vname">[^<]+<\/span>(, <span class="vaddr">[^<]+<\/span>)?<\/p>/);
});

test("rows: a game without a start goes in the last group «Data da definire» with «da definire» in the date column", () => {
  const html = renderSchedule(sample, NOW_BEFORE);
  const last = html.lastIndexOf('<h3 class="month">');
  assert.match(html.slice(last), /^<h3 class="month">Data da definire<\/h3>/);
  assert.match(html.slice(last), /<div class="dcol"><span class="tbd">da definire<\/span><\/div>/);
});

test("rows: the date column reads the Rome day, and a missing time says so", () => {
  const data = structuredClone(sample);
  Object.assign(data.games[2], { starts_at: "2026-11-21T23:30:00Z", time: null });
  const html = renderSchedule(data, NOW_BEFORE);
  assert.match(html, /<span class="wd">dom<\/span> <b>22<\/b> <span class="hm tbd">orario da definire<\/span>/);
});

test("rows: the «Prossima» tag stands before the opponent of the next game only, the tint class stays", () => {
  const html = renderSchedule(girone, NOW_BEFORE, undefined, ALL);
  assert.equal(count(html, "nexttag"), 1);
  assert.equal(count(html, " next\">"), 1);
  const row = html.split(/<li class="game (?:home|away) next">/)[1].split("</li>")[0];
  assert.match(row, /<p class="opp"><span class="tag nexttag">Prossima<\/span> /);
  assert.equal(count(renderSchedule(girone, NOW_BEFORE, undefined, { when: "played", side: "all" }), "nexttag"), 0);
});

function withPlayedAndata({ played = true } = {}) {
  const data = season18();
  const first = data.games[0];
  Object.assign(first, { played, sets_won: played ? [3, 1] : null });
  data.games[9].home_id = first.away_id; // the fixture has 5 opponents: round 10 is the return against the round 1 opponent
  return data;
}

test("andata: a ritorno row shows the score of the played andata against the same opponent, home side first", () => {
  const html = renderSchedule(withPlayedAndata(), new Date("2027-01-01T00:00:00Z"));
  const ritorno = html.split('<li class="game').find((row) => row.includes("1ª giornata di ritorno"));
  assert.match(ritorno, /<p class="andata">All'andata: ASD Fenice - [^<]+ 3-1<\/p>/);
  assert.equal(count(html, 'class="andata"'), 1);
});

test("andata: no line when the andata is not played, none on the andata rows themselves", () => {
  assert.equal(count(renderSchedule(withPlayedAndata({ played: false }), new Date("2027-01-01T00:00:00Z")), "andata\">"), 0);
});

test("andata: an andata won away reads the score in the order of the names, not from the Fenice side", () => {
  const data = season18();
  Object.assign(data.games[1], { played: true, sets_won: [2, 3] }); // round 2: away game, the opponent hosts
  data.games[10].away_id = data.games[1].home_id;
  const html = renderSchedule(data, new Date("2027-01-01T00:00:00Z"));
  const row = html.split('<li class="game').find((r) => r.includes("2ª giornata di ritorno"));
  assert.match(row, /All'andata: [^<]+ - ASD Fenice 2-3<\/p>/);
});

test("rows: the data strings of the andata line and the month labels are escaped", () => {
  const data = withPlayedAndata();
  const opponent = data.games[0].away_id;
  data.teams = data.teams.map((t) => (t.id === opponent ? { ...t, name: "<b>X</b>" } : t));
  const html = renderSchedule(data, new Date("2027-01-01T00:00:00Z"));
  assert.doesNotMatch(html, /<b>x/i);
  assert.match(html, /All.andata: ASD Fenice - &lt;b&gt;x/i);
});

test("schedule K3: a row carries home or away to colour its left edge, next with it", () => {
  const html = renderSchedule(girone, NOW_BEFORE, undefined, ALL);
  const rows = html.split("<li ").slice(1).map((r) => r.slice(0, r.indexOf(">")));
  assert.ok(rows.every((r) => /class="game (home|away)( next)?"/.test(r)));
  assert.ok(rows.some((r) => r.includes("home")) && rows.some((r) => r.includes("away")));
  assert.equal(rows.filter((r) => r.includes("next")).length, 1);
  assert.match(html, /<span class="tag home">In casa<\/span>/);
  assert.match(html, /<span class="tag away">In trasferta<\/span>/);
});

test("schedule K4: «Arbitro da designare» on the next game only, real names on every row that has them", () => {
  const data = structuredClone(sample);
  const html = renderSchedule(data, NOW_BEFORE, undefined, ALL);
  const rows = html.split("<li ").slice(1);
  assert.equal(count(html, "Arbitro da designare"), 1);
  assert.match(rows.find((r) => r.includes("Arbitro da designare")), /^class="game (home|away) next"/);
  data.games[1].referees = ["Rossi Luca"];
  data.games[1].referee_pending = false;
  const named = renderSchedule(data, NOW_BEFORE, undefined, ALL);
  assert.equal(count(named, "Arbitro: Rossi Luca"), 1);
});

test("schedule K6: venue name apart from address and city, both escaped", () => {
  const data = structuredClone(sample);
  data.games[0].venue = { ...data.games[0].venue, name: "Pal. <b>x</b>", address: "Via Roma", city: "Quartu" };
  const html = renderSchedule(data, NOW_BEFORE, undefined, ALL);
  assert.match(html, /<span class="vname">Pal\. &lt;b&gt;x&lt;\/b&gt;<\/span>, <span class="vaddr">Via Roma, Quartu<\/span>/);
  assert.equal(count(html, "<b>x"), 0);
});

test("schedule S2: map and calendar buttons name the opponent for screen readers and open in a new tab", () => {
  const data = structuredClone(sample);
  for (const g of data.games) g.venue = { ...g.venue, lat: 39.2, lng: 9.1 };
  const html = renderSchedule(data, NOW_BEFORE, undefined, ALL);
  assert.match(html, /<a class="mini" href="https:\/\/www\.google\.com\/maps[^"]*" target="_blank" rel="noopener"><svg [^>]*aria-hidden="true"[^>]*>.*<\/svg>Mappa<span class="sr-only"> per la partita contro [^<]+ \(si apre in una nuova scheda\)<\/span><\/a>/);
  assert.equal(count(html, "Apri la mappa"), 0);
  assert.equal(count(html, "Aggiungi a Google Calendar"), 0);
});

test("schedule K9: a played row shows the chip and a large score, the sets in a small muted line", () => {
  const html = renderSchedule(lostAtHome(), NOW_BEFORE, undefined, ALL);
  assert.match(html, /<div class="res"><span class="vchip won">Vinta<\/span> <b class="score">\d-\d<\/b><\/div>/);
  assert.match(html, /<div class="res"><span class="vchip lost">Persa<\/span> <b class="score">2-3<\/b><\/div>/);
  assert.match(html, /<p class="sets">Set: [\d-]+(, [\d-]+)*<\/p>/);
});

test("schedule: only the andata published (rounds 1-9 of a 10 team girone) is not labelled ritorno", () => {
  const data = season18();
  data.games = data.games.slice(0, 9);
  const html = renderSchedule(data, new Date("2027-01-01T00:00:00Z"));
  assert.equal(count(html, "di ritorno"), 0);
  assert.equal(count(html, "All'andata"), 0);
  assert.equal(count(html, ">6ª giornata di andata<"), 1);
});

test("schedule: a season over shows Tutte as selected instead of an empty Prossime", () => {
  const data = season18();
  data.games = data.games.map((g) => ({ ...g, played: true, sets_won: [3, 0] }));
  const html = renderSchedule(data, new Date("2027-06-01T00:00:00Z"));
  assert.equal(count(html, '<li class="game'), 18);
  assert.match(html, /data-value="all" aria-pressed="true">Tutte/);
  assert.match(html, /data-value="next" aria-pressed="false"/);
});
