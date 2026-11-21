import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { feedUrls, googleCalendarUrl, teamsById } from "../../docs/calendar-rules.js";

const sample = JSON.parse(readFileSync(new URL("../fixtures/data-sample.json", import.meta.url), "utf8"));
const teams = teamsById(sample);
const PAGES = "https://andreabonn.github.io/campionato-fenice-fipav-26-27/";
const LOCAL = "http://127.0.0.1:8000/";
const params = (url) => new URL(url).searchParams;

test("google calendar url: 2 hour slot in UTC from the Rome start", () => {
  const url = googleCalendarUrl(sample.games[3], teams, PAGES);
  assert.ok(url.startsWith("https://calendar.google.com/calendar/render?"));
  assert.equal(params(url).get("action"), "TEMPLATE");
  assert.equal(params(url).get("dates"), "20261121T160000Z/20261121T180000Z");
});

test("google calendar url: summer time uses the +02:00 offset", () => {
  const game = { ...sample.games[3], starts_at: "2027-06-05T21:30:00+02:00" };
  assert.equal(params(googleCalendarUrl(game, teams, PAGES)).get("dates"), "20270605T193000Z/20270605T213000Z");
});

test("google calendar url: title with both teams, venue as location, page link in details", () => {
  const p = params(googleCalendarUrl(sample.games[3], teams, PAGES));
  assert.equal(p.get("text"), "Asd Fenice - Asd Sandalyon Quartu");
  assert.equal(p.get("location"), "Palestra");
  assert.match(p.get("details"), /https:\/\/andreabonn\.github\.io\/campionato-fenice-fipav-26-27\//);
});

test("google calendar url: location joins the venue parts that exist, characters are encoded", () => {
  const game = { ...sample.games[3], venue: { ...sample.games[3].venue, name: "Pal. A&B", address: "Via Roma 1", city: "Cagliari" } };
  const url = googleCalendarUrl(game, teams, PAGES);
  assert.equal(params(url).get("location"), "Pal. A&B, Via Roma 1, Cagliari");
  assert.equal(url.includes("A&B"), false);
});

test("google calendar url: null for a game without a start", () => {
  assert.equal(googleCalendarUrl(sample.games[4], teams), null);
});

test("google calendar url: the page link comes from the page url it is given", () => {
  assert.match(params(googleCalendarUrl(sample.games[3], teams, LOCAL)).get("details"), /Calendario completo: http:\/\/127\.0\.0\.1:8000\/$/);
});

test("google calendar url: no page link in details when the page url is unknown", () => {
  const details = params(googleCalendarUrl(sample.games[3], teams, null)).get("details");
  assert.equal(details, "Seconda Divisione Femminile, giornata 4.");
});

test("feed links: webcal for subscribing, https for the plain download, from the published page", () => {
  assert.deepEqual(feedUrls(PAGES), {
    https: "https://andreabonn.github.io/campionato-fenice-fipav-26-27/calendario.ics",
    webcal: "webcal://andreabonn.github.io/campionato-fenice-fipav-26-27/calendario.ics",
  });
});

test("feed links: a local server keeps its host and port; page file, query and hash are dropped", () => {
  assert.deepEqual(feedUrls("http://127.0.0.1:8000/index.html?x=1#top"), {
    https: "http://127.0.0.1:8000/calendario.ics",
    webcal: "webcal://127.0.0.1:8000/calendario.ics",
  });
});

test("feed links: null when the page url is unknown", () => {
  assert.equal(feedUrls(null), null);
  assert.equal(feedUrls(undefined), null);
  // a page opened from disk cannot be subscribed to: no feed links at all
  assert.equal(feedUrls("file:///home/u/docs/index.html"), null);
});

test("google calendar url: a team that is not in the list is named «Squadra Sconosciuta»", () => {
  const game = { ...sample.games[3], home_id: "nope" };
  assert.equal(params(googleCalendarUrl(game, teams, PAGES)).get("text"), "Squadra Sconosciuta - Asd Sandalyon Quartu");
  assert.equal(params(googleCalendarUrl(sample.games[3], teams, PAGES)).get("text"), "Asd Fenice - Asd Sandalyon Quartu");
});

test("google calendar url: a venue with only the raw text uses it as the location", () => {
  const venue = { raw: "PAL. X - VIA Y - CAGLIARI", name: null, address: null, city: null, lat: null, lng: null };
  const url = googleCalendarUrl({ ...sample.games[3], venue }, teams, PAGES);
  assert.equal(params(url).get("location"), "PAL. X - VIA Y - CAGLIARI");
});

test("google calendar url: called without a page url the details have no «Calendario completo»", () => {
  assert.equal(params(googleCalendarUrl(sample.games[3], teams)).get("details").includes("Calendario completo"), false);
  assert.match(params(googleCalendarUrl(sample.games[3], teams, PAGES)).get("details"), /Calendario completo: /);
});
