import json
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fenice_calendar.fetch import FetchError
from fenice_calendar.notices import fetch_notices
from fenice_calendar.posters import fetch_posters
from fenice_calendar.schema import Data

logger = logging.getLogger(__name__)


def _previous_data(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError, TypeError, KeyError):
        return {}


def enrich(document: Data, fetch: Callable[[str], Any], path: Path) -> None:
    previous = _previous_data(path)
    try:
        document["notices"] = fetch_notices(fetch)
    except FetchError as err:
        logger.warning("Notices unavailable: %s", err)
        document["notices"] = previous.get("notices", [])
    try:
        posters = fetch_posters(fetch)
    except FetchError as err:
        logger.warning("Posters unavailable: %s", err)
        posters = {game["id"]: game["poster"] for game in previous.get("games", [])}
    for game in document["games"]:
        game["poster"] = posters.get(game["id"])
