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
            "sets_won": 0,
            "sets_lost": 0,
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
    ("field", "value"),
    [
        ("sets_won", None),
        ("sets", []),
        ("played", False),
        ("sets_won", [0, 3]),
        ("sets", [[-1, 2], [25, 19], [25, 18]]),
        ("starts_at", None),
        ("starts_at", "2026-11-21T17:00:00+02:00"),
        ("date", None),
        ("time", None),
        ("away_id", "232642"),
    ],
)
def test_inconsistent_game_is_rejected(sample: dict[str, Any], field: str, value: object) -> None:
    assert validate_data(sample) == []
    sample["games"][0][field] = value
    assert validate_data(sample)


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
