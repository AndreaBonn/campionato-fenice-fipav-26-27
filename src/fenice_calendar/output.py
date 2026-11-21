import json
from pathlib import Path
from typing import Any

VOLATILE_KEY = "updated_at"
JSON_INDENT = 2


def _serialize(data: Any) -> str:
    return json.dumps(data, indent=JSON_INDENT, ensure_ascii=False) + "\n"


def _without_volatile(data: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key != VOLATILE_KEY}


def _read_previous(path: Path) -> dict[str, Any] | None:
    try:
        previous = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return previous if isinstance(previous, dict) else None


def _write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    try:
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def json_if_changed(path: Path, data: dict[str, Any]) -> str | None:
    """Return ``data`` serialized as JSON, or None when only ``updated_at`` differs on disk."""
    previous = _read_previous(path)
    if previous is not None and _without_volatile(previous) == _without_volatile(data):
        return None
    return _serialize(data)


def write_if_changed(path: Path, data: dict[str, Any]) -> bool:
    """Write ``data`` as JSON unless only ``updated_at`` differs; return True if written."""
    content = json_if_changed(path, data)
    if content is None:
        return False
    _write_atomic(path, content)
    return True


def status_json(checked_at: str) -> str:
    """Content of status.json: when the last successful check ran."""
    return _serialize({"checked_at": checked_at})


def write_status(path: Path, checked_at: str) -> None:
    """Record when the last successful check ran."""
    _write_atomic(path, status_json(checked_at))


def write_all_atomic(files: list[tuple[Path, str]]) -> None:
    """Write every file to a temporary sibling first, then move them all into place.

    A failure while writing leaves every target as it was: nothing is moved until
    all the temporary files exist.
    """
    staged: list[tuple[Path, Path]] = []
    try:
        for path, content in files:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(path.name + ".tmp")
            temporary.write_text(content, encoding="utf-8")
            staged.append((temporary, path))
        for temporary, path in staged:
            temporary.replace(path)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
