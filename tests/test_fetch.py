import io
import json
from email.message import Message
from urllib.error import HTTPError
from urllib.request import Request

import pytest

from fenice_calendar.config import FALLBACK_URL, PRIMARY_URL, REQUEST_TIMEOUT_S, USER_AGENT
from fenice_calendar.fetch import FetchError, fetch_json


class Response(io.BytesIO):
    def __init__(self, body: bytes, content_type: str) -> None:
        super().__init__(body)
        self.headers = Message()
        self.headers["Content-Type"] = content_type


def test_primary_success_and_headers() -> None:
    requests: list[tuple[Request, int]] = []

    def opener(request: Request, timeout: int) -> Response:
        requests.append((request, timeout))
        return Response(b'{"data": 42}', "application/json")

    assert fetch_json("/test", opener=opener, delay=0) == {"data": 42}
    assert len(requests) == 1
    assert requests[0][0].full_url == PRIMARY_URL + "/test"
    assert requests[0][0].get_header("User-agent") == USER_AGENT
    assert requests[0][1] == REQUEST_TIMEOUT_S


def test_primary_error_uses_fallback() -> None:
    urls: list[str] = []

    def opener(request: Request, timeout: int) -> Response:
        urls.append(request.full_url)
        if len(urls) == 1:
            raise HTTPError(request.full_url, 503, "unavailable", Message(), None)
        return Response(b"[1, 2]", "application/json")

    assert fetch_json("/test", opener=opener, delay=0) == [1, 2]
    assert urls == [PRIMARY_URL + "/test", FALLBACK_URL + "/test"]


def test_html_from_both_sources_raises() -> None:
    urls: list[str] = []

    def opener(request: Request, timeout: int) -> Response:
        urls.append(request.full_url)
        return Response(b"<html>challenge</html>", "text/html")

    with pytest.raises(FetchError):
        fetch_json("/test", opener=opener, delay=0)
    assert urls == [PRIMARY_URL + "/test", FALLBACK_URL + "/test"]


def test_invalid_json_uses_fallback() -> None:
    calls: list[str] = []

    def opener(request: Request, timeout: int) -> Response:
        calls.append(request.full_url)
        return Response(
            b"invalid" if len(calls) == 1 else json.dumps({"ok": True}).encode(), "application/json"
        )

    assert fetch_json("/test", opener=opener, delay=0) == {"ok": True}
    assert len(calls) == 2


@pytest.mark.parametrize("both_fail", [False, True])
def test_incomplete_http_read_uses_fallback_or_raises(both_fail: bool) -> None:
    from http.client import IncompleteRead

    urls: list[str] = []

    def opener(request: Request, timeout: int) -> Response:
        urls.append(request.full_url)
        if len(urls) == 1 or both_fail:
            raise IncompleteRead(b"partial")
        return Response(b'{"ok": true}', "application/json")

    if both_fail:
        with pytest.raises(FetchError):
            fetch_json("/test", opener=opener, delay=0)
    else:
        assert fetch_json("/test", opener=opener, delay=0) == {"ok": True}
    assert urls == [PRIMARY_URL + "/test", FALLBACK_URL + "/test"]


def test_absolute_url_single_request_and_failure() -> None:
    requests: list[str] = []

    def opener(request: Request, timeout: int) -> Response:
        requests.append(request.full_url)
        return Response(b'{"ok": true}', "application/json")

    url = "https://fipavcagliari.it/test"
    assert fetch_json(url, opener=opener, delay=0) == {"ok": True}
    assert requests == [url]

    def broken(request: Request, timeout: int) -> Response:
        requests.append(request.full_url)
        return Response(b"bad", "text/html")

    with pytest.raises(FetchError):
        fetch_json(url, opener=broken, delay=0)
    assert requests == [url, url]
