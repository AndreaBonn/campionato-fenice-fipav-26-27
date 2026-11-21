import json
from pathlib import Path
from typing import Any

from fenice_calendar.config import WP_CATEGORY_COMUNICATI, WP_CATEGORY_INDIZIONI, WP_CATEGORY_NEWS

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> list[dict[str, Any]]:
    loaded: list[dict[str, Any]] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return loaded


def test_wp_categories_ids_match_config_constants() -> None:
    names = {c["id"]: c["name"] for c in load("wp-categories.json")}
    assert len(names) == 6
    assert names[WP_CATEGORY_INDIZIONI] == "Indizioni Campionati"
    assert names[WP_CATEGORY_COMUNICATI] == "Comunicati FIPAV"
    assert names[WP_CATEGORY_NEWS] == "News Stagioni"


def test_wp_search_fixture_has_five_posts_with_required_fields() -> None:
    posts = load("wp-search.json")
    assert len(posts) == 5
    for post in posts:
        assert {"id", "date", "link", "title", "categories"} <= post.keys()
        assert post["title"]["rendered"]
        assert post["link"].startswith("https://fipavcagliari.it/")


def test_wp_indizioni_fixture_has_twenty_posts_all_in_category() -> None:
    posts = load("wp-indizioni.json")
    assert len(posts) == 20
    assert all(post["categories"] == [WP_CATEGORY_INDIZIONI] for post in posts)
