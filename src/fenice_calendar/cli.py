import logging
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fenice_calendar.config import CALENDAR_PATH, GROUP_ID, OUTPUT_PATH, STATUS_PATH
from fenice_calendar.fetch import FetchError, fetch_json
from fenice_calendar.output import write_if_changed, write_status
from fenice_calendar.parse import ParseError, TeamNotFound, parse_document
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
    except (FetchError, TeamNotFound, ParseError, KeyError, ValueError) as err:
        logger.error("Sync failed, files left untouched: %s", err)
        return 1
    errors = validate_data(document)
    if errors:
        logger.error("Generated data is invalid, files left untouched: %s", errors[:5])
        return 1
    changed = write_if_changed(path=data_path, data=dict(document))
    write_status(path=status_path, checked_at=checked_at.isoformat())
    logger.info("data.json %s", "updated" if changed else "unchanged")
    return 0
