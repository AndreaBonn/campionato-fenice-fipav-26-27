import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SW_PATH = fileURLToPath(new URL("../../docs/sw.js", import.meta.url));
const SOURCE = readFileSync(SW_PATH, "utf8");
// deploy stamps this line (fenice-stamp-sw); the same substitution gives a stamped worker
const STAMPED_SOURCE = SOURCE.replace('const VERSION = "dev";', 'const VERSION = "abc123";');
const ORIGIN = "https://andreabonn.github.io";
const PAGE = `${ORIGIN}/campionato-fenice-fipav-26-27/data.json`;

// The browser around the worker: Cache Storage held in a Map, the network as a function.
function loadWorker({ network = () => Promise.resolve(new Response("live")), stored = {}, source = SOURCE } = {}) {
  const handlers = {};
  const storage = new Map(Object.entries(stored).map(([name, entries]) => [name, new Map(entries)]));
  const calls = { fetch: [], skipWaiting: 0, claimed: 0, shell: [] };
  const cacheFor = (name) => {
    if (!storage.has(name)) storage.set(name, new Map());
    const entries = storage.get(name);
    return {
      // like Cache.put, it consumes the body: a response the page also reads must be a clone
      put: async (request, response) => entries.set(request.url, new Response(await response.text())),
      addAll: async (requests) => {
        calls.shell.push(...requests);
        requests.forEach((r) => entries.set(r.url, new Response("shell")));
      },
    };
  };
  const worker = {
    location: new URL(PAGE),
    // relative URLs resolve against the worker's address, as in the browser
    Request: class extends Request {
      constructor(input, init) {
        super(typeof input === "string" ? new URL(input, PAGE).href : input, init);
      }
    },
    Response,
    URL,
    Promise,
    addEventListener: (type, handler) => (handlers[type] = handler),
    skipWaiting: () => calls.skipWaiting++,
    clients: { claim: async () => calls.claimed++ },
    fetch: (request, init) => {
      calls.fetch.push({ url: request.url, init });
      return network(request);
    },
    caches: {
      open: async (name) => cacheFor(name),
      keys: async () => [...storage.keys()],
      delete: async (name) => storage.delete(name),
      match: async (request) => {
        for (const entries of storage.values()) {
          if (entries.has(request.url)) return entries.get(request.url);
        }
        return undefined;
      },
    },
  };
  worker.self = worker;
  // filename lets V8 attribute the run to docs/sw.js, so the file shows up in the coverage report
  vm.runInNewContext(source, worker, { filename: SW_PATH });
  return { handlers, storage, calls };
}

// Dispatch one fetch event; `answer` is undefined when the worker lets the browser handle it.
async function dispatchFetch(handlers, request, pending = []) {
  let answer;
  handlers.fetch({
    request,
    respondWith: (promise) => (answer = promise),
    waitUntil: (promise) => pending.push(promise),
  });
  const response = answer && (await answer);
  await Promise.all(pending);
  return response;
}

async function dispatchLifecycle(handler, data) {
  let done;
  handler({ data, waitUntil: (promise) => (done = promise) });
  await done;
}

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

test("online: the network answer is served, revalidated, and cached for offline use", async () => {
  const { handlers, storage, calls } = loadWorker();

  const response = await dispatchFetch(handlers, new Request(PAGE));

  assert.equal(await response.text(), "live");
  assert.equal(calls.fetch[0].init.cache, "no-cache");
  assert.ok(storage.get("fenice-fipav-dev").has(PAGE));
});

test("online with a stale copy in cache: the network answer wins", async () => {
  const { handlers } = loadWorker({ stored: { "fenice-fipav-dev": [[PAGE, new Response("stale")]] } });

  const response = await dispatchFetch(handlers, new Request(PAGE));

  assert.equal(await response.text(), "live");
});

test("offline: the cached copy is served", async () => {
  const { handlers } = loadWorker({
    network: offline,
    stored: { "fenice-fipav-dev": [[PAGE, new Response("cached")]] },
  });

  const response = await dispatchFetch(handlers, new Request(PAGE));

  assert.equal(await response.text(), "cached");
});

test("offline and never cached: a network error, not an empty success", async () => {
  const { handlers } = loadWorker({ network: offline });

  const response = await dispatchFetch(handlers, new Request(PAGE));

  assert.equal(response.type, "error");
});

test("an error answer is passed on but not cached over the last good copy", async () => {
  const { handlers, storage } = loadWorker({
    network: () => Promise.resolve(new Response("down", { status: 503 })),
  });

  const response = await dispatchFetch(handlers, new Request(PAGE));

  assert.equal(response.status, 503);
  assert.equal(storage.get("fenice-fipav-dev")?.has(PAGE) ?? false, false);
});

test("cross-origin and non-GET requests are left to the browser", async () => {
  const { handlers, calls } = loadWorker();
  const crossOrigin = new Request("https://fip.it/risultati/");
  const post = new Request(PAGE, { method: "POST", body: "x" });

  assert.equal(await dispatchFetch(handlers, crossOrigin), undefined);
  assert.equal(await dispatchFetch(handlers, post), undefined);
  assert.equal(calls.fetch.length, 0);
});

test("install caches the app shell and waits for the user before taking over", async () => {
  const { handlers, storage, calls } = loadWorker();

  await dispatchLifecycle(handlers.install);

  assert.ok(storage.get("fenice-fipav-dev").has(new URL("index.html", PAGE).href));
  assert.equal(calls.skipWaiting, 0);
});

test("the page's SKIP_WAITING message activates the waiting version, other messages do not", () => {
  const { handlers, calls } = loadWorker();

  handlers.message({ data: { type: "PING" } });
  handlers.message({ data: null });
  assert.equal(calls.skipWaiting, 0);

  handlers.message({ data: { type: "SKIP_WAITING" } });
  assert.equal(calls.skipWaiting, 1);
});

test("activate drops the caches of previous versions and claims open pages", async () => {
  const { handlers, storage, calls } = loadWorker({
    stored: { "fenice-fipav-old": [], "fenice-fipav-dev": [] },
  });

  await dispatchLifecycle(handlers.activate);

  assert.deepEqual([...storage.keys()], ["fenice-fipav-dev"]);
  assert.equal(calls.claimed, 1);
});

// Cache Storage is per origin, and every GitHub Pages repo of the account shares
// andreabonn.github.io: another app's caches (the DR2 page uses "assemini-black-*") are not ours.
test("activate keeps the caches of other apps on the same origin", async () => {
  const { handlers, storage } = loadWorker({
    stored: { "assemini-black-1a2b3c": [], "fenice-fipav-old": [], "fenice-fipav-dev": [] },
  });

  await dispatchLifecycle(handlers.activate);

  assert.deepEqual([...storage.keys()].sort(), ["assemini-black-1a2b3c", "fenice-fipav-dev"]);
});

// Every module the page runs: <script src> and inline module of index.html, plus their static imports.
function pageModules() {
  const read = (name) => readFileSync(new URL(`../../docs/${name}`, import.meta.url), "utf8");
  const importsOf = (code) => [...code.matchAll(/from "\.\/([\w-]+\.js)"/g)].map((m) => m[1]);
  const html = read("index.html");
  const pending = [...[...html.matchAll(/<script[^>]*src="([\w-]+\.js)"/g)].map((m) => m[1]), ...importsOf(html)];
  const seen = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (!seen.has(name)) {
      seen.add(name);
      pending.push(...importsOf(read(name)));
    }
  }
  return seen;
}

test("install caches every module the page runs, so the app opens offline", async () => {
  const { handlers, storage } = loadWorker();

  await dispatchLifecycle(handlers.install);

  const modules = pageModules();
  const cached = storage.get("fenice-fipav-dev");
  const missing = [...modules].filter((name) => !cached.has(new URL(name, PAGE).href));
  // reached only through update.js: the import graph was really walked
  assert.ok(modules.has("update-rules.js"));
  assert.deepEqual(missing, []);
});

test("install bypasses the HTTP cache, which could still hold the previous release", async () => {
  const { handlers, calls } = loadWorker();

  await dispatchLifecycle(handlers.install);

  assert.deepEqual(new Set(calls.shell.map((r) => r.cache)), new Set(["reload"]));
});

test("install caches every stylesheet the page links, so the app opens styled offline", async () => {
  const { handlers, storage } = loadWorker();

  await dispatchLifecycle(handlers.install);

  const html = readFileSync(new URL("../../docs/index.html", import.meta.url), "utf8");
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([\w-]+\.css)"/g)].map((m) => m[1]);
  const cached = storage.get("fenice-fipav-dev");
  assert.deepEqual(sheets, ["styles.css"]);
  assert.deepEqual(sheets.filter((name) => !cached.has(new URL(name, PAGE).href)), []);
});

test("install: every cached file exists under docs/, one missing file would fail the whole install", async () => {
  const { handlers, calls } = loadWorker();

  await dispatchLifecycle(handlers.install);

  const base = new URL(".", PAGE).href;
  const paths = calls.shell.map((r) => r.url.slice(base.length) || "index.html");
  const missing = paths.filter((p) => !existsSync(new URL("../../docs/" + p, import.meta.url)));
  assert.ok(paths.includes("icons/icon-192.png"));
  assert.ok(paths.includes("index.html"));
  assert.deepEqual(missing, []);
});

test("install caches the icons the page links and the manifest's 'any' icons, so the installed app keeps its icon offline", async () => {
  const { handlers, storage } = loadWorker();

  await dispatchLifecycle(handlers.install);

  const read = (name) => readFileSync(new URL(`../../docs/${name}`, import.meta.url), "utf8");
  const linked = [...read("index.html").matchAll(/<link rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]);
  const fromManifest = JSON.parse(read("manifest.webmanifest")).icons.filter((i) => i.purpose === "any").map((i) => i.src);
  const cached = storage.get("fenice-fipav-dev");
  assert.ok(linked.includes("favicon.ico") && linked.includes("icons/apple-touch-icon.png"));
  assert.ok(fromManifest.includes("icons/icon-512.png"));
  const missing = [...linked, ...fromManifest].filter((name) => !cached.has(new URL(name, PAGE).href));
  assert.deepEqual(missing, []);
});

const BASE = new URL("./", PAGE).href;

test("the stamp substitution used by these tests really changes the worker source", () => {
  assert.ok(SOURCE.includes('const VERSION = "dev";'));
  assert.ok(STAMPED_SOURCE.includes('const VERSION = "abc123";'));
});

test("install then offline: the PWA start_url './' is answered from the cache", async () => {
  const { handlers } = loadWorker({ network: offline });
  await dispatchLifecycle(handlers.install);

  const response = await dispatchFetch(handlers, new Request(BASE));

  assert.equal(await response.text(), "shell");
});

test("offline without an install: the start_url is a network error, not a cached page", async () => {
  const { handlers } = loadWorker({ network: offline });

  const response = await dispatchFetch(handlers, new Request(BASE));

  assert.equal(response.type, "error");
});

test("a stamped worker installs into the cache named after its version", async () => {
  const { handlers, storage } = loadWorker({ source: STAMPED_SOURCE });

  await dispatchLifecycle(handlers.install);

  assert.deepEqual([...storage.keys()], ["fenice-fipav-abc123"]);
});

test("a stamped worker's activate deletes the other versions and keeps its own cache and other apps'", async () => {
  const { handlers, storage } = loadWorker({
    source: STAMPED_SOURCE,
    stored: { "fenice-fipav-dev": [], "fenice-fipav-old": [], "fenice-fipav-abc123": [], "assemini-black-1a2b3c": [] },
  });

  await dispatchLifecycle(handlers.activate);

  assert.deepEqual([...storage.keys()].sort(), ["assemini-black-1a2b3c", "fenice-fipav-abc123"]);
});

test("online: what is stored is the network body, and the page still gets a readable body", async () => {
  const { handlers, storage } = loadWorker({
    network: () => Promise.resolve(new Response("fresh from FIPAV")),
  });

  const response = await dispatchFetch(handlers, new Request(PAGE));

  assert.equal(await storage.get("fenice-fipav-dev").get(PAGE).text(), "fresh from FIPAV");
  assert.equal(await response.text(), "fresh from FIPAV");
});

test("online: the cache write is handed to event.waitUntil, so the worker is not stopped before it ends", async () => {
  const { handlers } = loadWorker();
  const waits = [];

  await dispatchFetch(handlers, new Request(PAGE), waits);

  assert.equal(waits.length, 1);
  assert.equal(typeof waits[0].then, "function");
});

test("an error answer schedules no cache write", async () => {
  const { handlers } = loadWorker({ network: () => Promise.resolve(new Response("down", { status: 503 })) });
  const waits = [];

  await dispatchFetch(handlers, new Request(PAGE), waits);

  assert.equal(waits.length, 0);
});

test("install caches every local image the page markup shows, so the header crest opens offline", async () => {
  const { handlers, storage } = loadWorker();
  await dispatchLifecycle(handlers.install);

  const html = readFileSync(new URL("../../docs/index.html", import.meta.url), "utf8");
  const images = [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]).filter((src) => !/^https?:/.test(src));
  const cached = storage.get("fenice-fipav-dev");
  assert.ok(images.includes("logo-fenice.png"));
  assert.deepEqual(images.filter((src) => !cached.has(new URL(src, PAGE).href)), []);
});
