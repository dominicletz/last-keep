#!/usr/bin/env python3
"""Pixel icons for elite marks, resource sacks, and five build buttons.

Elite marks and resource sacks come from the committed views. Each figure is
cut off the white ground, scaled so it is about 20 px tall, and snapped to a
short palette. Build icons are a square crop of the first cell of that kind's
own sheet, scaled to 28 px. The mage tower has no sheet, so it gets no icon.
"""
import os

import numpy as np
from PIL import Image

import sprite_from_video as sv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ELITE_MARKS = ("plated", "lean", "spiked")
ELITE_CELL = 24
ELITE_MAX = 20
ELITE_SHEET = os.path.join(ROOT, "priv/static/images/hd2d/elite-marks.png")

RESOURCES = ("wood", "food", "gold")
RESOURCE_SIZE = 24
RESOURCE_HEIGHT = 20

BUILDS = ("wall", "tower", "trap", "field", "forge")
BUILD_CELL = {
    "wall": (128, 120),
    "tower": (112, 144),
    "trap": (80, 64),
    "field": (136, 48),
    "forge": (152, 112),
}
BUILD_SIZE = 28

# Warm grey steel around the old plated mark (0xd8cfc3), plus a rivet and
# the night outline. Lean uses the same ivory.
STEEL = (
    (232, 226, 216),
    (216, 207, 195),
    (168, 161, 152),
    (125, 120, 113),
    (86, 83, 78),
    (52, 50, 47),
    (24, 24, 24),
)
# Orange tips at the old spiked mark (0xf5751e) over dark iron.
SPIKED = (
    (255, 176, 72),
    (245, 117, 30),
    (176, 84, 22),
    (118, 56, 16),
    (92, 84, 78),
    (58, 52, 48),
    (32, 28, 26),
    (24, 24, 24),
)
ELITE_PALETTE = {"plated": STEEL, "lean": STEEL, "spiked": SPIKED}


def view_path(folder, name):
    return os.path.join(ROOT, "assets/reference", folder, "views", f"{name}.jpg")


def cut_figure(path):
    rgb = np.asarray(Image.open(path).convert("RGB"))
    mask = sv.cut_out(rgb)
    ys, xs = np.nonzero(mask)
    if len(ys) < 8:
        raise RuntimeError(f"{path} has no figure")
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    return rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]


def scale_figure(rgb, mask, height, max_side):
    h, w = mask.shape
    scale = height / h
    if w * scale > max_side:
        scale = max_side / w
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    image = Image.fromarray(rgb).resize((new_w, new_h), Image.Resampling.BOX)
    alpha = Image.fromarray((mask.astype(np.uint8) * 255)).resize((new_w, new_h), Image.Resampling.BOX)
    return np.asarray(image), np.asarray(alpha) > 127


def snap(rgb, alpha, palette):
    pal = [tuple(int(c) for c in row) for row in palette]
    pal_lab = sv.srgb_to_lab(np.array(pal, np.float64))
    return sv.quantize(rgb, alpha, pal_lab, pal)


def place(canvas, icon, ox, oy):
    h, w = icon.shape[:2]
    canvas[oy : oy + h, ox : ox + w] = icon


def elite_icon(name):
    """The larger side is at most 20 px, so the wide lean chevron stays in the cell."""
    rgb, mask = cut_figure(view_path("elite_marks", name))
    rgb, alpha = scale_figure(rgb, mask, ELITE_MAX, ELITE_MAX)
    span = max(int(alpha.any(0).sum()), int(alpha.any(1).sum()))
    if span > ELITE_MAX or span < 8:
        raise RuntimeError(f"{name} spans {span} px")
    return snap(rgb, alpha, ELITE_PALETTE[name])


def elite_sheet():
    """One row: plated, lean, spiked. Each cell is 24×24."""
    cell = ELITE_CELL
    sheet = np.zeros((cell, cell * len(ELITE_MARKS), 4), np.uint8)
    for index, name in enumerate(ELITE_MARKS):
        icon = elite_icon(name)
        y = (cell - icon.shape[0]) // 2
        x = index * cell + (cell - icon.shape[1]) // 2
        place(sheet, icon, x, y)
    return sheet


def resource_icon(name):
    """A 24 px square. The sack is 20 px tall, or narrower when it is wide."""
    rgb, mask = cut_figure(view_path("resource_icons", name))
    rgb, alpha = scale_figure(rgb, mask, RESOURCE_HEIGHT, RESOURCE_SIZE - 2)
    if not 16 <= alpha.shape[0] <= 24:
        raise RuntimeError(f"{name} is {alpha.shape[0]} px tall")
    samples = rgb[alpha]
    palette = [tuple(int(c) for c in row) for row in sv.build_palette(samples, k=12)]
    palette.append(sv.OUTLINE)
    icon = snap(rgb, alpha, palette)
    canvas = np.zeros((RESOURCE_SIZE, RESOURCE_SIZE, 4), np.uint8)
    y = (RESOURCE_SIZE - icon.shape[0]) // 2
    x = (RESOURCE_SIZE - icon.shape[1]) // 2
    place(canvas, icon, x, y)
    return canvas


def build_icon(kind):
    """The top of variant a, squared, then 28 px, in that cell's colours."""
    path = os.path.join(ROOT, "priv/static/images/hd2d", f"{kind}-sheet.png")
    sheet = np.asarray(Image.open(path).convert("RGBA"))
    cw, ch = BUILD_CELL[kind]
    cell = sheet[:ch, :cw]
    alpha = cell[:, :, 3] > 16
    ys, xs = np.nonzero(alpha)
    if len(ys) < 8:
        raise RuntimeError(f"{kind} sheet has no figure")
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    side = min(x1 - x0, y1 - y0)
    cx = (x0 + x1) // 2
    sx = min(max(0, cx - side // 2), cw - side)
    sy = y0
    if sy + side > ch:
        sy = ch - side
    crop = cell[sy : sy + side, sx : sx + side]
    image = Image.fromarray(crop).resize((BUILD_SIZE, BUILD_SIZE), Image.Resampling.BOX)
    small = np.asarray(image)
    keep = small[:, :, 3] > 127
    used = cell[alpha][:, :3]
    colours = np.unique(used.reshape(-1, 3), axis=0)
    if len(colours) > 48:
        colours = sv.build_palette(used, k=16)
    palette = [tuple(int(c) for c in row) for row in colours]
    return snap(small[:, :, :3], keep, palette)


def save_png(path, rgba):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(path)


def write_all():
    save_png(ELITE_SHEET, elite_sheet())
    for name in RESOURCES:
        save_png(os.path.join(ROOT, "priv/static/images/ui", f"{name}.png"), resource_icon(name))
    for kind in BUILDS:
        save_png(os.path.join(ROOT, "priv/static/images/ui", f"build-{kind}.png"), build_icon(kind))


if __name__ == "__main__":
    write_all()
