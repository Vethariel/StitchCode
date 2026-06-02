#!/usr/bin/env python3
"""
Recorta cada emoción de Hilo.png y genera PNG cuadrados (padding vertical u horizontal).

Uso (desde la raíz del repo):
  uv run python scripts/build_hilo_frames.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITE_DIR = ROOT / "assets" / "sprite"
SHEET_PATH = SPRITE_DIR / "Hilo.png"
INFO_SOURCE = SPRITE_DIR / "HiloInfo.source.json"
INFO_LEGACY = SPRITE_DIR / "HiloInfo.json"
FRAMES_DIR = SPRITE_DIR / "frames"
MANIFEST_PATH = SPRITE_DIR / "HiloManifest.json"


def crop_to_square(cell: Image.Image, side: int) -> Image.Image:
    """Centra el recorte en un lienzo cuadrado transparente."""
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - cell.width) // 2
    oy = (side - cell.height) // 2
    square.paste(cell, (ox, oy), cell)
    return square


def main() -> None:
    if not SHEET_PATH.is_file():
        raise SystemExit(f"No existe {SHEET_PATH}")

    info_path = INFO_SOURCE if INFO_SOURCE.is_file() else INFO_LEGACY
    raw = json.loads(info_path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and "frames" in raw:
        cells = raw["frames"]
    else:
        cells = raw

    sheet = Image.open(SHEET_PATH).convert("RGBA")
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    side = max(max(c["w"], c["h"]) for c in cells)
    manifest = []

    for cell in cells:
        name = cell["name"]
        box = (cell["x"], cell["y"], cell["x"] + cell["w"], cell["y"] + cell["h"])
        cropped = sheet.crop(box)
        squared = crop_to_square(cropped, side)
        rel = f"frames/{name}.png"
        out = SPRITE_DIR / rel
        squared.save(out, optimize=True)
        manifest.append({"name": name, "file": rel, "size": side})
        print(f"  {rel} ({cell['w']}×{cell['h']} → {side}×{side})")

    MANIFEST_PATH.write_text(
        json.dumps({"size": side, "frames": manifest}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nManifest: {MANIFEST_PATH.relative_to(ROOT)} ({len(manifest)} emociones)")


if __name__ == "__main__":
    main()
