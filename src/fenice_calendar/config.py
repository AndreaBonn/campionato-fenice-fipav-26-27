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
ICS_PATH = ROOT / "docs" / "calendario.ics"
