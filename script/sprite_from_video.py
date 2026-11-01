#!/usr/bin/env python3
"""Build a hero's 8-direction walk + idle sheet from Grok Imagine clips.

    python3 script/sprite_from_video.py mage --report /tmp/report.json

HERO names the folders: clips from assets/reference/<hero>/video, sheet to
priv/static/images/hd2d/<hero>-walk.png. --clips and --out override them.

Input folder: dirs/<DIR>.png start poses on white, walk-<DIR>.mp4 (2 s
walk-in-place loop), idle-<DIR>.mp4 (2 s breathing loop) for DIR in
S SE E NE N NW W SW. Screen convention: S faces the camera, E faces
screen-right, N is the back, W faces screen-left.

Output: <out>.png (albedo) and <out>-normal.png. Columns follow
pictureColumn: S, SW, W, NW, N, NE, E, SE. Rows: 8 walk frames, then 4 idle.
Needs python3, numpy, scipy, Pillow, and ffmpeg on PATH. The same inputs give the
same bytes. See docs/concepts/SPRITE-PIPELINE.md.
"""
import argparse
import json
import struct
import os
import subprocess
import sys
import zlib

import numpy as np
from PIL import Image
from scipy import ndimage

COLUMNS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
CELL = 128
HERO = 88            # measured height including the 1 px outline
FILL = HERO - 2      # opaque body height before the outline
FOOT = CELL - 12     # row of the lowest body pixel (outline sits one below)
WALK = 8
IDLE = 4
COLOURS = 28         # palette size, not counting the outline
OUTLINE = (24, 24, 24)
BG_LOOSE = 222       # min channel for border-connected white
BG_TIGHT = 240       # min channel for an enclosed white hole
HOLE_MIN = 24        # smallest enclosed hole (source px) treated as background


def run_ffmpeg_frames(path):
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height", "-of", "json", path],
        check=True, capture_output=True, text=True)
    info = json.loads(probe.stdout)["streams"][0]
    w, h = info["width"], info["height"]
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        check=True, capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    return [f.copy() for f in frames]


def cut_out(rgb):
    """Alpha mask: white connected to the border is background, plus large
    enclosed pure-white holes (between legs, sword and body). Light armour
    highlights inside the silhouette survive: they are not connected to the
    border, and they are small or not pure white."""
    lo = rgb.min(2).astype(np.int16)
    spread = rgb.max(2).astype(np.int16) - lo
    loose = (lo >= BG_LOOSE) & (spread < 24)
    lab, _ = ndimage.label(loose)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    tight = (lo >= BG_TIGHT) & (spread < 16) & ~bg
    hl, n = ndimage.label(tight)
    if n:
        sizes = ndimage.sum(tight, hl, index=np.arange(1, n + 1))
        bg |= np.isin(hl, np.nonzero(sizes >= HOLE_MIN)[0] + 1)
    # Drop the 1 px anti-aliased white rim at source resolution.
    fg = ndimage.binary_erosion(~bg, iterations=1, border_value=0)
    # Keep blobs big enough to be the hero; video specks go.
    fl, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, fl, index=np.arange(1, n + 1))
        fg = np.isin(fl, np.nonzero(sizes >= sizes.max() * 0.02)[0] + 1)
    return fg


def sharpness(rgb, mask):
    g = rgb.astype(np.float32).mean(2)
    lap = (-4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:])
    m = mask[1:-1, 1:-1]
    return float(lap[m].var()) if m.any() else 0.0


def span(mask):
    ys = np.nonzero(mask.any(1))[0]
    return int(ys[0]), int(ys[-1])


def head_centre(mask):
    top, foot = span(mask)
    h = foot - top + 1
    band = mask[top + int(h * 0.03): top + int(h * 0.2)]
    xs = np.nonzero(band)[1]
    return float(np.median(xs)) if len(xs) else mask.shape[1] / 2


def small_gray(rgb, mask):
    im = Image.fromarray(np.where(mask[..., None], rgb, 255).astype(np.uint8)).convert("L")
    return np.asarray(im.resize((48, 48), Image.BOX), np.float32)


def walk_picks(frames):
    """Eight frames over one full cycle. The cycle ends at the frame most like
    frame 0 in the back part of the clip; each pick is the sharpest frame
    within one frame of its target time."""
    n = len(frames)
    g0 = frames[0]["gray"]
    diffs = [float(np.abs(f["gray"] - g0).mean()) for f in frames]
    lo = max(8, int(n * 0.55))
    cycle = lo + int(np.argmin(diffs[lo:]))
    picks = []
    for k in range(WALK):
        t = round(k * cycle / WALK)
        window = [i for i in range(t - 1, t + 2) if 0 <= i < cycle]
        if k == 0:
            window = [0]
        best = max(window, key=lambda i: frames[i]["sharp"])
        picks.append(best)
    return cycle, picks


def idle_picks(frames):
    n = len(frames) - 1  # last frame repeats the first
    picks = []
    for k in range(IDLE):
        t = round(k * n / IDLE)
        window = [i for i in range(t - 1, t + 2) if 0 <= i < n]
        if k == 0:
            window = [0]
        picks.append(max(window, key=lambda i: frames[i]["sharp"]))
    return picks


def load_clip(path):
    out = []
    for rgb in run_ffmpeg_frames(path):
        mask = cut_out(rgb)
        out.append({"rgb": rgb, "mask": mask, "sharp": sharpness(rgb, mask), "gray": small_gray(rgb, mask)})
    return out


def place(frame, scale, anchor_x, foot):
    """Sample one source frame into a CELL x CELL premultiplied cell so that
    the clip's foot line lands on FOOT and the head centre on CELL/2."""
    rgb, mask = frame["rgb"], frame["mask"]
    step = 1.0 / scale
    x0 = anchor_x - (CELL / 2) * step
    y0 = (foot + 1) - (FOOT + 1) * step
    pad = int(CELL * step) + 2
    box = (x0 + pad, y0 + pad, x0 + pad + CELL * step, y0 + pad + CELL * step)
    rgba = np.pad(np.dstack([rgb, mask.astype(np.uint8) * 255]), ((pad, pad), (pad, pad), (0, 0)))
    im = Image.fromarray(rgba, "RGBA").convert("RGBa")
    small = im.resize((CELL, CELL), Image.BOX, box=box).convert("RGBA")
    arr = np.asarray(small).copy()
    alpha = arr[..., 3] >= 128
    return arr[..., :3].astype(np.float32), alpha


def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def build_palette(samples, k=COLOURS, seed=7):
    """k-means in Lab. Saturated pixels weigh more so small saturated parts
    (the warrior's blue shield, gold cross and red cape, the mage's crystal and
    gold trim, skin) each keep their own entries instead of being averaged
    into the large armour or robe."""
    rng = np.random.default_rng(seed)
    lab = srgb_to_lab(samples)
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    weight = 1.0 + (chroma / 12.0) ** 2
    centres = [lab[int(np.argmax(weight))]]
    for _ in range(1, k):
        d = np.min([((lab - c) ** 2).sum(1) for c in centres], 0) * weight
        if d.sum() <= 0:
            break  # fewer distinct colours than k: every one is a centre
        centres.append(lab[int(rng.choice(len(lab), p=d / d.sum()))])
    centres = np.array(centres)
    k = len(centres)
    for _ in range(40):
        d = ((lab[:, None, :] - centres[None]) ** 2).sum(2)
        idx = d.argmin(1)
        new = centres.copy()
        for j in range(k):
            sel = idx == j
            if sel.any():
                new[j] = (lab[sel] * weight[sel, None]).sum(0) / weight[sel].sum()
        if np.allclose(new, centres, atol=1e-3):
            break
        centres = new
    # The palette entry is the weighted mean sRGB of its members, so it is a
    # real colour from the clips, not a Lab round trip.
    d = ((lab[:, None, :] - centres[None]) ** 2).sum(2)
    idx = d.argmin(1)
    pal = []
    for j in range(k):
        sel = idx == j
        if not sel.any():
            continue
        c = (samples[sel] * weight[sel, None]).sum(0) / weight[sel].sum()
        pal.append(tuple(int(round(v)) for v in c))
    pal = sorted(set(pal), key=lambda c: (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], c))
    pal = [c for c in pal if max(abs(a - b) for a, b in zip(c, OUTLINE)) > 6]
    return pal


def quantize(rgb, alpha, pal_lab, pal):
    out = np.zeros((CELL, CELL, 4), np.uint8)
    pts = rgb[alpha]
    lab = srgb_to_lab(pts)
    idx = ((lab[:, None, :] - pal_lab[None]) ** 2).sum(2).argmin(1)
    ind = np.full((CELL, CELL), -1, np.int32)
    ind[alpha] = idx
    ind = despeckle(ind)
    sel = ind >= 0
    out[sel, :3] = np.array(pal, np.uint8)[ind[sel]]
    out[sel, 3] = 255
    return out


def despeckle(ind, passes=4):
    """A lone pixel, one whose opaque 4-neighbours all differ from it, takes
    the colour most of those neighbours share (ties go to the 8-neighbour
    count). That removes quantization salt without blurring edges."""
    h, w = ind.shape
    out = ind.copy()
    for _ in range(passes):
        p = np.pad(out, 1, constant_values=-1)
        sh = lambda dy, dx: p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
        n4 = [sh(-1, 0), sh(1, 0), sh(0, -1), sh(0, 1)]
        solid = np.sum([n >= 0 for n in n4], 0)
        same = np.sum([n == out for n in n4], 0)
        lone = (out >= 0) & (solid >= 2) & (same == 0)
        if not lone.any():
            break
        # In place, so two touching lone pixels cannot swap colours forever.
        for y, x in np.argwhere(lone):
            near = [(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)]
            ring = near + [(y - 1, x - 1), (y - 1, x + 1), (y + 1, x - 1), (y + 1, x + 1)]
            look = lambda yy, xx: out[yy, xx] if 0 <= yy < h and 0 <= xx < w else -1
            cand = [look(*q) for q in near if look(*q) >= 0]
            if out[y, x] in cand or len(cand) < 2:
                continue
            around = [look(*q) for q in ring if look(*q) >= 0]
            out[y, x] = max(set(cand), key=lambda v: (cand.count(v), around.count(v), -v))
    return out


def write_png(path, rgba):
    """RGBA PNG with filter 0 on every row, the form assets/js/hd2d/png.js reads."""
    h, w, _ = rgba.shape
    raw = np.zeros((h, w * 4 + 1), np.uint8)
    raw[:, 1:] = rgba.reshape(h, w * 4)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw.tobytes(), 9)) + chunk(b"IEND", b""))


def outline(cell):
    a = cell[..., 3] > 0
    p = np.pad(a, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~a
    cell[ring, :3] = OUTLINE
    cell[ring, 3] = 255
    return cell


def normals(rgba):
    h, w, _ = rgba.shape
    a = rgba[..., 3] >= 128
    lum = (0.2126 * rgba[..., 0] + 0.7152 * rgba[..., 1] + 0.0722 * rgba[..., 2]) / 255.0
    hgt = np.where(a, lum, 0.0)
    p = np.pad(hgt, 1)
    dx = (p[1:-1, 2:] - p[1:-1, :-2]) * 2.4
    dy = (p[2:, 1:-1] - p[:-2, 1:-1]) * 2.4
    ln = np.sqrt(dx * dx + dy * dy + 1)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., 0] = np.round((-dx / ln) * 127.5 + 127.5)
    out[..., 1] = np.round((-dy / ln) * 127.5 + 127.5)
    out[..., 2] = np.round((1 / ln) * 127.5 + 127.5)
    out[..., 3] = np.where(a, 255, 0)
    return out


def clip_geometry(frames, picks):
    """The clip scale: its median body height becomes FILL. Frames may move
    5% off it (see main). Anchor: per frame, foot line and head centre,
    because walk-in-place clips drift a little."""
    heights = []
    for i in picks:
        top, foot = span(frames[i]["mask"])
        heights.append(foot - top + 1)
    scale = FILL / float(np.median(heights))
    return scale


def palette_samples(dirs):
    """Palette samples from the eight start poses only. They are the
    concept-matched stills every clip starts from, so they carry every
    material. Sampling the clip frames too made the palette depend on every
    clip: swapping one warrior idle clip reshuffled the k-means draw and moved the
    front-view shield blue off its hue."""
    samples = []
    for d in COLUMNS:
        pose = np.asarray(Image.open(os.path.join(dirs, f"{d}.png")).convert("RGB"))
        m = cut_out(pose)
        top, foot = span(m)
        rgb, alpha = place({"rgb": pose, "mask": m}, FILL / (foot - top + 1), head_centre(m), foot)
        samples.append(rgb[alpha])
    return np.concatenate(samples).astype(np.float64)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("hero", help="hero name, e.g. warrior or mage")
    ap.add_argument("--clips", help="default assets/reference/<hero>/video")
    ap.add_argument("--out", help="default priv/static/images/hd2d/<hero>-walk.png")
    ap.add_argument("--report", help="write picks and scales as JSON here")
    args = ap.parse_args(argv)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    args.clips = args.clips or os.path.join(root, "assets/reference", args.hero, "video")
    args.out = args.out or os.path.join(root, "priv/static/images/hd2d", f"{args.hero}-walk.png")

    plan = {}
    raw = {}
    for d in COLUMNS:
        walk = load_clip(os.path.join(args.clips, f"walk-{d}.mp4"))
        idle = load_clip(os.path.join(args.clips, f"idle-{d}.mp4"))
        cycle, wp = walk_picks(walk)
        ip = idle_picks(idle)
        ws = clip_geometry(walk, wp)
        iscale = clip_geometry(idle, ip)
        cells = []
        for frames, picks, scale in ((walk, wp, ws), (idle, ip, iscale)):
            for i in picks:
                f = frames[i]
                top, foot = span(f["mask"])
                # Grok clips are not camera-locked: the figure drifts and
                # breathes in size by a few percent. Each frame is fitted to
                # FILL, within 5% of the clip scale, and anchored on its own
                # foot line and head centre. A fixed per-clip anchor for idle
                # was tried and moved the feet by 3 px without less sway.
                own = min(max(FILL / (foot - top + 1), scale * 0.95), scale * 1.05)
                cells.append(place(f, own, head_centre(f["mask"]), foot))
        raw[d] = cells
        plan[d] = {"walk_frames": len(walk), "cycle": cycle, "walk": wp, "idle": ip,
                   "walk_scale": round(ws, 4), "idle_scale": round(iscale, 4)}
        print(f"{d}: cycle {cycle}/{len(walk)} walk {wp} idle {ip} scale {ws:.3f}/{iscale:.3f}", file=sys.stderr)

    pal = build_palette(palette_samples(os.path.join(args.clips, "dirs")))
    pal_lab = srgb_to_lab(np.array(pal, np.float64))

    sheet = np.zeros((CELL * (WALK + IDLE), CELL * len(COLUMNS), 4), np.uint8)
    for c, d in enumerate(COLUMNS):
        for r, (rgb, alpha) in enumerate(raw[d]):
            cell = outline(quantize(rgb, alpha, pal_lab, pal))
            sheet[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = cell
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_png(args.out, sheet)
    write_png(args.out.replace(".png", "-normal.png"), normals(sheet))
    print(f"wrote {args.out} {sheet.shape[1]}x{sheet.shape[0]}, {len(pal)} colours + outline", file=sys.stderr)
    if args.report:
        with open(args.report, "w") as fh:
            json.dump({"palette": pal, "plan": plan}, fh, indent=1)


if __name__ == "__main__":
    main()
