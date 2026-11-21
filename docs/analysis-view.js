// HTML of the "Andamento" section as a string: a strip with the record, the sets and the form, and the full analysis folded in. No DOM access: everything comes in as arguments.
import { feniceGames, feniceTeamId, form, outcome, playedInOrder } from "./game-rules.js";
import { averagePointsPerSet, closeSets, comebacks, forfeitCount, setStats, setsByNumber, streak, tieBreakDetail, tieBreakRecord } from "./fenice-rules.js";
import { formListHtml } from "./games-view.js";
import { esc } from "./html.js";
import { displayTeamName, plural } from "./view-rules.js";
import { homeAwayRecord, remainingGames } from "./team-rules.js";

const PERCENT = 100;
const dec = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;

const EMPTY = '<p class="state">L\'analisi comparirà dopo la prima partita.</p>';

function pointsText(avg) {
  const base = `${dec(avg.scored)} fatti, ${dec(avg.conceded)} subiti`;
  const decider = avg.tieBreak ? `; nel quinto set ${dec(avg.tieBreak.scored)} fatti, ${dec(avg.tieBreak.conceded)} subiti` : "";
  return base + decider;
}

const signed = (n) => (n < 0 ? "-" : "+") + dec(Math.abs(n));

// Each fifth set as "15-12 con Opponent" (Fenice points first), with the mean margin from two sets on
function tieBreakListText(detail, teams) {
  const name = (id) => displayTeamName(teams.find((t) => t.id === id)?.name ?? "Squadra sconosciuta");
  const sets = detail.sets.map((s) => `${s.mine}-${s.theirs} con ${name(s.opponentId)}`).join(", ");
  return `; ${sets}${detail.meanMargin === null ? "" : `; scarto medio ${signed(detail.meanMargin)}`}`;
}

function tieBreakText(tb, detail, teams) {
  if (!tb.played) return "nessuna gara al quinto set";
  return `${plural(tb.played, "gara", "gare")}: ${plural(tb.won, "vinta", "vinte")}, ${plural(tb.lost, "persa", "perse")}${tieBreakListText(detail, teams)}`;
}

function closeSetsText(c) {
  if (!c.won && !c.lost) return "nessun set punto a punto";
  return `${plural(c.won, "vinto", "vinti")}, ${plural(c.lost, "perso", "persi")}`;
}

// "7 gare, avversarie in media al 3,3° posto"; the average is left out when no position is known
function runInText(run) {
  const n = run.games.length;
  if (!n) return "nessuna gara da giocare";
  if (run.averagePosition === null) return plural(n, "gara", "gare");
  const where = n === 1 ? `avversaria al ${run.averagePosition}° posto` : `avversarie in media al ${dec(run.averagePosition)}° posto`;
  return `${plural(n, "gara", "gare")}, ${where}`;
}

const recordBox = (label, r) => {
  if (!r.played) return `<div class="box"><small>${label}</small><b>-</b><small>nessuna gara giocata</small></div>`;
  const big = `${r.won}-${r.lost}<span class="sr-only"> (${plural(r.won, "vinta", "vinte")}, ${plural(r.lost, "persa", "perse")})</span>`;
  return `<div class="box"><small>${label}</small><b>${big}</b><small>set ${r.setsWon}-${r.setsLost}</small></div>`;
};

function homeAwayHtml(id, games) {
  const rec = homeAwayRecord(id, games);
  return `<section class="split"><h3 class="sr-only">Rendimento in casa e in trasferta</h3>${recordBox("In casa", rec.home)}${recordBox("In trasferta", rec.away)}</section>`;
}

// One bar per set number; the bar is decoration, the "2 su 3" text carries the meaning
function setBarsHtml(bySet) {
  if (!bySet.length) return "";
  const items = bySet.map((s) => {
    const share = s.played ? Math.round((s.won / s.played) * PERCENT) : 0;
    const text = s.played ? `${s.won} su ${s.played}` : "nessuno";
    return `<li><span class="lbl">${s.number}° set</span><span class="bar" aria-hidden="true"><span style="width:${share}%"></span></span><span class="val">${text}</span></li>`;
  });
  return `<section class="by-set"><h3>Set vinti per numero di set</h3><ul class="set-bars">${items.join("")}</ul></section>`;
}

function streakText(s) {
  const noun = s.outcome === "won" ? plural(s.length, "vittoria", "vittorie") : plural(s.length, "sconfitta", "sconfitte");
  return s.length > 1 ? `${noun} di fila` : noun;
}

const FORM_LABEL = "Forma delle ultime partite, dalla più vecchia alla più recente. V vinta, P persa";

// Wins and losses, sets won and lost, the last results, and the full analysis folded under them
function stripHtml(id, data, sets, details) {
  const games = feniceGames(data), results = playedInOrder(games).map((g) => outcome(g, id));
  const won = results.filter((o) => o === "won").length;
  const setsSpan = sets.total ? `<span><b class="n">${sets.won}-${sets.lost}</b> set</span>` : "";
  return `<div class="strip"><span><b class="n">${won}-${results.length - won}</b> vinte e perse</span>${setsSpan}<span class="recent">Ultime ${formListHtml(form(games, id), FORM_LABEL)}</span>
<details><summary>Analisi completa (punti per set, quinto set, casa e trasferta, set per set)</summary>${details}</details></div>`;
}

export function renderAnalysis(data) {
  const id = feniceTeamId(data), games = data.games;
  const sets = setStats(id, games), avg = averagePointsPerSet(id, games), s = streak(id, games);
  if (!s) return EMPTY;
  const back = comebacks(id, games);
  const rows = [
    row("Set vinti e persi", sets.total ? `${sets.won} vinti, ${sets.lost} persi (${sets.wonPct}%)` : "nessun set giocato"),
    row("Punti medi per set", avg ? pointsText(avg) : "nessun parziale disponibile"),
    row("Quinto set", tieBreakText(tieBreakRecord(id, games), tieBreakDetail(id, games), data.teams)),
    row("Rimonte", `${plural(back.won, "vittoria", "vittorie")} dopo aver perso il primo set, ${back.fromTwoZero} da 0-2`),
    row("Serie in corso", streakText(s)),
  ];
  const forfeits = forfeitCount(id, games);
  if (forfeits) rows.push(row("Gare a tavolino", `${plural(forfeits, "gara decisa", "gare decise")} a tavolino`));
  rows.push(row("Set punto a punto", closeSetsText(closeSets(id, games))));
  rows.push(row("Gare che restano", runInText(remainingGames(id, games, data.standings))));
  const details = `<dl class="analysis">${rows.join("")}</dl>${homeAwayHtml(id, games)}${setBarsHtml(setsByNumber(id, games))}`;
  return stripHtml(id, data, sets, details);
}
