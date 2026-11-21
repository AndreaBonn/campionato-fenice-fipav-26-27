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
    old_search = fixture("wp-search.json")
    old_indizioni = fixture("wp-indizioni.json")

    assert select_notices(search_posts=old_search, indizione_posts=old_indizioni) == []
    # the same payloads do yield a notice as soon as a recent post sits next to the old ones
    recent = select_notices(
        search_posts=old_search + [post(900, "Recent notice")], indizione_posts=old_indizioni
    )
    assert [(n["id"], n["title"]) for n in recent] == [(900, "Recent notice")]


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


def with_link(number: int, link: str) -> dict[str, Any]:
    return {**post(number, "Notizia"), "link": link}


def test_selection_keeps_only_https_links_on_the_committee_site() -> None:
    posts = [
        with_link(1, "https://www.fipavcagliari.it/news/uno/"),
        with_link(2, "http://fipavcagliari.it/news/due/"),
        with_link(3, "https://fipavcagliari.it"),
        with_link(4, "fipavcagliari.it/news/quattro/"),
    ]

    result = select_notices(search_posts=posts, indizione_posts=[])

    assert [(n["id"], n["url"]) for n in result] == [(1, "https://www.fipavcagliari.it/news/uno/")]


@pytest.mark.parametrize(
    "title",
    [
        "Indizione Campionati Under 14",
        "Indizione Campionati di Serie D",
        "Indizione Coppa Italia",
        "Indizione Beach Volley",
        "Indizione Kit abbigliamento",
        "Indizione Volley S3",
        "Indizione Prima Divisione",
        "Indizione Terza Divisione",
    ],
)
def test_selection_drops_indizioni_naming_another_competition(title: str) -> None:
    result = select_notices(
        search_posts=[],
        indizione_posts=[post(1, title), post(2, "Indizione Seconda Divisione 2026/27")],
    )

    assert [(n["id"], n["kind"]) for n in result] == [(2, "indizione")]


@pytest.mark.parametrize(
    "title",
    [
        "Coppa Seconda Divisione",
        "Indizione Under 16 e Seconda Divisione",
        "Indizione 2ª Divisione e Serie D",
    ],
)
def test_selection_keeps_indizioni_that_also_name_the_second_division(title: str) -> None:
    unrelated = post(2, "Indizione Serie D")

    result = select_notices(search_posts=[], indizione_posts=[post(1, title), unrelated])

    assert [n["id"] for n in result] == [1]


def test_fetch_notices_non_integer_post_id_fails() -> None:
    bad = {**post(1, "Notizia"), "id": "7"}

    with pytest.raises(FetchError):
        fetch_notices(lambda url: [bad])


@pytest.mark.parametrize("failing", ["search", "categories"])
def test_fetch_notices_non_list_payload_fails(failing: str) -> None:
    error_payload = {"code": "rest_no_route", "message": "No route", "data": {"status": 404}}

    def fetch(url: str) -> Any:
        return error_payload if failing + "=" in url else [post(1, "Notizia")]

    with pytest.raises(FetchError):
        fetch_notices(fetch)
