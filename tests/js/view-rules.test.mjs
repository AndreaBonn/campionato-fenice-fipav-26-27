import assert from "node:assert/strict";
import { test } from "node:test";

import { TIME_ZONE, countdownText, displayTeamName, plural, relativeAge, teamInitials, teamNameOrUnknown } from "../../docs/view-rules.js";

const NOW = new Date("2026-11-20T12:00:00Z");
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();

test("countdown: exactly three hours after kickoff is still in progress", () => {
  const start = "2026-11-21T17:00:00+01:00";
  assert.equal(countdownText(start, new Date(new Date(start).getTime() + 3 * 60 * 60 * 1000)).main, "In corso");
});

test("countdown: exactly one hour before kickoff shows the time", () => {
  const start = "2026-11-21T17:00:00+01:00";
  assert.deepEqual(countdownText(start, new Date(new Date(start).getTime() - 60 * 60 * 1000)), { lead: "", main: "Stasera", sub: "ore 17:00" });
});

test("relative age: exactly 24 hours ago is yesterday", () => {
  assert.equal(relativeAge(ago(24 * 60 * 60 * 1000), NOW), "ieri");
});

test("countdown: two days or more read «tra N giorni» by Rome calendar day", () => {
  assert.deepEqual(countdownText("2026-11-23T17:00:00+01:00", NOW), { lead: "tra", main: "3 giorni", sub: "" });
  assert.deepEqual(countdownText("2026-11-22T17:00:00+01:00", NOW), { lead: "tra", main: "2 giorni", sub: "" });
});

test("countdown: the day after is «Domani» with the time", () => {
  assert.deepEqual(countdownText("2026-11-21T17:00:00+01:00", NOW), { lead: "", main: "Domani", sub: "ore 17:00" });
});

test("countdown: the late evening in Rome still counts as the same day, not the next", () => {
  const lateUtc = new Date("2026-11-20T23:30:00Z"); // 00:30 of the 21st in Rome
  assert.deepEqual(countdownText("2026-11-21T17:00:00+01:00", lateUtc), { lead: "", main: "Stasera", sub: "ore 17:00" });
});

test("countdown: game day is «Stasera» from 17:00 on, «Oggi» earlier", () => {
  const morning = new Date("2026-11-21T07:00:00Z");
  assert.deepEqual(countdownText("2026-11-21T17:00:00+01:00", morning), { lead: "", main: "Stasera", sub: "ore 17:00" });
  assert.deepEqual(countdownText("2026-11-21T16:30:00+01:00", morning), { lead: "", main: "Oggi", sub: "ore 16:30" });
});

test("countdown: under an hour to go reads minutes", () => {
  const near = new Date("2026-11-21T15:15:00Z"); // 16:15 in Rome
  assert.deepEqual(countdownText("2026-11-21T17:00:00+01:00", near), { lead: "tra", main: "45 minuti", sub: "" });
});

test("countdown: after the start it is «In corso» for three hours, then «Conclusa»", () => {
  const during = new Date("2026-11-21T16:30:00Z"); // 17:30 in Rome
  const after = new Date("2026-11-21T20:00:00Z"); // 21:00 in Rome
  assert.deepEqual(countdownText("2026-11-21T17:00:00+01:00", during), { lead: "", main: "In corso", sub: "" });
  assert.deepEqual(countdownText("2026-11-21T17:00:00+01:00", after), { lead: "", main: "Conclusa", sub: "" });
});

test("relative age: minutes, hours, yesterday, days", () => {
  assert.equal(relativeAge(ago(20e3), NOW), "adesso");
  assert.equal(relativeAge(ago(MIN), NOW), "1 minuto fa");
  assert.equal(relativeAge(ago(45 * MIN), NOW), "45 minuti fa");
  assert.equal(relativeAge(ago(HOUR), NOW), "1 ora fa");
  assert.equal(relativeAge(ago(5 * HOUR + 50 * MIN), NOW), "5 ore fa");
  assert.equal(relativeAge(ago(DAY + HOUR), NOW), "ieri");
  assert.equal(relativeAge(ago(3 * DAY), NOW), "3 giorni fa");
});

test("relative age: a clock slightly ahead of the device still reads «adesso»", () => {
  assert.equal(relativeAge(new Date(NOW.getTime() + 30e3).toISOString(), NOW), "adesso");
});

test("team name: FIPAV upper case becomes title case, acronyms and initials stay", () => {
  assert.equal(displayTeamName("ASD FENICE"), "Asd Fenice");
  assert.equal(displayTeamName("CUS CAGLIARI"), "CUS Cagliari");
  assert.equal(displayTeamName("G.S. AQUILA ORO"), "G.S. Aquila Oro");
  assert.equal(displayTeamName("POL. S. ANTONIO"), "Pol. S. Antonio");
  assert.equal(displayTeamName("VSA"), "VSA");
  assert.equal(displayTeamName("POLISPORTIVA SELARGIUS 85 ASD"), "Polisportiva Selargius 85 Asd");
  assert.equal(displayTeamName("SARDINIA YACHT SERVICES GS SARDEGNA"), "Sardinia Yacht Services GS Sardegna");
});

test("team name: hyphens and apostrophes start a new capital", () => {
  assert.equal(displayTeamName("SANT'ANDREA ALTO-MARE"), "Sant'Andrea Alto-Mare");
});


test("teamInitials takes the first letter of the first two words, in capitals", () => {
  assert.equal(teamInitials("ASD FENICE"), "AF");
  assert.equal(teamInitials("Volley Sant'Andrea Rossa"), "VS");
  assert.equal(teamInitials("Fenice"), "F");
  assert.equal(teamInitials("  "), "");
});

test("time zone: Rome, the one every view formats dates in", () => {
  assert.equal(TIME_ZONE, "Europe/Rome");
});

test("countdown: minutes are rounded up, so the last seconds before the whistle still read «1 minuto»", () => {
  const start = "2026-11-21T17:00:00+01:00"; // 16:00:00Z
  assert.deepEqual(countdownText(start, new Date("2026-11-21T15:15:30Z")), { lead: "tra", main: "45 minuti", sub: "" }); // 44 min 30 s to go
  assert.deepEqual(countdownText(start, new Date("2026-11-21T15:59:30Z")), { lead: "tra", main: "1 minuto", sub: "" }); // 30 s to go
  assert.deepEqual(countdownText(start, new Date("2026-11-21T15:15:00Z")), { lead: "tra", main: "45 minuti", sub: "" }); // exact minutes stay
});

test("countdown: «In corso» just inside three hours after the start, «Conclusa» just past it", () => {
  const start = "2026-11-21T17:00:00+01:00"; // 16:00:00Z
  assert.equal(countdownText(start, new Date("2026-11-21T18:59:59Z")).main, "In corso");
  assert.equal(countdownText(start, new Date("2026-11-21T19:00:01Z")).main, "Conclusa");
});

test("relative age: minutes and hours are rounded down, the last second before the next unit keeps the lower one", () => {
  assert.equal(relativeAge(ago(59 * MIN + 59e3), NOW), "59 minuti fa");
  assert.equal(relativeAge(ago(90 * MIN), NOW), "1 ora fa");
  assert.equal(relativeAge(ago(HOUR + 59 * MIN + 59e3), NOW), "1 ora fa");
  assert.equal(relativeAge(ago(DAY - 1e3), NOW), "23 ore fa");
});

test("relative age: days are rounded down, so 47 hours is still «ieri» and 48 hours is «2 giorni fa»", () => {
  assert.equal(relativeAge(ago(DAY + MIN), NOW), "ieri");
  assert.equal(relativeAge(ago(2 * DAY - MIN), NOW), "ieri");
  assert.equal(relativeAge(ago(2 * DAY), NOW), "2 giorni fa");
});

test("team name: a number inside the name stays as it is and no empty word is added", () => {
  assert.equal(displayTeamName("ASD 85 FENICE"), "Asd 85 Fenice");
  assert.equal(displayTeamName("ASD 85 FENICE").split(" ").length, 3);
});

test("plural: the noun agrees with the number, zero takes the plural", () => {
  assert.equal(plural(1, "gara", "gare"), "1 gara");
  assert.equal(plural(0, "gara", "gare"), "0 gare");
  assert.equal(plural(2, "gara", "gare"), "2 gare");
});

test("teamNameOrUnknown: a missing name reads «Squadra sconosciuta», a FIPAV name is title-cased", () => {
  assert.equal(teamNameOrUnknown(undefined), "Squadra sconosciuta");
  assert.equal(teamNameOrUnknown(null), "Squadra sconosciuta");
  assert.equal(teamNameOrUnknown("ASD SANDALYON QUARTU"), "Asd Sandalyon Quartu");
});
