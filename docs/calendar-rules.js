// Pure calendar rules: Google Calendar link of a game and the addresses of the ICS feed. No DOM.
import { displayTeamName } from "./view-rules.js";

const SITE_URL = "https://andreabonn.github.io/campionato-fenice-fipav-26-27/";
export const FEED_HTTPS_URL = `${SITE_URL}calendario.ics`;
export const FEED_WEBCAL_URL = FEED_HTTPS_URL.replace(/^https:/, "webcal:");

const GOOGLE_CALENDAR = "https://calendar.google.com/calendar/render";
const GAME_DURATION_MS = 2 * 60 * 60e3;

export const teamsById = (data) => new Map(data.teams.map((t) => [t.id, t]));

// 2026-11-21T16:00:00.000Z -> 20261121T160000Z
const utcStamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const teamLabel = (teams, id) => displayTeamName(teams.get(id)?.name ?? "Squadra sconosciuta");
const venueText = (v) => [v.name, v.address, v.city].filter(Boolean).join(", ") || v.raw;

// "Add to Google Calendar" URL for a 2 hour slot; null when the game has no start yet
export function googleCalendarUrl(game, teams) {
  if (!game.starts_at) return null;
  const start = new Date(game.starts_at);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${teamLabel(teams, game.home_id)} - ${teamLabel(teams, game.away_id)}`,
    dates: `${utcStamp(start)}/${utcStamp(new Date(start.getTime() + GAME_DURATION_MS))}`,
    location: venueText(game.venue),
    details: `Seconda Divisione Femminile, giornata ${game.round}. Calendario completo: ${SITE_URL}`,
  });
  return `${GOOGLE_CALENDAR}?${params}`;
}
