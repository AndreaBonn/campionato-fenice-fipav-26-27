import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { installOpponentDialog, renderOpponent } from "../../docs/opponent-view.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const FENICE = "232645";
const AQUILA = "232223";
const SARROCH = "232139";
// before the first unplayed game of the fixture (2026-11-23), so every unplayed game is still to come
const NOW = new Date("2026-11-21T12:00:00+01:00");

test("the card has title, head to head, home/away record and remaining games", () => {
  const html = renderOpponent(girone, AQUILA, NOW);
  assert.match(html, /<h2 id="opp-title">G\.S\. Aquila Oro<\/h2>/);
  assert.match(html, /<h3>Scontri diretti con la Fenice<\/h3>/);
  assert.match(html, /<b>0-3<\/b> persa dalla Fenice/);
  assert.match(html, /8-25, 17-25, 16-25/);
  assert.match(html, /<h3>Rendimento in casa e in trasferta<\/h3>/);
  assert.match(html, /In trasferta: 3 vinte, 0 perse, set 9-2/);
  assert.match(html, /In casa: nessuna gara giocata/);
  assert.match(html, /<h3>Prossime gare<\/h3>/);
  assert.match(html, /<button type="button" class="btn" data-close>Chiudi<\/button>/);
});

test("the remaining games show the opponent position and put the tail in a details", () => {
  // Sarroch has 7 games left (opponent position from the standings): the first 5 are listed, the last 2 sit in a details
  const html = renderOpponent(girone, SARROCH, NOW);
  const shown = [
    "<li>gio 26 nov: CUS Cagliari <small>(3°)</small>, in trasferta</li>",
    "<li>lun 30 nov: Polisportiva Selargius 85 Asd <small>(4°)</small>, in casa</li>",
    "<li>dom 20 dic: G.S. Aquila Oro <small>(1°)</small>, in trasferta</li>",
    "<li>lun 11 gen: Asd Sporting Club Su Planu <small>(5°)</small>, in trasferta</li>",
    "<li>lun 18 gen: Asd Fenice <small>(6°)</small>, in casa</li>",
  ].join("");
  const later = [
    "<li>mer 27 gen: CUS Cagliari <small>(3°)</small>, in casa</li>",
    "<li>ven 29 gen: Polisportiva Selargius 85 Asd <small>(4°)</small>, in trasferta</li>",
  ].join("");
  assert.ok(html.includes(`<h3>Prossime gare</h3><ul>${shown}</ul><details><summary>Le altre 2 gare</summary><ul>${later}</ul></details>`));
  assert.ok(html.includes("Posizione media delle avversarie da affrontare: 3,7°."));
});

test("the positions of the remaining games match the standings shown in the header", () => {
  const data = structuredClone(girone);
  data.standings = data.standings.map((r) => r.team_id === AQUILA ? { ...r, pos: 2 } : r.team_id === SARROCH ? { ...r, pos: 1 } : r);
  const html = renderOpponent(data, "229802", NOW);
  assert.match(html, /Aquila Oro[^<]*<small>\(2°\)<\/small>/);
  assert.doesNotMatch(html, /Aquila Oro[^<]*<small>\(1°\)<\/small>/);
});

test("the crest falls back to initials without a logo, and names are escaped", () => {
  const data = structuredClone(girone);
  const team = data.teams.find((t) => t.id === AQUILA);
  team.logo_url = null;
  team.name = 'A <b>"X"</b>';
  const html = renderOpponent(data, AQUILA, NOW);
  assert.match(html, /class="crest-fallback"/);
  assert.doesNotMatch(html, /<b>"X"/);
  assert.match(html, /&lt;/);
});

test("no card for the followed club or an unknown team", () => {
  assert.equal(renderOpponent(girone, FENICE, NOW), "");
  assert.equal(renderOpponent(girone, "nope", NOW), "");
});

// Minimal stand-ins for the document, the dialog and the controls
function harness(data) {
  const listeners = {}, dialogListeners = {};
  const dialog = {
    open: false, modal: false,
    showModal() { this.open = true; this.modal = true; },
    close() { this.open = false; (dialogListeners.close ?? []).forEach((f) => f()); },
    addEventListener(type, fn) { (dialogListeners[type] ??= []).push(fn); },
  };
  const body = { innerHTML: "", addEventListener() {} };
  const root = { addEventListener(type, fn) { listeners[type] = fn; } };
  installOpponentDialog(root, dialog, body, () => data, () => NOW);
  const control = (attr, id) => ({
    dataset: { opponent: id }, isConnected: true, focused: false, focus() { this.focused = true; },
    closest(sel) { return sel === attr ? this : null; },
  });
  const click = (target) => listeners.click({ target });
  return { dialog, body, control, click };
}

test("clicking a [data-opponent] control opens the modal dialog with the card", () => {
  const { dialog, body, control, click } = harness(girone);
  click(control("[data-opponent]", AQUILA));
  assert.equal(dialog.open, true);
  assert.equal(dialog.modal, true);
  assert.match(body.innerHTML, /Aquila Oro/);
});

test("closing returns the focus to the control that opened the card", () => {
  const { dialog, control, click } = harness(girone);
  const opener = control("[data-opponent]", AQUILA);
  click(opener);
  click({ closest: (sel) => (sel === "[data-close]" ? {} : null) });
  assert.equal(dialog.open, false);
  assert.equal(opener.focused, true);
});

test("clicks elsewhere and a missing data do nothing", () => {
  const h = harness(girone);
  h.click({ closest: () => null });
  assert.equal(h.dialog.open, false);
  const none = harness(null);
  none.click(none.control("[data-opponent]", AQUILA));
  assert.equal(none.dialog.open, false);
});

test("a game awarded at the table shows its score without empty parentheses", () => {
  const data = structuredClone(girone);
  const g = data.games.find((x) => x.played && [x.home_id, x.away_id].includes(AQUILA) && [x.home_id, x.away_id].includes(FENICE));
  g.sets = [];
  const html = renderOpponent(data, AQUILA, NOW);
  assert.match(html, /<b>0-3<\/b> persa dalla Fenice/);
  assert.doesNotMatch(html, /\(\)/);
  assert.match(renderOpponent(girone, AQUILA, NOW), /\(8-25, 17-25, 16-25\)/);
});

const clone = () => structuredClone(girone);
// Marks the unplayed games of the team as played, oldest first, until only `left` remain
function playUntil(data, teamId, left) {
  const open = data.games.filter((g) => !g.played && [g.home_id, g.away_id].includes(teamId));
  for (const g of open.slice(0, open.length - left)) Object.assign(g, { played: true, sets_won: [3, 0], sets: [[25, 1], [25, 1], [25, 1]] });
  return data;
}
const countOf = (html, needle) => html.split(needle).length - 1;

test("the card lists up to 5 remaining games with no details, a sixth one opens the details", () => {
  assert.equal(countOf(renderOpponent(girone, AQUILA, NOW), "<details>"), 1); // 7 left
  const five = renderOpponent(playUntil(clone(), AQUILA, 5), AQUILA, NOW);
  assert.equal(countOf(five, "<details>"), 0);
  assert.match(five, /<h3>Prossime gare<\/h3><ul>(<li>[^]*?<\/li>){5}<\/ul><p class="note">/);
  assert.equal(countOf(renderOpponent(playUntil(clone(), AQUILA, 6), AQUILA, NOW), "<details>"), 1);
});

test("with every game played the card says there is nothing left and shows no average", () => {
  const data = clone();
  for (const g of data.games.filter((x) => !x.played)) Object.assign(g, { played: true, sets_won: [3, 0], sets: [[25, 1], [25, 1], [25, 1]] });
  const html = renderOpponent(data, AQUILA, NOW);
  assert.match(html, /<h3>Prossime gare<\/h3><p>Nessuna gara da giocare\.<\/p>/);
  assert.equal(countOf(html, "Posizione media"), 0);
  assert.match(html, /Giornata 7: <b>0-3<\/b> persa dalla Fenice/);
  assert.equal(countOf(renderOpponent(girone, AQUILA, NOW), "Nessuna gara da giocare"), 0);
});

test("without standings the card shows no average position and no position beside the opponents", () => {
  const data = clone();
  data.standings = [];
  const html = renderOpponent(data, AQUILA, NOW);
  assert.match(html, /<li>[^<]*CUS Cagliari, in trasferta<\/li>/);
  assert.equal(countOf(html, "Posizione media"), 0);
  assert.equal(countOf(html, "°)"), 0);
  assert.equal(countOf(html, "° in classifica"), 0);
  assert.equal(countOf(renderOpponent(girone, AQUILA, NOW), "Posizione media"), 1);
});

test("a team missing from the standings has no position line and no range line, one in them has both", () => {
  const data = clone();
  for (const g of data.games.filter((x) => !x.played)) Object.assign(g, { played: true, sets_won: [3, 0], sets: [[25, 1], [25, 1], [25, 1]] });
  const listed = renderOpponent(data, AQUILA, NOW);
  assert.match(listed, /<p>1° in classifica<\/p><p class="opp-range">Posizione finale possibile: 1°<\/p>/);
  data.standings = data.standings.filter((r) => r.team_id !== AQUILA);
  const missing = renderOpponent(data, AQUILA, NOW);
  assert.equal(countOf(missing, "° in classifica"), 0);
  assert.equal(countOf(missing, "opp-range"), 0);
  assert.match(missing, /<h2 id="opp-title">G\.S\. Aquila Oro<\/h2>/);
});

test("a game without a start date reads «Data da definire» in the head to head and in the remaining games", () => {
  const data = clone();
  data.games.find((g) => g.id === "12995193").starts_at = null; // round 7, Aquila at home against the Fenice
  const html = renderOpponent(data, AQUILA, NOW);
  assert.ok(html.includes("<li>Giornata 7: da giocare, Data da definire</li>"));
  assert.ok(html.includes("<li>Data da definire: Asd Fenice <small>(6°)</small>, in casa</li>"));
  assert.ok(renderOpponent(girone, AQUILA, NOW).includes("<li>Giornata 7: da giocare, gio 7 gen</li>"));
});

test("a team that never meets the Fenice has an explicit «Nessuno scontro» line", () => {
  const data = clone();
  data.games = data.games.filter((g) => ![g.home_id, g.away_id].every((id) => [FENICE, AQUILA].includes(id)));
  assert.match(renderOpponent(data, AQUILA, NOW), /<h3>Scontri diretti con la Fenice<\/h3><p>Nessuno scontro in calendario\.<\/p>/);
  assert.equal(countOf(renderOpponent(girone, AQUILA, NOW), "Nessuno scontro"), 0);
});

test("head to head: a game won by the Fenice reads «vinta dalla Fenice» with the sets from its side", () => {
  const data = clone();
  Object.assign(data.games.find((g) => g.id === "12995178"), { sets_won: [3, 0], sets: [[25, 8], [25, 17], [25, 16]] }); // Fenice at home
  const html = renderOpponent(data, AQUILA, NOW);
  assert.ok(html.includes("<li>Giornata 2: <b>3-0</b> vinta dalla Fenice<small> (25-8, 25-17, 25-16)</small></li>"));
  assert.equal(countOf(html, "persa dalla Fenice"), 0);
});

test("head to head: a game played by the Fenice away shows the score and sets from the Fenice side", () => {
  const html = renderOpponent(girone, "232550", NOW); // Selargius at home beat the Fenice 3-0 in round 1
  assert.ok(html.includes("<li>Giornata 1: <b>0-3</b> persa dalla Fenice<small> (12-25, 19-25, 18-25)</small></li>"));
});

test("a remaining game against a team that is not in the list reads «Squadra sconosciuta»", () => {
  const data = clone();
  data.teams = data.teams.filter((t) => t.id !== SARROCH);
  const html = renderOpponent(data, AQUILA, NOW); // round 6 Aquila at home against Sarroch
  assert.ok(html.includes("<li>dom 20 dic: Squadra sconosciuta <small>(2°)</small>, in casa</li>"));
  assert.equal(countOf(renderOpponent(girone, AQUILA, NOW), "Squadra sconosciuta"), 0);
});

test("clicking the control of the followed club or an unknown id leaves the dialog closed and the body untouched", () => {
  const { dialog, body, control, click } = harness(girone);
  click(control("[data-opponent]", FENICE));
  click(control("[data-opponent]", "999999"));
  assert.equal(dialog.open, false);
  assert.equal(body.innerHTML, "");
  click(control("[data-opponent]", AQUILA));
  assert.equal(dialog.open, true);
  assert.match(body.innerHTML, /Aquila Oro/);
});

test("one game beyond the five shown is announced in the singular", () => {
  const html = renderOpponent(playUntil(clone(), AQUILA, 6), AQUILA, NOW);
  assert.match(html, /<summary>L'altra gara<\/summary>/);
  assert.doesNotMatch(html, /Le altre 1 gare/);
  assert.match(renderOpponent(girone, AQUILA, NOW), /<summary>Le altre 2 gare<\/summary>/);
});

test("head to head: a game over without a result reads «risultato in arrivo», a game being played «in corso»", () => {
  const kickoff = Date.parse(girone.games.find((g) => g.id === "12995193").starts_at); // round 7, Aquila - Fenice
  const during = renderOpponent(girone, AQUILA, new Date(kickoff + 30 * 60e3));
  assert.ok(during.includes("<li>Giornata 7: in corso, gio 7 gen</li>"));
  const after = renderOpponent(girone, AQUILA, new Date(kickoff + 2 * 24 * 3600e3));
  assert.ok(after.includes("<li>Giornata 7: risultato in arrivo, gio 7 gen</li>"));
  assert.equal(countOf(after, "Giornata 7: da giocare"), 0);
});

test("closing after the opener was re-rendered gives the focus to its replacement, the same team's control", () => {
  const listeners = {}, dialogListeners = {};
  const dialog = {
    open: false, showModal() { this.open = true; },
    close() { this.open = false; (dialogListeners.close ?? []).forEach((f) => f()); },
    addEventListener(type, fn) { (dialogListeners[type] ??= []).push(fn); },
  };
  const control = (id) => ({
    dataset: { opponent: id }, isConnected: true, focused: false, focus() { this.focused = true; },
    closest(sel) { return sel === "[data-opponent]" ? this : null; },
  });
  const opener = control(AQUILA), replacement = control(AQUILA);
  const asked = [];
  const root = {
    addEventListener(type, fn) { listeners[type] = fn; },
    querySelector(sel) { asked.push(sel); return replacement; },
  };
  installOpponentDialog(root, dialog, { innerHTML: "", addEventListener() {} }, () => girone, () => NOW);
  listeners.click({ target: opener });
  opener.isConnected = false; // the clock re-rendered the section that held it

  dialog.close();

  assert.equal(opener.focused, false);
  assert.equal(replacement.focused, true);
  assert.deepEqual(asked, [`[data-opponent="${AQUILA}"]`]);
});
