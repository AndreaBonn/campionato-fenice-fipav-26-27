from pathlib import Path

PRIMARY_URL = "https://data.fipavonline.it"
FALLBACK_URL = "https://app.fipavonline.it"
CALENDAR_PATH = "/api/v2/calendar/0/{group}"
TABLES_PATH = "/api/v2/tables/{group}"
POSTERS_PATH = "/public/locandine/{committee}.json"
GROUP_ID = "64444"
TEAM_COD = "190920448"
COMMITTEE_CODE = "19092"
SEASON = "2026/27"
USER_AGENT = (
    "campionato-fenice-fipav-26-27 calendar sync "
    "(personal project; https://github.com/AndreaBonn/campionato-fenice-fipav-26-27)"
)
REQUEST_TIMEOUT_S = 30
REQUEST_DELAY_S = 1.0
PAGE_URL = "https://andreabonn.github.io/campionato-fenice-fipav-26-27/"
SOURCE = {"name": "FIPAV Online", "url": "https://www.fipavonline.it"}
FORMULA = {"published": False, "promotion": 0, "playoff": 0, "relegation": 0}
TIE_BREAK = {"criteria": ["wins", "set_ratio", "point_ratio"], "provisional": True}
ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "docs" / "data.json"
STATUS_PATH = ROOT / "docs" / "status.json"
BASELINE_PATH = ROOT / "data" / "calendario-iniziale.json"

WP_POSTS_URL = "https://fipavcagliari.it/wp-json/wp/v2/posts"
WP_CATEGORY_INDIZIONI = 3
WP_CATEGORY_COMUNICATI = 1
WP_CATEGORY_NEWS = 2
NOTICES_SINCE = "2026-08-01"
NOTICES_MAX = 10
WP_SEARCH_TERM = "seconda divisione"
WP_FIELDS = "id,date,link,title,categories"
WP_PER_PAGE = 20
POSTER_KEY_RE = r"^public/locandine/images/[A-Za-z0-9]{5}/\d+/[a-f0-9]{64}\.(jpg|gif)$"
POSTER_BASE = PRIMARY_URL + "/"
