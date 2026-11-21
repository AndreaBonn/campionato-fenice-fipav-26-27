import json
from pathlib import Path
from typing import Any

import pytest

from fenice_calendar.fetch import FetchError
from fenice_calendar.notices import fetch_notices, select_notices

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text())


def post(number: int, title: str, date: str = "2026-08-01") -> dict[str, Any]:
    return {
        "id": number,
        "date": date,
        "link": "https://fipavcagliari.it/news/",
        "title": {"rendered": title},
        "categories": [3],
    }


def test_real_fixtures_are_old() -> None:
    assert (
        select_notices(
            search_posts=fixture("wp-search.json"), indizione_posts=fixture("wp-indizioni.json")
        )
        == []
    )


def test_selection_cleans_filters_deduplicates_and_sorts() -> None:
    search = [
        post(1, " <b>Novità &#8211;  gara</b> "),
        post(2, "Old", "2026-07-31"),
        post(3, "Latest", "2026-08-02"),
    ]
    indizioni = [
        post(1, "duplicate"),
        post(4, "Bando Campionati di Divisione 2019-2020"),
        post(5, "Bando Campionati Under 13"),
        post(6, "INDIZIONE CAMPIONATI DI SERIE"),
        post(7, "Indizione 2ª Divisione Femminile"),
    ]
    result = select_notices(search_posts=search, indizione_posts=indizioni)
    assert [(p["id"], p["title"], p["kind"]) for p in result] == [
        (3, "Latest", "seconda-divisione"),
        (7, "Indizione 2ª Divisione Femminile", "indizione"),
        (4, "Bando Campionati di Divisione 2019-2020", "indizione"),
        (1, "Novità – gara", "seconda-divisione"),
    ]


def test_selection_caps_and_rejects_other_domains() -> None:
    posts = [post(i, str(i)) for i in range(12)]
    invalid = post(99, "unsafe")
    invalid["link"] = "https://fipavcagliari.it.evil.test/"
    assert [
        p["id"] for p in select_notices(search_posts=posts + [invalid], indizione_posts=[])
    ] == list(range(11, 1, -1))


def test_fetch_requests_both_sources_and_fails_as_a_unit() -> None:
    urls: list[str] = []

    def fetch(url: str) -> Any:
        urls.append(url)
        return [post(1, "Notizia")]

    assert fetch_notices(fetch)[0]["title"] == "Notizia"
    assert urls == [
        "https://fipavcagliari.it/wp-json/wp/v2/posts?search=seconda%20divisione&per_page=20&_fields=id,date,link,title,categories",
        "https://fipavcagliari.it/wp-json/wp/v2/posts?categories=3&per_page=20&_fields=id,date,link,title,categories",
    ]

    def broken(url: str) -> Any:
        if "categories=" in url:
            raise FetchError("down")
        return [post(1, "Notizia")]

    with pytest.raises(FetchError):
        fetch_notices(broken)
