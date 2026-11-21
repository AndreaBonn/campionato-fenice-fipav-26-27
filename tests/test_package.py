import tomllib
from importlib import import_module
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_every_project_script_points_to_a_callable() -> None:
    scripts = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["scripts"]
    assert scripts, "pyproject.toml declares no entry point"
    for target in scripts.values():
        module_name, func_name = target.split(":")
        assert callable(getattr(import_module(module_name), func_name))
