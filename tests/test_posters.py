import json
from pathlib import Path
from typing import Any

import pytest

from fenice_calendar.fetch import FetchError
from fenice_calendar.posters import fetch_posters


def test_posters_accept_real_fixture_and_reject_invalid_keys() -> None:
    payload = json.loads((Path(__file__).parent / "fixtures" / "posters-19092.json").read_text())
    entry = payload["data"]["13012625"]
    for index, key in enumerate(
        [
            "../x.jpg",
            "http://x.jpg",
            "other/x.jpg",
            entry["key"][:-3] + "png",
            "public/locandine/images/19092/1/abc.jpg",
        ]
    ):
        payload["data"][str(index)] = {**entry, "key": key}
    payload["data"]["bad-size"] = {**entry, "width": 0}
    assert fetch_posters(lambda path: payload) == {
        "13012625": {
            "url": "https://data.fipavonline.it/" + entry["key"],
            "width": 620,
            "height": 877,
        }
    }


@pytest.mark.parametrize("payload", [None, {}, {"data": []}])
def test_posters_malformed_payload_fails(payload: Any) -> None:
    with pytest.raises(FetchError):
        fetch_posters(lambda path: payload)


def valid_entry() -> dict[str, Any]:
    payload = json.loads((Path(__file__).parent / "fixtures" / "posters-19092.json").read_text())
    entry: dict[str, Any] = payload["data"]["13012625"]
    return entry


@pytest.mark.parametrize(
    "bad",
    [
        {"height": 0},
        {"width": True},
        {"key": None},
        {"key": 5},
        None,
    ],
    ids=["height-zero", "width-bool", "key-none", "key-int", "entry-null"],
)
def test_posters_malformed_entry_is_dropped_and_valid_neighbours_stay(bad: Any) -> None:
    good = valid_entry()
    broken = None if bad is None else {**good, **bad}
    payload = {"data": {"1": good, "2": broken, "3": good}}

    result = fetch_posters(lambda path: payload)

    assert sorted(result) == ["1", "3"]
    assert result["1"]["width"] == good["width"]
