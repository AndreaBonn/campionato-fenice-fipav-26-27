import json
from datetime import UTC, datetime
from pathlib import Path

from fenice_calendar.merge import build_baseline, compute_changes
from fenice_calendar.parse import parse_document

FIXTURES = Path(__file__).parent / "fixtures"


def test_compute_changes_compares_baseline_fields() -> None:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    game = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))["games"][0]
    baseline = build_baseline([game])
    assert compute_changes(game, baseline) == []
    changed = game.copy()
    changed["time"] = "20:30"
    assert compute_changes(changed, baseline) == ["time"]
    assert compute_changes(changed, {}) == []
    changed = game.copy()
    changed["date"] = "2027-01-01"
    changed["time"] = "20:30"
    changed["venue"] = {**game["venue"], "raw": "Other"}
    assert compute_changes(changed, baseline) == ["date", "time", "venue"]
