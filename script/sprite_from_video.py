#!/usr/bin/env python3
"""Build a hero's 8-direction walk + idle sheet, or a monster's walk +
attack + death sheet, from Grok Imagine clips.

    python3 script/sprite_from_video.py mage --report /tmp/report.json
    python3 script/sprite_from_video.py goblin

HERO names the folders: clips from assets/reference/<hero>/video, sheet to
priv/static/images/hd2d/<hero>-walk.png. --clips and --out override them.
A name with assets/reference/<name>/asset.json (type monster) builds the
monster sheet its "sheet" block sizes instead, to <name>-sheet.png; see
build_monster.

Input folder: dirs/<DIR>.png start poses on white, walk-<DIR>.mp4 (2 s
walk-in-place loop), idle-<DIR>.mp4 (2 s breathing loop) for DIR in
S SE E NE N NW W SW. Screen convention: S faces the camera, E faces
screen-right, N is the back, W faces screen-left.

Output: <out>.png (albedo) and <out>-normal.png. Columns follow
pictureColumn: S, SW, W, NW, N, NE, E, SE. Rows: 8 walk frames, then 4 idle.
When every attack clip (8) and every death clip (S W N E) is on disk, the
sheet gains 6 attack rows and 6 death rows and idle moves to row 20.
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
from typing import NamedTuple

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
# Attack and death rows use the monster row counts (attack_picks and
# death_picks). A hero sheet gains them only when every clip of that block
# is on disk; until then the sheet stays the 8 walk + 4 idle rows.
ATTACK_ROWS = 6
DEATH_ROWS = 6
COLOURS = 28         # palette size, not counting the outline
OUTLINE = (24, 24, 24)
BG_LOOSE = 222       # min channel for border-connected white
BG_TIGHT = 240       # min channel for an enclosed white hole
HOLE_MIN = 24        # smallest enclosed hole (source px) treated as background
# Monster sheets: rows in this order (the client's sheetRow reads walk, then
# attack, then death, then idle), only the kinds the asset has clips for.
# An NPC idle is four frames, the same count as a hero idle.
MONSTER_ROWS = (("walk", WALK), ("attack", 6), ("death", 6), ("idle", IDLE))
# A diagonal death reuses the nearest cardinal clip that keeps its read:
# SW and SE face the camera like S, NW and NE show the back like N. Never a
# mirror: a mirrored clip swaps the hand that holds the weapon.
DEATH_FROM = {"SW": "S", "SE": "S", "NW": "N", "NE": "N"}
FOOT_MARGIN = 8      # monster cells: lowest body pixel this many rows above the cell bottom
FLIER_FOOT_MARGIN = 24  # a flier's: its walk and attack hold frame 0's foot line and the downstroke
                        # sweeps the wings below it (the bat's take 2 reached 7 px under it, into
                        # the cell edge, with 38+ px empty above), so it hangs 16 px higher


class Spec(NamedTuple):
    """A sheet layout. height is the drawn figure with its 1 px outline, foot
    the cell row of the lowest body pixel, rows (kind, frames) top to bottom."""
    cell: int
    height: int
    foot: int
    rows: tuple
    colours: int = COLOURS
    flies: bool = False  # asset.json "flies": hover anchoring (monster_anchor) and the flier checks
    death_by_motion: bool = False  # asset.json "death_picks": "motion" (see death_picks)

    @property
    def fill(self):
        return self.height - 2

    def row_kind(self, r):
        for kind, n in self.rows:
            if r < n:
                return kind
            r -= n
        raise IndexError(r)

    def first_row(self, kind):
        r = 0
        for k, n in self.rows:
            if k == kind:
                return r
            r += n
        raise KeyError(kind)

    @property
    def frames(self):
        return sum(n for _, n in self.rows)


HERO_SPEC = Spec(CELL, HERO, FOOT, (("walk", WALK), ("idle", IDLE)))


def hero_bands(height):
    """Row ranges for a hero sheet of this pixel height.

    12 rows is walk then idle, the sheet the client reads today. 24 rows is
    walk, attack, death, idle: the same order as a monster sheet, so idle
    moves from row 8 to row 20. None when the height is neither."""
    if height == CELL * (WALK + IDLE):
        return {"walk": range(WALK), "attack": range(0), "death": range(0),
                "idle": range(WALK, WALK + IDLE)}
    full = WALK + ATTACK_ROWS + DEATH_ROWS + IDLE
    if height == CELL * full:
        attack = WALK
        death = attack + ATTACK_ROWS
        idle = death + DEATH_ROWS
        return {"walk": range(WALK), "attack": range(attack, death),
                "death": range(death, idle), "idle": range(idle, full)}
    return None


def actions_complete(clips):
    """Both extra blocks are present: attack on all 8 directions, death on
    S W N E. A partial set (the warrior pilot has only S) leaves the
    walk and idle sheet alone."""
    attack = all(os.path.exists(os.path.join(clips, f"attack-{d}.mp4")) for d in COLUMNS)
    death = all(os.path.exists(os.path.join(clips, f"death-{d}.mp4")) for d in ("S", "W", "N", "E"))
    return attack and death


def hero_attack_cells(frames):
    """Six attack cells placed like a walk frame: each frame's own foot and
    head centre, scale within 5% of the clip median. Returns picks, scale,
    cells (rgb, alpha) and the peak info."""
    peak, back, picks = attack_picks(frames, ATTACK_ROWS)
    scale = clip_geometry(frames, picks)
    cells = []
    for i in picks:
        f = frames[i]
        top, foot = span(f["mask"])
        own = min(max(FILL / (foot - top + 1), scale * 0.95), scale * 1.05)
        cells.append(place(f, own, head_centre(f["mask"]), foot))
    return picks, scale, cells, {"peak": peak, "recovery": back}


def hero_death_picks(frames, n=DEATH_ROWS):
    """Six frames from the start pose to the last frame. The last cell is the
    still lying pose the clip holds, not the earlier rest estimate a monster
    death uses (that estimate can still be mid-fall)."""
    end = len(frames) - 1
    picks = []
    for k in range(n):
        t = int(round(k * end / (n - 1)))
        picks.append(t if k in (0, n - 1) else sharpest(frames, t, 1, end))
    return picks


def hero_death_cells(frames):
    """Death cells at frame 0's scale, so a lying pose stays short. Each
    frame's own lowest pixel sits on the foot row, and x stays on frame 0's
    head centre so the body does not slide. Returns picks, scale, cells,
    a placer(i) for any source frame, and info."""
    top, foot = span(frames[0]["mask"])
    scale = FILL / float(foot - top + 1)
    x0 = head_centre(frames[0]["mask"])
    picks = hero_death_picks(frames)

    def placer(i):
        f = frames[i]
        return place(f, scale, x0, span(f["mask"])[1])

    return picks, scale, [placer(i) for i in picks], placer, {"scale": round(scale, 4)}


def cell_metrics(rgb, alpha):
    """Height, foot row and whether the outlined cell touches its border."""
    cell = np.zeros((CELL, CELL, 4), np.uint8)
    cell[alpha, :3] = np.clip(rgb[alpha], 0, 255).astype(np.uint8)
    cell[alpha, 3] = 255
    cell = outline(cell)
    ys = np.nonzero(cell[..., 3].any(1))[0]
    ring = np.ones((CELL, CELL), bool)
    ring[1:-1, 1:-1] = False
    if len(ys) == 0:
        return {"height": 0, "foot": -1, "edge": False}
    return {"height": int(ys[-1] - ys[0] + 1), "foot": int(ys[-1]),
            "edge": bool((cell[..., 3][ring] > 0).any())}


def paste_hero_actions(base, attack, death):
    """A 24-row sheet. Walk rows and idle rows are the base sheet's pixels.
    attack and death map a direction to ATTACK_ROWS / DEATH_ROWS outlined
    RGBA cells. Diagonal deaths are the caller's copies of the cardinal."""
    full = WALK + ATTACK_ROWS + DEATH_ROWS + IDLE
    tall = np.zeros((CELL * full, CELL * len(COLUMNS), 4), np.uint8)
    tall[:CELL * WALK] = base[:CELL * WALK]
    idle_at = WALK + ATTACK_ROWS + DEATH_ROWS
    tall[CELL * idle_at:CELL * (idle_at + IDLE)] = base[CELL * WALK:CELL * (WALK + IDLE)]
    for c, d in enumerate(COLUMNS):
        for r, cell in enumerate(attack[d]):
            row = WALK + r
            tall[row * CELL:(row + 1) * CELL, c * CELL:(c + 1) * CELL] = cell
        for r, cell in enumerate(death[d]):
            row = WALK + ATTACK_ROWS + r
            tall[row * CELL:(row + 1) * CELL, c * CELL:(c + 1) * CELL] = cell
    return tall


def sheet_spec(cfg):
    """The layout for a hero.json or asset.json config (as loaded JSON)."""
    if cfg.get("type", "hero") == "hero":
        return HERO_SPEC
    s = cfg["sheet"]
    cell = int(s["cell"])
    rows = tuple((k, n) for k, n in MONSTER_ROWS if k in cfg["clips"])
    flies = cfg.get("flies") is True
    return Spec(cell, int(s["height"]), cell - (FLIER_FOOT_MARGIN if flies else FOOT_MARGIN), rows,
                int(s.get("colours", COLOURS)), flies, cfg.get("death_picks") == "motion")


def clip_for(clips, kind, d):
    """The direction whose kind clip fills column d: its own, or for death on
    a diagonal the DEATH_FROM cardinal."""
    have = clips.get(kind, ())
    if d in have:
        return d
    if kind == "death" and DEATH_FROM.get(d) in have:
        return DEATH_FROM[d]
    raise SystemExit(f"no {kind} clip for {d} (clips {list(have)}; a diagonal death needs {DEATH_FROM.get(d)})")


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


def torso_centre(mask, h):
    """Median x of the torso band (30-70% of the figure height h above the
    lowest pixel), after an opening that drops parts thinner than 4% of h.
    A spear shaft or a raised arm does not pull it, unlike head_centre, whose
    top band is the spearhead when the spear is upright."""
    _, foot = span(mask)
    band = mask[max(0, int(foot - 0.7 * h)):max(1, int(foot - 0.3 * h))]
    opened = ndimage.binary_opening(band, np.ones((1, max(3, int(h * 0.04))), bool))
    xs = np.nonzero(opened if opened.any() else band)[1]
    return float(np.median(xs)) if len(xs) else mask.shape[1] / 2


def feet_centre(mask, h):
    """Median x of the bottom 10% of the figure."""
    _, foot = span(mask)
    xs = np.nonzero(mask[max(0, int(foot - 0.1 * h)):foot + 1])[1]
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


def sharpest(frames, t, lo, hi):
    window = [i for i in range(t - 1, t + 2) if lo <= i <= hi]
    return max(window or [min(max(t, lo), hi)], key=lambda i: frames[i]["sharp"])


def attack_picks(frames, n=6):
    """Wind-up, strike and recovery: frame 0, a third and two thirds of the
    way to the peak (the frame least like frame 0 in the first three
    quarters), the peak, midway back, and the recovery frame (the first after
    the peak within 20% of the peak's change). Frame 0 and the peak are
    exact; the rest take the sharpest frame within one frame."""
    g0 = frames[0]["gray"]
    d0 = [float(np.abs(f["gray"] - g0).mean()) for f in frames]
    end = max(2, int(len(frames) * 0.75))
    peak = 1 + int(np.argmax(d0[1:end]))
    back = next((i for i in range(peak + 1, len(frames)) if d0[i] <= 0.2 * d0[peak]), len(frames) - 1)
    targets = [0, peak / 3, 2 * peak / 3, peak, (peak + back) / 2, back][:n]
    picks = []
    for k, t in enumerate(targets):
        t = int(round(t))
        picks.append(t if k in (0, 3) else sharpest(frames, t, 1, len(frames) - 1))
    return peak, back, picks


def death_picks(frames, n=6, by_motion=False):
    """n frames from frame 0 to the rest frame: the first frame within 10%
    of the largest change from the last frame, so the fall ends on the
    ground and not in the long hold. The picks between are evenly timed or,
    by_motion (asset.json "death_picks": "motion"), at equal shares of the
    frame-to-frame change summed from frame 0 to the rest. A death holds the
    start pose for a moment and then falls fast, and evenly timed picks can
    spend most of the row on the hold and jump from standing to lying (the
    wolf's death-E: four picks standing, then flat). Ends are exact; the
    rest take the sharpest frame within one frame, each after the pick
    before it and leaving room for the ones after."""
    gl = frames[-1]["gray"]
    dl = [float(np.abs(f["gray"] - gl).mean()) for f in frames]
    top = max(dl)
    rest = next((i for i, v in enumerate(dl) if v <= 0.1 * top), len(frames) - 1) if top > 0 else 0
    if not by_motion or rest < n - 1:
        picks = []
        for k in range(n):
            t = int(round(k * rest / (n - 1)))
            picks.append(t if k in (0, n - 1) else sharpest(frames, t, 1, rest))
        return rest, picks
    step = [float(np.abs(frames[i]["gray"] - frames[i - 1]["gray"]).mean()) for i in range(1, rest + 1)]
    cum = np.concatenate([[0.0], np.cumsum(step)])
    picks = [0]
    for k in range(1, n - 1):
        lo, hi = picks[-1] + 1, rest - (n - 1 - k)
        t = int(np.searchsorted(cum, cum[-1] * k / (n - 1))) if cum[-1] > 0 else int(round(k * rest / (n - 1)))
        picks.append(sharpest(frames, min(max(t, lo), hi), lo, hi))
    picks.append(rest)
    return rest, picks


def load_clip(path):
    out = []
    for rgb in run_ffmpeg_frames(path):
        mask = cut_out(rgb)
        out.append({"rgb": rgb, "mask": mask, "sharp": sharpness(rgb, mask), "gray": small_gray(rgb, mask)})
    return out


def place(frame, scale, anchor_x, foot, cell=CELL, foot_row=FOOT):
    """Sample one source frame into a cell x cell premultiplied cell so that
    the clip's foot line lands on foot_row and anchor_x on cell/2."""
    rgb, mask = frame["rgb"], frame["mask"]
    step = 1.0 / scale
    x0 = anchor_x - (cell / 2) * step
    y0 = (foot + 1) - (foot_row + 1) * step
    pad = int(cell * step) + 2
    box = (x0 + pad, y0 + pad, x0 + pad + cell * step, y0 + pad + cell * step)
    rgba = np.pad(np.dstack([rgb, mask.astype(np.uint8) * 255]), ((pad, pad), (pad, pad), (0, 0)))
    im = Image.fromarray(rgba, "RGBA").convert("RGBa")
    small = im.resize((cell, cell), Image.BOX, box=box).convert("RGBA")
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
    out = np.zeros(alpha.shape + (4,), np.uint8)
    pts = rgb[alpha]
    lab = srgb_to_lab(pts)
    idx = ((lab[:, None, :] - pal_lab[None]) ** 2).sum(2).argmin(1)
    ind = np.full(alpha.shape, -1, np.int32)
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


def pose_place(pose, spec=HERO_SPEC):
    """A start pose (RGB array) in its sheet cell: hero poses anchor on the
    head centre, monster poses on the torso; both fill spec.fill."""
    m = cut_out(pose)
    top, foot = span(m)
    h = foot - top + 1
    if spec is HERO_SPEC:
        return place({"rgb": pose, "mask": m}, FILL / h, head_centre(m), foot)
    return place({"rgb": pose, "mask": m}, spec.fill / h, torso_centre(m, h), foot, spec.cell, spec.foot)


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


def build(clips, inspect=None):
    """The albedo sheet, its palette and the per-clip plan, in memory.
    inspect(dir, kind, frames, picks, scale), when given, sees every clip
    while its frames are loaded (hero_sprites.py precheck uses it)."""
    plan = {}
    raw = {}
    for d in COLUMNS:
        walk = load_clip(os.path.join(clips, f"walk-{d}.mp4"))
        idle = load_clip(os.path.join(clips, f"idle-{d}.mp4"))
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
        if inspect:
            inspect(d, "walk", walk, wp, ws)
            inspect(d, "idle", idle, ip, iscale)
        raw[d] = cells
        plan[d] = {"walk_frames": len(walk), "cycle": cycle, "walk": wp, "idle": ip,
                   "walk_scale": round(ws, 4), "idle_scale": round(iscale, 4)}
        print(f"{d}: cycle {cycle}/{len(walk)} walk {wp} idle {ip} scale {ws:.3f}/{iscale:.3f}", file=sys.stderr)

    pal = build_palette(palette_samples(os.path.join(clips, "dirs")))
    pal_lab = srgb_to_lab(np.array(pal, np.float64))

    sheet = np.zeros((CELL * (WALK + IDLE), CELL * len(COLUMNS), 4), np.uint8)
    for c, d in enumerate(COLUMNS):
        for r, (rgb, alpha) in enumerate(raw[d]):
            cell = outline(quantize(rgb, alpha, pal_lab, pal))
            sheet[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = cell
    # A missing attack or death clip leaves this sheet exactly as it is.
    # The walk and idle pixels above are copied unchanged when the blocks exist.
    if not actions_complete(clips):
        return sheet, pal, plan
    def outlined(cells):
        return [outline(quantize(rgb, alpha, pal_lab, pal)) for rgb, alpha in cells]

    attack, death = {}, {}
    for d in COLUMNS:
        frames = load_clip(os.path.join(clips, f"attack-{d}.mp4"))
        picks, scale, cells, info = hero_attack_cells(frames)
        attack[d] = outlined(cells)
        plan[d]["attack"] = {"clip": f"attack-{d}.mp4", "picks": picks, "scale": round(scale, 4), **info}
        if inspect:
            inspect(d, "attack", frames, picks, scale)
        del frames
    done = {}
    for d in ("S", "W", "N", "E"):
        frames = load_clip(os.path.join(clips, f"death-{d}.mp4"))
        picks, scale, cells, _placer, info = hero_death_cells(frames)
        done[d] = outlined(cells)
        plan[d]["death"] = {"clip": f"death-{d}.mp4", "picks": picks, "scale": round(scale, 4), **info}
        if inspect:
            inspect(d, "death", frames, picks, scale)
        del frames
    for d, src in DEATH_FROM.items():
        death[d] = done[src]
        plan[d]["death"] = dict(plan[src]["death"])
    for d in ("S", "W", "N", "E"):
        death[d] = done[d]
    return paste_hero_actions(sheet, attack, death), pal, plan


def monster_palette_samples(dirs, spec):
    samples = []
    for d in COLUMNS:
        rgb, alpha = pose_place(np.asarray(Image.open(os.path.join(dirs, f"{d}.png")).convert("RGB")), spec)
        samples.append(rgb[alpha])
    return np.concatenate(samples).astype(np.float64)


def monster_geometry(kind, frames, spec):
    """Picks, the clip scale and a placer(i) -> (rgb, alpha) for one monster
    clip. Frame 0 (the start pose every clip of a direction shares) sets the
    scale: its height becomes spec.fill, so walk, attack and death draw the
    body at one size. Fixed per clip, because the spear is inside the figure
    height: fitting each frame to the height would pump the body as the
    spear moves. walk: each frame anchors on its own torso centre and foot
    line (the clips drift). attack: the anchor follows the feet from frame
    0's torso, so a lunge does not slide the feet; foot line per frame.
    death: frame 0 sets anchor and foot line too, so the fall moves and
    drops inside the cell instead of being re-centred."""
    if kind == "walk":
        cycle, picks = walk_picks(frames)
        info = {"cycle": cycle}
    elif kind == "attack":
        peak, back, picks = attack_picks(frames)
        info = {"peak": peak, "recovery": back}
    elif kind == "idle":
        picks = idle_picks(frames)
        info = {}
    else:
        rest, picks = death_picks(frames, by_motion=spec.death_by_motion)
        info = {"rest": rest}
    top, foot = span(frames[0]["mask"])
    h = float(foot - top + 1)
    scale = spec.fill / h
    m0 = frames[0]["mask"]
    torso0, feet0, foot0 = torso_centre(m0, h), feet_centre(m0, h), span(m0)[1]

    def placer(i):
        f = frames[i]
        ax, foot = monster_anchor(kind, f["mask"], h, (torso0, feet0, foot0), spec.flies)
        return place(f, scale, ax, foot, spec.cell, spec.foot)
    return picks, scale, placer, info


def monster_anchor(kind, m, h, start, flies=False):
    """(anchor x, foot line) of one frame's mask m; start is frame 0's
    (torso x, feet x, foot line) and h its height. A figure on its feet: see
    monster_geometry. A flier (asset.json "flies") has no feet on a line:
    the wings sweep below the body on the downstroke, so the lowest pixel
    is not the ground. Its walk (a wingbeat in place) and attack (a bite
    from the hover) keep frame 0's anchor and foot line, like a locked
    camera: the body stays where the clip has it and the precheck loop and
    the hover check catch a drift. Its death anchors x on frame 0 and the
    foot line on each frame's own lowest pixel, so the cells keep the body
    in the cell while it drops; the drop itself is the client bringing the
    lift down to 0 (render.js)."""
    torso0, feet0, foot0 = start
    if flies:
        return torso0, (span(m)[1] if kind == "death" else foot0)
    if kind in ("walk", "idle"):
        return torso_centre(m, h), span(m)[1]
    if kind == "attack":
        return torso0 + feet_centre(m, h) - feet0, span(m)[1]
    return torso0, foot0


def build_monster(clips, spec, have, inspect=None):
    """A monster sheet: columns as the hero's, rows spec.rows (walk, attack,
    death). have maps kind -> directions with a clip; a diagonal death uses
    the DEATH_FROM cardinal clip, the same cells, never mirrored.
    inspect(dir, kind, frames, picks, scale, placer) sees every clip once,
    all walks first so a check can measure against the walk."""
    plan = {d: {} for d in COLUMNS}
    raw = {}
    for kind, n in spec.rows:
        done = {}
        for d in COLUMNS:
            # An idle authored on the four views only (an NPC) holds the start
            # pose on the other four columns. It is not a mirrored clip.
            if kind == "idle" and d not in have.get("idle", ()):
                rgb, alpha = pose_place(
                    np.asarray(Image.open(os.path.join(clips, "dirs", f"{d}.png")).convert("RGB")), spec)
                raw.setdefault(d, []).extend([(rgb, alpha)] * n)
                plan[d][kind] = {"clip": f"dirs/{d}.png", "frames": 1, "picks": [0] * n, "held": True}
                print(f"{d} {kind}: held on dirs/{d}.png", file=sys.stderr)
                continue
            src = clip_for(have, kind, d)
            if src not in done:
                frames = load_clip(os.path.join(clips, f"{kind}-{src}.mp4"))
                picks, scale, placer, info = monster_geometry(kind, frames, spec)
                if len(picks) != n:
                    raise SystemExit(f"{kind}-{src}: {len(picks)} picks for {n} rows")
                done[src] = ([placer(i) for i in picks],
                             {"clip": f"{kind}-{src}.mp4", "frames": len(frames), "picks": picks,
                              "scale": round(scale, 4), **info})
                if inspect:
                    inspect(src, kind, frames, picks, scale, placer)
                del frames
            raw.setdefault(d, []).extend(done[src][0])
            plan[d][kind] = done[src][1]
            print(f"{d} {kind}: {done[src][1]}", file=sys.stderr)

    pal = build_palette(monster_palette_samples(os.path.join(clips, "dirs"), spec), k=spec.colours)
    pal_lab = srgb_to_lab(np.array(pal, np.float64))
    c_ = spec.cell
    sheet = np.zeros((c_ * spec.frames, c_ * len(COLUMNS), 4), np.uint8)
    for c, d in enumerate(COLUMNS):
        for r, (rgb, alpha) in enumerate(raw[d]):
            sheet[r * c_:(r + 1) * c_, c * c_:(c + 1) * c_] = outline(quantize(rgb, alpha, pal_lab, pal))
    return sheet, pal, plan


def asset_config(name, root=None):
    """assets/reference/<name>/asset.json as loaded JSON, or None for a hero."""
    root = root or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(root, "assets/reference", name, "asset.json")
    if not os.path.exists(path):
        return None
    with open(path) as fh:
        return json.load(fh)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("hero", help="hero name, e.g. warrior or mage")
    ap.add_argument("--clips", help="default assets/reference/<hero>/video")
    ap.add_argument("--out", help="default priv/static/images/hd2d/<hero>-walk.png")
    ap.add_argument("--report", help="write picks and scales as JSON here")
    args = ap.parse_args(argv)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    args.clips = args.clips or os.path.join(root, "assets/reference", args.hero, "video")
    cfg = asset_config(args.hero, root)
    stem = "sheet" if cfg else "walk"
    args.out = args.out or os.path.join(root, "priv/static/images/hd2d", f"{args.hero}-{stem}.png")

    if cfg:
        sheet, pal, plan = build_monster(args.clips, sheet_spec(cfg), cfg["clips"])
    else:
        sheet, pal, plan = build(args.clips)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_png(args.out, sheet)
    if not cfg:
        # Monster cards are unlit like every monster billboard (they must read
        # in the night yard), so they ship no normal map.
        write_png(args.out.replace(".png", "-normal.png"), normals(sheet))
    print(f"wrote {args.out} {sheet.shape[1]}x{sheet.shape[0]}, {len(pal)} colours + outline", file=sys.stderr)
    if args.report:
        with open(args.report, "w") as fh:
            json.dump({"palette": pal, "plan": plan}, fh, indent=1)


if __name__ == "__main__":
    main()
