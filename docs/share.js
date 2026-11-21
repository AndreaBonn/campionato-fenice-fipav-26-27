// "Condividi" of the next-game box: the browser share sheet, or the clipboard with a short visible confirmation.
// Everything the browser provides comes in through env, so it is tested without a browser.
import { feniceGames, nextGame } from "./game-rules.js";
import { clipboardText, sharePayload } from "./hero-rules.js";

export const CONFIRM_MS = 2500;
const COPIED = "Copiato";
const FAILED = "Non riesco a condividere da questo browser";

// The pending clear timer of each status element: a new message cancels it, so it keeps its full time
const pendingClear = new WeakMap();

const say = (env, text, ms = CONFIRM_MS) => {
  env.status.textContent = text;
  if (pendingClear.has(env.status)) env.clearTimeout(pendingClear.get(env.status));
  pendingClear.set(env.status, env.setTimeout(() => { env.status.textContent = ""; }, ms));
};

async function copy(env, payload) {
  try {
    if (!env.nav.clipboard) throw new Error("no clipboard");
    await env.nav.clipboard.writeText(clipboardText(payload));
    say(env, COPIED);
  } catch (err) {
    console.warn("copy failed", err);
    say(env, FAILED);
  }
}

// env: { data, now, pageUrl, status (element), nav: { share?, clipboard? }, setTimeout, clearTimeout }
export async function shareNextGame(env) {
  const game = nextGame(feniceGames(env.data), env.now);
  if (!game) return;
  const payload = sharePayload(env.data, game, env.pageUrl);
  if (typeof env.nav.share === "function") {
    try {
      await env.nav.share(payload);
      return;
    } catch (err) {
      // the user closed the sheet: that is an answer, not a failure
      if (err?.name === "AbortError") return;
      console.warn("share failed, copying instead", err);
    }
  }
  await copy(env, payload);
}
