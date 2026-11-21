import html
import re
from collections.abc import Callable
from typing import Any
from urllib.parse import quote, urlsplit

from fenice_calendar.config import (
    NOTICES_MAX,
    NOTICES_SINCE,
    WP_CATEGORY_INDIZIONI,
    WP_FIELDS,
    WP_PER_PAGE,
    WP_POSTS_URL,
    WP_SEARCH_TERM,
)
from fenice_calendar.fetch import FetchError
from fenice_calendar.schema import Notice, NoticeKind

SECOND_DIVISION = re.compile(r"\b(?:seconda|2[ªa°])\s+divisione\b", re.IGNORECASE)
OTHER_COMPETITION = re.compile(
    r"\b(?:under|serie|coppa|beach|kit)\b|\bvolley\s+s3\b"
    r"|\b(?:prima|terza|[13][ªa°])\s+divisione\b",
    re.IGNORECASE,
)
HTML_TAG = re.compile(r"<[^>]*>")
ALLOWED_HOSTS = {"fipavcagliari.it", "www.fipavcagliari.it"}


def _is_division_indizione(title: str) -> bool:
    """Keep second-division or general notices, excluding other named competitions."""
    normalized = title.casefold()
    return bool(SECOND_DIVISION.search(normalized) or not OTHER_COMPETITION.search(normalized))


def _notice(post: Any, kind: NoticeKind) -> Notice | None:
    title = " ".join(HTML_TAG.sub("", html.unescape(post["title"]["rendered"])).split())
    url = post["link"]
    parsed = urlsplit(url)
    date = post["date"][:10]
    if (
        parsed.scheme != "https"
        or parsed.netloc not in ALLOWED_HOSTS
        or not parsed.path.startswith("/")
        or date < NOTICES_SINCE
    ):
        return None
    if kind == "indizione" and not _is_division_indizione(title):
        return None
    if type(post["id"]) is not int:
        raise TypeError("Invalid notice ID")
    return {"id": post["id"], "title": title, "url": url, "date": date, "kind": kind}


def select_notices(*, search_posts: list[Any], indizione_posts: list[Any]) -> list[Notice]:
    selected: dict[int, Notice] = {}
    sources: tuple[tuple[list[Any], NoticeKind], ...] = (
        (search_posts, "seconda-divisione"),
        (indizione_posts, "indizione"),
    )
    for posts, kind in sources:
        if not isinstance(posts, list):
            raise TypeError("Invalid notices payload")
        for post in posts:
            notice = _notice(post, kind)
            if notice is not None:
                selected.setdefault(notice["id"], notice)
    return sorted(selected.values(), key=lambda item: (item["date"], item["id"]), reverse=True)[
        :NOTICES_MAX
    ]


def fetch_notices(fetch: Callable[[str], Any]) -> list[Notice]:
    common = f"per_page={WP_PER_PAGE}&_fields={WP_FIELDS}"
    try:
        search = fetch(f"{WP_POSTS_URL}?search={quote(WP_SEARCH_TERM)}&{common}")
        indizioni = fetch(f"{WP_POSTS_URL}?categories={WP_CATEGORY_INDIZIONI}&{common}")
        return select_notices(search_posts=search, indizione_posts=indizioni)
    except (FetchError, ValueError, KeyError, TypeError) as err:
        raise FetchError("Could not fetch notices") from err
