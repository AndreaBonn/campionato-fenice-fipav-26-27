import json
from pathlib import Path

from fenice_calendar import config


def test_fenice_code_identifies_eighteen_games() -> None:
    fixture = Path(__file__).parent / "fixtures" / "calendar-64444.json"
    matches = json.loads(fixture.read_text())["data"]["matches"]
    games = [
        game for game in matches
        if config.TEAM_COD in (
            game["team1"]["cod_aff_societa"], game["team2"]["cod_aff_societa"]
        )
    ]
    assert len(games) == 18


def test_formula_is_unpublished_and_empty() -> None:
    assert config.FORMULA == {"published": False, "promotion": 0, "playoff": 0, "relegation": 0}
