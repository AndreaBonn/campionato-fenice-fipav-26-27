import assert from "node:assert/strict";
import { test } from "node:test";

import { setupUpdates, supportsServiceWorker } from "../../docs/update.js";

// Minimal browser around setupUpdates: event targets, a registration and the three notice elements.
function target() {
  const handlers = {};
  return {
    handlers,
    addEventListener: (type, fn) => (handlers[type] ??= []).push(fn),
    fire: (type) => (handlers[type] ?? []).forEach((fn) => fn()),
  };
}

function setup({ controller = {}, waiting = null, installing = null, registerFails = false } = {}) {
  const sw = Object.assign(target(), { controller });
  const doc = Object.assign(target(), { visibilityState: "visible" });
  const els = {
    "update-notice": { hidden: true },
    "update-apply": { disabled: false, textContent: "Aggiorna" },
    "update-later": {},
  };
  doc.getElementById = (id) => els[id];
  const registration = Object.assign(target(), { waiting, installing, updates: 0 });
  registration.update = () => {
    registration.updates++;
    return Promise.resolve();
  };
  const registered = [];
  sw.register = (url) => {
    registered.push(url);
    return registerFails ? Promise.reject(new Error("no")) : Promise.resolve(registration);
  };
  const env = { sw, doc, now: () => clock.t, reload: () => reloads.n++ };
  const clock = { t: 1_000_000 };
  const reloads = { n: 0 };
  return { env, sw, doc, els, registration, clock, reloads, registered };
}

const worker = (state) => Object.assign(target(), { state, posted: [], postMessage(m) { this.posted.push(m); } });

test("a controlled page with a waiting worker shows the notice", async () => {
  const t = setup({ waiting: worker("installed") });

  await setupUpdates(t.env);

  assert.equal(t.els["update-notice"].hidden, false);
});

test("first visit: a waiting worker is not announced", async () => {
  const t = setup({ controller: null, waiting: worker("installed") });

  await setupUpdates(t.env);

  assert.equal(t.els["update-notice"].hidden, true);
});

test("nothing waiting: the notice stays hidden", async () => {
  const t = setup();

  await setupUpdates(t.env);

  assert.equal(t.els["update-notice"].hidden, true);
});

test("a worker found installing announces itself once it reaches installed", async () => {
  const installing = worker("installing");
  const t = setup({ installing });
  await setupUpdates(t.env);

  t.registration.waiting = installing;
  installing.state = "installed";
  installing.fire("statechange");

  assert.equal(t.els["update-notice"].hidden, false);
});

test("updatefound watches the new worker", async () => {
  const t = setup();
  await setupUpdates(t.env);
  const next = worker("installing");

  t.registration.installing = next;
  t.registration.fire("updatefound");
  t.registration.waiting = next;
  next.state = "installed";
  next.fire("statechange");

  assert.equal(t.els["update-notice"].hidden, false);
});

test("Aggiorna posts SKIP_WAITING and disables the button; no reload before controllerchange", async () => {
  const waiting = worker("installed");
  const t = setup({ waiting });
  await setupUpdates(t.env);

  t.els["update-apply"].onclick();

  assert.deepEqual(waiting.posted, [{ type: "SKIP_WAITING" }]);
  assert.equal(t.els["update-apply"].disabled, true);
  assert.equal(t.els["update-apply"].textContent, "Aggiornamento…");
  assert.equal(t.reloads.n, 0);
});

test("Aggiorna with nothing waiting (another tab accepted) just hides the notice", async () => {
  const t = setup();
  await setupUpdates(t.env);
  t.els["update-notice"].hidden = false;

  t.els["update-apply"].onclick();

  assert.equal(t.els["update-notice"].hidden, true);
  assert.equal(t.els["update-apply"].disabled, false);
});

test("Più tardi hides the notice", async () => {
  const t = setup({ waiting: worker("installed") });
  await setupUpdates(t.env);

  t.els["update-later"].onclick();

  assert.equal(t.els["update-notice"].hidden, true);
});

test("controllerchange reloads once when the page was controlled", async () => {
  const t = setup();
  await setupUpdates(t.env);

  t.sw.fire("controllerchange");
  t.sw.fire("controllerchange");

  assert.equal(t.reloads.n, 1);
});

test("controllerchange on a first visit does not reload", async () => {
  const t = setup({ controller: null });
  await setupUpdates(t.env);

  t.sw.fire("controllerchange");

  assert.equal(t.reloads.n, 0);
});

test("returning to the foreground checks for updates at most every 10 minutes", async () => {
  const t = setup();
  await setupUpdates(t.env);
  assert.equal(t.registration.updates, 1);

  t.clock.t += 60_000;
  t.doc.fire("visibilitychange");
  assert.equal(t.registration.updates, 1);

  t.clock.t += 600_000;
  t.doc.fire("visibilitychange");
  assert.equal(t.registration.updates, 2);
});

test("a hidden page neither announces nor checks", async () => {
  const t = setup();
  await setupUpdates(t.env);
  t.clock.t += 700_000;
  t.doc.visibilityState = "hidden";

  t.doc.fire("visibilitychange");

  assert.equal(t.registration.updates, 1);
});

test("a failed registration is logged and the page keeps working", async () => {
  const t = setup({ registerFails: true });
  const warn = console.warn;
  console.warn = () => {};
  try {
    await setupUpdates(t.env);
  } finally {
    console.warn = warn;
  }

  assert.equal(t.els["update-notice"].hidden, true);
});

const settle = () => new Promise((resolve) => setImmediate(resolve));

function captureWarnings() {
  const warn = console.warn;
  const logged = [];
  console.warn = (...args) => logged.push(args);
  return { logged, restore: () => (console.warn = warn) };
}

test("supportsServiceWorker is true for a navigator that has serviceWorker", () => {
  assert.equal(supportsServiceWorker({ serviceWorker: {} }), true);
});

test("supportsServiceWorker is false without a navigator and for one without serviceWorker", () => {
  assert.equal(supportsServiceWorker(undefined), false);
  assert.equal(supportsServiceWorker({ userAgent: "old browser" }), false);
});

test("register is called with the relative URL sw.js, so it resolves next to the page", async () => {
  const t = setup();

  await setupUpdates(t.env);

  assert.deepEqual(t.registered, ["sw.js"]);
});

test("first visit: the first controllerchange does not reload, a second one does", async () => {
  const t = setup({ controller: null });
  await setupUpdates(t.env);

  t.sw.fire("controllerchange");
  assert.equal(t.reloads.n, 0);

  t.sw.fire("controllerchange");
  assert.equal(t.reloads.n, 1);
});

test("a worker that became waiting while the tab was hidden shows the notice when the tab turns visible", async () => {
  const t = setup();
  await setupUpdates(t.env);
  t.doc.visibilityState = "hidden";
  t.registration.waiting = worker("installed");
  assert.equal(t.els["update-notice"].hidden, true);

  t.doc.visibilityState = "visible";
  t.doc.fire("visibilitychange");

  assert.equal(t.els["update-notice"].hidden, false);
});

test("a rejected registration.update is logged with console.warn and does not break the page", async () => {
  const t = setup();
  const failure = new Error("offline");
  t.registration.update = () => Promise.reject(failure);
  const warnings = captureWarnings();
  try {
    await setupUpdates(t.env);
    await settle();
  } finally {
    warnings.restore();
  }

  assert.equal(warnings.logged.length, 1);
  assert.match(warnings.logged[0][0], /controllo aggiornamenti non riuscito/);
  assert.equal(warnings.logged[0][1], failure);
  assert.equal(t.els["update-notice"].hidden, true);
});

test("visibilitychange before register resolves neither throws nor asks for an update", async () => {
  const t = setup();
  let resolveRegister;
  t.sw.register = () => new Promise((resolve) => (resolveRegister = resolve));
  const starting = setupUpdates(t.env);

  t.doc.fire("visibilitychange");

  assert.equal(t.registration.updates, 0);
  assert.equal(t.els["update-notice"].hidden, true);
  resolveRegister(t.registration);
  await starting;
  assert.equal(t.registration.updates, 1);
});

test("Più tardi: coming back to the tab does not show the notice again", async () => {
  const t = setup({ waiting: worker("installed") });
  await setupUpdates(t.env);
  assert.equal(t.els["update-notice"].hidden, false);

  t.els["update-later"].onclick();
  t.doc.visibilityState = "hidden";
  t.doc.fire("visibilitychange");
  t.doc.visibilityState = "visible";
  t.doc.fire("visibilitychange");

  assert.equal(t.els["update-notice"].hidden, true);
});

test("accepted worker replaced by a newer release before taking over: the button works again for the newer one", async () => {
  const old = worker("installed");
  const t = setup({ waiting: old });
  await setupUpdates(t.env);
  t.els["update-apply"].onclick();
  assert.equal(t.els["update-apply"].disabled, true);

  const newer = worker("installed");
  t.registration.waiting = newer;
  old.state = "redundant";
  old.fire("statechange");

  assert.equal(t.els["update-apply"].disabled, false);
  assert.equal(t.els["update-apply"].textContent, "Aggiorna");
  assert.equal(t.els["update-notice"].hidden, false);
  t.els["update-apply"].onclick();
  assert.deepEqual(newer.posted, [{ type: "SKIP_WAITING" }]);
});

test("accepted worker that dies with nothing else waiting: the notice goes away instead of hanging", async () => {
  const old = worker("installed");
  const t = setup({ waiting: old });
  await setupUpdates(t.env);
  t.els["update-apply"].onclick();

  t.registration.waiting = null;
  old.state = "redundant";
  old.fire("statechange");

  assert.equal(t.els["update-notice"].hidden, true);
  assert.equal(t.els["update-apply"].disabled, false);
});
