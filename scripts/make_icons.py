#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow>=11"]
# ///
"""Generate the web app icons in docs/icons from the official crest in assets/logo-fenice.png.

Run from the repository root: uv run --script scripts/make_icons.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SOURCE = ROOT / "assets" / "logo-fenice.png"
ICONS = DOCS / "icons"
# the light --paper token of docs/styles.css, oklch(0.975 0.006 280)
PAPER = (246, 246, 251)
# share of the icon side the round crest fills on plain icons
PLAIN_FILL = 0.92
# maskable icons: launchers may crop to a circle of radius 40%, so the crest stays inside it
MASKABLE_FILL = 0.76
FAVICON_SIZES = [(16, 16), (32, 32), (48, 48)]


def crop_crest(image: Image.Image) -> Image.Image:
    """Cut the crest out of its transparent margin."""
    rgba = image.convert("RGBA")
    box = rgba.getchannel("A").getbbox()
    if box is None:
        raise ValueError(f"{SOURCE} is fully transparent")
    return rgba.crop(box)


def place(crest: Image.Image, size: int, fill: float) -> Image.Image:
    """Center the crest, `fill` of the side wide, on an opaque paper square of `size` px."""
    side = round(size * fill)
    resized = crest.resize(
        (side, round(side * crest.height / crest.width)), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGBA", (size, size), PAPER + (255,))
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas.convert("RGB")


def main() -> None:
    crest = crop_crest(Image.open(SOURCE))
    ICONS.mkdir(exist_ok=True)
    place(crest=crest, size=192, fill=PLAIN_FILL).save(ICONS / "icon-192.png", optimize=True)
    place(crest=crest, size=512, fill=PLAIN_FILL).save(ICONS / "icon-512.png", optimize=True)
    place(crest=crest, size=512, fill=MASKABLE_FILL).save(
        ICONS / "icon-maskable-512.png", optimize=True
    )
    # iOS ignores the manifest icons and fills transparency with black: this one is opaque
    place(crest=crest, size=180, fill=PLAIN_FILL).save(
        ICONS / "apple-touch-icon.png", optimize=True
    )
    place(crest=crest, size=48, fill=1.0).save(DOCS / "favicon.ico", sizes=FAVICON_SIZES)


if __name__ == "__main__":
    main()
