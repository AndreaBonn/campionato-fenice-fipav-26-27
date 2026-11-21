import assert from "node:assert/strict";
import { test } from "node:test";

import { setupSectionNav } from "../../docs/nav.js";

// Four sections and the links to them, with the scroll position as a plain number: top of each = start - scrollY.
function setup({ hidden = [], starts = { next: 200, standings: 900, calendar: 1600, notices: 2600 }, scrollY = 0 } = {}) {
  const IDS = Object.keys(starts);
  const sections = Object.fromEntries(IDS.map((id) => [id, { id, hidden: hidden.includes(id), getBoundingClientRect: () => ({ top: starts[id] - env.win.scrollY }) }]));
  const items = Object.fromEntries(IDS.map((id) => [id, { hidden: false }]));
  const links = Object.fromEntries(IDS.map((id) => [id, {
    attrs: {}, parentElement: items[id],
    getAttribute: (n) => (n === "href" ? `#${id}` : null),
    setAttribute(n, v) { this.attrs[n] = v; },
    removeAttribute(n) { delete this.attrs[n]; },
  }]));
  const listeners = {};
  const pending = [];
  const doc = {
    getElementById: (id) => sections[id] ?? null,
    querySelectorAll: () => Object.values(links),
    documentElement: { scrollHeight: 4000 },
  };
  const env = {
    doc, offset: 80, raf: (fn) => pending.push(fn),
    win: { scrollY: scrollY, innerHeight: 800, addEventListener: (type, fn) => (listeners[type] ??= []).push(fn) },
  };
  const flush = () => pending.splice(0).forEach((fn) => fn());
  const scrollTo = (y) => { env.win.scrollY = y; (listeners.scroll ?? []).forEach((fn) => fn()); flush(); };
  return { env, links, items, sections, scrollTo, flush, listeners };
}

const current = (t) => Object.keys(t.links).filter((id) => "aria-current" in t.links[id].attrs);

test("on start the first section's link is marked with aria-current", () => {
  const t = setup();
  setupSectionNav(t.env);
  t.flush();
  assert.deepEqual(current(t), ["next"]);
  assert.equal(t.links.next.attrs["aria-current"], "location");
});

test("scrolling moves the mark to the section under the bar, one link at a time", () => {
  const t = setup();
  setupSectionNav(t.env);
  t.scrollTo(1000);
  assert.deepEqual(current(t), ["standings"]);
  t.scrollTo(1700);
  assert.deepEqual(current(t), ["calendar"]);
});

test("at the end of the page the last section is marked", () => {
  const t = setup();
  setupSectionNav(t.env);
  t.scrollTo(3300);
  assert.deepEqual(current(t), ["notices"]);
});

test("a section that is hidden is never marked and its link is hidden too", () => {
  const t = setup({ hidden: ["next", "standings"] });
  setupSectionNav(t.env);
  t.flush();
  assert.deepEqual(current(t), ["calendar"]);
  assert.equal(t.items.next.hidden, true);
  assert.equal(t.items.standings.hidden, true);
  assert.equal(t.items.calendar.hidden, false);
});

test("many scroll events in one frame are one update", () => {
  const t = setup();
  setupSectionNav(t.env);
  t.flush();
  let reads = 0;
  for (const s of Object.values(t.sections)) {
    const read = s.getBoundingClientRect;
    s.getBoundingClientRect = () => (reads++, read());
  }
  for (let i = 0; i < 10; i++) t.listeners.scroll.forEach((fn) => fn());
  t.flush();
  assert.equal(reads, 4);
});

test("an observer of the page content re-runs the update when sections are shown or hidden", () => {
  const t = setup({ hidden: ["standings"] });
  let callback = null;
  t.env.watch = (fn) => { callback = fn; };
  setupSectionNav(t.env);
  t.flush();
  assert.equal(t.items.standings.hidden, true);
  t.sections.standings.hidden = false;
  callback();
  t.flush();
  assert.equal(t.items.standings.hidden, false);
});

test("a page that fits the viewport does not count as scrolled to the end: the first section stays current", () => {
  const t = setup({ starts: { next: 100, standings: 300, calendar: 500, notices: 700 } });
  t.env.doc.documentElement.scrollHeight = 700;
  setupSectionNav(t.env);
  t.flush();
  assert.deepEqual(current(t), ["next"]);
});
