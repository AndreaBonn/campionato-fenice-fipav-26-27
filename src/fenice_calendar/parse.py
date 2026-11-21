import copy
import math
import re
from datetime import UTC, datetime
from typing import Any, cast

from fenice_calendar.config import (
    FORMULA,
    LAT_LIMIT,
    LNG_LIMIT,
    LOCAL_TZ,
    SEASON,
    SOURCE,
    TEAM_COD,
    TIE_BREAK,
)
from fenice_calendar.schema import Data, Formula, Game, League, Row, Source, Team, TieBreak, Venue

DATE_FORMAT = "%d/%m/%Y"
TIME_FORMAT = "%H.%M"
REFEREE_PENDING_LABEL = "DESIGNATO"
VENUE_SEPARATOR = " - "
LIVE_URL = "https://escore.fipavonline.it?gara={game_id}"
ROUND_PATTERN = re.compile(r"Giornata\s+(\d+)")
FLAG_ON = "1"


SCHEMA_VERSION = 1


class ParseError(Exception):
    pass


class TeamNotFound(Exception):
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


def _coordinate(value: object, limit: float) -> float | None:
    try:
        number = float(str(value))
    except ValueError:
        return None
    return number if math.isfinite(number) and -limit <= number <= limit else None


def _parse_venue(raw: dict[str, Any]) -> Venue:
    text = str(raw["stadium"]).replace("\\'", "'")
    parts = [_clean(part) for part in text.split(VENUE_SEPARATOR)]
    lat = _coordinate(raw.get("lat-stadium"), LAT_LIMIT)
    lng = _coordinate(raw.get("lng-stadium"), LNG_LIMIT)
    if lat is None or lng is None:
        lat = lng = None
    return Venue(
        raw=text,
        name=parts[0],
        address=VENUE_SEPARATOR.join(parts[1:-1]) or None,
        city=parts[-1] if len(parts) > 1 else None,
        lat=lat,
        lng=lng,
    )


def _parse_referees(raw: dict[str, Any]) -> tuple[list[str], bool]:
    names = [_clean(str(raw.get(key, ""))) for key in ("1referee", "2referee")]
    real = [name for name in names if name and name != REFEREE_PENDING_LABEL]
    return real, not real


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


def _parse_team(raw: dict[str, Any]) -> Team:
    return Team(
        id=str(raw["id"]),
        cod=str(raw["cod_aff_societa"]),
        name=_clean(str(raw["title"])),
        logo_url=str(raw["logo"]) or None,
    )


def _build_teams(matches: list[dict[str, Any]], team_cod: str) -> list[Team]:
    teams = {
        str(raw["id"]): _parse_team(raw)
        for match in matches
        for raw in (match["team1"], match["team2"])
    }
    if not any(team["cod"] == team_cod for team in teams.values()):
        raise TeamNotFound(f"Team {team_cod} not found in the calendar")
    return sorted(teams.values(), key=lambda team: (team["cod"] != team_cod, team["name"]))


def _game_order(game: Game) -> tuple[int, bool, datetime, int]:
    start = game["starts_at"]
    return (
        game["round"],
        start is None,
        datetime.fromisoformat(start) if start else datetime.min.replace(tzinfo=UTC),
        int(game["number"]),
    )


def parse_document(
    calendar_json: dict[str, Any], generated_at: datetime, team_cod: str = TEAM_COD
) -> Data:
    """Build the complete data.json document from a FIPAV calendar response."""
    calendar = calendar_json["data"]
    teams = _build_teams(calendar["matches"], team_cod)
    index = {team["id"]: team for team in teams}
    games = sorted((parse_game(raw, index) for raw in calendar["matches"]), key=_game_order)
    return Data(
        schema_version=SCHEMA_VERSION,
        updated_at=generated_at.astimezone(UTC).isoformat(),
        source=cast(Source, copy.deepcopy(SOURCE)),
        season=SEASON,
        league=League(group_id=str(calendar["id"]), title=_clean(str(calendar["title"]))),
        team_cod=team_cod,
        formula=cast(Formula, copy.deepcopy(FORMULA)),
        tie_break=cast(TieBreak, copy.deepcopy(TIE_BREAK)),
        teams=teams,
        games=games,
        standings=[],
        notices=[],
    )


def _ratio(value: object) -> float | None:
    number = float(str(value))
    return number if math.isfinite(number) else None


def parse_standings(raw: list[dict[str, Any]]) -> list[Row]:
    """Normalize the FIPAV standings and order them by position."""
    rows = [
        Row(
            team_id=str(team["id"]),
            pos=int(team["pos"]),
            played=int(team["g"]),
            points=int(team["p"]),
            won=int(team["gv"]),
            lost=int(team["gp"]),
            sets_won=int(team["sv"]),
            sets_lost=int(team["sp"]),
            points_for=int(team["pf"]),
            points_against=int(team["ps"]),
            set_ratio=_ratio(team["qs"]),
            point_ratio=_ratio(team["qp"]),
        )
        for team in raw[0]["data"]["teams"]
    ]
    return sorted(rows, key=lambda row: row["pos"])
