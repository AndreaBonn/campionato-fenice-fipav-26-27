import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { feniceGames } from "../../docs/game-rules.js";
import { errorCause, esc, renderCalendarFeed, renderChecked, renderEmpty, renderError, renderHero, renderLastResult, renderSchedule } from "../../docs/games-view.js";

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
  assert.match(html, /0-3 \(12-25, 19-25, 18-25\)/);
  assert.equal(count(html, "Set:"), 0);
  assert.match(html, /Persa/);
  assert.equal(count(html, "Da giocare"), 7);
});

test("schedule: a game without a date says so", () => {
  const html = renderSchedule(sample, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /Data da definire/);
});

test("schedule: a played game without sets (forfeit) shows the bare score, no empty brackets", () => {
  const forfeit = structuredClone(girone);
  for (const g of forfeit.games.filter((x) => x.played)) g.sets = [];
  const html = renderSchedule(forfeit, new Date("2026-11-20T10:00:00Z"));
  assert.match(html, /class="sets">0-3</);
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
  assert.equal(count(renderSchedule(sample, new Date("2026-11-20T10:00:00Z")), "Arbitro da designare"), 3);
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

test("schedule: no «Aggiungi a Google Calendar» once the game has started, even without a result", () => {
  const html = renderSchedule(sample, new Date("2026-11-21T16:30:00Z"));
  assert.equal(count(html, "calendar.google.com/calendar/render"), 0);
  assert.equal(count(html, "Aggiungi a Google Calendar"), 0);
});

const PAGES = "https://andreabonn.github.io/campionato-fenice-fipav-26-27/";

test("calendar feed block: webcal subscribe link and https download link, from the page url", () => {
  const html = renderCalendarFeed(sample, PAGES);
  assert.match(html, /Aggiungi al calendario/);
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

const POSTER = { url: "https://fipavcagliari.it/wp-content/uploads/locandina.jpg", width: 800, height: 1131 };
const withPoster = (data, poster) => ({ ...data, games: data.games.map((g, i) => (i === data.games.indexOf(feniceGames(data).find((x) => !x.played)) ? { ...g, poster } : g)) });

test("poster: hero and schedule row link a lazy image with explicit size and alt", () => {
  const data = withPoster(sample, POSTER), now = new Date("2026-11-20T10:00:00Z");
  for (const html of [renderHero(data, now), renderSchedule(data, now)]) {
    assert.match(html, /<a href="https:\/\/fipavcagliari\.it\/wp-content\/uploads\/locandina\.jpg" target="_blank" rel="noopener"><img /);
    const img = /<img [^>]*>/.exec(html)[0];
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
  const html = renderSchedule(lostAtHome(), NOW_BEFORE);
  assert.equal(count(html, '<span class="verdict won">Vinta</span>'), 1);
  assert.equal(count(html, '<span class="verdict lost">Persa</span>'), 1);
  assert.equal(count(html, "Vinta"), 1);
  assert.equal(count(html, "Persa"), 1);
});

test("last result: a game won by the Fenice reads «Vinta», the score and every set from its side", () => {
  const html = renderLastResult(sample);
  assert.match(html, /<b>3-2<\/b> <span class="verdict won">Vinta<\/span>/);
  assert.match(html, /<p class="sets">Set: 25-20, 20-25, 25-19, 22-25, 15-13<\/p>/);
  assert.equal(count(html, "Persa"), 0);
});

test("last result: a game lost by the Fenice reads «Persa» with the lost class, never «Vinta»", () => {
  const html = renderLastResult(lostAtHome());
  assert.match(html, /<b>2-3<\/b> <span class="verdict lost">Persa<\/span>/);
  assert.equal(count(html, "Vinta"), 0);
});

test("last result: a game awarded at the table (no sets) shows the score and no «Set:» line", () => {
  const forfeit = structuredClone(sample);
  Object.assign(forfeit.games.find((g) => g.id === "2"), { sets_won: [3, 0], sets: [] });
  assert.match(renderLastResult(forfeit), /<b>3-0<\/b>/);
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
