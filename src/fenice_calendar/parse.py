import re
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from fenice_calendar.schema import Game, Team, Venue

LOCAL_TZ = ZoneInfo("Europe/Rome")
DATE_FORMAT = "%d/%m/%Y"
TIME_FORMAT = "%H.%M"
REFEREE_PENDING_LABEL = "DESIGNATO"
VENUE_SEPARATOR = " - "
LIVE_URL = "https://escore.fipavonline.it?gara={game_id}"
ROUND_PATTERN = re.compile(r"Giornata\s+(\d+)")
FLAG_ON = "1"


class ParseError(Exception):
    pass


def _clean(text: str) -> str:
    return " ".join(text.replace("\\'", "'").split())


def _parse_round(label: str) -> int:
    found = ROUND_PATTERN.fullmatch(label.strip())
    if found is None:
        raise ParseError(f"Unrecognized round label: {label!r}")
    return int(found.group(1))


def _parse_when(date_text: str, time_text: str) -> tuple[str | None, str | None, str | None]:
    day = datetime.strptime(date_text, DATE_FORMAT) if date_text.strip() else None
    clock = datetime.strptime(time_text, TIME_FORMAT) if time_text.strip() else None
    date_iso = day.date().isoformat() if day else None
    time_iso = clock.time().isoformat(timespec="minutes") if clock else None
    if day is None or clock is None:
        return date_iso, time_iso, None
    starts_at = datetime.combine(day.date(), clock.time(), tzinfo=LOCAL_TZ)
    return date_iso, time_iso, starts_at.isoformat()


def _coordinate(value: object) -> float | None:
    try:
        return float(str(value))
    except ValueError:
        return None


def _parse_venue(raw: dict[str, Any]) -> Venue:
    text = str(raw["stadium"]).replace("\\'", "'")
    parts = [_clean(part) for part in text.split(VENUE_SEPARATOR)]
    return Venue(
        raw=text,
        name=parts[0],
        address=VENUE_SEPARATOR.join(parts[1:-1]) or None,
        city=parts[-1] if len(parts) > 1 else None,
        lat=_coordinate(raw.get("lat-stadium")),
        lng=_coordinate(raw.get("lng-stadium")),
    )


def _parse_referees(raw: dict[str, Any]) -> tuple[list[str], bool]:
    names = [_clean(str(raw.get(key, ""))) for key in ("1referee", "2referee")]
    real = [name for name in names if name and name != REFEREE_PENDING_LABEL]
    return real, REFEREE_PENDING_LABEL in names


def _team_id(raw: dict[str, Any], key: str, teams_index: dict[str, Team]) -> str:
    team_id = str(raw[key]["id"])
    if team_id not in teams_index:
        raise ParseError(f"Game {raw['id']}: unknown team {team_id}")
    return team_id


def _parse_results(raw: dict[str, Any]) -> tuple[list[int] | None, list[list[int]]]:
    if not raw["played"]:
        return None, []
    sets = [[int(a), int(b)] for a, b in zip(raw["pt_a"], raw["pt_b"], strict=True)]
    return [int(raw["team1-setwin"]), int(raw["team2-setwin"])], sets


def _live_url(raw: dict[str, Any]) -> str | None:
    if str(raw["escorevolley"]) != FLAG_ON:
        return None
    return LIVE_URL.format(game_id=raw["id"])


def parse_game(raw: dict[str, Any], teams_index: dict[str, Team]) -> Game:
    """Normalize one FIPAV match into a data.json game.

    The calendar date and time are authoritative; ``ts_gara`` is ignored.
    """
    date_iso, time_iso, starts_at = _parse_when(str(raw["date"]), str(raw["time"]))
    referees, pending = _parse_referees(raw)
    sets_won, sets = _parse_results(raw)
    return Game(
        id=str(raw["id"]),
        number=str(raw["ng"]),
        round=_parse_round(str(raw["day"])),
        date=date_iso,
        time=time_iso,
        starts_at=starts_at,
        venue=_parse_venue(raw),
        home_id=_team_id(raw, "team1", teams_index),
        away_id=_team_id(raw, "team2", teams_index),
        played=bool(raw["played"]),
        official=str(raw["ris_ufficiale"]) == FLAG_ON,
        sets_won=sets_won,
        sets=sets,
        referees=referees,
        referee_pending=pending,
        live_url=_live_url(raw),
        poster=None,
        changes=[],
    )
