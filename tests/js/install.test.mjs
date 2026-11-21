import assert from "node:assert/strict";
import { test } from "node:test";

import { DISMISS_KEY, IOS_HOW, setupInstallHint } from "../../docs/install.js";

function target() {
  const handlers = {};
  return {
    handlers,
    addEventListener: (type, fn) => (handlers[type] ??= []).push(fn),
    fire(type, event = {}) {
      (handlers[type] ?? []).forEach((fn) => fn(event));
    },
  };
}

// A page with the hint, an optional saved install event, and a storage that may be broken.
function setup({ standalone = false, ios = false, stored = null, storageThrows = false } = {}) {
  const els = {
    "install-hint": { hidden: true },
    "install-how": { textContent: "prompt text" },
    "install-go": Object.assign(target(), { hidden: false }),
    "install-no": target(),
  };
  const doc = { getElementById: (id) => els[id] };
  const win = Object.assign(target(), { matchMedia: () => ({ matches: standalone }) });
  const nav = ios
    ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1", maxTouchPoints: 5 }
    : { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/124.0 Mobile Safari/537.36", maxTouchPoints: 5 };
  const store = new Map(stored === null ? [] : [[DISMISS_KEY, stored]]);
  const storage = () => {
    if (storageThrows) throw new Error("SecurityError");
    return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  };
  return { env: { doc, win, nav, storage }, els, win, store };
}

const promptEvent = (outcome = "accepted") => {
  const e = { prevented: false, prompted: 0, preventDefault() { this.prevented = true; }, prompt() { this.prompted++; return Promise.resolve(); }, userChoice: Promise.resolve({ outcome }) };
  return e;
};

test("nothing is shown until the browser says the page is installable", () => {
  const t = setup();
  setupInstallHint(t.env);
  assert.equal(t.els["install-hint"].hidden, true);
});

test("beforeinstallprompt: the default mini-bar is suppressed and the hint appears with the Installa button", () => {
  const t = setup();
  setupInstallHint(t.env);
  const e = promptEvent();
  t.win.fire("beforeinstallprompt", e);
  assert.equal(e.prevented, true);
  assert.equal(t.els["install-hint"].hidden, false);
  assert.equal(t.els["install-go"].hidden, false);
});

test("Installa calls the saved event once and hides the hint, accepted or not", async () => {
  for (const outcome of ["accepted", "dismissed"]) {
    const t = setup();
    setupInstallHint(t.env);
    const e = promptEvent(outcome);
    t.win.fire("beforeinstallprompt", e);
    t.els["install-go"].fire("click");
    await new Promise((r) => setImmediate(r));
    assert.equal(e.prompted, 1, outcome);
    assert.equal(t.els["install-hint"].hidden, true, outcome);
  }
});

test("a refused browser prompt hides the hint for now but does not remember it", async () => {
  const t = setup();
  setupInstallHint(t.env);
  t.win.fire("beforeinstallprompt", promptEvent("dismissed"));
  t.els["install-go"].fire("click");
  await new Promise((r) => setImmediate(r));
  assert.equal(t.store.has(DISMISS_KEY), false);
});

test("iOS Safari: the hint shows the Condividi instructions and no Installa button", () => {
  const t = setup({ ios: true });
  setupInstallHint(t.env);
  assert.equal(t.els["install-hint"].hidden, false);
  assert.equal(t.els["install-go"].hidden, true);
  assert.equal(t.els["install-how"].textContent, IOS_HOW);
  assert.match(IOS_HOW, /Condividi/);
  assert.match(IOS_HOW, /Aggiungi alla schermata Home/);
});

test("standalone: never shown, not even on iOS or after beforeinstallprompt", () => {
  const t = setup({ standalone: true, ios: true });
  setupInstallHint(t.env);
  t.win.fire("beforeinstallprompt", promptEvent());
  assert.equal(t.els["install-hint"].hidden, true);
});

test("No, grazie hides the hint for good: stored, and a later visit shows nothing", () => {
  const t = setup();
  setupInstallHint(t.env);
  t.win.fire("beforeinstallprompt", promptEvent());
  t.els["install-no"].fire("click");
  assert.equal(t.els["install-hint"].hidden, true);
  assert.equal(t.store.get(DISMISS_KEY), "1");

  const again = setup({ stored: "1" });
  setupInstallHint(again.env);
  again.win.fire("beforeinstallprompt", promptEvent());
  assert.equal(again.els["install-hint"].hidden, true);
});

test("appinstalled hides the hint and remembers it", () => {
  const t = setup();
  setupInstallHint(t.env);
  t.win.fire("beforeinstallprompt", promptEvent());
  t.win.fire("appinstalled");
  assert.equal(t.els["install-hint"].hidden, true);
  assert.equal(t.store.get(DISMISS_KEY), "1");
});

test("a broken storage (private mode) never throws: the hint still works and closes", () => {
  const t = setup({ storageThrows: true });
  assert.doesNotThrow(() => setupInstallHint(t.env));
  t.win.fire("beforeinstallprompt", promptEvent());
  assert.equal(t.els["install-hint"].hidden, false);
  assert.doesNotThrow(() => t.els["install-no"].fire("click"));
  assert.equal(t.els["install-hint"].hidden, true);
});

test("a page without the hint markup does nothing", () => {
  const t = setup();
  t.env.doc.getElementById = () => null;
  assert.doesNotThrow(() => setupInstallHint(t.env));
});

test("iOS Safari already running as the installed app (navigator.standalone) shows no hint", () => {
  const shown = setup({ ios: true });
  setupInstallHint(shown.env);
  assert.equal(shown.els["install-hint"].hidden, false);

  const t = setup({ ios: true });
  t.env.win.matchMedia = () => ({ matches: false });
  t.env.nav.standalone = true;
  setupInstallHint(t.env);
  assert.equal(t.els["install-hint"].hidden, true);
});

test("iOS Safari with navigator.standalone false shows the hint", () => {
  const t = setup({ ios: true });
  t.env.nav.standalone = false;
  setupInstallHint(t.env);
  assert.equal(t.els["install-hint"].hidden, false);
});

test("without matchMedia the iOS install hint still appears", () => {
  const t = setup({ ios: true });
  delete t.win.matchMedia;
  setupInstallHint(t.env);
  assert.equal(t.els["install-hint"].hidden, false);
});

test("a stored zero does not dismiss the install hint", () => {
  const t = setup({ ios: true, stored: "0" });
  setupInstallHint(t.env);
  assert.equal(t.els["install-hint"].hidden, false);
});

test("a rejected install prompt logs one warning", async () => {
  const t = setup();
  const error = new Error("prompt rejected");
  const warnings = [];
  const previous = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    setupInstallHint(t.env);
    const event = promptEvent();
    event.prompt = () => Promise.reject(error);
    t.win.fire("beforeinstallprompt", event);
    t.els["install-go"].fire("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(warnings, [["install prompt failed", error]]);
  } finally {
    console.warn = previous;
  }
});
