// Loads data.json and status.json and renders the page; the DOM and the network are passed in.
import { renderCalendarFeed, renderChecked, renderError, renderHero, renderLastResult, renderLoading, renderSchedule } from "./games-view.js";
import { installCrestFallback, renderStandings } from "./tables-view.js";
import { renderNotices } from "./notices-view.js";
import { renderAnalysis } from "./analysis-view.js";
import { installOpponentDialog } from "./opponent-view.js";

// Past this wait the page admits the network is slow
export const SLOW_LOAD_MS = 15000;
export const CLOCK_TICK_MS = 60000;
// A visible page asks for data.json again once what it shows is this old (FIPAV is synced every 4 hours)
export const REFRESH_AFTER_MS = 10 * 60e3;

// A TypeError while building the markup is bad data, not a dead network: the cause text must not say so
export function buildViews(data, now) {
  try {
    return { hero: renderHero(data, now), list: renderSchedule(data, now), standings: renderStandings(data), last: renderLastResult(data), feed: renderCalendarFeed(data), analysis: renderAnalysis(data), notices: renderNotices(data) };
  } catch (err) {
    throw new Error("invalid data", { cause: err });
  }
}

// view -> [element that receives the markup, section hidden while the markup is empty (or none)]
const TARGETS = {
  hero: ["next-body", "next"], list: ["list", null], standings: ["standings-body", "standings"], last: ["last-body", "last"],
  feed: ["feed", null], analysis: ["analysis-body", "analysis"], notices: ["notices-body", null],
};

// Writes only the sections whose markup differs from previous (the views already on screen): an untouched
// section keeps its nodes, so a clock tick does not steal the keyboard focus from a link inside it
export function applyViews($, views, previous = {}) {
  for (const [key, [body, section]] of Object.entries(TARGETS)) {
    if (views[key] === previous[key]) continue;
    $(body).innerHTML = views[key];
    if (section) $(section).hidden = !views[key];
  }
}

export function showLoading($) {
  for (const id of ["next", "standings", "last", "analysis"]) $(id).hidden = true;
  $("next-body").innerHTML = "";
  $("list").setAttribute("aria-busy", "true");
  $("list").innerHTML = renderLoading();
}

export function showSlowNote($) {
  const box = $("list").querySelector(".state");
  if (box) box.insertAdjacentHTML("afterbegin", "<p>Ci sta mettendo più del previsto: la rete è lenta.</p>");
}

export async function fetchData(fetchFn) {
  const r = await fetchFn("data.json", { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function showChecked(app) {
  if (!app.checkedAt) return;
  const el = app.$("checked");
  el.textContent = renderChecked(app.checkedAt, app.now());
  el.hidden = false;
}

// status.json is optional: without it (local run, first deploy) the line stays hidden
export async function loadStatus(app) {
  try {
    const r = await app.fetch("status.json", { cache: "no-cache" });
    if (!r.ok) return;
    app.checkedAt = (await r.json()).checked_at ?? null;
    showChecked(app);
  } catch (err) {
    console.warn("status.json not available", err);
  }
}

// Page states: loading -> shown | failed, and shown | failed -> (refresh) -> shown. Every request takes a
// ticket: an answer whose ticket is no longer the latest is dropped, so a slow old request never wins.
function show(app, data, views) {
  applyViews(app.$, views, app.views ?? {});
  app.data = data;
  app.views = views;
  app.loadedAt = app.now();
}

export async function load(app) {
  const { $ } = app, ticket = (app.ticket = (app.ticket ?? 0) + 1);
  showLoading($);
  app.views = null;
  app.loading = true;
  const slow = setTimeout(() => showSlowNote($), SLOW_LOAD_MS);
  loadStatus(app);
  try {
    const data = await fetchData(app.fetch);
    const views = buildViews(data, app.now());
    if (ticket === app.ticket) show(app, data, views);
  } catch (err) {
    console.error("load failed", err);
    if (ticket === app.ticket) $("list").innerHTML = renderError(err, app.protocol);
  } finally {
    clearTimeout(slow);
    if (ticket === app.ticket) {
      app.loading = false;
      $("list").setAttribute("aria-busy", "false");
    }
  }
}

// Background request: no loading box, and on failure the page keeps what it shows (data or error box)
export async function refresh(app) {
  const ticket = (app.ticket = (app.ticket ?? 0) + 1);
  loadStatus(app);
  try {
    const data = await fetchData(app.fetch);
    const views = buildViews(data, app.now());
    if (ticket === app.ticket) show(app, data, views);
  } catch (err) {
    console.warn("background refresh failed, the page keeps what it shows", err);
  }
}

// Countdown, next game and the live / awaiting labels follow the clock from the data already loaded
export function rerender(app) {
  if (!app.data) return;
  try {
    const views = buildViews(app.data, app.now());
    applyViews(app.$, views, app.views ?? {});
    app.views = views;
  } catch (err) {
    console.warn("re-render failed, the page keeps what it shows", err);
  }
}

const isStale = (app) => app.loadedAt === null || app.now() - app.loadedAt >= REFRESH_AFTER_MS;

// Every clock tick and every return to the page: follow the clock, then ask for fresh data if it is old.
// Never during a foreground load: its ticket would be superseded and its loading box left without an outcome
export function keepCurrent(app, doc) {
  showChecked(app);
  rerender(app);
  if (!app.loading && doc.visibilityState !== "hidden" && isStale(app)) refresh(app);
}

export function startApp({ doc, fetch, now = () => new Date(), protocol }) {
  const $ = (id) => doc.getElementById(id);
  const app = { $, fetch, now, protocol, checkedAt: null, data: null, views: null, loadedAt: null, ticket: 0, loading: false };
  installCrestFallback($("standings-body"));
  installOpponentDialog(doc, $("opponent"), $("opp-body"), () => app.data, app.now);
  doc.addEventListener("click", (e) => {
    if (e.target.closest("#retry")) load(app);
  });
  setInterval(() => keepCurrent(app, doc), CLOCK_TICK_MS);
  // an installed app is reopened by bringing it back to the foreground, maybe days later
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState !== "hidden") keepCurrent(app, doc);
  });
  return load(app);
}
