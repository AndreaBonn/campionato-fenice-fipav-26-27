// HTML of the "Andamento" section as a string: a strip with the record, the sets and the form, and the full analysis folded in. No DOM access: everything comes in as arguments.
import { feniceGames, feniceTeamId, form, outcome, playedInOrder } from "./game-rules.js";
import { averagePointsPerSet, comebacks, forfeitCount, setStats, streak, tieBreakRecord } from "./fenice-rules.js";
import { formListHtml } from "./games-view.js";
import { esc } from "./html.js";
import { plural } from "./view-rules.js";

const dec = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;

const EMPTY = '<p class="state">L\'analisi comparirà dopo la prima partita.</p>';

function pointsText(avg) {
  const base = `${dec(avg.scored)} fatti, ${dec(avg.conceded)} subiti`;
  const decider = avg.tieBreak ? `; nel quinto set ${dec(avg.tieBreak.scored)} fatti, ${dec(avg.tieBreak.conceded)} subiti` : "";
  return base + decider;
}

function tieBreakText(tb) {
  if (!tb.played) return "nessuna gara al quinto set";
  return `${plural(tb.played, "gara", "gare")}: ${plural(tb.won, "vinta", "vinte")}, ${plural(tb.lost, "persa", "perse")}`;
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
<details><summary>Analisi completa (punti per set, quinto set, rimonte)</summary>${details}</details></div>`;
}

export function renderAnalysis(data) {
  const id = feniceTeamId(data), games = data.games;
  const sets = setStats(id, games), avg = averagePointsPerSet(id, games), s = streak(id, games);
  if (!s) return EMPTY;
  const back = comebacks(id, games);
  const rows = [
    row("Set vinti e persi", sets.total ? `${sets.won} vinti, ${sets.lost} persi (${sets.wonPct}%)` : "nessun set giocato"),
    row("Punti medi per set", avg ? pointsText(avg) : "nessun parziale disponibile"),
    row("Quinto set", tieBreakText(tieBreakRecord(id, games))),
    row("Rimonte", `${plural(back.won, "vittoria", "vittorie")} dopo aver perso il primo set, ${back.fromTwoZero} da 0-2`),
    row("Serie in corso", streakText(s)),
  ];
  const forfeits = forfeitCount(id, games);
  if (forfeits) rows.push(row("Gare a tavolino", `${plural(forfeits, "gara decisa", "gare decise")} a tavolino`));
  return stripHtml(id, data, sets, `<dl class="analysis">${rows.join("")}</dl>`);
}
