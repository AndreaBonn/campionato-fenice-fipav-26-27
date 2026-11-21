import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { CONFIRM_MS, shareNextGame } from "../../docs/share.js";

const sample = JSON.parse(readFileSync(new URL("../fixtures/data-sample.json", import.meta.url), "utf8"));
const NOW = new Date("2026-11-20T10:00:00Z");

function setup({ share, clipboard } = {}) {
  const status = { textContent: "" };
  const timers = [];
  const cleared = [];
  const env = {
    data: sample, now: NOW, pageUrl: "https://example.org/fenice/", status,
    nav: { share, clipboard }, setTimeout: (fn, ms) => { timers.push([fn, ms]); return timers.length; }, clearTimeout: (id) => cleared.push(id),
  };
  return { env, status, timers, cleared };
}

test("with navigator.share the payload carries title, text and url", async () => {
  const calls = [];
  const t = setup({ share: async (p) => calls.push(p) });
  await shareNextGame(t.env);
  assert.deepEqual(calls, [{ title: "ASD Fenice - VSA", text: "ASD Fenice - VSA, sabato 21 novembre ore 17:00, Palestra", url: "https://example.org/fenice/" }]);
  assert.equal(t.status.textContent, "");
});

test("a share sheet the user closes (AbortError) is not an error and copies nothing", async () => {
  const copied = [];
  const t = setup({
    share: async () => { throw new DOMException("closed", "AbortError"); },
    clipboard: { writeText: async (x) => copied.push(x) },
  });
  await shareNextGame(t.env);
  assert.deepEqual(copied, []);
  assert.equal(t.status.textContent, "");
});

test("without navigator.share the text and the url go to the clipboard and «Copiato» is shown, then cleared", async () => {
  const copied = [];
  const t = setup({ clipboard: { writeText: async (x) => copied.push(x) } });
  await shareNextGame(t.env);
  assert.deepEqual(copied, ["ASD Fenice - VSA, sabato 21 novembre ore 17:00, Palestra\nhttps://example.org/fenice/"]);
  assert.equal(t.status.textContent, "Copiato");
  assert.equal(t.timers[0][1], CONFIRM_MS);
  t.timers[0][0]();
  assert.equal(t.status.textContent, "");
});

test("a share that fails for another reason falls back to the clipboard", async () => {
  const copied = [];
  const t = setup({ share: async () => { throw new Error("NotAllowedError"); }, clipboard: { writeText: async (x) => copied.push(x) } });
  await shareNextGame(t.env);
  assert.equal(copied.length, 1);
  assert.equal(t.status.textContent, "Copiato");
});

test("no share and no clipboard (or a refused write) says so instead of staying silent", async () => {
  const none = setup();
  await shareNextGame(none.env);
  assert.equal(none.status.textContent, "Non riesco a condividere da questo browser");
  const refused = setup({ clipboard: { writeText: async () => { throw new Error("denied"); } } });
  await shareNextGame(refused.env);
  assert.equal(refused.status.textContent, "Non riesco a condividere da questo browser");
});

test("no next game: nothing happens", async () => {
  const t = setup({ share: async () => assert.fail("must not share") });
  t.env.data = { ...sample, games: sample.games.map((g) => ({ ...g, played: true })) };
  await shareNextGame(t.env);
  assert.equal(t.status.textContent, "");
});

test("a second message resets the clear timer: the first timer is cancelled", async () => {
  const t = setup({ clipboard: { writeText: async () => {} } });
  await shareNextGame(t.env);
  await shareNextGame(t.env);
  assert.deepEqual(t.cleared, [1]);
  assert.equal(t.timers.length, 2);
  assert.equal(t.status.textContent, "Copiato");
});
