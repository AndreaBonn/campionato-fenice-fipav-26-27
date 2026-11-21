import json
import os
from datetime import UTC, datetime
from pathlib import Path

from fenice_calendar.ics import build_ics, escape_text, fold_line, write_ics_if_changed
from fenice_calendar.parse import parse_document

FIXTURES = Path(__file__).parent / "fixtures"


def test_calendar_contains_fenice_games_and_folded_utf8_lines(tmp_path: Path) -> None:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))
    content = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))
    assert content.count("BEGIN:VEVENT") == 18
    assert content.count("SEQUENCE:0\r\n") == 18
    assert "TZID:Europe/Rome" in content
    fenice = next(t["id"] for t in document["teams"] if t["cod"] == document["team_cod"])
    game = next(g for g in document["games"] if fenice in (g["home_id"], g["away_id"]))
    assert f"UID:{game['id']}@campionato-fenice-fipav-26-27" in content
    assert "DTSTART;TZID=Europe/Rome:" in content
    assert "DTEND;TZID=Europe/Rome:" in content
    assert "SUMMARY:Fenice - " in content
    assert " - Fenice" in content
    assert "LOCATION:" in content
    assert "DESCRIPTION:Giornata " in content
    assert all(len(line.encode("utf-8")) <= 75 for line in content.split("\r\n"))
    path = tmp_path / "calendar.ics"
    assert write_ics_if_changed(path, content)
    os.utime(path, ns=(1_000_000_000, 1_000_000_000))
    newer = build_ics(document, datetime(2026, 11, 22, tzinfo=UTC))
    assert not write_ics_if_changed(path, newer)
    assert path.stat().st_mtime_ns == 1_000_000_000
    assert path.read_bytes() == content.encode()


def test_escape_text_normalizes_carriage_returns() -> None:
    assert escape_text("prima\r\ndopo\rtesto") == "prima\\ndopotesto"


def test_fold_line_preserves_multibyte_text_within_octet_limit() -> None:
    original = "DESCRIPTION:" + "è" * 60
    folded = fold_line(original)
    lines = folded.split("\r\n")
    assert len(lines) > 1
    assert all(len(line.encode("utf-8")) <= 75 for line in lines)
    assert folded.replace("\r\n ", "") == original
