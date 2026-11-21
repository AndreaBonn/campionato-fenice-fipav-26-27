// Pure calendar rules: Google Calendar link of a game and the addresses of the ICS feed. No DOM.
import { displayTeamName } from "./view-rules.js";

const FEED_FILE = "calendario.ics";

// Folder of the page, without file, query or hash: the site root where docs/ is served; null when unknown
const siteUrl = (pageUrl) => (pageUrl ? new URL(".", pageUrl).href : null);

// Addresses of the ICS feed next to the page that links it: { https, webcal }; null when the page url is unknown.
// pageUrl is location.href, passed by the caller, so there is no second copy of the site address here
export function feedUrls(pageUrl = globalThis.location?.href) {
  const base = siteUrl(pageUrl);
  if (base === null) return null;
  const https = new URL(FEED_FILE, base).href;
  return { https, webcal: https.replace(/^https?:/, "webcal:") };
}

const GOOGLE_CALENDAR = "https://calendar.google.com/calendar/render";
const GAME_DURATION_MS = 2 * 60 * 60e3;

export const teamsById = (data) => new Map(data.teams.map((t) => [t.id, t]));

// 2026-11-21T16:00:00.000Z -> 20261121T160000Z
const utcStamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const teamLabel = (teams, id) => displayTeamName(teams.get(id)?.name ?? "Squadra sconosciuta");
const venueText = (v) => [v.name, v.address, v.city].filter(Boolean).join(", ") || v.raw;

// "Add to Google Calendar" URL for a 2 hour slot; null when the game has no start yet
export function googleCalendarUrl(game, teams, pageUrl = globalThis.location?.href) {
  if (!game.starts_at) return null;
  const start = new Date(game.starts_at), site = siteUrl(pageUrl);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${teamLabel(teams, game.home_id)} - ${teamLabel(teams, game.away_id)}`,
    dates: `${utcStamp(start)}/${utcStamp(new Date(start.getTime() + GAME_DURATION_MS))}`,
    location: venueText(game.venue),
    details: `Seconda Divisione Femminile, giornata ${game.round}.${site ? ` Calendario completo: ${site}` : ""}`,
  });
  return `${GOOGLE_CALENDAR}?${params}`;
}
