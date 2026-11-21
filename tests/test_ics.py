import json
import os
from datetime import UTC, datetime
from pathlib import Path

import pytest

from fenice_calendar.ics import build_ics, escape_text, fold_line, ics_changed
from fenice_calendar.output import write_all_atomic
from fenice_calendar.parse import parse_document

FIXTURES = Path(__file__).parent / "fixtures"


def write_ics_if_changed(path: Path, content: str) -> bool:
    """What the cli does for calendario.ics: write it only when more than DTSTAMP changed."""
    if not ics_changed(path, content):
        return False
    write_all_atomic([(path, content)])
    return True


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


def test_build_ics_first_fenice_event_matches_fixture() -> None:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))

    content = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC)).replace("\r\n ", "")
    event = content.split("BEGIN:VEVENT\r\n", 1)[1].split("END:VEVENT", 1)[0].splitlines()

    assert "UID:13002244@campionato-fenice-fipav-26-27" in event
    assert "DTSTAMP:20261121T000000Z" in event
    assert "DTSTART;TZID=Europe/Rome:20261121T170000" in event
    assert "DTEND;TZID=Europe/Rome:20261121T190000" in event
    assert "SUMMARY:Fenice - Santandreasulcis" in event
    assert "LOCATION:PALASPORT BEATRICE LOPEZ - VIA MONTE SPADA - QUARTUCCIU" in event
    assert "URL:https://andreabonn.github.io/campionato-fenice-fipav-26-27/" in event


def test_build_ics_away_game_puts_home_team_first() -> None:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))

    content = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))
    event = content.split("BEGIN:VEVENT\r\n")[2].split("END:VEVENT", 1)[0]

    assert "SUMMARY:Asd Scuola Volley Solki - Fenice\r\n" in event


def test_write_ics_if_changed_game_time_rewrites_file(tmp_path: Path) -> None:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))
    path = tmp_path / "calendario.ics"
    original = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))
    assert write_ics_if_changed(path, original) is True
    document["games"][0]["starts_at"] = "2026-11-21T18:00:00+01:00"
    changed = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))

    assert write_ics_if_changed(path, changed) is True
    assert "DTSTART;TZID=Europe/Rome:20261121T180000" in path.read_text()
    assert "DTEND;TZID=Europe/Rome:20261121T200000" in path.read_text()


@pytest.mark.parametrize(
    ("value", "expected"),
    [("\\", "\\\\"), (";", "\\;"), (",", "\\,"), ("\n", "\\n"), ("\\;", "\\\\\\;")],
)
def test_escape_text_special_characters_follow_rfc(value: str, expected: str) -> None:
    assert escape_text(value) == expected


def test_build_ics_timezone_contains_rome_offsets() -> None:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))

    content = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))
    zone = content.split("BEGIN:VTIMEZONE\r\n", 1)[1].split("END:VTIMEZONE", 1)[0]

    assert "TZID:Europe/Rome\r\n" in zone
    assert "TZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\n" in zone
    assert "TZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\n" in zone


def test_build_ics_undated_fenice_game_omits_event() -> None:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))
    original = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))
    document["games"][0]["starts_at"] = None

    content = build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))

    assert "UID:13002244@campionato-fenice-fipav-26-27" in original
    assert "UID:13002244@campionato-fenice-fipav-26-27" not in content
    assert content.count("BEGIN:VEVENT") == 17


def test_build_ics_non_utc_generation_converts_timestamp() -> None:
    from datetime import timedelta, timezone

    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))
    generated = datetime(2026, 11, 21, 12, 30, tzinfo=timezone(timedelta(hours=1)))

    content = build_ics(document, generated)

    assert content.count("DTSTAMP:20261121T113000Z\r\n") == 18


def _fixture_ics() -> str:
    raw = json.loads((FIXTURES / "calendar-64444.json").read_text())
    document = parse_document(raw, generated_at=datetime(2026, 11, 21, tzinfo=UTC))
    return build_ics(document, datetime(2026, 11, 21, tzinfo=UTC))


def test_build_ics_venue_with_comma_escapes_location() -> None:
    content = _fixture_ics().replace("\r\n ", "")
    events = content.split("BEGIN:VEVENT\r\n")
    event = next(e for e in events if "UID:13002323@campionato-fenice-fipav-26-27" in e)

    assert (
        "LOCATION:scuola media lao silesu - VIA WOLFGANG AMADEUS MOZART\\, 25 - QUARTU SANT'ELENA"
    ) in event.splitlines()


def test_build_ics_calendar_header_is_icalendar_2_0_and_ends_the_calendar() -> None:
    lines = _fixture_ics().split("\r\n")

    assert lines[:4] == [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Fenice//Calendar//IT",
        "CALSCALE:GREGORIAN",
    ]
    assert lines[-2:] == ["END:VCALENDAR", ""]


def test_build_ics_rome_switches_on_the_last_sunday_of_march_and_october() -> None:
    # EU rule since 1996: summer time from the last Sunday of March at 02:00,
    # back to standard time the last Sunday of October at 03:00
    zone = _fixture_ics().split("BEGIN:VTIMEZONE\r\n", 1)[1].split("END:VTIMEZONE", 1)[0]
    daylight = zone.split("BEGIN:DAYLIGHT\r\n", 1)[1].split("END:DAYLIGHT", 1)[0].splitlines()
    standard = zone.split("BEGIN:STANDARD\r\n", 1)[1].split("END:STANDARD", 1)[0].splitlines()

    assert "DTSTART:19700329T020000" in daylight
    assert "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU" in daylight
    assert "DTSTART:19701025T030000" in standard
    assert "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU" in standard


def test_build_ics_description_names_the_round_and_links_the_page() -> None:
    content = _fixture_ics().replace("\r\n ", "")
    event = content.split("BEGIN:VEVENT\r\n", 1)[1].split("END:VEVENT", 1)[0].splitlines()

    assert (
        "DESCRIPTION:Giornata 1\\nAggiornamenti: "
        "https://andreabonn.github.io/campionato-fenice-fipav-26-27/"
    ) in event


def test_fold_line_keeps_a_line_of_exactly_75_octets_whole() -> None:
    exact = "X" * 75

    assert fold_line(exact) == exact
    assert fold_line(exact + "Y") == exact + "\r\n Y"


def test_ics_changed_unreadable_previous_calendar_counts_as_changed(tmp_path: Path) -> None:
    # like data.json: a damaged file on disk is replaced by the next run, it never blocks it
    path = tmp_path / "calendario.ics"
    path.write_bytes(b"\xff\xfe not utf-8")
    content = _fixture_ics()

    assert ics_changed(path, content) is True
    assert write_ics_if_changed(path, content) is True
    assert ics_changed(path, content) is False
