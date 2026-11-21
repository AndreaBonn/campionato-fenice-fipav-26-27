import json
import logging
import re
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fenice_calendar.config import (
    BASELINE_PATH,
    CALENDAR_PATH,
    GROUP_ID,
    OUTPUT_PATH,
    STATUS_PATH,
    TABLES_PATH,
)
from fenice_calendar.enrich import enrich
from fenice_calendar.fetch import FetchError, fetch_json
from fenice_calendar.ics import build_ics, ics_changed
from fenice_calendar.merge import compute_changes
from fenice_calendar.output import json_if_changed, status_json, write_all_atomic
from fenice_calendar.parse import ParseError, TeamNotFound, parse_document, parse_standings
from fenice_calendar.schema import Data, validate_data

logger = logging.getLogger(__name__)

Fetch = Callable[[str], Any]

FAILURE_DIR = Path("reports") / "sync-failure"
RUN_STAMP = "%Y%m%dT%H%M%SZ"
NON_SLUG = re.compile(r"[^A-Za-z0-9]+")
MAX_SLUG = 100


def _utc_now() -> datetime:
    return datetime.now(UTC)


def failure_dir_for(data_path: Path) -> Path:
    """Folder for the responses of a failed run: reports/ beside docs/, gitignored, unpublished."""
    return data_path.parent.parent / FAILURE_DIR


def _recording(fetch: Fetch, responses: dict[str, Any]) -> Fetch:
    def recorded(path: str) -> Any:
        payload = fetch(path)
        responses[path] = payload
        return payload

    return recorded


def _save_responses(responses: dict[str, Any], folder: Path) -> None:
    """Keep what FIPAV answered, in request order, so the failure can be replayed from a fixture."""
    if not responses:
        return
    try:
        folder.mkdir(parents=True, exist_ok=True)
        for index, (path, payload) in enumerate(responses.items(), start=1):
            slug = NON_SLUG.sub("-", path.removesuffix(".json")).strip("-")[:MAX_SLUG]
            text = json.dumps(payload, ensure_ascii=False, indent=2)
            (folder / f"{index:02d}-{slug}.json").write_text(text, encoding="utf-8")
    except OSError as err:
        logger.error("Could not save the FIPAV responses in %s: %s", folder, err)
        return
    logger.error("FIPAV responses of the failed run saved in %s", folder)


def _fetch_and_build(fetch: Fetch, checked_at: datetime, data_path: Path) -> tuple[Data, str]:
    calendar = fetch(CALENDAR_PATH.format(group=GROUP_ID))
    document = parse_document(calendar, generated_at=checked_at)
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    for game in document["games"]:
        game["changes"] = compute_changes(game, baseline)
    document["standings"] = parse_standings(fetch(TABLES_PATH.format(group=GROUP_ID)))
    if any(
        row["team_id"] not in {team["id"] for team in document["teams"]}
        for row in document["standings"]
    ):
        raise ParseError("Standings contain an unknown team")
    enrich(document, fetch, data_path)
    errors = validate_data(document)
    if errors:
        raise ValueError(f"Generated data is invalid: {errors[:5]}")
    return document, build_ics(document, checked_at)


def _write_outputs(document: Data, calendar_ics: str, data_path: Path, status_path: Path) -> None:
    files: list[tuple[Path, str]] = []
    data_json = json_if_changed(path=data_path, data=dict(document))
    if data_json is not None:
        files.append((data_path, data_json))
    ics_path = data_path.with_name("calendario.ics")
    if ics_changed(ics_path, calendar_ics):
        files.append((ics_path, calendar_ics))
    # last, so a run that stops between two renames does not look successful
    files.append((status_path, status_json(checked_at=document["updated_at"])))
    write_all_atomic(files)
    logger.info("data.json %s", "unchanged" if data_json is None else "updated")


def main(
    fetch: Fetch = fetch_json,
    now: Callable[[], datetime] = _utc_now,
    data_path: Path = OUTPUT_PATH,
    status_path: Path = STATUS_PATH,
) -> int:
    """Build all outputs before writing; return 1 if building or writing fails."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    checked_at = now()
    responses: dict[str, Any] = {}
    try:
        document, calendar_ics = _fetch_and_build(
            _recording(fetch, responses), checked_at, data_path
        )
        _write_outputs(document, calendar_ics, data_path, status_path)
    except (
        FetchError,
        TeamNotFound,
        ParseError,
        KeyError,
        ValueError,
        OSError,
        TypeError,
        IndexError,
    ) as err:
        logger.error("Sync failed: %s", err, exc_info=True)
        _save_responses(responses, failure_dir_for(data_path) / checked_at.strftime(RUN_STAMP))
        return 1
    return 0
