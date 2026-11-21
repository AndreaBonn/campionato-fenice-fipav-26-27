import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";

import { SLOW_LOAD_MS, applyViews, buildViews, load, loadStatus, startApp } from "../../docs/app.js";

const SAMPLE = JSON.parse(readFileSync(new URL("./../fixtures/data-sample.json", import.meta.url), "utf8"));
const NOW = new Date("2026-11-21T12:00:00+01:00");
const IDS = ["next", "next-body", "last", "last-body", "standings", "standings-body", "analysis", "analysis-body", "list", "feed", "notices-body", "checked", "opponent", "opp-body"];

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
      insertAdjacentHTML(_where, html) {
        this.innerHTML = html + this.innerHTML;
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
  return { $: page.$, fetch, now: () => NOW, protocol: "https:", checkedAt: null, data: null };
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
  assert.match(page.els.list.innerHTML, /Giornata/);
  assert.equal(page.els.list.attrs["aria-busy"], "false");
  assert.equal(app.data, SAMPLE);
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

test("buildViews wraps a rendering failure so the cause text is not 'network'", () => {
  assert.throws(() => buildViews({}, NOW), (err) => err.message === "invalid data" && err.cause instanceof Error);
});

test("status.json: the last check line is shown when the file exists", async () => {
  const page = fakePage();
  const app = makeApp(page, router({ "status.json": () => respond({ checked_at: "2026-11-21T10:00:00+00:00" }) }));

  await loadStatus(app);

  assert.equal(page.els.checked.hidden, false);
  assert.match(page.els.checked.textContent, /Ultimo controllo su FIPAV Online/);
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
    assert.match(page.els.list.innerHTML, /Giornata/);
  } finally {
    mock.timers.reset();
  }
});
