import json
from pathlib import Path
from typing import Any

FIXTURES = Path(__file__).parent / "fixtures"
FENICE_COD = "190920448"


def load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text())


def test_calendar_64444_is_the_full_seconda_divisione_group() -> None:
    matches = load("calendar-64444.json")["data"]["matches"]
    fenice = [
        m
        for m in matches
        if FENICE_COD in (m["team1"]["cod_aff_societa"], m["team2"]["cod_aff_societa"])
    ]
    assert len(matches) == 90
    assert len(fenice) == 18


def test_calendar_64353_has_played_games_with_set_scores() -> None:
    matches = load("calendar-64353.json")["data"]["matches"]
    played = [m for m in matches if m["played"]]
    assert len(matches) == 30
    assert len(played) == 8
    assert all(len(m["pt_a"]) == len(m["pt_b"]) >= 3 for m in played)


def test_standings_fixtures_list_every_team() -> None:
    assert len(load("standings-64444.json")[0]["data"]["teams"]) == 10
    assert len(load("standings-64353.json")[0]["data"]["teams"]) == 6


def test_posters_fixture_maps_game_ids_to_keys() -> None:
    posters = load("posters-19092.json")["data"]
    assert len(posters) > 0
    assert all(entry["key"].startswith("public/locandine/images/") for entry in posters.values())


def test_sample_games_to_play_without_referees_are_pending() -> None:
    sample = json.loads((FIXTURES / "data-sample.json").read_text())
    to_play = [g for g in sample["games"] if not g["played"]]
    assert to_play
    assert [(g["id"], g["referee_pending"]) for g in to_play if not g["referees"]] == [
        (g["id"], True) for g in to_play if not g["referees"]
    ]
    assert any(not g["referees"] for g in to_play)
