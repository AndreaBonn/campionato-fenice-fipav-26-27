import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { FEED_HTTPS_URL, FEED_WEBCAL_URL, googleCalendarUrl, teamsById } from "../../docs/calendar-rules.js";

const sample = JSON.parse(readFileSync(new URL("../fixtures/data-sample.json", import.meta.url), "utf8"));
const teams = teamsById(sample);
const params = (url) => new URL(url).searchParams;

test("google calendar url: 2 hour slot in UTC from the Rome start", () => {
  const url = googleCalendarUrl(sample.games[3], teams);
  assert.ok(url.startsWith("https://calendar.google.com/calendar/render?"));
  assert.equal(params(url).get("action"), "TEMPLATE");
  assert.equal(params(url).get("dates"), "20261121T160000Z/20261121T180000Z");
});

test("google calendar url: summer time uses the +02:00 offset", () => {
  const game = { ...sample.games[3], starts_at: "2027-06-05T21:30:00+02:00" };
  assert.equal(params(googleCalendarUrl(game, teams)).get("dates"), "20270605T193000Z/20270605T213000Z");
});

test("google calendar url: title with both teams, venue as location, page link in details", () => {
  const p = params(googleCalendarUrl(sample.games[3], teams));
  assert.equal(p.get("text"), "Asd Fenice - Asd Sandalyon Quartu");
  assert.equal(p.get("location"), "Palestra");
  assert.match(p.get("details"), /https:\/\/andreabonn\.github\.io\/campionato-fenice-fipav-26-27\//);
});

test("google calendar url: location joins the venue parts that exist, characters are encoded", () => {
  const game = { ...sample.games[3], venue: { ...sample.games[3].venue, name: "Pal. A&B", address: "Via Roma 1", city: "Cagliari" } };
  const url = googleCalendarUrl(game, teams);
  assert.equal(params(url).get("location"), "Pal. A&B, Via Roma 1, Cagliari");
  assert.equal(url.includes("A&B"), false);
});

test("google calendar url: null for a game without a start", () => {
  assert.equal(googleCalendarUrl(sample.games[4], teams), null);
});

test("feed links: webcal for subscribing, https for the plain download", () => {
  assert.equal(FEED_WEBCAL_URL, "webcal://andreabonn.github.io/campionato-fenice-fipav-26-27/calendario.ics");
  assert.equal(FEED_HTTPS_URL, "https://andreabonn.github.io/campionato-fenice-fipav-26-27/calendario.ics");
});
