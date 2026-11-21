import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";

import { CLOCK_TICK_MS, REFRESH_AFTER_MS, SLOW_LOAD_MS, applyViews, buildViews, load, loadStatus, refresh, rerender, startApp } from "../../docs/app.js";

const SAMPLE = JSON.parse(readFileSync(new URL("./../fixtures/data-sample.json", import.meta.url), "utf8"));
const GIRONE = JSON.parse(readFileSync(new URL("./../fixtures/data-64353.json", import.meta.url), "utf8"));
const NOW = new Date("2026-11-21T12:00:00+01:00");
const CHECKED_AT = "2026-11-21T10:00:00+00:00";
const IDS = ["next", "next-body", "last", "last-body", "standings", "standings-body", "analysis", "analysis-body", "list", "feed", "notices", "notices-body", "checked", "opponent", "opp-body", "nav-notices-count"];

// The page's elements, as plain objects keyed by id.
function fakePage() {
  const els = {};
  for (const id of IDS) {
    els[id] = {
      hidden: false,
      innerHTML: "",
      attrs: {},
      listeners: {},
      setAttribute(name, value) {
        this.attrs[name] = value;
      },
      addEventListener(type, fn) {
        this.listeners[type] = fn;
      },
      insertAdjacentHTML(where, html) {
        this.insertedAt = where;
        this.innerHTML = where === "afterbegin" ? html + this.innerHTML : this.innerHTML + html;
      },
      querySelector(selector) {
        return selector === ".state" && this.innerHTML.includes('class="state') ? this : null;
      },
    };
  }
  const doc = {
    getElementById: (id) => els[id],
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
  };
  return { els, doc, $: (id) => els[id] };
}

function respond(body, { ok = true, status = 200 } = {}) {
  return Promise.resolve({ ok, status, json: async () => body });
}

function router(routes) {
  return (url) => (url in routes ? routes[url]() : respond({}, { ok: false, status: 404 }));
}

function makeApp(page, fetch) {
  return { $: page.$, fetch, now: () => NOW, protocol: "https:", checkedAt: null, data: null, views: null, loadedAt: null, ticket: 0, loading: false };
}

const sampleWithoutGames = () => ({ ...SAMPLE, games: [], standings: [] });

test("populated: sections are filled and shown, busy flag cleared", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => respond(SAMPLE) }));

  await load(app);

  assert.equal(page.els.next.hidden, false);
  assert.match(page.els["next-body"].innerHTML, /\S/);
  assert.equal(page.els.standings.hidden, false);
  assert.match(page.els["standings-body"].innerHTML, /<table/);
  assert.match(page.els.list.innerHTML, /giornata di andata/);
  assert.equal(page.els.list.attrs["aria-busy"], "false");
  assert.equal(app.data, SAMPLE);
});

test("populated: last result, analysis and calendar feed carry their own markup", async () => {
  const hadLocation = Object.hasOwn(globalThis, "location");
  const previous = globalThis.location;
  globalThis.location = { href: "https://example.org/f/" };
  try {
    const page = fakePage();
    await load(makeApp(page, router({ "data.json": () => respond(SAMPLE) })));

    // sample: round 1 won 3-0, round 2 won 3-2 against CUS Cagliari (last played), so 2 wins, 6 sets won, 2 lost
    assert.match(page.els["last-body"].innerHTML, /<p class="teams"><b>ASD Fenice - CUS Cagliari<\/b><\/p>/);
    assert.match(page.els["last-body"].innerHTML, /<p class="big">3-2<\/p>/);
    assert.equal(page.els.last.hidden, false);
    assert.match(page.els["analysis-body"].innerHTML, /<b class="n">2-0<\/b> vinte e perse/);
    assert.match(page.els["analysis-body"].innerHTML, /<b class="n">6-2<\/b> set/);
    assert.equal(page.els.analysis.hidden, false);
    assert.match(page.els.feed.innerHTML, /<h3>Tutte le partite nel calendario del telefono<\/h3>/);
    assert.match(page.els.feed.innerHTML, /href="webcal:\/\/example\.org\/f\/calendario\.ics"/);
  } finally {
    if (hadLocation) globalThis.location = previous; else delete globalThis.location;
  }
});

test("a reload empties the next game box while the new data is awaited", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const page = fakePage();
    page.els["next-body"].innerHTML = "<p>previous next game</p>";
    const app = makeApp(page, router({ "data.json": () => new Promise(() => {}) }));

    load(app);

    assert.equal(page.els["next-body"].innerHTML, "");
  } finally {
    mock.timers.reset();
  }
});

test("startApp: a failed crest image in the standings or in the next game box is replaced by the initials", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    await startApp({ doc: page.doc, fetch: router({ "data.json": () => respond(GIRONE) }), now: () => NOW, protocol: "https:" });
    for (const id of ["standings-body", "next-body"]) {
      assert.match(page.els[id].innerHTML, /<img [^>]*data-crest-name="[^"]+"/);
      const calls = [];
      const img = { tagName: "IMG", dataset: { crestName: "ASD FENICE" }, insertAdjacentHTML: (...a) => calls.push(a), remove: () => calls.push("removed") };
      page.els[id].listeners.error({ target: img });
      assert.deepEqual(calls, [["afterend", '<span class="crest-fallback" aria-hidden="true">AF</span>'], "removed"]);
    }
  } finally {
    mock.timers.reset();
  }
});

test("loading state is shown while the request is pending, sections hidden", async () => {
  const page = fakePage();
  let release;
  const pending = new Promise((resolve) => (release = resolve));
  const app = makeApp(page, router({ "data.json": () => pending }));

  const loading = load(app);

  assert.match(page.els.list.innerHTML, /Caricamento dei dati in corso/);
  assert.equal(page.els.list.attrs["aria-busy"], "true");
  assert.equal(page.els.next.hidden, true);
  assert.equal(page.els.standings.hidden, true);
  release(await respond(SAMPLE));
  await loading;
  assert.equal(page.els.list.attrs["aria-busy"], "false");
});

test("slow network: after the threshold a note is added to the loading box, once loaded the timer is gone", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const page = fakePage();
    let release;
    const pending = new Promise((resolve) => (release = resolve));
    const app = makeApp(page, router({ "data.json": () => pending }));
    const loading = load(app);

    mock.timers.tick(SLOW_LOAD_MS - 1);
    assert.doesNotMatch(page.els.list.innerHTML, /più del previsto/);
    mock.timers.tick(1);
    assert.match(page.els.list.innerHTML, /Ci sta mettendo più del previsto/);
    assert.equal(page.els.list.insertedAt, "afterbegin");
    assert.ok(page.els.list.innerHTML.startsWith("<p>Ci sta mettendo più del previsto: la rete è lenta.</p>"));

    release(await respond(SAMPLE));
    await loading;
    assert.doesNotMatch(page.els.list.innerHTML, /più del previsto/);
  } finally {
    mock.timers.reset();
  }
});

test("network failure: connection error with a retry button, sections stay hidden", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => Promise.reject(new TypeError("Failed to fetch")) }));
  const log = mock.method(console, "error", () => {});

  await load(app);
  log.mock.restore();

  assert.match(page.els.list.innerHTML, /Connessione non riuscita/);
  assert.match(page.els.list.innerHTML, /id="retry"/);
  assert.equal(page.els.next.hidden, true);
  assert.equal(page.els.list.attrs["aria-busy"], "false");
  assert.equal(app.data, null);
});

test("HTTP error: the status is reported to the user", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => respond({}, { ok: false, status: 503 }) }));
  const log = mock.method(console, "error", () => {});

  await load(app);
  log.mock.restore();

  assert.match(page.els.list.innerHTML, /\(503\)/);
});

test("malformed data is reported as unreadable data, not as a dead network", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => respond({ nonsense: true }) }));
  const log = mock.method(console, "error", () => {});

  await load(app);
  log.mock.restore();

  assert.match(page.els.list.innerHTML, /I dati ricevuti non sono leggibili/);
  assert.doesNotMatch(page.els.list.innerHTML, /Connessione non riuscita/);
});

test("empty calendar: the empty state with retry is shown and the hero stays hidden", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => respond(sampleWithoutGames()) }));

  await load(app);

  assert.match(page.els.list.innerHTML, /Calendario non ancora disponibile/);
  assert.equal(page.els.next.hidden, true);
  assert.equal(page.els.last.hidden, true);
});

test("applyViews hides a section whose markup is empty and shows one that has some", () => {
  const page = fakePage();

  applyViews(page.$, { hero: "", list: "L", standings: "S", last: "", feed: "F", analysis: "A", notices: "N" });

  assert.equal(page.els.next.hidden, true);
  assert.equal(page.els.standings.hidden, false);
  assert.equal(page.els.last.hidden, true);
  assert.equal(page.els.analysis.hidden, false);
  assert.equal(page.els["notices-body"].innerHTML, "N");
});

test("applyViews hides the notices section without notices and shows it when one arrives", () => {
  const page = fakePage();
  const views = { hero: "H", list: "L", standings: "S", last: "R", feed: "F", analysis: "A", notices: "" };

  applyViews(page.$, views);
  assert.equal(page.els.notices.hidden, true);

  applyViews(page.$, { ...views, notices: "N" }, views);
  assert.equal(page.els.notices.hidden, false);
  assert.equal(page.els["notices-body"].innerHTML, "N");
});

test("buildViews wraps a rendering failure so the cause text is not 'network'", () => {
  assert.throws(() => buildViews({}, NOW), (err) => err.message === "invalid data" && err.cause instanceof Error);
});

test("status.json: the last check line is shown when the file exists", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "status.json": () => respond({ checked_at: "2026-11-21T10:00:00+00:00" }) }));

  await loadStatus(app);

  assert.equal(page.els.checked.hidden, false);
  assert.match(page.els.checked.textContent, /Dati FIPAV controllati/);
});

test("status.json with an unreadable checked_at: the line stays hidden instead of reading «NaN giorni fa»", async () => {
  for (const checked_at of ["garbage", 42, ""]) {
    const page = fakePage();
    page.els.checked.hidden = true; // as in index.html
    await loadStatus(makeApp(page, router({ "status.json": () => respond({ checked_at }) })));
    assert.equal(page.els.checked.hidden, true, String(checked_at));
    assert.doesNotMatch(page.els.checked.textContent ?? "", /NaN/);
  }
  const valid = fakePage();
  valid.els.checked.hidden = true;
  await loadStatus(makeApp(valid, router({ "status.json": () => respond({ checked_at: "2026-11-21T10:00:00+00:00" }) })));
  assert.equal(valid.els.checked.hidden, false);
});

test("status.json missing or unreachable: the line stays hidden and the load goes on", async () => {
  const missing = fakePage();
  await loadStatus(makeApp(missing, router({})));
  const down = fakePage();
  const warn = mock.method(console, "warn", () => {});
  await loadStatus(makeApp(down, router({ "status.json": () => Promise.reject(new TypeError("offline")) })));
  warn.mock.restore();

  assert.equal(missing.els.checked.textContent, undefined);
  assert.equal(down.els.checked.textContent, undefined);
});

test("startApp: a click on the retry button reloads, a click elsewhere does not", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    let calls = 0;
    const fetch = router({ "data.json": () => (calls++ === 0 ? Promise.reject(new TypeError("x")) : respond(SAMPLE)) });
    const log = mock.method(console, "error", () => {});
    await startApp({ doc: page.doc, fetch, now: () => NOW, protocol: "https:" });
    log.mock.restore();
    assert.match(page.els.list.innerHTML, /id="retry"/);

    page.doc.listeners.click({ target: { closest: () => null } });
    assert.equal(calls, 1);

    page.doc.listeners.click({ target: { closest: (sel) => (sel === "#retry" ? {} : null) } });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 2);
    assert.match(page.els.list.innerHTML, /giornata di andata/);
  } finally {
    mock.timers.reset();
  }
});

const statusOk = () => respond({ checked_at: CHECKED_AT });
// load() does not await loadStatus(): let the pending status.json chain finish before asserting
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("load with a valid status.json: the last check line becomes visible", async () => {
  const page = fakePage();
  page.els.checked.hidden = true;
  const app = makeApp(page, router({ "data.json": () => respond(SAMPLE), "status.json": statusOk }));

  await load(app);
  await settle();

  assert.equal(page.els.checked.hidden, false);
  assert.equal(page.els.checked.textContent, "Dati FIPAV controllati 1 ora fa");
});

test("load requests data.json and status.json revalidated, never from the HTTP cache", async () => {
  const page = fakePage();
  const seen = [];
  const fetch = (url, init) => {
    seen.push([url, init]);
    return router({ "data.json": () => respond(SAMPLE), "status.json": statusOk })(url);
  };

  await load(makeApp(page, fetch));

  assert.deepEqual(seen.map(([url]) => url).sort(), ["data.json", "status.json"]);
  assert.deepEqual(seen.map(([, init]) => init), [{ cache: "no-cache" }, { cache: "no-cache" }]);
});

test("applyViews writes each markup into its own element", () => {
  const page = fakePage();

  applyViews(page.$, { hero: "H", list: "LIST", standings: "STAND", last: "LAST", feed: "FEED", analysis: "AN", notices: "N" });

  assert.equal(page.els["next-body"].innerHTML, "H");
  assert.equal(page.els.list.innerHTML, "LIST");
  assert.equal(page.els["standings-body"].innerHTML, "STAND");
  assert.equal(page.els["last-body"].innerHTML, "LAST");
  assert.equal(page.els.feed.innerHTML, "FEED");
  assert.equal(page.els["analysis-body"].innerHTML, "AN");
  assert.equal(page.els["notices-body"].innerHTML, "N");
});

test("while loading, next, standings, last and analysis are hidden", () => {
  const page = fakePage();
  const pending = new Promise(() => {});
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    load(makeApp(page, router({ "data.json": () => pending })));
  } finally {
    mock.timers.reset();
  }

  for (const id of ["next", "standings", "last", "analysis"]) assert.equal(page.els[id].hidden, true, id);
});

test("after a failed load, next, standings, last and analysis stay hidden", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => Promise.reject(new TypeError("Failed to fetch")) }));
  const log = mock.method(console, "error", () => {});

  await load(app);
  log.mock.restore();

  for (const id of ["next", "standings", "last", "analysis"]) assert.equal(page.els[id].hidden, true, id);
});

test("status.json answering 404 with a valid-looking body leaves the line hidden", async () => {
  const page = fakePage();
  page.els.checked.hidden = true;
  const app = makeApp(page, router({ "status.json": () => respond({ checked_at: CHECKED_AT }, { ok: false, status: 404 }) }));

  await loadStatus(app);

  assert.equal(page.els.checked.hidden, true);
  assert.equal(page.els.checked.textContent, undefined);
});

test("status.json without checked_at leaves the line hidden", async () => {
  const page = fakePage();
  page.els.checked.hidden = true;

  await loadStatus(makeApp(page, router({ "status.json": () => respond({}) })));

  assert.equal(page.els.checked.hidden, true);
  assert.equal(page.els.checked.textContent, undefined);
});

test("startApp: every clock tick refreshes the age shown in the last check line", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    const clock = { now: NOW };
    const fetch = router({ "data.json": () => respond(SAMPLE), "status.json": statusOk });
    await startApp({ doc: page.doc, fetch, now: () => clock.now, protocol: "https:" });
    await settle();
    assert.equal(page.els.checked.textContent, "Dati FIPAV controllati 1 ora fa");

    clock.now = new Date(NOW.getTime() + 3 * 3600e3);
    mock.timers.tick(CLOCK_TICK_MS);

    assert.equal(page.els.checked.textContent, "Dati FIPAV controllati 4 ore fa");
  } finally {
    mock.timers.reset();
  }
});

test("startApp: a clock tick without a known last check does not touch the line", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    page.els.checked.hidden = true;
    await startApp({ doc: page.doc, fetch: router({ "data.json": () => respond(SAMPLE) }), now: () => NOW, protocol: "https:" });

    mock.timers.tick(CLOCK_TICK_MS);

    assert.equal(page.els.checked.hidden, true);
    assert.equal(page.els.checked.textContent, undefined);
  } finally {
    mock.timers.reset();
  }
});

test("startApp without a now function reads the system clock", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: new Date("2026-11-21T10:30:00+00:00") });
  try {
    const page = fakePage();
    const fetch = router({ "data.json": () => respond(SAMPLE), "status.json": statusOk });

    await startApp({ doc: page.doc, fetch, protocol: "https:" });
    await settle();

    assert.equal(page.els.checked.textContent, "Dati FIPAV controllati 30 minuti fa");
  } finally {
    mock.timers.reset();
  }
});

test("startApp: a click on a [data-opponent] element opens the team card with the loaded data", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    const clicks = [];
    page.doc.addEventListener = (type, fn) => type === "click" && clicks.push(fn);
    const shown = [];
    page.els.opponent.showModal = () => shown.push(true);
    page.els.opponent.close = () => {};
    const fetch = router({ "data.json": () => respond(GIRONE) });
    await startApp({ doc: page.doc, fetch, now: () => NOW, protocol: "https:" });
    const click = (opponentId) => {
      const opener = { dataset: { opponent: opponentId } };
      const target = { closest: (sel) => (sel === "[data-opponent]" ? opener : null) };
      clicks.forEach((fn) => fn({ target }));
    };

    click("no-such-team");
    assert.equal(shown.length, 0);

    click("232396");
    assert.equal(shown.length, 1);
    assert.match(page.els["opp-body"].innerHTML, /Sporting Club Su Planu/);
  } finally {
    mock.timers.reset();
  }
});

// A fetch that records every URL and answers from the routes
function recording(routes) {
  const calls = [];
  const fetch = (url, init) => {
    calls.push(url);
    return router(routes)(url, init);
  };
  return { calls, fetch, dataCalls: () => calls.filter((u) => u === "data.json").length };
}

// Element whose innerHTML writes are counted, to tell a rewrite from an untouched section
function countingElement() {
  const el = { hidden: false, writes: 0, html: "", setAttribute() {} };
  Object.defineProperty(el, "innerHTML", { get() { return this.html; }, set(v) { this.writes += 1; this.html = v; } });
  return el;
}

test("applyViews rewrites only the sections whose markup changed since the previous views", () => {
  const els = Object.fromEntries(IDS.map((id) => [id, countingElement()]));
  const $ = (id) => els[id];
  const views = { hero: "<p>h</p>", list: "<li>l</li>", standings: "", last: "<p>r</p>", feed: "", analysis: "", notices: "<p>n</p>" };
  applyViews($, views);
  applyViews($, { ...views, hero: "<p>h2</p>" }, views);
  assert.equal(els["next-body"].writes, 2);
  assert.equal(els["next-body"].innerHTML, "<p>h2</p>");
  // a focused link inside an untouched section keeps its node, so the keyboard focus is not lost
  assert.equal(els.list.writes, 1);
  assert.equal(els["notices-body"].writes, 1);
});

test("clock tick: the hero follows the kickoff without a new request («Stasera» becomes «In corso»)", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    const clock = { now: new Date("2026-11-21T16:58:00+01:00") };
    const net = recording({ "data.json": () => respond(SAMPLE) });
    await startApp({ doc: page.doc, fetch: net.fetch, now: () => clock.now, protocol: "https:" });
    assert.match(page.els["next-body"].innerHTML, /tra<\/span><b>2 minuti/);
    assert.doesNotMatch(page.els.list.innerHTML, /In corso/);

    clock.now = new Date("2026-11-21T17:05:00+01:00");
    mock.timers.tick(CLOCK_TICK_MS);

    assert.match(page.els["next-body"].innerHTML, /<b>In corso<\/b>/);
    assert.match(page.els.list.innerHTML, /<span class="pending">In corso<\/span>/);
    assert.equal(net.dataCalls(), 1);
  } finally {
    mock.timers.reset();
  }
});

test("clock tick: data older than REFRESH_AFTER_MS on a visible page is requested again and applied", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    const clock = { now: NOW };
    let body = SAMPLE;
    const net = recording({ "data.json": () => respond(body) });
    await startApp({ doc: page.doc, fetch: net.fetch, now: () => clock.now, protocol: "https:" });

    clock.now = new Date(NOW.getTime() + REFRESH_AFTER_MS - 1);
    mock.timers.tick(CLOCK_TICK_MS);
    assert.equal(net.dataCalls(), 1);

    body = GIRONE;
    clock.now = new Date(NOW.getTime() + REFRESH_AFTER_MS);
    mock.timers.tick(CLOCK_TICK_MS);
    await settle();
    assert.equal(net.dataCalls(), 2);
    assert.match(page.els["standings-body"].innerHTML, /Sporting Club Su Planu/);
  } finally {
    mock.timers.reset();
  }
});

test("clock tick on a hidden page never asks the network", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    page.doc.visibilityState = "hidden";
    const clock = { now: NOW };
    const net = recording({ "data.json": () => respond(SAMPLE) });
    await startApp({ doc: page.doc, fetch: net.fetch, now: () => clock.now, protocol: "https:" });

    clock.now = new Date(NOW.getTime() + 2 * REFRESH_AFTER_MS);
    mock.timers.tick(CLOCK_TICK_MS);
    await settle();

    assert.equal(net.dataCalls(), 1);
  } finally {
    mock.timers.reset();
  }
});

test("coming back to the page (installed app reopened) refreshes stale data at once", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    const clock = { now: NOW };
    const net = recording({ "data.json": () => respond(SAMPLE) });
    page.doc.visibilityState = "visible";
    await startApp({ doc: page.doc, fetch: net.fetch, now: () => clock.now, protocol: "https:" });

    page.doc.listeners.visibilitychange();
    await settle();
    assert.equal(net.dataCalls(), 1);

    clock.now = new Date(NOW.getTime() + 2 * 24 * 3600e3);
    page.doc.listeners.visibilitychange();
    await settle();
    assert.equal(net.dataCalls(), 2);
  } finally {
    mock.timers.reset();
  }
});

test("a failed background refresh keeps the page as it was: no error box over good data", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => respond(SAMPLE) }));
  await load(app);
  const before = page.els.list.innerHTML;

  app.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
  await refresh(app);

  assert.equal(page.els.list.innerHTML, before);
  assert.equal(app.data, SAMPLE);
});

test("a background refresh after a failed load replaces the error with the data", async () => {
  const page = fakePage();
  const app = makeApp(page, () => Promise.reject(new TypeError("Failed to fetch")));
  await load(app);
  assert.match(page.els.list.innerHTML, /Riprova/);

  app.fetch = router({ "data.json": () => respond(SAMPLE) });
  await refresh(app);

  assert.match(page.els.list.innerHTML, /giornata di andata/);
  assert.equal(page.els.next.hidden, false);
});

test("an older request that answers last never overwrites the newer one", async () => {
  const page = fakePage();
  let releaseOld;
  const oldAnswer = new Promise((resolve) => (releaseOld = resolve));
  const answers = [() => oldAnswer, () => respond(GIRONE)];
  const app = makeApp(page, (url) => (url === "data.json" ? answers.shift()() : respond({}, { ok: false, status: 404 })));

  const first = load(app);
  await load(app);
  releaseOld({ ok: true, status: 200, json: async () => SAMPLE });
  await first;

  assert.equal(app.data, GIRONE);
  assert.match(page.els["standings-body"].innerHTML, /Sporting Club Su Planu/);
  assert.equal(page.els.list.attrs["aria-busy"], "false");
});

test("a clock tick during a slow first load does not start a refresh that would orphan the loading box", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    let release;
    const answers = [() => new Promise((resolve) => (release = resolve)), () => Promise.reject(new TypeError("Failed to fetch"))];
    const net = recording({ "data.json": () => answers.shift()() });
    const started = startApp({ doc: page.doc, fetch: net.fetch, now: () => NOW, protocol: "https:" });

    mock.timers.tick(CLOCK_TICK_MS);
    assert.equal(net.dataCalls(), 1);

    release({ ok: false, status: 503, json: async () => ({}) });
    await started;
    assert.match(page.els.list.innerHTML, /Riprova/);
    assert.equal(page.els.list.attrs["aria-busy"], "false");
  } finally {
    mock.timers.reset();
  }
});

test("startApp: a click on [data-share] in the next game box shares the loaded next game, a click elsewhere does not", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    page.els["share-status"] = { textContent: "" };
    const clicks = [];
    page.els["next-body"].addEventListener = (type, fn) => type === "click" && clicks.push(fn);
    const shared = [];
    const nav = { share: async (p) => shared.push(p) };
    await startApp({ doc: page.doc, fetch: router({ "data.json": () => respond(SAMPLE) }), now: () => NOW, protocol: "https:", nav, pageUrl: () => "https://example.org/f/" });
    clicks.forEach((fn) => fn({ target: { closest: () => null } }));
    assert.equal(shared.length, 0);
    clicks.forEach((fn) => fn({ target: { closest: (sel) => (sel === "[data-share]" ? {} : null) } }));
    await Promise.resolve();
    assert.equal(shared.length, 1);
    assert.equal(shared[0].url, "https://example.org/f/");
    assert.match(shared[0].title, /^ASD Fenice - /);
  } finally {
    mock.timers.reset();
  }
});

// UX K-a: the schedule filters live in app.filter, a click redraws the list and keeps the focus on the choice
// closest() answers like the DOM: the delegated listener asks for either kind, chooseFilter asks if it is the reset one
const FILTER_OR_RESET = "[data-filter], [data-filter-reset]";
const button = (filter, value) => {
  const el = { dataset: { filter, value }, closest: (sel) => (sel === FILTER_OR_RESET ? el : null) };
  return el;
};
const resetButton = { dataset: {}, closest: () => resetButton };
const rows = (html) => html.split('<li class="game').length - 1;

async function startFiltered(data = GIRONE) {
  const page = fakePage();
  const focused = [];
  page.els.list.querySelector = (selector) => ({ focus: () => focused.push(selector) });
  await startApp({ doc: page.doc, fetch: router({ "data.json": () => respond(data) }), now: () => NOW, protocol: "https:" });
  return { page, focused };
}

test("filters: the list starts on Prossime and Casa e trasferta, nothing persisted", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const { page } = await startFiltered();
    assert.match(page.els.list.innerHTML, /data-value="next" aria-pressed="true"/);
    assert.match(page.els.list.innerHTML, /data-value="all" aria-pressed="true">Casa e trasferta/);
    assert.equal(page.els.list.innerHTML.includes('class="verdict'), false);
  } finally {
    mock.timers.reset();
  }
});

test("filters: a click on Giocate shows the played games and puts the focus on that button; Trasferta narrows it", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const { page, focused } = await startFiltered();
    const click = page.els.list.listeners.click;
    click({ target: button("when", "played") });
    const played = rows(page.els.list.innerHTML);
    assert.equal(played, GIRONE.games.filter((g) => g.played && [g.home_id, g.away_id].includes("232645")).length);
    assert.match(page.els.list.innerHTML, /data-value="played" aria-pressed="true"/);
    assert.deepEqual(focused, ['[data-filter="when"][data-value="played"]']);
    click({ target: button("side", "away") });
    assert.ok(rows(page.els.list.innerHTML) < played);
    assert.match(page.els.list.innerHTML, /data-filter="when" data-value="played" aria-pressed="true"/); // the other group is kept
    assert.equal(focused.at(-1), '[data-filter="side"][data-value="away"]');
  } finally {
    mock.timers.reset();
  }
});

test("filters: «Mostra tutte» resets both groups to Tutte and Casa e trasferta and focuses «Tutte»", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const noneYet = { ...GIRONE, games: GIRONE.games.map((g) => ({ ...g, played: false, sets_won: null, sets: [] })) };
    const { page, focused } = await startFiltered(noneYet);
    const click = page.els.list.listeners.click;
    click({ target: button("when", "played") });
    assert.match(page.els.list.innerHTML, /Nessuna partita giocata finora\./);
    click({ target: resetButton });
    assert.match(page.els.list.innerHTML, /data-value="all" aria-pressed="true">Tutte/);
    assert.match(page.els.list.innerHTML, /data-value="all" aria-pressed="true">Casa e trasferta/);
    assert.equal(rows(page.els.list.innerHTML), noneYet.games.filter((g) => [g.home_id, g.away_id].includes("232645")).length);
    assert.equal(focused.at(-1), '[data-filter="when"][data-value="all"]');
  } finally {
    mock.timers.reset();
  }
});

test("filters: a click that is not on a filter button, or a value outside the options, changes nothing", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const { page, focused } = await startFiltered();
    const before = page.els.list.innerHTML;
    page.els.list.listeners.click({ target: { closest: () => null } });
    page.els.list.listeners.click({ target: button("when", "nope") });
    assert.equal(page.els.list.innerHTML, before);
    assert.equal(focused.length, 1); // the bad value still redraws and refocuses, but with the filter unchanged
  } finally {
    mock.timers.reset();
  }
});

test("filters: a clock tick keeps the chosen filter", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const { page } = await startFiltered();
    page.els.list.listeners.click({ target: button("when", "played") });
    const chosen = page.els.list.innerHTML;
    mock.timers.tick(CLOCK_TICK_MS);
    assert.equal(page.els.list.innerHTML, chosen);
  } finally {
    mock.timers.reset();
  }
});

test("buildViews: the filter given reaches the schedule view", () => {
  assert.match(buildViews(GIRONE, NOW, { when: "played", side: "home" }).list, /data-value="played" aria-pressed="true"/);
});

test("applyViews: the nav badge shows the number of new notices, hidden at 0", () => {
  const page = fakePage();
  const views = { hero: "", list: "", standings: "", last: "", feed: "", analysis: "", notices: "", navBadge: "" };

  applyViews(page.$, views);
  assert.equal(page.els["nav-notices-count"].hidden, true);

  const withNew = { ...views, navBadge: '<span aria-hidden="true">2</span>' };
  applyViews(page.$, withNew, views);
  assert.equal(page.els["nav-notices-count"].hidden, false);
  assert.equal(page.els["nav-notices-count"].innerHTML, withNew.navBadge);

  applyViews(page.$, views, withNew);
  assert.equal(page.els["nav-notices-count"].hidden, true);
});

test("buildViews: a notice dated today gives the nav badge and the Nuova tag; none gives neither", () => {
  const today = { ...GIRONE, notices: [{ id: "n", title: "Oggi", url: "https://fipavcagliari.it/x/", date: "2026-11-21", kind: "indizione" }] };
  const v = buildViews(today, NOW);
  assert.match(v.navBadge, /1 nuova/);
  assert.match(v.notices, /Nuova/);
  const none = buildViews({ ...GIRONE, notices: [] }, NOW);
  assert.equal(none.navBadge, "");
});

test("clock tick: a focused filter button is focused again after the list is rewritten", async () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const page = fakePage();
    const focused = [];
    page.els.list.querySelector = (selector) => ({ focus: () => focused.push(selector) });
    const clock = { now: new Date("2026-11-21T16:58:00+01:00") };
    await startApp({ doc: page.doc, fetch: router({ "data.json": () => respond(SAMPLE) }), now: () => clock.now, protocol: "https:" });
    const active = { dataset: { filter: "side", value: "home" }, closest: (sel) => (sel === "#list" ? page.els.list : null) };
    page.doc.activeElement = active;
    clock.now = new Date("2026-11-21T17:05:00+01:00");
    mock.timers.tick(CLOCK_TICK_MS);
    assert.match(page.els.list.innerHTML, /<span class="pending">In corso<\/span>/);
    assert.deepEqual(focused, ['[data-filter="side"][data-value="home"]']);
    // focus elsewhere (a link, the body): nothing is moved
    page.doc.activeElement = { dataset: {}, closest: () => null };
    clock.now = new Date("2026-11-21T20:30:00+01:00");
    mock.timers.tick(CLOCK_TICK_MS);
    assert.equal(focused.length, 1);
  } finally {
    mock.timers.reset();
  }
});

test("timings from the spec: the slow note after 15 s, a refresh once the data is 10 minutes old", () => {
  assert.equal(SLOW_LOAD_MS, 15_000);
  assert.equal(REFRESH_AFTER_MS, 600_000);
});

test("an older request that fails last never puts an error box over the newer data", async () => {
  const page = fakePage();
  let failOld;
  const oldAnswer = new Promise((_, reject) => (failOld = reject));
  const answers = [() => oldAnswer, () => respond(GIRONE)];
  const app = makeApp(page, (url) => (url === "data.json" ? answers.shift()() : respond({}, { ok: false, status: 404 })));
  const errors = mock.method(console, "error", () => {});
  try {
    const first = load(app);
    await load(app);
    failOld(new TypeError("network down"));
    await first;
  } finally {
    errors.mock.restore();
  }

  assert.equal(app.data, GIRONE);
  assert.doesNotMatch(page.els.list.innerHTML, /Impossibile caricare/);
  assert.match(page.els.list.innerHTML, /class="filters"/);
});

test("a background refresh that answers after a newer load is dropped", async () => {
  const page = fakePage();
  let releaseRefresh;
  const slowRefresh = new Promise((resolve) => (releaseRefresh = resolve));
  const answers = [() => slowRefresh, () => respond(GIRONE)];
  const app = makeApp(page, (url) => (url === "data.json" ? answers.shift()() : respond({}, { ok: false, status: 404 })));

  const background = refresh(app);
  await load(app);
  releaseRefresh({ ok: true, status: 200, json: async () => SAMPLE });
  await background;

  assert.equal(app.data, GIRONE);
  assert.match(page.els["standings-body"].innerHTML, /Sporting Club Su Planu/);
});

test("a re-render that fails keeps what the page shows and logs why", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "data.json": () => respond(SAMPLE) }));
  await load(app);
  const shown = page.els.list.innerHTML, views = app.views;
  app.data = { teams: [] };
  const warn = mock.method(console, "warn", () => {});
  try {
    rerender(app);
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[0]), /re-render failed/);
  } finally {
    warn.mock.restore();
  }

  assert.equal(page.els.list.innerHTML, shown);
  assert.equal(app.views, views);
});

test("an older load that ends while a newer one is pending leaves the page busy for the newer one", async () => {
  const page = fakePage();
  let releaseNew;
  const newAnswer = new Promise((resolve) => (releaseNew = resolve));
  const answers = [() => respond(SAMPLE), () => newAnswer];
  const app = makeApp(page, (url) => (url === "data.json" ? answers.shift()() : respond({}, { ok: false, status: 404 })));

  const first = load(app);
  const second = load(app);
  await first;

  assert.equal(app.loading, true);
  assert.equal(page.els.list.attrs["aria-busy"], "true");
  releaseNew(await respond(GIRONE));
  await second;
  assert.equal(app.loading, false);
  assert.equal(page.els.list.attrs["aria-busy"], "false");
});
