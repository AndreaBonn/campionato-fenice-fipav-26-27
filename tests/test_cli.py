import copy
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from fenice_calendar.cli import main
from fenice_calendar.config import CALENDAR_PATH, GROUP_ID, TABLES_PATH, TEAM_COD
from fenice_calendar.fetch import FetchError
from fenice_calendar.merge import build_baseline
from fenice_calendar.parse import parse_document
from fenice_calendar.schema import validate_data

FIXTURES = Path(__file__).parent / "fixtures"
FIRST_RUN = datetime(2026, 11, 21, 12, 0, tzinfo=UTC)
SECOND_RUN = datetime(2026, 11, 21, 16, 0, tzinfo=UTC)


def calendar() -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads((FIXTURES / "calendar-64444.json").read_text())
    return loaded


class Env:
    def __init__(self, tmp_path: Path) -> None:
        self.data = tmp_path / "docs" / "data.json"
        self.status = tmp_path / "docs" / "status.json"
        self.requested: list[str] = []

    def run(self, payload: Any, now: datetime = FIRST_RUN) -> int:
        def fetch(path: str) -> Any:
            self.requested.append(path)
            if isinstance(payload, Exception):
                raise payload
            if path == TABLES_PATH.format(group=GROUP_ID):
                return json.loads((FIXTURES / "standings-64444.json").read_text())
            return payload

        return main(fetch=fetch, now=lambda: now, data_path=self.data, status_path=self.status)


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Env:
    baseline = tmp_path / "baseline.json"
    games = parse_document(calendar(), generated_at=FIRST_RUN)["games"]
    baseline.write_text(json.dumps(build_baseline(games)))
    monkeypatch.setattr("fenice_calendar.cli.BASELINE_PATH", baseline)
    return Env(tmp_path)


def test_main_success_writes_valid_data_and_status(env: Env) -> None:
    assert env.run(calendar()) == 0
    data = json.loads(env.data.read_text(encoding="utf-8"))
    assert validate_data(data) == []
    assert len(data["games"]) == 90
    assert len(data["standings"]) == 10
    assert (env.data.parent / "calendario.ics").read_text().count("BEGIN:VEVENT") == 18
    assert data["team_cod"] == TEAM_COD
    assert data["updated_at"] == "2026-11-21T12:00:00+00:00"
    assert json.loads(env.status.read_text(encoding="utf-8")) == {
        "checked_at": "2026-11-21T12:00:00+00:00"
    }
    assert env.requested == [
        CALENDAR_PATH.format(group=GROUP_ID),
        TABLES_PATH.format(group=GROUP_ID),
    ]


def test_main_network_down_exits_1_and_leaves_files_untouched(env: Env) -> None:
    env.run(calendar())
    before = (env.data.read_bytes(), env.status.read_bytes())

    assert env.run(FetchError("down"), now=SECOND_RUN) == 1

    assert (env.data.read_bytes(), env.status.read_bytes()) == before


def test_main_network_down_on_first_run_writes_nothing(env: Env) -> None:
    assert env.run(FetchError("down")) == 1
    assert not env.data.exists()
    assert not env.status.exists()


def test_main_without_fenice_exits_1_and_writes_nothing(env: Env) -> None:
    payload = copy.deepcopy(calendar())
    payload["data"]["matches"] = [
        m
        for m in payload["data"]["matches"]
        if TEAM_COD not in (m["team1"]["cod_aff_societa"], m["team2"]["cod_aff_societa"])
    ]
    assert env.run(payload) == 1
    assert not env.data.exists()
    assert not env.status.exists()


def test_main_invalid_document_exits_1_and_writes_nothing(env: Env) -> None:
    payload = copy.deepcopy(calendar())
    payload["data"]["matches"][0]["day"] = "Giornata 99"
    assert env.run(payload) == 1
    assert not env.data.exists()
    assert not env.status.exists()


def test_main_second_run_keeps_data_but_refreshes_status(env: Env) -> None:
    env.run(calendar())
    os.utime(env.data, ns=(1_000_000_000, 1_000_000_000))
    before = env.data.read_bytes()

    assert env.run(calendar(), now=SECOND_RUN) == 0

    assert env.data.read_bytes() == before
    assert env.data.stat().st_mtime_ns == 1_000_000_000
    assert json.loads(env.status.read_text(encoding="utf-8")) == {
        "checked_at": "2026-11-21T16:00:00+00:00"
    }


def test_main_changed_game_rewrites_data(env: Env) -> None:
    env.run(calendar())
    payload = copy.deepcopy(calendar())
    target = payload["data"]["matches"][0]["id"]
    payload["data"]["matches"][0]["time"] = "20.30"

    assert env.run(payload, now=SECOND_RUN) == 0

    data = json.loads(env.data.read_text(encoding="utf-8"))
    game = next(g for g in data["games"] if g["id"] == target)
    assert game["time"] == "20:30"
    assert game["changes"] == ["time"]
    assert data["updated_at"] == "2026-11-21T16:00:00+00:00"


def test_main_standings_failure_preserves_files(env: Env) -> None:
    assert env.run(calendar()) == 0
    before = env.data.read_bytes(), env.status.read_bytes()

    def fetch(path: str) -> Any:
        if path == TABLES_PATH.format(group=GROUP_ID):
            raise FetchError("standings unavailable")
        return calendar()

    assert (
        main(fetch=fetch, now=lambda: SECOND_RUN, data_path=env.data, status_path=env.status) == 1
    )
    assert (env.data.read_bytes(), env.status.read_bytes()) == before


def test_main_missing_baseline_preserves_files(env: Env, monkeypatch: pytest.MonkeyPatch) -> None:
    assert env.run(calendar()) == 0
    before = env.data.read_bytes(), env.status.read_bytes()
    monkeypatch.setattr("fenice_calendar.cli.BASELINE_PATH", env.data.parent / "missing.json")
    assert env.run(calendar()) == 1
    assert (env.data.read_bytes(), env.status.read_bytes()) == before


def test_main_data_write_failure_preserves_calendar_and_status(
    env: Env, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert env.run(calendar()) == 0
    ics = env.data.parent / "calendario.ics"
    before = ics.read_bytes(), env.status.read_bytes()

    def fail_write(*args: Any, **kwargs: Any) -> bool:
        raise OSError("disk full")

    monkeypatch.setattr("fenice_calendar.cli.write_if_changed", fail_write)
    assert env.run(calendar(), now=SECOND_RUN) == 1
    assert (ics.read_bytes(), env.status.read_bytes()) == before
