#!/usr/bin/env python3
"""Bust portraits for the five heroes, from the committed front views.

    python3 script/hero_portraits.py

Each portrait is 76 by 96. The crop is the top of the figure, a window
76:96 wide centred on the head, then pixelized with the colours of that
hero's walk sheet. The warrior has no views/v-S in the repo, so its
source is video/dirs/S.png, the front the clips start from. Re-running
writes the same pixels.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_from_video as sv  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEROES = ("warrior", "mage", "scout", "farmer", "engineer")
WIDTH = 76
HEIGHT = 96
# Share of the figure's height taken from the top of the head. The window
# is that tall and 76:96 wide, so the resize does not stretch it.
BUST = 0.42


def source_path(hero, root=ROOT):
    """The front view: v-S.png, else v-S.jpg, else the dirs/S start pose."""
    base = os.path.join(root, "assets/reference", hero, "video")
    for name in ("views/v-S.png", "views/v-S.jpg", "dirs/S.png"):
        path = os.path.join(base, name)
        if os.path.exists(path):
            return path
    raise SystemExit(f"{hero}: no front view under {base}")


def sheet_palette(hero, root=ROOT):
    """The walk sheet's opaque colours, outline included. Sorted, so the
    quantize index does not depend on set order."""
    path = os.path.join(root, "priv/static/images/hd2d", f"{hero}-walk.png")
    sheet = np.asarray(Image.open(path).convert("RGBA"))
    colours = {tuple(int(v) for v in c) for c in sheet[sheet[..., 3] > 0][:, :3]}
    return sorted(colours)


def bust_window(mask):
    """(y0, x0, height, width) of the bust. Centred on the head, clamped
    into the frame by shifting, never by changing the 76:96 shape."""
    top, foot = sv.span(mask)
    fig = foot - top + 1
    bh = max(1, int(round(fig * BUST)))
    bw = max(1, int(round(bh * WIDTH / HEIGHT)))
    y0 = top
    x0 = int(round(sv.head_centre(mask) - bw / 2))
    height, width = mask.shape
    if bh > height or bw > width:
        raise SystemExit("bust window is larger than the front view")
    x0 = min(max(0, x0), width - bw)
    y0 = min(max(0, y0), height - bh)
    return y0, x0, bh, bw


def portrait(hero, root=ROOT):
    """The 76×96 RGB bust. Black is the empty ground, not a sheet colour."""
    rgb = np.asarray(Image.open(source_path(hero, root)).convert("RGB"))
    mask = sv.cut_out(rgb)
    if not mask.any():
        raise SystemExit(f"{hero}: the front view has no figure")
    y0, x0, bh, bw = bust_window(mask)
    crop = np.ascontiguousarray(rgb[y0:y0 + bh, x0:x0 + bw])
    keep = mask[y0:y0 + bh, x0:x0 + bw]
    small = np.asarray(Image.fromarray(crop).resize((WIDTH, HEIGHT), Image.BOX))
    alpha = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).resize((WIDTH, HEIGHT), Image.BOX))
    pal = sheet_palette(hero, root)
    painted = sv.quantize(small, alpha >= 128, sv.srgb_to_lab(np.array(pal, np.float64)), pal)
    out = np.zeros((HEIGHT, WIDTH, 3), np.uint8)
    on = painted[..., 3] > 0
    out[on] = painted[on][:, :3]
    return out


def write_portrait(hero, root=ROOT):
    path = os.path.join(root, "priv/static/images/portraits", f"{hero}.png")
    Image.fromarray(portrait(hero, root)).save(path)
    return path


def main(argv=None):
    heroes = tuple(argv) if argv else HEROES
    for hero in heroes:
        if hero not in HEROES:
            raise SystemExit(f"{hero} is not one of {HEROES}")
        print(write_portrait(hero))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
