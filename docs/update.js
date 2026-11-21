// Registers the service worker and announces a new release; the rules live in update-rules.js.
import { isCheckDue, shouldAnnounce, shouldReloadOnControllerChange } from "./update-rules.js";

function announce(s) {
  if (!s.registration) return;
  const waiting = s.registration.waiting !== null;
  if (shouldAnnounce({ waiting, controlled: s.sw.controller !== null, dismissed: s.dismissed })) s.notice.hidden = false;
}

// updatefound fires while the worker is still installing; "installed" is only visible here
function watch(s, worker) {
  worker.addEventListener("statechange", () => {
    if (worker.state === "installed") announce(s);
  });
}

function watchRegistration(s, registration) {
  s.registration = registration;
  if (registration.installing) watch(s, registration.installing);
  registration.addEventListener("updatefound", () => watch(s, registration.installing));
  announce(s);
  checkForUpdate(s);
}

function checkForUpdate(s) {
  const now = s.now();
  if (!s.registration || !isCheckDue({ now, lastCheck: s.lastCheck })) return;
  s.lastCheck = now;
  s.registration.update().catch((err) => console.warn("controllo aggiornamenti non riuscito", err));
}

function applyUpdate(s) {
  // another tab already accepted: its controllerchange reload reaches this tab too
  if (!s.registration?.waiting) {
    s.notice.hidden = true;
    return;
  }
  s.apply.disabled = true;
  s.apply.textContent = "Aggiornamento…";
  // the reload happens on controllerchange, once the new version is in control
  s.registration.waiting.postMessage({ type: "SKIP_WAITING" });
}

function wireButtons(s) {
  s.apply.onclick = () => applyUpdate(s);
  s.later.onclick = () => {
    s.dismissed = true;
    s.notice.hidden = true;
  };
}

// fires in every open tab: all of them must leave the old code behind
function onControllerChange(s) {
  const wasControlled = s.controlled;
  s.controlled = true;
  if (!shouldReloadOnControllerChange({ hadController: wasControlled, reloading: s.reloading })) return;
  s.reloading = true;
  s.reload();
}

function wireLifecycle(s) {
  s.sw.addEventListener("controllerchange", () => onControllerChange(s));
  // an installed app is reopened by bringing it back to the foreground
  s.doc.addEventListener("visibilitychange", () => {
    if (s.doc.visibilityState !== "visible") return;
    announce(s);
    checkForUpdate(s);
  });
}

export function setupUpdates(env) {
  const { sw, doc } = env;
  const s = {
    ...env,
    notice: doc.getElementById("update-notice"),
    apply: doc.getElementById("update-apply"),
    later: doc.getElementById("update-later"),
    registration: null,
    lastCheck: null,
    reloading: false,
    // «Più tardi» was pressed: no notice until the page is loaded again
    dismissed: false,
    // false on a first visit: the first worker claiming the page is not an update
    controlled: sw.controller !== null,
  };
  wireButtons(s);
  wireLifecycle(s);
  return sw
    .register("sw.js")
    .then((registration) => watchRegistration(s, registration))
    .catch((err) => console.warn("service worker non registrato", err));
}

export function supportsServiceWorker(nav) {
  return Boolean(nav) && "serviceWorker" in nav;
}

// file:// pages and old browsers have no service worker: the page works without updates
if (supportsServiceWorker(typeof navigator === "undefined" ? undefined : navigator)) {
  setupUpdates({ sw: navigator.serviceWorker, doc: document, now: Date.now, reload: () => location.reload() });
}
