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
