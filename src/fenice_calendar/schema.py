import math
from datetime import date, datetime, time
from types import UnionType
from typing import Any, TypedDict, get_args, get_origin, get_type_hints, is_typeddict
from zoneinfo import ZoneInfo

MAX_ROUND = 18
DATE_LENGTH = 10
TIME_LENGTH = 5
LAT_LIMIT = 90
LNG_LIMIT = 180
LOCAL_TZ = ZoneInfo("Europe/Rome")


class Source(TypedDict):
    name: str
    url: str


class League(TypedDict):
    group_id: str
    title: str


class Formula(TypedDict):
    published: bool
    promotion: int
    playoff: int
    relegation: int


class TieBreak(TypedDict):
    criteria: list[str]
    provisional: bool


class Team(TypedDict):
    id: str
    cod: str
    name: str
    logo_url: str | None


class Venue(TypedDict):
    raw: str
    name: str
    address: str | None
    city: str | None
    lat: float | None
    lng: float | None


class Poster(TypedDict):
    url: str
    width: int
    height: int


class Game(TypedDict):
    id: str
    number: str
    round: int
    date: str | None
    time: str | None
    starts_at: str | None
    venue: Venue
    home_id: str
    away_id: str
    played: bool
    official: bool
    sets_won: list[int] | None
    sets: list[list[int]]
    referees: list[str]
    referee_pending: bool
    live_url: str | None
    poster: Poster | None
    changes: list[str]


class Row(TypedDict):
    team_id: str
    pos: int
    played: int
    points: int
    won: int
    lost: int
    sets_won: int
    sets_lost: int
    points_for: int
    points_against: int
    set_ratio: float | None
    point_ratio: float | None


class Notice(TypedDict):
    id: int
    title: str
    url: str
    date: str
    kind: str


class Data(TypedDict):
    schema_version: int
    updated_at: str
    source: Source
    season: str
    league: League
    team_cod: str
    formula: Formula
    tie_break: TieBreak
    teams: list[Team]
    games: list[Game]
    standings: list[Row]
    notices: list[Notice]


def _validate_type(value: Any, expected: Any, path: str) -> list[str]:
    origin = get_origin(expected)
    if origin is UnionType:
        if any(not _validate_type(value, option, path) for option in get_args(expected)):
            return []
        return [f"{path}: invalid type or value"]
    if origin is list:
        if not isinstance(value, list):
            return [f"{path}: expected list"]
        return [
            error
            for index, item in enumerate(value)
            for error in _validate_type(item, get_args(expected)[0], f"{path}[{index}]")
        ]
    if is_typeddict(expected):
        if not isinstance(value, dict):
            return [f"{path}: expected object"]
        errors: list[str] = []
        hints = get_type_hints(expected)
        errors.extend(f"{path}.{key}: unexpected key" for key in value.keys() - hints.keys())
        for key, kind in hints.items():
            field = f"{path}.{key}" if path else key
            errors.extend(
                _validate_type(value[key], kind, field) if key in value else [f"{field}: missing"]
            )
        return errors
    if expected is float and type(value) in (int, float):
        return [] if math.isfinite(value) else [f"{path}: non-finite number"]
    return [] if type(value) is expected else [f"{path}: expected {expected.__name__}"]


def _valid_datetime(value: str, field: str) -> bool:
    try:
        if field == "date":
            return len(value) == DATE_LENGTH and date.fromisoformat(value).isoformat() == value
        if field == "time":
            return (
                len(value) == TIME_LENGTH
                and time.fromisoformat(value).isoformat(timespec="minutes") == value
            )
        return datetime.fromisoformat(value).utcoffset() is not None
    except ValueError:
        return False


def _game_errors(game: dict[str, Any], team_ids: set[str], path: str) -> list[str]:
    errors = []
    lat, lng = game["venue"]["lat"], game["venue"]["lng"]
    if (
        (lat is None) != (lng is None)
        or (lat is not None and not -LAT_LIMIT <= lat <= LAT_LIMIT)
        or (lng is not None and not -LNG_LIMIT <= lng <= LNG_LIMIT)
    ):
        errors.append(f"{path}.venue: invalid coordinates")
    if not 1 <= game["round"] <= MAX_ROUND:
        errors.append(f"{path}.round: out of range")
    for field in ("home_id", "away_id"):
        if game[field] not in team_ids:
            errors.append(f"{path}.{field}: unknown team")
    for field in ("date", "time", "starts_at"):
        if game[field] is not None and not _valid_datetime(game[field], field):
            errors.append(f"{path}.{field}: invalid format")
    if game["sets_won"] is not None and len(game["sets_won"]) != 2:
        errors.append(f"{path}.sets_won: expected pair")
    if any(len(pair) != 2 for pair in game["sets"]):
        errors.append(f"{path}.sets: expected pairs")
    errors.extend(_game_consistency_errors(game, path))
    if not set(game["changes"]) <= {"date", "time", "venue"}:
        errors.append(f"{path}.changes: invalid value")
    return errors


def _game_consistency_errors(game: dict[str, Any], path: str) -> list[str]:
    errors = []
    sets, won = game["sets"], game["sets_won"]
    if game["played"]:
        if won is None or not sets:
            errors.append(f"{path}.sets: played game needs results")
        elif len(won) == 2 and all(len(pair) == 2 for pair in sets):
            counts = [sum(pair[side] > pair[1 - side] for pair in sets) for side in (0, 1)]
            if won != counts or any(score < 0 for pair in sets for score in pair):
                errors.append(f"{path}.sets: inconsistent scores")
    elif won is not None or sets:
        errors.append(f"{path}.sets: unplayed game has results")
    if game["home_id"] == game["away_id"]:
        errors.append(f"{path}.away_id: same as home team")
    day, clock, start = game["date"], game["time"], game["starts_at"]
    if day is None or clock is None:
        if start is not None:
            errors.append(f"{path}.starts_at: requires date and time")
    elif all(_valid_datetime(v, f) for v, f in ((day, "date"), (clock, "time"))):
        expected = datetime.combine(date.fromisoformat(day), time.fromisoformat(clock), LOCAL_TZ)
        if (
            start is None
            or not _valid_datetime(start, "starts_at")
            or datetime.fromisoformat(start) != expected
        ):
            errors.append(f"{path}.starts_at: inconsistent date and time")
    return errors


def _standings_errors(rows: list[Row], team_ids: set[str]) -> list[str]:
    errors = []
    if sorted(row["pos"] for row in rows) != list(range(1, len(rows) + 1)):
        errors.append("standings: invalid positions")
    for index, row in enumerate(rows):
        if row["team_id"] not in team_ids:
            errors.append(f"standings[{index}].team_id: unknown team")
        if row["played"] != row["won"] + row["lost"]:
            errors.append(f"standings[{index}].played: inconsistent results")
    return errors


def validate_data(data: object) -> list[str]:
    errors = _validate_type(data, Data, "")
    if errors:
        return errors
    assert isinstance(data, dict)
    if data["schema_version"] != 1:
        errors.append("schema_version: expected 1")
    team_ids = {team["id"] for team in data["teams"]}
    if len(team_ids) != len(data["teams"]):
        errors.append("teams: duplicate id")
    if len({game["id"] for game in data["games"]}) != len(data["games"]):
        errors.append("games: duplicate id")
    if data["team_cod"] not in {team["cod"] for team in data["teams"]}:
        errors.append("team_cod: unknown team")
    errors.extend(_standings_errors(data["standings"], team_ids))
    for index, game in enumerate(data["games"]):
        errors.extend(_game_errors(game, team_ids, f"games[{index}]"))
    return errors
