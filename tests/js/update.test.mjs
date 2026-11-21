import assert from "node:assert/strict";
import { test } from "node:test";

import { setupUpdates } from "../../docs/update.js";

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
  sw.register = () => (registerFails ? Promise.reject(new Error("no")) : Promise.resolve(registration));
  const env = { sw, doc, now: () => clock.t, reload: () => reloads.n++ };
  const clock = { t: 1_000_000 };
  const reloads = { n: 0 };
  return { env, sw, doc, els, registration, clock, reloads };
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
