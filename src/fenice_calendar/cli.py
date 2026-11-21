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
from fenice_calendar.fetch import FetchError, fetch_json
from fenice_calendar.ics import build_ics, write_ics_if_changed
from fenice_calendar.merge import compute_changes
from fenice_calendar.output import write_if_changed, write_status
from fenice_calendar.parse import ParseError, TeamNotFound, parse_document, parse_standings
from fenice_calendar.schema import validate_data

logger = logging.getLogger(__name__)

Fetch = Callable[[str], Any]


def _utc_now() -> datetime:
    return datetime.now(UTC)


def main(
    fetch: Fetch = fetch_json,
    now: Callable[[], datetime] = _utc_now,
    data_path: Path = OUTPUT_PATH,
    status_path: Path = STATUS_PATH,
) -> int:
    """Sync data.json and status.json; exit 1 without writing anything on any failure."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    checked_at = now()
    try:
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
        logger.error("Sync failed, files left untouched: %s", err)
        return 1
    errors = validate_data(document)
    if errors:
        logger.error("Generated data is invalid, files left untouched: %s", errors[:5])
        return 1
    calendar_ics = build_ics(document, checked_at)
    write_ics_if_changed(data_path.with_name("calendario.ics"), calendar_ics)
    changed = write_if_changed(path=data_path, data=dict(document))
    write_status(path=status_path, checked_at=checked_at.isoformat())
    logger.info("data.json %s", "updated" if changed else "unchanged")
    return 0
