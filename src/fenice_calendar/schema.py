from datetime import date, datetime, time
from types import UnionType
from typing import Any, TypedDict, get_args, get_origin, get_type_hints, is_typeddict


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
        errors = []
        for key, kind in get_type_hints(expected).items():
            field = f"{path}.{key}" if path else key
            errors.extend(
                _validate_type(value[key], kind, field) if key in value else [f"{field}: missing"]
            )
        return errors
    if expected is float and type(value) in (int, float):
        return []
    return [] if type(value) is expected else [f"{path}: expected {expected.__name__}"]


def _valid_datetime(value: str, field: str) -> bool:
    try:
        if field == "date":
            return len(value) == 10 and date.fromisoformat(value).isoformat() == value
        if field == "time":
            return (
                len(value) == 5 and time.fromisoformat(value).isoformat(timespec="minutes") == value
            )
        return datetime.fromisoformat(value).utcoffset() is not None
    except ValueError:
        return False


def _game_errors(game: dict[str, Any], team_ids: set[str], path: str) -> list[str]:
    errors = []
    if not 1 <= game["round"] <= 18:
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
    if not set(game["changes"]) <= {"date", "time", "venue"}:
        errors.append(f"{path}.changes: invalid value")
    return errors


def validate_data(data: object) -> list[str]:
    errors = _validate_type(data, Data, "")
    if errors:
        return errors
    assert isinstance(data, dict)
    if data["schema_version"] != 1:
        errors.append("schema_version: expected 1")
    team_ids = {team["id"] for team in data["teams"]}
    for index, game in enumerate(data["games"]):
        errors.extend(_game_errors(game, team_ids, f"games[{index}]"))
    return errors
