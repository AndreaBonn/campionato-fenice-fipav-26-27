import json
import struct
from pathlib import Path

import pytest

DOCS = Path(__file__).resolve().parent.parent / "docs"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# IHDR color types without an alpha channel: grayscale and truecolor
OPAQUE_COLOR_TYPES = {0, 2}


def _manifest() -> dict[str, object]:
    text = (DOCS / "manifest.webmanifest").read_text(encoding="utf-8")
    manifest: dict[str, object] = json.loads(text)
    return manifest


def png_color_type(data: bytes) -> int:
    """Return the IHDR color type of a PNG (0 gray, 2 RGB, 3 palette, 4 gray+alpha, 6 RGBA)."""
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("not a PNG")
    length, chunk = struct.unpack(">I4s", data[8:16])
    if chunk != b"IHDR" or length != 13:
        raise ValueError("IHDR is not the first chunk")
    return data[25]


def test_png_color_type_reads_ihdr() -> None:
    header = PNG_SIGNATURE + struct.pack(">I4sIIBBBBB", 13, b"IHDR", 180, 180, 8, 6, 0, 0, 0)

    assert png_color_type(header) == 6


def test_png_color_type_rejects_other_data() -> None:
    with pytest.raises(ValueError):
        png_color_type(b"GIF89a" + bytes(30))


def test_manifest_start_url_and_scope_are_relative() -> None:
    manifest = _manifest()

    # absolute paths would break on the GitHub Pages project subpath
    assert manifest["start_url"] == "./"
    assert manifest["scope"] == "./"


def test_manifest_icons_exist_with_declared_size() -> None:
    icons = _manifest()["icons"]
    assert isinstance(icons, list) and icons

    for icon in icons:
        src = str(icon["src"])
        assert not src.startswith("/"), src
        path = DOCS / src
        assert path.is_file(), src
        data = path.read_bytes()
        width, height = struct.unpack(">II", data[16:24])
        assert f"{width}x{height}" == icon["sizes"], src


def test_manifest_has_a_512_any_icon_and_a_maskable_one() -> None:
    icons = _manifest()["icons"]
    assert isinstance(icons, list)

    assert any(i["sizes"] == "512x512" and i["purpose"] == "any" for i in icons)
    assert any(i["purpose"] == "maskable" for i in icons)


def test_apple_touch_icon_is_opaque() -> None:
    # iOS fills transparency with black
    data = (DOCS / "icons" / "apple-touch-icon.png").read_bytes()

    assert png_color_type(data) in OPAQUE_COLOR_TYPES


def test_index_links_the_apple_touch_icon_that_exists() -> None:
    html = (DOCS / "index.html").read_text(encoding="utf-8")

    assert 'rel="apple-touch-icon" href="icons/apple-touch-icon.png"' in html
