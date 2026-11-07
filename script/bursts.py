#!/usr/bin/env python3
"""Pixel burst flipbooks. Nothing is generated; each frame is drawn here.

Six frames, 32 px cells, three rows: boom, death, slam. A burst plays the
row over the same 520 ms the old sphere used to grow.
"""
import io
import os

import numpy as np
from PIL import Image

import projectiles as shots

ROOT = shots.ROOT
CELL = 32
FRAMES = 6
ROWS = ("boom", "death", "slam")
SHEET = os.path.join(ROOT, "priv/static/images/hd2d/burst-sheet.png")

# Dusty grey-violet. The last step is the dark outline of the puff.
DEATH = (
    (186, 176, 188),
    (150, 140, 158),
    (112, 102, 122),
    (78, 68, 86),
    (48, 40, 54),
    (28, 22, 32),
)
# Earth brown. The ring is the mid stone, the dust is the light step.
SLAM = (
    (176, 132, 78),
    (140, 96, 52),
    (110, 74, 40),
    (78, 52, 30),
    (52, 34, 20),
    (36, 24, 16),
)
PALETTE = {"boom": shots.FIRE, "death": DEATH, "slam": SLAM}


def png_bytes(rgba):
    buf = io.BytesIO()
    Image.fromarray(np.ascontiguousarray(rgba), "RGBA").save(buf, format="PNG", compress_level=9)
    return buf.getvalue()


def save_png(path, rgba):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(png_bytes(rgba))


def roll(x, y, frame, salt):
    n = (x * 374761393 + y * 668265263 + frame * 1440673 + salt * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n & 255) / 255.0


def paint(kind, frame):
    image = np.zeros((CELL, CELL, 4), np.uint8)
    palette = PALETTE[kind]
    center = (CELL - 1) / 2.0
    radius = 4.0 + frame * 2.15
    for y in range(CELL):
        for x in range(CELL):
            dist = ((x - center) ** 2 + (y - center) ** 2) ** 0.5
            chance = roll(x, y, frame, 1 if kind == "boom" else 2 if kind == "death" else 3)
            color = None
            if kind == "boom":
                ring = radius - 3.2 + frame * 0.28
                if ring <= dist <= radius and chance > 0.12:
                    step = int((dist - ring) / max(radius - ring, 0.01) * (len(palette) - 1))
                    color = palette[max(0, min(len(palette) - 1, len(palette) - 1 - step))]
                elif frame < 3 and dist < ring and chance > 0.55:
                    color = palette[-1]
                elif frame >= 3 and abs(dist - radius) < 2.2 and chance > 0.78:
                    color = palette[min(5, len(palette) - 1)]
            elif kind == "death":
                if dist <= radius and chance > 0.18 + frame * 0.08:
                    step = int(dist / max(radius, 0.01) * (len(palette) - 1))
                    color = palette[max(0, min(len(palette) - 1, step))]
            elif kind == "slam" and abs(dist - radius) <= 2.1 and chance > 0.2:
                color = palette[1 if chance > 0.55 else 2]
            elif kind == "slam" and frame >= 2 and dist < radius - 2.1 and chance > 0.86:
                color = palette[0]
            if color is not None:
                image[y, x, :3] = color
                image[y, x, 3] = 255
    if int((image[:, :, 3] > 0).sum()) < 12:
        raise RuntimeError(f"{kind} frame {frame} is empty")
    return image


def burst_sheet():
    sheet = np.zeros((CELL * len(ROWS), CELL * FRAMES, 4), np.uint8)
    for row, kind in enumerate(ROWS):
        for frame in range(FRAMES):
            icon = paint(kind, frame)
            y = row * CELL
            x = frame * CELL
            sheet[y : y + CELL, x : x + CELL] = icon
    return sheet


def write_all():
    save_png(SHEET, burst_sheet())


if __name__ == "__main__":
    write_all()
