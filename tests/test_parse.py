import copy
import json
from pathlib import Path
from typing import Any

import pytest

from fenice_calendar.parse import ParseError, parse_game
from fenice_calendar.schema import Team

FIXTURES = Path(__file__).parent / "fixtures"


def load_matches(name: str) -> list[dict[str, Any]]:
    data = json.loads((FIXTURES / name).read_text())
    matches: list[dict[str, Any]] = data["data"]["matches"]
    return matches


def index_for(matches: list[dict[str, Any]]) -> dict[str, Team]:
    teams: dict[str, Team] = {}
    for match in matches:
        for key in ("team1", "team2"):
            raw = match[key]
            teams[raw["id"]] = Team(
                id=raw["id"], cod=raw["cod_aff_societa"], name=raw["title"], logo_url=raw["logo"]
            )
    return teams


def find(matches: list[dict[str, Any]], match_id: str) -> dict[str, Any]:
    return next(match for match in matches if match["id"] == match_id)


@pytest.fixture
def girone_a() -> list[dict[str, Any]]:
    return load_matches("calendar-64444.json")


@pytest.fixture
def girone_b() -> list[dict[str, Any]]:
    return load_matches("calendar-64353.json")


def test_parse_game_normalizes_date_time_and_offset(girone_a: list[dict[str, Any]]) -> None:
    game = parse_game(find(girone_a, "13002244"), index_for(girone_a))
    assert game["id"] == "13002244"
    assert game["number"] == "1168"
    assert game["round"] == 1
    assert game["date"] == "2026-11-21"
    assert game["time"] == "17:00"
    assert game["starts_at"] == "2026-11-21T17:00:00+01:00"


def test_parse_game_summer_time_uses_cest_offset(girone_a: list[dict[str, Any]]) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["date"] = "10/04/2027"
    game = parse_game(raw, index_for(girone_a))
    assert game["starts_at"] == "2027-04-10T17:00:00+02:00"


@pytest.mark.parametrize(("date", "time"), [("", "17.00"), ("21/11/2026", ""), ("", "")])
def test_parse_game_missing_date_or_time_gives_null_start(
    girone_a: list[dict[str, Any]], date: str, time: str
) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["date"], raw["time"] = date, time
    game = parse_game(raw, index_for(girone_a))
    assert game["starts_at"] is None
    assert game["date"] == ("2026-11-21" if date else None)
    assert game["time"] == ("17:00" if time else None)


def test_parse_game_team_ids_and_unplayed_defaults(girone_a: list[dict[str, Any]]) -> None:
    raw = find(girone_a, "13002244")
    game = parse_game(raw, index_for(girone_a))
    assert game["home_id"] == raw["team1"]["id"]
    assert game["away_id"] == raw["team2"]["id"]
    assert game["played"] is False
    assert game["official"] is False
    assert game["sets_won"] is None
    assert game["sets"] == []
    assert game["live_url"] is None
    assert game["poster"] is None
    assert game["changes"] == []


def test_parse_game_played_has_sets_won_and_set_scores(girone_b: list[dict[str, Any]]) -> None:
    game = parse_game(find(girone_b, "12995174"), index_for(girone_b))
    assert game["played"] is True
    assert game["official"] is True
    assert game["sets_won"] == [2, 3]
    assert game["sets"] == [[25, 16], [25, 19], [12, 25], [16, 25], [5, 15]]
    assert game["referees"] == ["Ventura Fabio"]
    assert game["referee_pending"] is False


def test_parse_game_pending_referee_is_not_a_name(girone_a: list[dict[str, Any]]) -> None:
    game = parse_game(find(girone_a, "13002244"), index_for(girone_a))
    assert game["referees"] == []
    assert game["referee_pending"] is True


def test_parse_game_no_referee_is_pending(girone_a: list[dict[str, Any]]) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["1referee"] = ""
    game = parse_game(raw, index_for(girone_a))
    assert game["referees"] == []
    assert game["referee_pending"] is True


def test_parse_game_two_referees_keep_real_names(girone_a: list[dict[str, Any]]) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["1referee"], raw["2referee"] = "Rossi Mario", "DESIGNATO"
    game = parse_game(raw, index_for(girone_a))
    assert game["referees"] == ["Rossi Mario"]
    assert game["referee_pending"] is False


def test_parse_game_venue_split_in_name_address_city(girone_a: list[dict[str, Any]]) -> None:
    game = parse_game(find(girone_a, "13002244"), index_for(girone_a))
    assert game["venue"] == {
        "raw": "PALASPORT BEATRICE LOPEZ - VIA MONTE SPADA - QUARTUCCIU",
        "name": "PALASPORT BEATRICE LOPEZ",
        "address": "VIA MONTE SPADA",
        "city": "QUARTUCCIU",
        "lat": 39.2547576,
        "lng": 9.1761296,
    }


def test_parse_game_venue_without_separators_keeps_name_only(
    girone_a: list[dict[str, Any]],
) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["stadium"] = "Palestra"
    raw["lat-stadium"] = ""
    raw["lng-stadium"] = ""
    venue = parse_game(raw, index_for(girone_a))["venue"]
    assert venue == {
        "raw": "Palestra",
        "name": "Palestra",
        "address": None,
        "city": None,
        "lat": None,
        "lng": None,
    }


def test_parse_game_venue_decodes_escaped_apostrophe(girone_a: list[dict[str, Any]]) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["stadium"] = "PALASPORT - VIA ROMA, 1 - SANT\\'ANTIOCO"
    venue = parse_game(raw, index_for(girone_a))["venue"]
    assert venue["city"] == "SANT'ANTIOCO"
    assert venue["raw"] == "PALASPORT - VIA ROMA, 1 - SANT'ANTIOCO"


def test_parse_game_live_url_only_when_escore_enabled(girone_a: list[dict[str, Any]]) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["escorevolley"] = "1"
    game = parse_game(raw, index_for(girone_a))
    assert game["live_url"] == "https://escore.fipavonline.it?gara=13002244"


def test_parse_game_unknown_team_raises(girone_a: list[dict[str, Any]]) -> None:
    with pytest.raises(ParseError):
        parse_game(find(girone_a, "13002244"), {})


@pytest.mark.parametrize("round_label", ["Giornata", "Andata 3", ""])
def test_parse_game_bad_round_label_raises(
    girone_a: list[dict[str, Any]], round_label: str
) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["day"] = round_label
    with pytest.raises(ParseError):
        parse_game(raw, index_for(girone_a))


@pytest.mark.parametrize(
    ("lat", "lng", "expected"),
    [
        ("90", "-180", (90.0, -180.0)),
        ("nan", "9", (None, None)),
        ("91", "9", (None, None)),
        ("39", "181", (None, None)),
        ("39", "inf", (None, None)),
        ("", "9", (None, None)),
    ],
)
def test_parse_game_validates_coordinates(
    girone_a: list[dict[str, Any]], lat: str, lng: str, expected: tuple[float | None, float | None]
) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["lat-stadium"], raw["lng-stadium"] = lat, lng
    venue = parse_game(raw, index_for(girone_a))["venue"]
    assert (venue["lat"], venue["lng"]) == expected


@pytest.mark.parametrize(
    ("first", "second", "expected", "pending"),
    [
        ("A", "B", ["A", "B"], False),
        ("DESIGNATO", "B", ["B"], False),
        ("DESIGNATO", "DESIGNATO", [], True),
    ],
)
def test_parse_game_referees_filters_placeholders(
    girone_a: list[dict[str, Any]], first: str, second: str, expected: list[str], pending: bool
) -> None:
    raw = copy.deepcopy(find(girone_a, "13002244"))
    raw["1referee"], raw["2referee"] = first, second
    game = parse_game(raw, index_for(girone_a))
    assert game["referees"] == expected
    assert game["referee_pending"] is pending
