from datetime import UTC, datetime, timedelta
from pathlib import Path

from fenice_calendar.config import ICS_UID_DOMAIN, PAGE_URL, TEAM_DISPLAY_NAME, TIMEZONE_NAME
from fenice_calendar.schema import Data, Game

CRLF = "\r\n"
MAX_LINE_OCTETS = 75
GAME_DURATION = timedelta(hours=2)
LOCAL_FORMAT = "%Y%m%dT%H%M%S"
ROME_TIMEZONE = [
    "BEGIN:VTIMEZONE",
    f"TZID:{TIMEZONE_NAME}",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
]


def escape_text(value: str) -> str:
    """Escape an iCalendar text value."""
    value = value.replace("\r\n", "\n").replace("\r", "")
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def fold_line(line: str) -> str:
    """Fold at 75 octets without splitting a UTF-8 character."""
    parts, current = [], ""
    for char in line:
        if len((current + char).encode("utf-8")) > MAX_LINE_OCTETS:
            parts.append(current)
            current = " "
        current += char
    parts.append(current)
    return CRLF.join(parts)


def _event(game: Game, names: dict[str, str], stamp: str) -> list[str]:
    assert game["starts_at"] is not None
    start = datetime.fromisoformat(game["starts_at"])
    summary = f"{names[game['home_id']]} - {names[game['away_id']]}"
    description = f"Giornata {game['round']}\nAggiornamenti: {PAGE_URL}"
    return [
        "BEGIN:VEVENT",
        f"UID:{game['id']}@{ICS_UID_DOMAIN}",
        f"DTSTAMP:{stamp}",
        "SEQUENCE:0",
        f"DTSTART;TZID={TIMEZONE_NAME}:{start.strftime(LOCAL_FORMAT)}",
        f"DTEND;TZID={TIMEZONE_NAME}:{(start + GAME_DURATION).strftime(LOCAL_FORMAT)}",
        f"SUMMARY:{escape_text(summary)}",
        f"LOCATION:{escape_text(game['venue']['raw'])}",
        f"DESCRIPTION:{escape_text(description)}",
        f"URL:{PAGE_URL}",
        "END:VEVENT",
    ]


def build_ics(document: Data, generated_at: datetime) -> str:
    """Build a subscribable calendar containing dated Fenice games."""
    fenice = next(team["id"] for team in document["teams"] if team["cod"] == document["team_cod"])
    names = {
        team["id"]: (TEAM_DISPLAY_NAME if team["id"] == fenice else team["name"].title())
        for team in document["teams"]
    }
    stamp = generated_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Fenice//Calendar//IT",
        "CALSCALE:GREGORIAN",
        *ROME_TIMEZONE,
    ]
    for game in document["games"]:
        if game["starts_at"] and fenice in (game["home_id"], game["away_id"]):
            lines.extend(_event(game, names, stamp))
    lines.append("END:VCALENDAR")
    return CRLF.join(fold_line(line) for line in lines) + CRLF


def ics_changed(path: Path, content: str) -> bool:
    """Tell whether the calendar on disk differs from ``content`` beyond DTSTAMP."""

    def stable(value: str) -> list[str]:
        return [line for line in value.splitlines() if not line.startswith("DTSTAMP:")]

    try:
        previous = path.read_text(encoding="utf-8")
    # missing or damaged (not UTF-8): rewritten like an unreadable data.json, never blocking the run
    except (OSError, ValueError):
        previous = ""
    return stable(previous) != stable(content)
