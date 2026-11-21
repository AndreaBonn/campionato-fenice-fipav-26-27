import json
import logging
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
from fenice_calendar.ics import build_ics, write_ics_if_changed
from fenice_calendar.merge import compute_changes
from fenice_calendar.output import write_if_changed, write_status
from fenice_calendar.parse import ParseError, TeamNotFound, parse_document, parse_standings
from fenice_calendar.schema import Data, validate_data

logger = logging.getLogger(__name__)

Fetch = Callable[[str], Any]


def _utc_now() -> datetime:
    return datetime.now(UTC)


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
    changed = write_if_changed(path=data_path, data=dict(document))
    write_ics_if_changed(data_path.with_name("calendario.ics"), calendar_ics)
    write_status(path=status_path, checked_at=document["updated_at"])
    logger.info("data.json %s", "updated" if changed else "unchanged")


def main(
    fetch: Fetch = fetch_json,
    now: Callable[[], datetime] = _utc_now,
    data_path: Path = OUTPUT_PATH,
    status_path: Path = STATUS_PATH,
) -> int:
    """Build all outputs before writing; return 1 if building or writing fails."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    checked_at = now()
    try:
        document, calendar_ics = _fetch_and_build(fetch, checked_at, data_path)
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
        return 1
    return 0
