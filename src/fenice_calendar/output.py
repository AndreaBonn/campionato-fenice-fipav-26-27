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


def write_if_changed(path: Path, data: dict[str, Any]) -> bool:
    """Write ``data`` as JSON unless only ``updated_at`` differs; return True if written."""
    previous = _read_previous(path)
    if previous is not None and _without_volatile(previous) == _without_volatile(data):
        return False
    _write_atomic(path, _serialize(data))
    return True


def write_status(path: Path, checked_at: str) -> None:
    """Record when the last successful check ran."""
    _write_atomic(path, _serialize({"checked_at": checked_at}))
