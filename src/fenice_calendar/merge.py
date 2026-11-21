from typing import TypedDict

from fenice_calendar.schema import Game


class BaselineEntry(TypedDict):
    date: str | None
    time: str | None
    venue_raw: str


def build_baseline(games: list[Game]) -> dict[str, BaselineEntry]:
    """Create the initial snapshot from normalized fixture games, once per season."""
    return {
        game["id"]: BaselineEntry(
            date=game["date"], time=game["time"], venue_raw=game["venue"]["raw"]
        )
        for game in games
    }


def compute_changes(game: Game, baseline: dict[str, BaselineEntry]) -> list[str]:
    """Return changed schedule fields in display order."""
    original = baseline.get(game["id"])
    if original is None:
        return []
    return [
        field
        for field, current, previous in (
            ("date", game["date"], original["date"]),
            ("time", game["time"], original["time"]),
            ("venue", game["venue"]["raw"], original["venue_raw"]),
        )
        if current != previous
    ]
