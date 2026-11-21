// HTML of the "Analisi della Fenice" section as a string. No DOM access: everything comes in as arguments.
import { feniceTeamId } from "./game-rules.js";
import { averagePointsPerSet, comebacks, forfeitCount, setStats, streak, tieBreakRecord } from "./fenice-rules.js";
import { esc } from "./games-view.js";

const dec = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;

const EMPTY = '<p class="state">L\'analisi comparirà dopo la prima partita.</p>';

function pointsText(avg) {
  const base = `${dec(avg.scored)} fatti, ${dec(avg.conceded)} subiti`;
  const decider = avg.tieBreak ? `; nel quinto set ${dec(avg.tieBreak.scored)} fatti, ${dec(avg.tieBreak.conceded)} subiti` : "";
  return avg.sets ? base + decider : decider.slice(2);
}

function tieBreakText(tb) {
  if (!tb.played) return "nessuna gara al quinto set";
  return `${plural(tb.played, "gara", "gare")}: ${plural(tb.won, "vinta", "vinte")}, ${plural(tb.lost, "persa", "perse")}`;
}

function streakText(s) {
  const noun = s.outcome === "won" ? plural(s.length, "vittoria", "vittorie") : plural(s.length, "sconfitta", "sconfitte");
  return s.length > 1 ? `${noun} di fila` : noun;
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
  return `<dl class="analysis">${rows.join("")}</dl>`;
}
