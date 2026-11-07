#!/usr/bin/env python3
"""The start-screen wordmark, the navbar mark, and the favicon.

The raw title sits on black. Black becomes transparent, and the crop is
reduced by an integer factor of 3 so the wordmark is 382 px wide. The keep
between the words is the logo and both favicon sizes.
"""
import io
import os

import numpy as np
from PIL import Image

import sprite_from_video as sv
import ui_icons as ui

ROOT = ui.ROOT
FACTOR = 3
INK = 16
TITLE_W = 382
TITLE_H = 83
MARK = 32

VIEW = os.path.join(ROOT, "assets/reference/title/views/title.jpg")
TITLE = os.path.join(ROOT, "priv/static/images/hd2d/title.png")
LOGO = os.path.join(ROOT, "priv/static/images/logo.png")
FAVICON = os.path.join(ROOT, "priv/static/favicon.ico")


def png_bytes(rgba):
    buf = io.BytesIO()
    Image.fromarray(np.ascontiguousarray(rgba), "RGBA").save(buf, format="PNG", compress_level=9)
    return buf.getvalue()


def save_png(path, rgba):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(png_bytes(rgba))


def load_view():
    rgb = np.asarray(Image.open(VIEW).convert("RGB"))
    ink = rgb.max(2) > INK
    ys, xs = np.nonzero(ink)
    if len(ys) < 8:
        raise RuntimeError("title has no letters")
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    return rgb[y0:y1, x0:x1], ink[y0:y1, x0:x1]


def block_mean(rgb, ink):
    """Average each factor×factor block of the letters. Empty blocks stay clear."""
    h, w = ink.shape
    pad_h = (FACTOR - h % FACTOR) % FACTOR
    pad_w = (FACTOR - w % FACTOR) % FACTOR
    rgb = np.pad(rgb, ((0, pad_h), (0, pad_w), (0, 0)))
    ink = np.pad(ink, ((0, pad_h), (0, pad_w)))
    height, width = ink.shape
    rows, cols = height // FACTOR, width // FACTOR
    rgb_b = rgb.reshape(rows, FACTOR, cols, FACTOR, 3)
    ink_b = ink.reshape(rows, FACTOR, cols, FACTOR)
    count = ink_b.sum((1, 3))
    summed = (rgb_b * ink_b[:, :, :, :, None]).sum((1, 3))
    mean = np.zeros((rows, cols, 3), np.uint8)
    on = count > 0
    mean[on] = np.rint(summed[on] / count[on, None]).astype(np.uint8)
    alpha = count >= (FACTOR * FACTOR) / 3
    return mean, alpha


def wordmark():
    rgb, ink = load_view()
    small, alpha = block_mean(rgb, ink)
    if small.shape[1] != TITLE_W or small.shape[0] != TITLE_H:
        raise RuntimeError(f"title is {small.shape[1]}×{small.shape[0]}")
    samples = small[alpha]
    palette = [tuple(int(c) for c in row) for row in sv.build_palette(samples, k=16)]
    return ui.snap(small, alpha, palette)


def tower_window(mark):
    """The spire between the words: the columns that reach the top of the crop."""
    ink = mark[:, :, 3] > 0
    height, width = ink.shape
    top = np.full(width, height)
    for x in range(width):
        rows = np.nonzero(ink[:, x])[0]
        if len(rows):
            top[x] = int(rows[0])
    peak = int(top.min())
    tip = np.where(top <= peak + 1)[0]
    center = int(round(tip.mean()))
    # The tower body is the run of ink around that tip, stopped at the letter gaps.
    band = ink[height // 3 : height * 2 // 3].mean(0)

    def empty(x):
        return 0 <= x < width and band[x] < 0.08

    left = center
    while left > 0 and not empty(left - 1):
        left -= 1
    right = center
    while right < width - 1 and not empty(right + 1):
        right += 1
    return left, 0, right + 1, height


def tower_source():
    """A 64 px square of the raw tower top. Halving it twice lands on 32 and 16."""
    rgb, ink = load_view()
    x0, _y0, x1, _y1 = tower_window(wordmark())
    # The wordmark is the view reduced by FACTOR, origin unchanged.
    left = x0 * FACTOR
    right = min(rgb.shape[1], x1 * FACTOR)
    side = MARK * 2
    center = (left + right) // 2
    x = min(max(0, center - side // 2), rgb.shape[1] - side)
    crop = rgb[0:side, x : x + side]
    mask = ink[0:side, x : x + side]
    image = Image.fromarray(crop).resize((MARK, MARK), Image.Resampling.BOX)
    alpha = Image.fromarray((mask.astype(np.uint8) * 255)).resize((MARK, MARK), Image.Resampling.BOX)
    small = np.asarray(image)
    keep = np.asarray(alpha) > 127
    samples = small[keep]
    if len(samples) < 8:
        raise RuntimeError("tower crop is empty")
    palette = [tuple(int(c) for c in row) for row in sv.build_palette(samples, k=8)]
    return ui.snap(small, keep, palette)


def logo():
    return tower_source()


def favicon_icons():
    mark = logo()
    icon16 = np.asarray(Image.fromarray(mark, "RGBA").resize((16, 16), Image.Resampling.BOX))
    return mark, icon16


def ico_bytes(icon32, icon16):
    buf = io.BytesIO()
    Image.fromarray(icon32, "RGBA").save(
        buf,
        format="ICO",
        sizes=[(16, 16), (32, 32)],
        append_images=[Image.fromarray(icon16, "RGBA")],
    )
    return buf.getvalue()


def write_all():
    mark = wordmark()
    save_png(TITLE, mark)
    icon32, icon16 = favicon_icons()
    save_png(LOGO, icon32)
    os.makedirs(os.path.dirname(FAVICON), exist_ok=True)
    with open(FAVICON, "wb") as handle:
        handle.write(ico_bytes(icon32, icon16))


if __name__ == "__main__":
    write_all()
