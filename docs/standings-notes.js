// Pure texts and rules of the standings section: pre-season note, last five games, "how to read" help. No DOM.
import { outcome, playedInOrder } from "./game-rules.js";
import { TIME_ZONE } from "./view-rules.js";

export const TIE_BREAK_LABELS = { wins: "vittorie", set_ratio: "quoziente set", point_ratio: "quoziente punti" };

const FORM_LENGTH = 5;
const ALL_ZERO = "tutte le squadre hanno 0 punti e l'ordine non è ancora una graduatoria.";

const involves = (game, teamId) => game.home_id === teamId || game.away_id === teamId;

// Note shown above the table while no team has played; "" once any row has played or when there are no rows.
// The date is the earliest start among the games, in Rome time; without any start the clause is left out
export function preseasonNote(rows, games) {
  if (!rows.length || rows.some((r) => r.played > 0)) return "";
  const starts = games.map((g) => g.starts_at).filter(Boolean).map((s) => Date.parse(s));
  if (!starts.length) return `Finché nessuno ha giocato ${ALL_ZERO}`;
  const day = new Date(Math.min(...starts)).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE });
  return `Il campionato parte ${day}: finché nessuno ha giocato ${ALL_ZERO}`;
}

// Outcomes ("won" | "lost") of the team's last FORM_LENGTH played games, oldest first, by play date
export const lastFive = (games, teamId) =>
  playedInOrder(games.filter((g) => involves(g, teamId))).slice(-FORM_LENGTH).map((g) => outcome(g, teamId));

const BASE_ITEMS = [
  { term: "Pt", text: "punti: 3 per una vittoria 3-0 o 3-1, 2 per un 3-2, 1 per una sconfitta 2-3." },
  { term: "G, V, P", text: "partite giocate, vinte, perse." },
  { term: "Set", text: "set vinti e persi." },
  { term: "Q. set", text: "quoziente set: set vinti diviso set persi." },
  { term: "Q. punti", text: "quoziente punti: punti fatti diviso punti subiti." },
];
const POSSIBLE_ITEM = { term: "Poss.", text: "posizioni finali ancora possibili, in base alle partite che restano da giocare." };
const FENICE_ITEM = { term: "Fenice", text: "la riga della Fenice è evidenziata." };
const PROVISIONAL = "Criterio provvisorio finché il Comitato non pubblica l'indizione.";

// Content of "Come leggere la classifica": the terms (Poss. only when its column is shown) and the tie-break sentence
export function howToRead({ tieBreak, showPossible }) {
  const labels = tieBreak.criteria.map((c) => TIE_BREAK_LABELS[c] ?? c).join(", ");
  const sentence = `A parità di punti si guarda, nell'ordine: ${labels}.`;
  return {
    items: [...BASE_ITEMS, ...(showPossible ? [POSSIBLE_ITEM] : []), FENICE_ITEM],
    tieBreak: tieBreak.provisional ? `${sentence} ${PROVISIONAL}` : sentence,
  };
}
