// Pure display rules of the page (wording, names, countdown): no DOM, no browser API, tested with node --test.

import { MATCH_WINDOW_MS } from "./game-rules.js";

export const TIME_ZONE = "Europe/Rome";
// From this hour on, a game on the same day is "tonight"
const EVENING_HOUR = 17;
const MINUTE_MS = 60e3;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// FIPAV spells some club acronyms without dots: they stay upper case
const ACRONYMS = new Set(["CUS", "GS", "VSA"]);

// "1 gara", "2 gare": the number and the noun that agrees with it
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Letters of a game outcome, so the form is readable without its colours
export const OUTCOME_LETTERS = { won: "V", lost: "P" };

// Calendar day in Rome as a UTC midnight, so two days compare without DST drift
const romeDay = (date) => Date.parse(date.toLocaleDateString("sv-SE", { timeZone: TIME_ZONE }));

// Countdown to a kickoff (ISO with Rome offset): { lead, main, sub } as shown in the hero
export function countdownText(startsAt, now) {
  const start = new Date(startsAt);
  const ms = start.getTime() - now.getTime();
  if (ms <= 0) return { lead: "", main: ms >= -MATCH_WINDOW_MS ? "In corso" : "Conclusa", sub: "" };
  const time = startsAt.slice(11, 16);
  const days = Math.round((romeDay(start) - romeDay(now)) / DAY_MS);
  if (days >= 2) return { lead: "tra", main: `${days} giorni`, sub: "" };
  if (days === 1) return { lead: "", main: "Domani", sub: `ore ${time}` };
  if (ms < HOUR_MS) return { lead: "tra", main: plural(Math.ceil(ms / MINUTE_MS), "minuto", "minuti"), sub: "" };
  const evening = Number(time.slice(0, 2)) >= EVENING_HOUR;
  return { lead: "", main: evening ? "Stasera" : "Oggi", sub: `ore ${time}` };
}

// "2 ore fa" for an ISO timestamp; a device clock a little behind the server reads "adesso"
export function relativeAge(iso, now) {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < MINUTE_MS) return "adesso";
  if (ms < HOUR_MS) return plural(Math.floor(ms / MINUTE_MS), "minuto", "minuti") + " fa";
  if (ms < DAY_MS) return plural(Math.floor(ms / HOUR_MS), "ora", "ore") + " fa";
  const days = Math.floor(ms / DAY_MS);
  return days === 1 ? "ieri" : `${days} giorni fa`;
}

// Title case of a word, also after an apostrophe or a hyphen ("SANT'ANDREA" -> "Sant'Andrea")
const titleWord = (w) => w.toLowerCase().replace(/(^|['-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
// Dotted acronyms (G.S.), single initials (S.) and known acronyms keep FIPAV's capitals
const keepsCapitals = (w) => /^(\p{L}\.){2,}$/u.test(w) || /^\p{L}\.$/u.test(w) || ACRONYMS.has(w);

// FIPAV registers names in capitals: same name, only the capitals change
export const displayTeamName = (name) => name.split(" ").map((w) => (keepsCapitals(w) ? w : titleWord(w))).join(" ");

const INITIALS_LENGTH = 2;

// Capitals of the first words of a name, shown where the crest image cannot load: "ASD FENICE" -> "AF"
export const teamInitials = (name) =>
  name.split(/\s+/).map((w) => w.match(/\p{L}/u)?.[0]).filter(Boolean).slice(0, INITIALS_LENGTH).join("").toUpperCase();
