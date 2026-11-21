import json
from pathlib import Path

import pytest

from fenice_calendar.parse import ParseError, parse_standings

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_standings_normalizes_and_sorts() -> None:
    raw = json.loads((FIXTURES / "standings-64353.json").read_text())
    raw[0]["data"]["teams"].reverse()
    rows = parse_standings(raw)
    assert [row["pos"] for row in rows] == list(range(1, 7))
    assert rows[0] == {
        "team_id": "232223",
        "pos": 1,
        "played": 3,
        "points": 8,
        "won": 3,
        "lost": 0,
        "sets_won": 9,
        "sets_lost": 2,
        "points_for": 250,
        "points_against": 157,
        "set_ratio": 4.5,
        "point_ratio": 1.5924,
    }
    raw[0]["data"]["teams"][0]["qs"] = "inf"
    assert parse_standings(raw)[-1]["set_ratio"] is None


def test_parse_standings_invalid_number_raises() -> None:
    raw = json.loads((FIXTURES / "standings-64353.json").read_text())
    raw[0]["data"]["teams"][0]["g"] = "bad"
    with pytest.raises((ParseError, ValueError)):
        parse_standings(raw)


def test_validate_standings_rejects_unknown_team_positions_and_inconsistent_played() -> None:
    from fenice_calendar.schema import validate_data

    data = json.loads((FIXTURES / "data-64353.json").read_text())
    assert validate_data(data) == []
    data["standings"][0].update(team_id="unknown", pos=2, played=9)
    errors = validate_data(data)
    assert any("unknown team" in error for error in errors)
    assert any("positions" in error for error in errors)
    assert any("inconsistent results" in error for error in errors)
