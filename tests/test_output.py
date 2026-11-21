import json
import os
from pathlib import Path
from typing import Any

import pytest

from fenice_calendar.output import json_if_changed, status_json, write_all_atomic


def write_if_changed(path: Path, data: dict[str, Any]) -> bool:
    """What the cli does for data.json: stage it only when it changed, then write it."""
    content = json_if_changed(path=path, data=data)
    if content is None:
        return False
    write_all_atomic([(path, content)])
    return True


def write_status(path: Path, checked_at: str) -> None:
    write_all_atomic([(path, status_json(checked_at=checked_at))])


def sample(
    updated_at: str = "2026-11-21T12:00:00+00:00", venue: str = "Palestra"
) -> dict[str, Any]:
    return {"updated_at": updated_at, "games": [{"id": "1", "venue": venue}], "name": "Società"}


def test_write_if_changed_creates_file_with_stable_json(tmp_path: Path) -> None:
    path = tmp_path / "data.json"
    assert write_if_changed(path=path, data=sample()) is True
    text = path.read_text(encoding="utf-8")
    assert text == json.dumps(sample(), indent=2, ensure_ascii=False) + "\n"
    assert "Società" in text


def test_write_if_changed_ignores_updated_at(tmp_path: Path) -> None:
    path = tmp_path / "data.json"
    write_if_changed(path=path, data=sample())
    os.utime(path, ns=(1_000_000_000, 1_000_000_000))
    before = path.read_bytes()

    changed = write_if_changed(path=path, data=sample(updated_at="2026-11-22T08:00:00+00:00"))

    assert changed is False
    assert path.read_bytes() == before
    assert path.stat().st_mtime_ns == 1_000_000_000


def test_write_if_changed_rewrites_when_content_differs(tmp_path: Path) -> None:
    path = tmp_path / "data.json"
    write_if_changed(path=path, data=sample())

    changed = write_if_changed(
        path=path, data=sample(updated_at="2026-11-22T08:00:00+00:00", venue="Altra")
    )

    assert changed is True
    written = json.loads(path.read_text(encoding="utf-8"))
    assert written["games"][0]["venue"] == "Altra"
    assert written["updated_at"] == "2026-11-22T08:00:00+00:00"


def test_write_if_changed_replaces_unreadable_existing_file(tmp_path: Path) -> None:
    path = tmp_path / "data.json"
    path.write_text("not json", encoding="utf-8")
    assert write_if_changed(path=path, data=sample()) is True
    assert json.loads(path.read_text(encoding="utf-8")) == sample()


def test_write_if_changed_creates_missing_directories(tmp_path: Path) -> None:
    path = tmp_path / "docs" / "data.json"
    assert write_if_changed(path=path, data=sample()) is True
    assert path.exists()


def test_write_status_always_rewrites_checked_at(tmp_path: Path) -> None:
    path = tmp_path / "status.json"
    write_status(path=path, checked_at="2026-11-21T12:00:00+00:00")
    write_status(path=path, checked_at="2026-11-21T16:00:00+00:00")
    assert json.loads(path.read_text(encoding="utf-8")) == {
        "checked_at": "2026-11-21T16:00:00+00:00"
    }
    assert path.read_text(encoding="utf-8").endswith("\n")


@pytest.mark.parametrize("status", [False, True])
def test_failed_write_preserves_previous_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, status: bool
) -> None:
    path = tmp_path / "data.json"
    path.write_text("previous", encoding="utf-8")
    original_write = Path.write_text

    def interrupted_write(target: Path, content: str, **kwargs: Any) -> int:
        original_write(target, content[:3], **kwargs)
        raise OSError("interrupted write")

    with monkeypatch.context() as patch:
        patch.setattr(Path, "write_text", interrupted_write)
        with pytest.raises(OSError, match="interrupted write"):
            if status:
                write_status(path=path, checked_at="new")
            else:
                write_if_changed(path=path, data=sample())
    assert path.read_text(encoding="utf-8") == "previous"
    write_status(path=path, checked_at="new")
    assert json.loads(path.read_text(encoding="utf-8")) == {"checked_at": "new"}


def test_write_if_changed_only_notices_change_rewrites_file(tmp_path: Path) -> None:
    path = tmp_path / "data.json"
    initial = {**sample(), "notices": []}
    changed = {**sample(), "notices": [{"id": 1, "title": "Avviso"}]}
    assert write_if_changed(path=path, data=initial) is True

    assert write_if_changed(path=path, data=changed) is True
    assert json.loads(path.read_text()) == changed


def test_write_if_changed_previous_json_list_rewrites_file(tmp_path: Path) -> None:
    path = tmp_path / "data.json"
    path.write_text("[]")

    assert write_if_changed(path=path, data=sample()) is True
    assert json.loads(path.read_text()) == sample()


def test_write_if_changed_interrupted_write_removes_temporary_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "data.json"
    path.write_text("previous")
    original_write = Path.write_text

    def interrupted_write(target: Path, content: str, **kwargs: Any) -> int:
        original_write(target, content[:3], **kwargs)
        raise OSError("interrupted write")

    with monkeypatch.context() as patch:
        patch.setattr(Path, "write_text", interrupted_write)
        with pytest.raises(OSError, match="interrupted write"):
            write_if_changed(path=path, data=sample())

    assert path.read_text() == "previous"
    assert not path.with_name("data.json.tmp").exists()
    assert write_if_changed(path=path, data=sample()) is True
    assert json.loads(path.read_text()) == sample()


def test_write_all_atomic_moves_files_in_the_given_order(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # the caller puts status.json last: a run stopped between two renames must not look successful
    first, last = tmp_path / "data.json", tmp_path / "status.json"
    first.write_text("old data")
    last.write_text("old status")
    original_replace = Path.replace
    moved: list[str] = []

    def replace_once(source: Path, target: Path) -> Path:
        if moved:
            raise OSError("disk gone")
        moved.append(Path(target).name)
        return original_replace(source, target)

    monkeypatch.setattr(Path, "replace", replace_once)
    with pytest.raises(OSError, match="disk gone"):
        write_all_atomic([(first, "new data"), (last, "new status")])

    assert moved == ["data.json"]
    assert (first.read_text(), last.read_text()) == ("new data", "old status")
    assert not list(tmp_path.glob("*.tmp"))
