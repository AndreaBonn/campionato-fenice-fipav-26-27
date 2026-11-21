import copy
import json
from pathlib import Path
from typing import Any, cast

import pytest

from fenice_calendar.schema import validate_data


@pytest.fixture
def sample() -> dict[str, Any]:
    return cast(
        dict[str, Any],
        json.loads((Path(__file__).parent / "fixtures/data-sample.json").read_text()),
    )


def test_sample_is_valid(sample: dict[str, Any]) -> None:
    assert validate_data(sample) == []


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("sets_won", "3-0"),
        ("round", 0),
        ("home_id", "unknown"),
        ("starts_at", "2026-11-21T17:00:00"),
        ("changes", ["score"]),
    ],
)
def test_invalid_game_fields_report_field(
    sample: dict[str, Any], field: str, value: object
) -> None:
    changed = copy.deepcopy(sample)
    changed["games"][0][field] = value
    assert any(field in error for error in validate_data(changed))


def test_missing_key_reports_field(sample: dict[str, Any]) -> None:
    del sample["season"]
    assert any("season" in error for error in validate_data(sample))


@pytest.mark.parametrize(
    ("lat", "lng"),
    [(float("nan"), 9.0), (91.0, 9.0), (39.0, 181.0), (None, 9.0), (39.0, float("inf"))],
)
def test_invalid_coordinates_are_rejected(
    sample: dict[str, Any], lat: float | None, lng: float | None
) -> None:
    assert validate_data(sample) == []
    sample["games"][0]["venue"].update(lat=lat, lng=lng)
    assert validate_data(sample)


def test_nonfinite_standings_ratio_is_rejected(sample: dict[str, Any]) -> None:
    sample["standings"] = [
        {
            "team_id": sample["teams"][0]["id"],
            "pos": 1,
            "played": 0,
            "points": 0,
            "won": 0,
            "lost": 0,
            "sets_won": 3,
            "sets_lost": 3,
            "points_for": 0,
            "points_against": 0,
            "set_ratio": 1.0,
            "point_ratio": None,
        }
    ]
    assert validate_data(sample) == []
    sample["standings"][0]["set_ratio"] = float("nan")
    assert validate_data(sample)


@pytest.mark.parametrize(
    ("field", "value", "expected"),
    [
        ("sets_won", None, "games[0].sets: played game needs results"),
        ("sets", [], "games[0].sets: played game needs results"),
        ("played", False, "games[0].sets: unplayed game has results"),
        ("sets_won", [0, 3], "games[0].sets: inconsistent scores"),
        ("starts_at", None, "games[0].starts_at: inconsistent date and time"),
        (
            "starts_at",
            "2026-11-21T17:00:00+02:00",
            "games[0].starts_at: inconsistent date and time",
        ),
        ("date", None, "games[0].starts_at: requires date and time"),
        ("time", None, "games[0].starts_at: requires date and time"),
        ("away_id", "232642", "games[0].away_id: same as home team"),
    ],
)
def test_inconsistent_game_is_rejected(
    sample: dict[str, Any], field: str, value: object, expected: str
) -> None:
    assert validate_data(sample) == []
    sample["games"][0][field] = value
    assert any(expected in error for error in validate_data(sample))


def test_validate_data_negative_set_score_reports_inconsistent_scores(
    sample: dict[str, Any],
) -> None:
    assert validate_data(sample) == []
    sample["games"][0]["sets"] = [[-1, -3], [25, 19], [25, 18]]
    sample["games"][0]["sets_won"] = [3, 0]
    assert "games[0].sets: inconsistent scores" in validate_data(sample)


@pytest.mark.parametrize(
    ("field", "value", "expected"),
    [
        ("away_id", "unknown", "games[0].away_id: unknown team"),
        ("round", True, "games[0].round: expected int"),
        ("date", "2026-13-01", "games[0].date: invalid format"),
        ("time", "17.00", "games[0].time: invalid format"),
        ("starts_at", "garbage", "games[0].starts_at: invalid format"),
        ("sets_won", [3, 0, 0], "games[0].sets_won: expected pair"),
        ("sets", [[25, 19, 10]], "games[0].sets: expected pairs"),
    ],
)
def test_validate_data_invalid_game_value_reports_field(
    sample: dict[str, Any], field: str, value: object, expected: str
) -> None:
    assert validate_data(sample) == []
    sample["games"][0][field] = value
    assert expected in validate_data(sample)


def test_validate_data_schema_version_two_reports_error(sample: dict[str, Any]) -> None:
    assert validate_data(sample) == []
    sample["schema_version"] = 2
    assert "schema_version: expected 1" in validate_data(sample)


def test_validate_data_round_boundary_accepts_18_and_rejects_19(sample: dict[str, Any]) -> None:
    sample["games"][0]["round"] = 18
    assert validate_data(sample) == []
    sample["games"][0]["round"] = 19
    assert "games[0].round: out of range" in validate_data(sample)


def test_validate_data_latitude_boundary_accepts_90_and_rejects_90_1(
    sample: dict[str, Any],
) -> None:
    sample["games"][0]["venue"].update(lat=90, lng=9)
    assert validate_data(sample) == []
    sample["games"][0]["venue"]["lat"] = 90.1
    assert "games[0].venue: invalid coordinates" in validate_data(sample)


@pytest.mark.parametrize("kind", ["team", "game", "team_cod", "extra_root", "extra_nested"])
def test_inconsistent_document_is_rejected(sample: dict[str, Any], kind: str) -> None:
    assert validate_data(sample) == []
    if kind == "team":
        sample["teams"].append(copy.deepcopy(sample["teams"][0]))
    elif kind == "game":
        sample["games"].append(copy.deepcopy(sample["games"][0]))
    elif kind == "team_cod":
        sample["team_cod"] = "unknown"
    elif kind == "extra_root":
        sample["extra"] = 1
    else:
        sample["games"][0]["venue"]["extra"] = 1
    errors = validate_data(sample)
    assert errors
    if kind.startswith("extra"):
        assert any("unexpected key" in error for error in errors)


def _notice(kind: object) -> dict[str, Any]:
    return {
        "id": 1,
        "title": "Indizione Seconda Divisione",
        "url": "https://fipavcagliari.it/x",
        "date": "2026-09-01",
        "kind": kind,
    }


@pytest.mark.parametrize("kind", ["seconda-divisione", "indizione"])
def test_notice_with_known_kind_is_valid(sample: dict[str, Any], kind: str) -> None:
    sample["notices"] = [_notice(kind)]
    assert validate_data(sample) == []


@pytest.mark.parametrize("kind", ["news", "", "Indizione", 3])
def test_notice_with_unknown_kind_is_rejected(sample: dict[str, Any], kind: object) -> None:
    sample["notices"] = [_notice(kind)]
    errors = validate_data(sample)
    assert any(error.startswith("notices[0].kind") for error in errors)


def test_validate_data_referee_pending_only_for_games_to_play(sample: dict[str, Any]) -> None:
    assert validate_data(sample) == []
    played = next(g for g in sample["games"] if g["played"] and not g["referees"])
    to_play = next(g for g in sample["games"] if not g["played"] and not g["referees"])
    played["referee_pending"] = True
    to_play["referee_pending"] = False
    errors = validate_data(sample)
    index = {g["id"]: i for i, g in enumerate(sample["games"])}
    assert (
        f"games[{index[played['id']]}].referee_pending: inconsistent with played and referees"
        in errors
    )
    assert (
        f"games[{index[to_play['id']]}].referee_pending: inconsistent with played and referees"
        in errors
    )


def test_validate_data_named_referee_is_never_pending(sample: dict[str, Any]) -> None:
    game = next(g for g in sample["games"] if not g["played"])
    game["referees"], game["referee_pending"] = ["Rossi Mario"], True
    assert any(
        e.endswith("referee_pending: inconsistent with played and referees")
        for e in validate_data(sample)
    )
    game["referee_pending"] = False
    assert validate_data(sample) == []
