import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from fenice_calendar.config import FORMULA, SEASON, SOURCE, TEAM_COD, TIE_BREAK
from fenice_calendar.parse import TeamNotFound, parse_document
from fenice_calendar.schema import validate_data

FIXTURES = Path(__file__).parent / "fixtures"
GENERATED_AT = datetime(2026, 11, 21, 12, 0, tzinfo=UTC)
FENICE_COD_64353 = "190920448"


def load(name: str) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads((FIXTURES / name).read_text())
    return loaded


@pytest.fixture
def document() -> dict[str, Any]:
    return dict(parse_document(load("calendar-64444.json"), generated_at=GENERATED_AT))


def test_parse_document_counts_games_teams_and_fenice_games(document: dict[str, Any]) -> None:
    fenice_id = next(t["id"] for t in document["teams"] if t["cod"] == TEAM_COD)
    fenice_games = [g for g in document["games"] if fenice_id in (g["home_id"], g["away_id"])]
    assert len(document["games"]) == 90
    assert len(document["teams"]) == 10
    assert len(fenice_games) == 18


def test_parse_document_is_valid_against_schema(document: dict[str, Any]) -> None:
    assert validate_data(document) == []


def test_parse_document_header_comes_from_config_and_calendar(document: dict[str, Any]) -> None:
    assert document["schema_version"] == 1
    assert document["updated_at"] == "2026-11-21T12:00:00+00:00"
    assert document["season"] == SEASON
    assert document["source"] == SOURCE
    assert document["formula"] == FORMULA
    assert document["tie_break"] == TIE_BREAK
    assert document["team_cod"] == TEAM_COD
    assert document["league"] == {
        "group_id": "64444",
        "title": "Seconda Divisione Femminile - Girone A",
    }


def test_parse_document_later_phase_keys_are_empty(document: dict[str, Any]) -> None:
    assert document["standings"] == []
    assert document["notices"] == []
    assert {g["poster"] for g in document["games"]} == {None}
    assert [g["changes"] for g in document["games"] if g["changes"]] == []


def test_parse_document_team_names_are_stripped_and_logo_kept(document: dict[str, Any]) -> None:
    fenice = next(t for t in document["teams"] if t["cod"] == TEAM_COD)
    assert fenice == {
        "id": "232642",
        "cod": "190920448",
        "name": "ASD FENICE",
        "logo_url": "https://app.fipavonline.it/img/loghi_societa/190920448/logo.jpg?v=1762974109",
    }
    assert all(t["name"] == " ".join(t["name"].split()) for t in document["teams"])


def test_parse_document_games_sorted_by_round_then_start_then_number(
    document: dict[str, Any],
) -> None:
    keys = [(g["round"], g["starts_at"] or "~", int(g["number"])) for g in document["games"]]
    assert keys == sorted(keys)
    assert document["games"][0]["round"] == 1
    assert document["games"][-1]["round"] == 18


def test_parse_document_undated_game_goes_last_in_its_round() -> None:
    calendar = load("calendar-64444.json")
    first_round = [m for m in calendar["data"]["matches"] if m["day"] == "Giornata 1"]
    first_round[0]["date"] = ""
    first_round[0]["time"] = ""
    games = parse_document(calendar, generated_at=GENERATED_AT)["games"]
    round_one = [g for g in games if g["round"] == 1]
    assert round_one[-1]["id"] == first_round[0]["id"]
    assert round_one[-1]["starts_at"] is None
    assert all(g["starts_at"] is not None for g in round_one[:-1])


def test_parse_document_without_fenice_raises_team_not_found() -> None:
    calendar = copy.deepcopy(load("calendar-64444.json"))
    calendar["data"]["matches"] = [
        m
        for m in calendar["data"]["matches"]
        if TEAM_COD not in (m["team1"]["cod_aff_societa"], m["team2"]["cod_aff_societa"])
    ]
    with pytest.raises(TeamNotFound):
        parse_document(calendar, generated_at=GENERATED_AT)


def test_parse_document_regenerates_the_64353_fixture() -> None:
    parsed = parse_document(
        load("calendar-64353.json"), generated_at=GENERATED_AT, team_cod=FENICE_COD_64353
    )
    expected = load("data-64353.json")
    assert json.loads(json.dumps(parsed)) == expected
    assert validate_data(expected) == []
    sarlux_aquila = next(g for g in expected["games"] if g["id"] == "12995174")
    assert sarlux_aquila["sets_won"] == [2, 3]
