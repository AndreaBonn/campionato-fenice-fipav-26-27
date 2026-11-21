// "Tienila sul telefono" hint: offers the install where the browser allows it; the rules live in install-rules.js.
import { hintMode, isIosSafari, isStandalone } from "./install-rules.js";

export const DISMISS_KEY = "fenice-install-dismissed";
export const IOS_HOW = "Tocca Condividi, poi Aggiungi alla schermata Home: si apre come un'app, anche senza rete.";

// Storage can be missing or throw (private mode, blocked cookies): the hint then works for this visit only
function readDismissed(storage) {
  try {
    return storage().getItem(DISMISS_KEY) === "1";
  } catch (err) {
    console.warn("storage not available, the hint is not remembered", err);
    return false;
  }
}

function writeDismissed(storage) {
  try {
    storage().setItem(DISMISS_KEY, "1");
  } catch (err) {
    console.warn("storage not available, the hint is not remembered", err);
  }
}

function render(s) {
  const mode = hintMode({ standalone: s.standalone, dismissed: s.dismissed, installed: s.installed, iosSafari: s.iosSafari, canPrompt: s.saved !== null });
  s.hint.hidden = mode === null;
  if (mode === "ios") s.how.textContent = IOS_HOW;
  s.go.hidden = mode !== "prompt";
}

async function install(s) {
  const event = s.saved;
  if (!event) return;
  // a saved event can be prompted once: whatever the answer, the offer is over for this visit
  s.saved = null;
  render(s);
  await event.prompt();
  await event.userChoice;
}

export function setupInstallHint(env) {
  const { doc, win, nav, storage } = env;
  const hint = doc.getElementById("install-hint");
  if (!hint) return;
  const s = {
    hint, how: doc.getElementById("install-how"), go: doc.getElementById("install-go"), no: doc.getElementById("install-no"),
    storage, saved: null, installed: false,
    dismissed: readDismissed(storage),
    standalone: isStandalone(win.matchMedia?.("(display-mode: standalone)"), nav.standalone),
    iosSafari: isIosSafari(nav),
  };
  const remember = () => {
    s.dismissed = true;
    writeDismissed(storage);
    render(s);
  };
  win.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    s.saved = event;
    render(s);
  });
  win.addEventListener("appinstalled", () => {
    s.installed = true;
    remember();
  });
  s.go.addEventListener("click", () => install(s).catch((err) => console.warn("install prompt failed", err)));
  s.no.addEventListener("click", remember);
  render(s);
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  setupInstallHint({ doc: document, win: window, nav: navigator, storage: () => localStorage });
}
