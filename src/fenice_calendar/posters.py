import re
from collections.abc import Callable
from typing import Any

from fenice_calendar.config import COMMITTEE_CODE, POSTER_BASE, POSTER_KEY_RE, POSTERS_PATH
from fenice_calendar.fetch import FetchError
from fenice_calendar.schema import Poster


def fetch_posters(fetch: Callable[[str], Any]) -> dict[str, Poster]:
    payload = fetch(POSTERS_PATH.format(committee=COMMITTEE_CODE))
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise FetchError("Invalid posters payload")
    posters: dict[str, Poster] = {}
    for game_id, entry in payload["data"].items():
        if not isinstance(game_id, str) or not isinstance(entry, dict):
            continue
        key, width, height = entry.get("key"), entry.get("width"), entry.get("height")
        if not isinstance(key, str) or not re.fullmatch(POSTER_KEY_RE, key):
            continue
        if type(width) is not int or type(height) is not int or width <= 0 or height <= 0:
            continue
        posters[game_id] = {"url": POSTER_BASE + key, "width": width, "height": height}
    return posters
