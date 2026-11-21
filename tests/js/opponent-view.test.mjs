import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { installOpponentDialog, renderOpponent } from "../../docs/opponent-view.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const FENICE = "232645";
const AQUILA = "232223";
const SARROCH = "232139";

test("the card has title, head to head, home/away record and remaining games", () => {
  const html = renderOpponent(girone, AQUILA);
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
  const html = renderOpponent(girone, SARROCH);
  assert.match(html, /<small>\(\d+°\)<\/small>/);
  assert.match(html, /Posizione media delle avversarie da affrontare: \d+,\d°/);
  assert.match(html, /<details><summary>Le altre \d+ gare<\/summary>/);
  assert.equal(html.split("<li>").length - 1 >= 6, true);
});

test("the crest falls back to initials without a logo, and names are escaped", () => {
  const data = structuredClone(girone);
  const team = data.teams.find((t) => t.id === AQUILA);
  team.logo_url = null;
  team.name = 'A <b>"X"</b>';
  const html = renderOpponent(data, AQUILA);
  assert.match(html, /class="crest-fallback"/);
  assert.doesNotMatch(html, /<b>"X"/);
  assert.match(html, /&lt;/);
});

test("no card for the followed club or an unknown team", () => {
  assert.equal(renderOpponent(girone, FENICE), "");
  assert.equal(renderOpponent(girone, "nope"), "");
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
  installOpponentDialog(root, dialog, body, () => data);
  const control = (attr, id) => ({
    dataset: { opponent: id }, focused: false, focus() { this.focused = true; },
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
