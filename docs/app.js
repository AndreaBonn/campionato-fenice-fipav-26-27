// Loads data.json and status.json and renders the page; the DOM and the network are passed in.
import { renderCalendarFeed, renderChecked, renderError, renderHero, renderLastResult, renderLoading, renderSchedule } from "./games-view.js";
import { installCrestFallback, renderStandings } from "./tables-view.js";
import { renderNotices } from "./notices-view.js";
import { renderAnalysis } from "./analysis-view.js";
import { installOpponentDialog } from "./opponent-view.js";

// Past this wait the page admits the network is slow
export const SLOW_LOAD_MS = 15000;
export const CLOCK_TICK_MS = 60000;

// A TypeError while building the markup is bad data, not a dead network: the cause text must not say so
export function buildViews(data, now) {
  try {
    return { hero: renderHero(data, now), list: renderSchedule(data, now), standings: renderStandings(data), last: renderLastResult(data), feed: renderCalendarFeed(data), analysis: renderAnalysis(data), notices: renderNotices(data) };
  } catch (err) {
    throw new Error("invalid data", { cause: err });
  }
}

// A section with no markup stays hidden
export function applyViews($, views) {
  $("next-body").innerHTML = views.hero;
  $("next").hidden = !views.hero;
  $("list").innerHTML = views.list;
  $("standings-body").innerHTML = views.standings;
  $("standings").hidden = !views.standings;
  $("last-body").innerHTML = views.last;
  $("last").hidden = !views.last;
  $("feed").innerHTML = views.feed;
  $("analysis-body").innerHTML = views.analysis;
  $("analysis").hidden = !views.analysis;
  $("notices-body").innerHTML = views.notices;
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

export async function load(app) {
  const { $ } = app;
  showLoading($);
  const slow = setTimeout(() => showSlowNote($), SLOW_LOAD_MS);
  loadStatus(app);
  try {
    const data = await fetchData(app.fetch);
    const views = buildViews(data, app.now());
    app.data = data;
    applyViews($, views);
  } catch (err) {
    console.error("load failed", err);
    $("list").innerHTML = renderError(err, app.protocol);
  } finally {
    clearTimeout(slow);
    $("list").setAttribute("aria-busy", "false");
  }
}

export function startApp({ doc, fetch, now = () => new Date(), protocol }) {
  const $ = (id) => doc.getElementById(id);
  const app = { $, fetch, now, protocol, checkedAt: null, data: null };
  installCrestFallback($("standings-body"));
  installOpponentDialog(doc, $("opponent"), $("opp-body"), () => app.data);
  doc.addEventListener("click", (e) => {
    if (e.target.closest("#retry")) load(app);
  });
  setInterval(() => showChecked(app), CLOCK_TICK_MS);
  return load(app);
}
