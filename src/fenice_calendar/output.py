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


def json_if_changed(path: Path, data: dict[str, Any]) -> str | None:
    """Return ``data`` serialized as JSON, or None when only ``updated_at`` differs on disk."""
    previous = _read_previous(path)
    if previous is not None and _without_volatile(previous) == _without_volatile(data):
        return None
    return _serialize(data)


def status_json(checked_at: str) -> str:
    """Content of status.json: when the last successful check ran."""
    return _serialize({"checked_at": checked_at})


def write_all_atomic(files: list[tuple[Path, str]]) -> None:
    """Write every file to a temporary sibling first, then move them all into place.

    A failure while writing the temporary files leaves every target as it was. The
    renames that follow are same-directory and each one is atomic, but the set is not:
    a rename failing halfway leaves the earlier targets new. Files are moved in the
    given order, so the caller puts status.json last and a half-moved run never looks
    like a successful one.
    """
    staged: list[tuple[Path, Path]] = []
    try:
        for path, content in files:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(path.name + ".tmp")
            # tracked before writing, so a write that fails halfway is cleaned up too
            staged.append((temporary, path))
            temporary.write_text(content, encoding="utf-8")
        for temporary, path in staged:
            temporary.replace(path)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
