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

test("at the end of the page a short last section is marked even if it starts below the bar", () => {
  const t = setup({ starts: { next: 200, standings: 900, calendar: 1600, notices: 3500 } });
  setupSectionNav(t.env);
  t.scrollTo(3150);
  assert.deepEqual(current(t), ["calendar"]);
  t.scrollTo(3200);
  // notices starts 300 px below the top of the viewport, but nothing is left to scroll
  assert.deepEqual(current(t), ["notices"]);
});

test("a resize of the window updates the mark like a scroll does", () => {
  const t = setup();
  setupSectionNav(t.env);
  t.flush();
  t.env.win.scrollY = 1000;
  t.listeners.resize.forEach((fn) => fn());
  t.flush();
  assert.deepEqual(current(t), ["standings"]);
});

test("without an offset the bar height of 80 px is used", () => {
  const t = setup();
  delete t.env.offset;
  setupSectionNav(t.env);
  // calendar starts 50 px below the top: under the 80 px bar it is the current one
  t.scrollTo(1550);
  assert.deepEqual(current(t), ["calendar"]);
});

test("without an injected raf scroll updates through requestAnimationFrame", () => {
  const t = setup();
  const frames = [];
  delete t.env.raf;
  t.env.win.requestAnimationFrame = (fn) => frames.push(fn);
  setupSectionNav(t.env);
  frames.shift()();
  t.env.win.scrollY = 1000;
  t.listeners.scroll.forEach((fn) => fn());
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(current(t), ["standings"]);
});

test("a link to a missing section is hidden while existing links remain visible", () => {
  const t = setup();
  delete t.sections.standings;
  setupSectionNav(t.env);
  t.flush();
  assert.equal(t.items.standings.hidden, true);
  assert.equal(t.items.next.hidden, false);
  assert.deepEqual(current(t), ["next"]);
});

test("the short last section becomes current two pixels before the bottom", () => {
  const t = setup({ starts: { next: 200, standings: 900, calendar: 1600, notices: 3500 } });
  setupSectionNav(t.env);
  t.scrollTo(3197);
  assert.deepEqual(current(t), ["calendar"]);
  t.scrollTo(3198);
  assert.deepEqual(current(t), ["notices"]);
});

test("the default bar offset includes 80 pixels but not 81", () => {
  const t = setup();
  delete t.env.offset;
  setupSectionNav(t.env);
  t.scrollTo(1519);
  assert.deepEqual(current(t), ["standings"]);
  t.scrollTo(1520);
  assert.deepEqual(current(t), ["calendar"]);
});
