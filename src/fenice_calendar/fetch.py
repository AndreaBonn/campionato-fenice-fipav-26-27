import json
import logging
import time
from collections.abc import Callable
from http.client import HTTPException
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from fenice_calendar.config import (
    FALLBACK_URL,
    PRIMARY_URL,
    REQUEST_DELAY_S,
    REQUEST_TIMEOUT_S,
    USER_AGENT,
)

JSON_CONTENT_TYPE = "application/json"
logger = logging.getLogger(__name__)
_last_request = 0.0


Opener = Callable[..., Any]


class FetchError(Exception):
    pass


def _request_json(url: str, opener: Opener, delay: float) -> Any:
    global _last_request
    remaining = delay - (time.monotonic() - _last_request)
    if remaining > 0:
        time.sleep(remaining)
    _last_request = time.monotonic()
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with opener(request, timeout=REQUEST_TIMEOUT_S) as response:
        if response.headers.get_content_type() != JSON_CONTENT_TYPE:
            raise ValueError("Response is not JSON")
        return json.loads(response.read())


def fetch_json(path: str, opener: Opener = urlopen, delay: float = REQUEST_DELAY_S) -> Any:
    last_error: Exception | None = None
    urls = (
        (path,)
        if path.startswith("https://")
        else tuple(base_url + path for base_url in (PRIMARY_URL, FALLBACK_URL))
    )
    for url in urls:
        try:
            return _request_json(url, opener, delay)
        except (URLError, OSError, ValueError, HTTPException) as err:
            logger.warning("Could not fetch JSON from %s: %s", url, err)
            last_error = err
    raise FetchError(f"Could not fetch JSON from either source: {path}") from last_error
