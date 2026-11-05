#!/usr/bin/env python3
"""Pixel projectiles from the committed views.

The arrow is pixelized pointing right, then turned in pixel space through the
eight compass steps. The engine picks a frame; it does not rotate the sprite.
The fireball is one 14 px figure and three more frames from a palette shift
and a one-pixel edge shear. A meteor draws that same sheet larger. Frost is
one 12 px shard.
"""
import io
import os

import numpy as np
from PIL import Image

import sprite_from_video as sv
import ui_icons as ui

ROOT = ui.ROOT

ARROW_CELL = 24
ARROW_LONG = 18
ARROW_FRAMES = 8

FIRE_CELL = 16
FIRE_LONG = 14
FIRE_FRAMES = 4

FROST_CELL = 16
FROST_LONG = 12

ARROW_SHEET = os.path.join(ROOT, "priv/static/images/hd2d/arrow-sheet.png")
FIRE_SHEET = os.path.join(ROOT, "priv/static/images/hd2d/fire-sheet.png")
FROST_SHEET = os.path.join(ROOT, "priv/static/images/hd2d/frost.png")

# Dark to light. The last step is the hot core the bloom gate reads.
FIRE = (
    (92, 28, 10),
    (148, 48, 12),
    (196, 72, 16),
    (228, 108, 28),
    (245, 148, 40),
    (255, 186, 72),
    (255, 220, 128),
    (255, 246, 214),
)
FIRE_CORE = FIRE[-1]


def view_path(name):
    return os.path.join(ROOT, "assets/reference/projectiles/views", f"{name}.jpg")


def png_bytes(rgba):
    buf = io.BytesIO()
    Image.fromarray(np.ascontiguousarray(rgba), "RGBA").save(buf, format="PNG", compress_level=9)
    return buf.getvalue()


def save_png(path, rgba):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(png_bytes(rgba))


def pixelize(name, longest):
    rgb, mask = ui.cut_figure(view_path(name))
    rgb, alpha = ui.scale_figure(rgb, mask, longest, longest)
    samples = rgb[alpha]
    if name == "fireball":
        palette = list(FIRE)
    else:
        palette = [tuple(int(c) for c in row) for row in sv.build_palette(samples, k=8)]
        palette.append(sv.OUTLINE)
    return ui.snap(rgb, alpha, palette), palette


def ink_span(icon):
    ink = icon[:, :, 3] > 0
    if not ink.any():
        return 0
    return max(int(ink.any(0).sum()), int(ink.any(1).sum()))


def rotate_icon(icon, degrees):
    """Nearest-neighbour turn about the figure's centre. 0 keeps the arrow pointing right."""
    if degrees % 360 == 0:
        return icon.copy()
    image = Image.fromarray(icon, "RGBA")
    side = int(np.ceil(np.hypot(icon.shape[0], icon.shape[1]))) + 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(image, ((side - icon.shape[1]) // 2, (side - icon.shape[0]) // 2))
    turned = canvas.rotate(degrees, resample=Image.Resampling.NEAREST, expand=False, fillcolor=(0, 0, 0, 0))
    arr = np.asarray(turned)
    ys, xs = np.nonzero(arr[:, :, 3] > 0)
    if len(ys) < 4:
        raise RuntimeError(f"rotation {degrees} lost the figure")
    return np.ascontiguousarray(arr[int(ys.min()) : int(ys.max()) + 1, int(xs.min()) : int(xs.max()) + 1])


def place_cell(sheet, icon, index, cell):
    if icon.shape[0] > cell or icon.shape[1] > cell:
        raise RuntimeError(f"frame {index} is {icon.shape[1]}×{icon.shape[0]} in a {cell} cell")
    y = (cell - icon.shape[0]) // 2
    x = index * cell + (cell - icon.shape[1]) // 2
    ui.place(sheet, icon, x, y)


def arrow_sheet():
    icon, _palette = pixelize("arrow", ARROW_LONG)
    if not 16 <= icon.shape[1] <= 20:
        raise RuntimeError(f"arrow is {icon.shape[1]} px long")
    sheet = np.zeros((ARROW_CELL, ARROW_CELL * ARROW_FRAMES, 4), np.uint8)
    for index in range(ARROW_FRAMES):
        turned = rotate_icon(icon, index * 45)
        if ink_span(turned) > 20:
            raise RuntimeError(f"arrow frame {index} spans {ink_span(turned)} px")
        place_cell(sheet, turned, index, ARROW_CELL)
    return sheet


def as_index(icon, palette):
    pal = np.array(palette, np.int16)
    rgb = icon[:, :, :3].astype(np.int16)
    alpha = icon[:, :, 3] > 0
    dist = ((rgb[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(3)
    idx = dist.argmin(2).astype(np.int16)
    idx[~alpha] = -1
    return idx


def from_index(idx, palette):
    out = np.zeros(idx.shape + (4,), np.uint8)
    on = idx >= 0
    out[on, :3] = np.array(palette, np.uint8)[idx[on]]
    out[on, 3] = 255
    return out


def shift_palette(idx, step, count):
    out = idx.copy()
    on = idx >= 0
    out[on] = np.clip(idx[on] + step, 0, count - 1)
    return out


def shear_rows(idx, shift):
    """Move even rows by one pixel. The silhouette jitters; the colours do not."""
    if shift == 0:
        return idx.copy()
    out = np.full_like(idx, -1)
    h, w = idx.shape
    for y in range(h):
        if y % 2:
            out[y] = idx[y]
            continue
        row = idx[y]
        if shift > 0:
            out[y, shift:] = row[:-shift]
        else:
            out[y, :shift] = row[-shift:]
    return out


def fire_sheet():
    icon, _palette = pixelize("fireball", FIRE_LONG)
    if ink_span(icon) > FIRE_LONG or ink_span(icon) < 10:
        raise RuntimeError(f"fireball spans {ink_span(icon)} px")
    base = as_index(icon, FIRE)
    # Frame 0 is the drawing. 1 shears the edge. 2 burns hotter. 3 cools and shears back.
    frames = [
        base,
        shear_rows(base, 1),
        shift_palette(base, 1, len(FIRE)),
        shear_rows(shift_palette(base, -1, len(FIRE)), -1),
    ]
    sheet = np.zeros((FIRE_CELL, FIRE_CELL * FIRE_FRAMES, 4), np.uint8)
    for index, idx in enumerate(frames):
        frame = from_index(idx, FIRE)
        if ink_span(frame) > FIRE_CELL:
            raise RuntimeError(f"fire frame {index} spans {ink_span(frame)} px")
        place_cell(sheet, frame, index, FIRE_CELL)
    return sheet


def frost_sheet():
    icon, _palette = pixelize("frost", FROST_LONG)
    if ink_span(icon) > FROST_LONG or ink_span(icon) < 8:
        raise RuntimeError(f"frost spans {ink_span(icon)} px")
    sheet = np.zeros((FROST_CELL, FROST_CELL, 4), np.uint8)
    place_cell(sheet, icon, 0, FROST_CELL)
    return sheet


def sheets():
    return {"arrow": arrow_sheet(), "fire": fire_sheet(), "frost": frost_sheet()}


def write_all():
    made = sheets()
    save_png(ARROW_SHEET, made["arrow"])
    save_png(FIRE_SHEET, made["fire"])
    save_png(FROST_SHEET, made["frost"])


if __name__ == "__main__":
    write_all()
