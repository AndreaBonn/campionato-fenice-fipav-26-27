import copy
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from fenice_calendar.cli import failure_dir_for, main
from fenice_calendar.config import (
    CALENDAR_PATH,
    COMMITTEE_CODE,
    GROUP_ID,
    OUTPUT_PATH,
    POSTERS_PATH,
    TABLES_PATH,
    TEAM_COD,
    WP_POSTS_URL,
)
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
        self.overrides: dict[str, Any] = {}

    def run(self, payload: Any, now: datetime = FIRST_RUN) -> int:
        def fetch(path: str) -> Any:
            self.requested.append(path)
            if isinstance(payload, Exception):
                raise payload
            if path in self.overrides:
                result = self.overrides[path]
                if isinstance(result, Exception):
                    raise result
                return result
            if path.startswith(WP_POSTS_URL):
                name = "wp-indizioni.json" if "categories=" in path else "wp-search.json"
                return json.loads((FIXTURES / name).read_text())
            if path == POSTERS_PATH.format(committee=COMMITTEE_CODE):
                return json.loads((FIXTURES / "posters-19092.json").read_text())
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
        WP_POSTS_URL
        + "?search=seconda%20divisione&per_page=20&_fields=id,date,link,title,categories",
        WP_POSTS_URL + "?categories=3&per_page=20&_fields=id,date,link,title,categories",
        POSTERS_PATH.format(committee=COMMITTEE_CODE),
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

    def fail_write(*args: Any, **kwargs: Any) -> str:
        raise OSError("disk full")

    monkeypatch.setattr("fenice_calendar.cli.json_if_changed", fail_write)
    assert env.run(calendar(), now=SECOND_RUN) == 1
    assert (ics.read_bytes(), env.status.read_bytes()) == before


def test_extra_sources_outage_preserves_previous_values(env: Env) -> None:
    assert env.run(calendar()) == 0
    data = json.loads(env.data.read_text())
    notices = [
        {
            "id": i,
            "title": f"Notice {i}",
            "url": "https://fipavcagliari.it/",
            "date": "2026-08-01",
            "kind": "indizione",
        }
        for i in (1, 2)
    ]
    poster = {"url": "https://data.fipavonline.it/example.jpg", "width": 620, "height": 877}
    data["notices"] = notices
    data["games"][0]["poster"] = poster
    env.data.write_text(json.dumps(data))
    env.overrides[
        WP_POSTS_URL
        + "?search=seconda%20divisione&per_page=20&_fields=id,date,link,title,categories"
    ] = FetchError("down")
    env.overrides[POSTERS_PATH.format(committee=COMMITTEE_CODE)] = FetchError("down")
    assert env.run(calendar(), now=SECOND_RUN) == 0
    result = json.loads(env.data.read_text())
    assert result["notices"] == notices
    assert result["games"][0]["poster"] == poster


def test_first_run_outage_and_recent_notices_and_poster(env: Env) -> None:
    search_url = (
        WP_POSTS_URL
        + "?search=seconda%20divisione&per_page=20&_fields=id,date,link,title,categories"
    )
    poster_path = POSTERS_PATH.format(committee=COMMITTEE_CODE)
    env.overrides[search_url] = FetchError("down")
    env.overrides[poster_path] = FetchError("down")
    assert env.run(calendar()) == 0
    data = json.loads(env.data.read_text())
    assert data["notices"] == []
    assert all(game["poster"] is None for game in data["games"])
    posts = json.loads((FIXTURES / "wp-search.json").read_text())[:1]
    posts[0]["date"] = "2026-08-01T12:00:00"
    posts[0]["title"]["rendered"] = "<b>Notizie &#8211; gara</b>"
    env.overrides[search_url] = posts
    payload = json.loads((FIXTURES / "posters-19092.json").read_text())
    entry = payload["data"].pop("13012625")
    target = data["games"][0]["id"]
    payload["data"][target] = entry
    env.overrides[poster_path] = payload
    assert env.run(calendar(), now=SECOND_RUN) == 0
    data = json.loads(env.data.read_text())
    assert data["notices"][0]["title"] == "Notizie – gara"
    assert validate_data(data) == []
    assert [(game["id"], game["poster"]) for game in data["games"] if game["poster"]] == [
        (
            target,
            {"url": "https://data.fipavonline.it/" + entry["key"], "width": 620, "height": 877},
        )
    ]


def test_posters_outage_tolerates_previous_games_without_poster(env: Env) -> None:
    assert env.run(calendar()) == 0
    data = json.loads(env.data.read_text())
    for game in data["games"]:
        del game["poster"]
    env.data.write_text(json.dumps(data))
    env.overrides[POSTERS_PATH.format(committee=COMMITTEE_CODE)] = FetchError("down")
    assert env.run(calendar(), now=SECOND_RUN) == 0
    result = json.loads(env.data.read_text())
    assert all(game["poster"] is None for game in result["games"])


def test_utc_now_returns_utc_aware_datetime() -> None:
    from fenice_calendar.cli import _utc_now

    assert _utc_now().tzinfo is UTC


def test_main_corrupt_previous_data_and_outage_uses_empty_enrichments(env: Env) -> None:
    search_url = (
        WP_POSTS_URL
        + "?search=seconda%20divisione&per_page=20&_fields=id,date,link,title,categories"
    )
    posts = json.loads((FIXTURES / "wp-search.json").read_text())[:1]
    posts[0]["date"] = "2026-08-01T12:00:00"
    env.overrides[search_url] = posts
    assert env.run(calendar()) == 0
    previous = json.loads(env.data.read_text())
    assert previous["notices"]
    env.data.write_text("not json")
    env.overrides[search_url] = FetchError("down")
    env.overrides[POSTERS_PATH.format(committee=COMMITTEE_CODE)] = FetchError("down")

    assert env.run(calendar(), now=SECOND_RUN) == 0
    result = json.loads(env.data.read_text())
    assert result["notices"] == []
    assert len(result["games"]) == 90
    assert all(game["poster"] is None for game in result["games"])


def fenice_game_moved() -> dict[str, Any]:
    """The calendar with one Fenice game moved to 20:30, so data.json and the ICS both change."""
    payload = copy.deepcopy(calendar())
    match = next(
        m
        for m in payload["data"]["matches"]
        if TEAM_COD in (m["team1"]["cod_aff_societa"], m["team2"]["cod_aff_societa"])
    )
    match["time"] = "20.30"
    return payload


def test_main_status_write_failure_leaves_data_and_calendar_unchanged(env: Env) -> None:
    assert env.run(calendar()) == 0
    ics = env.data.parent / "calendario.ics"
    before = env.data.read_bytes(), ics.read_bytes()
    payload = fenice_game_moved()
    blocker = env.data.parent / "blocked"
    blocker.write_text("a file where a directory is expected")
    env.status = blocker / "status.json"

    assert env.run(payload, now=SECOND_RUN) == 1

    assert (env.data.read_bytes(), ics.read_bytes()) == before
    assert sorted(p.name for p in env.data.parent.iterdir()) == [
        "blocked",
        "calendario.ics",
        "data.json",
        "status.json",
    ]


def test_main_changed_game_rewrites_data_calendar_and_status_together(env: Env) -> None:
    assert env.run(calendar()) == 0
    ics = env.data.parent / "calendario.ics"
    before = env.data.read_bytes(), ics.read_bytes(), env.status.read_bytes()
    payload = fenice_game_moved()

    assert env.run(payload, now=SECOND_RUN) == 0

    after = env.data.read_bytes(), ics.read_bytes(), env.status.read_bytes()
    assert all(old != new for old, new in zip(before, after, strict=True))
    assert not list(env.data.parent.glob("*.tmp"))


def test_main_standings_with_an_unknown_team_exits_1_and_says_why(
    env: Env, caplog: pytest.LogCaptureFixture
) -> None:
    env.overrides[TABLES_PATH.format(group=GROUP_ID)] = json.loads(
        (FIXTURES / "standings-64353.json").read_text()
    )

    assert env.run(calendar()) == 1

    assert not env.data.exists()
    assert not env.status.exists()
    assert "Sync failed: Standings contain an unknown team" in caplog.text


@pytest.mark.parametrize(
    "broken",
    ["round_label", "calendar_without_data", "empty_standings"],
)
def test_main_malformed_fipav_answer_exits_1_and_writes_nothing(env: Env, broken: str) -> None:
    # ParseError, KeyError and IndexError: each is a failure the run reports, never a traceback
    payload: Any = copy.deepcopy(calendar())
    if broken == "round_label":
        payload["data"]["matches"][0]["day"] = "Andata 3"
    elif broken == "calendar_without_data":
        payload = {}
    else:
        env.overrides[TABLES_PATH.format(group=GROUP_ID)] = []

    assert env.run(payload) == 1

    assert not env.data.exists()
    assert not env.status.exists()


def test_main_previous_data_that_is_not_an_object_is_ignored_on_outage(env: Env) -> None:
    env.data.parent.mkdir(parents=True)
    env.data.write_text("[]")
    env.overrides[
        WP_POSTS_URL
        + "?search=seconda%20divisione&per_page=20&_fields=id,date,link,title,categories"
    ] = FetchError("down")
    env.overrides[POSTERS_PATH.format(committee=COMMITTEE_CODE)] = FetchError("down")

    assert env.run(calendar()) == 0

    result = json.loads(env.data.read_text())
    assert result["notices"] == []
    assert all(game["poster"] is None for game in result["games"])


def test_main_moved_venue_is_recorded_as_a_change(env: Env) -> None:
    payload = copy.deepcopy(calendar())
    match = payload["data"]["matches"][0]
    match["stadium"] = "PALESTRA NUOVA - VIA ROMA 1 - CAGLIARI"

    assert env.run(payload) == 0

    data = json.loads(env.data.read_text())
    moved = next(game for game in data["games"] if game["id"] == str(match["id"]))
    assert moved["changes"] == ["venue"]
    assert sum(1 for game in data["games"] if game["changes"]) == 1


def test_season_baseline_has_every_game_of_the_girone_with_the_compared_fields() -> None:
    baseline = json.loads(
        (Path(__file__).parent.parent / "data" / "calendario-iniziale.json").read_text()
    )
    games = parse_document(calendar(), generated_at=FIRST_RUN)["games"]

    assert set(baseline) == {game["id"] for game in games}
    assert all(set(entry) == {"date", "time", "venue_raw"} for entry in baseline.values())


# A failed run keeps the FIPAV answers it read: a new response shape can go in tests/fixtures/
FAILED_RUN_DIR = "reports/sync-failure/20261121T120000Z"


def saved_responses(env: Env) -> dict[str, Any]:
    folder = env.data.parent.parent / FAILED_RUN_DIR
    return {p.name: json.loads(p.read_text(encoding="utf-8")) for p in sorted(folder.iterdir())}


def test_main_failed_build_saves_every_response_it_read(env: Env) -> None:
    payload = copy.deepcopy(calendar())
    payload["data"]["matches"][0]["day"] = "Giornata 99"

    assert env.run(payload) == 1

    saved = saved_responses(env)
    assert [name[:22] for name in saved] == [
        "01-api-v2-calendar-0-6",
        "02-api-v2-tables-64444",
        "03-https-fipavcagliari",
        "04-https-fipavcagliari",
        "05-public-locandine-19",
    ]
    assert "05-public-locandine-19092.json" in saved
    assert saved["01-api-v2-calendar-0-64444.json"] == payload


def test_main_bad_standings_saves_calendar_and_standings_in_request_order(env: Env) -> None:
    env.overrides[TABLES_PATH.format(group=GROUP_ID)] = json.loads(
        (FIXTURES / "standings-64353.json").read_text()
    )

    assert env.run(calendar()) == 1

    assert list(saved_responses(env)) == [
        "01-api-v2-calendar-0-64444.json",
        "02-api-v2-tables-64444.json",
    ]


def test_main_success_saves_no_responses(env: Env) -> None:
    assert env.run(calendar()) == 0
    assert not (env.data.parent.parent / "reports").exists()


def test_main_network_down_before_any_answer_saves_nothing(env: Env) -> None:
    assert env.run(FetchError("down")) == 1
    assert not (env.data.parent.parent / "reports").exists()


def test_main_unwritable_reports_folder_still_exits_1_and_says_so(
    env: Env, caplog: pytest.LogCaptureFixture
) -> None:
    env.data.parent.parent.joinpath("reports").write_text("a file where a directory is expected")
    payload = copy.deepcopy(calendar())
    payload["data"]["matches"][0]["day"] = "Giornata 99"

    assert env.run(payload) == 1

    assert "Could not save the FIPAV responses" in caplog.text
    assert "FIPAV responses of the failed run saved in" not in caplog.text


def test_failed_run_responses_land_in_the_gitignored_reports_folder() -> None:
    root = Path(__file__).resolve().parents[1]
    assert failure_dir_for(OUTPUT_PATH) == root / "reports" / "sync-failure"
    assert "reports/" in (root / ".gitignore").read_text().splitlines()


@pytest.mark.parametrize("broken", ["data_is_null", "matches_is_null"])
def test_main_calendar_of_the_wrong_shape_exits_1_and_writes_nothing(
    env: Env, broken: str, caplog: pytest.LogCaptureFixture
) -> None:
    # parse_document raises TypeError on these: a failure the run reports, never a traceback
    payload = copy.deepcopy(calendar())
    if broken == "data_is_null":
        payload["data"] = None
    else:
        payload["data"]["matches"] = None

    assert env.run(payload) == 1

    failure = next(r for r in caplog.records if r.getMessage().startswith("Sync failed"))
    assert failure.exc_info is not None and failure.exc_info[0] is TypeError
    assert not env.data.exists()
    assert not env.status.exists()
    assert not (env.data.parent / "calendario.ics").exists()


def test_main_posters_outage_ignores_malformed_previous_games(env: Env) -> None:
    assert env.run(calendar()) == 0
    previous = json.loads(env.data.read_text())
    poster = {"url": "https://data.fipavonline.it/example.jpg", "width": 620, "height": 877}
    previous["games"][0]["poster"] = poster
    previous["games"] = [5, {}, *previous["games"]]
    env.data.write_text(json.dumps(previous))
    env.overrides[POSTERS_PATH.format(committee=COMMITTEE_CODE)] = FetchError("down")

    assert env.run(calendar(), now=SECOND_RUN) == 0

    result = json.loads(env.data.read_text())
    assert result["games"][0]["poster"] == poster


def test_main_saved_responses_are_logged_with_their_folder(
    env: Env, caplog: pytest.LogCaptureFixture
) -> None:
    payload = copy.deepcopy(calendar())
    payload["data"]["matches"][0]["day"] = "Giornata 99"

    assert env.run(payload) == 1

    assert "FIPAV responses of the failed run saved in" in caplog.text
    assert "Could not save the FIPAV responses" not in caplog.text


def test_main_failed_run_cuts_the_file_name_slug_at_100_characters(env: Env) -> None:
    payload = copy.deepcopy(calendar())
    payload["data"]["matches"][0]["day"] = "Giornata 99"

    assert env.run(payload) == 1

    # the committee search URL, non-alphanumeric runs turned into "-", cut after 100 characters
    assert "03-" + (
        "https-fipavcagliari-it-wp-json-wp-v2-posts-search-seconda-20divisione"
        "-per-page-20-fields-id-date-lin"
    ) + ".json" in saved_responses(env)


def test_utc_now_is_the_current_time() -> None:
    from fenice_calendar.cli import _utc_now

    before = datetime.now(UTC)
    now = _utc_now()
    after = datetime.now(UTC)

    assert before <= now <= after
    # the failure folder stamp ends in "Z": the clock must be UTC, not just the right instant
    assert now.tzinfo is UTC
