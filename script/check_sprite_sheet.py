#!/usr/bin/env python3
"""Local checks for a hero sheet built by script/sprite_from_video.py.

    python3 script/check_sprite_sheet.py \
        priv/static/images/hd2d/warrior-walk.png \
        --poses assets/reference/warrior/video/dirs \
        --concept assets/reference/warrior/concept.png \
        --out /tmp/approval

Prints one line per check and exits 1 if any fails. With --out it writes
contact.png (concept | 8 directions at 1x and 2x | every walk row at 2x),
walk.gif and idle.gif (all 8 directions at 3x). No CI, no browser.
"""
import argparse
import colorsys
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_from_video as sv  # noqa: E402

CELL, WALK, IDLE, COLUMNS = sv.CELL, sv.WALK, sv.IDLE, sv.COLUMNS
OUTLINE = sv.OUTLINE
GROUND = (58, 66, 52, 255)
# Sampled from assets/reference/warrior/concept.png (cape from the N pose,
# since the concept is a front view). The palette must keep each one.
ANCHORS = {"shield blue": (32, 56, 82), "gold cross": (170, 122, 65), "skin": (152, 103, 61), "red cape": (67, 21, 17)}


def cells(sheet):
    return [[sheet[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] for r in range(WALK + IDLE)]
            for c in range(len(COLUMNS))]


def role(rgb):
    r, g, b = [v / 255 for v in rgb]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    chroma = max(r, g, b) - min(r, g, b)
    if chroma < 0.12:
        return "neutral"
    if 195 <= h <= 245:
        return "blue"
    if (h >= 340 or h <= 12) and l < 0.45:
        return "red"
    if 14 <= h <= 50 and chroma > 0.2 and l > 0.25:
        return "warm"  # gold cross, face, belt buckle: same hue family here
    return "other"


def roles(cell):
    out = np.full(cell.shape[:2], "", object)
    a = cell[..., 3] > 0
    cache = {}
    for y, x in np.argwhere(a):
        k = tuple(int(v) for v in cell[y, x, :3])
        if k not in cache:
            cache[k] = "outline" if k == OUTLINE else role(k)
        out[y, x] = cache[k]
    return out


def body_span(cell):
    ys = np.nonzero((cell[..., 3] > 0).any(1))[0]
    return int(ys[0]), int(ys[-1])


def changed_lower(a, b):
    h = CELL // 2
    return int((np.any(a[h:] != b[h:], axis=2)).sum())


def changed(a, b):
    return int(np.any(a != b, axis=2).sum())


def shield_offset(cell):
    r = roles(cell)
    blue = np.argwhere(r == "blue")
    body = np.argwhere(cell[..., 3] > 0)
    if len(blue) < 6:
        return None, len(blue)
    return float(blue[:, 1].mean() - body[:, 1].mean()), len(blue)


class Report:
    def __init__(self):
        self.fails = 0

    def check(self, ok, name, detail=""):
        print(f"{'PASS' if ok else 'FAIL'}  {name}{('  ' + detail) if detail else ''}")
        if not ok:
            self.fails += 1


def pose_cells(poses):
    out = {}
    for d in COLUMNS:
        pose = np.asarray(Image.open(os.path.join(poses, f"{d}.png")).convert("RGB"))
        m = sv.cut_out(pose)
        top, foot = sv.span(m)
        rgb, alpha = sv.place({"rgb": pose, "mask": m}, sv.FILL / (foot - top + 1), sv.head_centre(m), foot)
        cell = np.zeros((CELL, CELL, 4), np.uint8)
        cell[alpha, :3] = np.clip(rgb[alpha], 0, 255).astype(np.uint8)
        cell[alpha, 3] = 255
        out[d] = cell
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("--poses", required=True)
    ap.add_argument("--concept")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    sheet = np.asarray(Image.open(args.sheet).convert("RGBA")).copy()
    rep = Report()

    rep.check(sheet.shape == (CELL * (WALK + IDLE), CELL * len(COLUMNS), 4), "sheet size",
              f"{sheet.shape[1]}x{sheet.shape[0]} (want {CELL * len(COLUMNS)}x{CELL * (WALK + IDLE)})")
    alpha = sheet[..., 3]
    rep.check(set(np.unique(alpha)) <= {0, 255}, "alpha is 0 or 255")
    opaque = sheet[alpha > 0][:, :3]
    colours = {tuple(int(v) for v in c) for c in np.unique(opaque, axis=0)}
    body_colours = colours - {OUTLINE}
    rep.check(len(body_colours) <= 32, "palette size", f"{len(body_colours)} colours + outline")
    pal = sorted(body_colours)
    pal_lab = sv.srgb_to_lab(np.array(pal, np.float64))
    for name, rgb in ANCHORS.items():
        d = np.sqrt(((pal_lab - sv.srgb_to_lab(np.array([rgb], np.float64))) ** 2).sum(1))
        j = int(d.argmin())
        rep.check(d[j] <= 15, f"palette keeps {name} {rgb}", f"nearest {pal[j]} dE {d[j]:.1f}")

    grid = cells(sheet)
    a = alpha > 0
    p = np.pad(a, 1)
    edge = a & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    edge_ok = np.all(sheet[edge][:, :3] == OUTLINE, axis=1)
    rep.check(edge_ok.all() and OUTLINE in colours, "1 px outline on every silhouette edge",
              f"{int((~edge_ok).sum())} edge pixels off-outline")

    heights, feet = [], []
    for c in range(len(COLUMNS)):
        for r in range(WALK + IDLE):
            top, foot = body_span(grid[c][r])
            heights.append(foot - top + 1)
            feet.append(foot)
    rep.check(all(abs(h - sv.HERO) <= 2 for h in heights), "height 88 +-2 px",
              f"min {min(heights)} max {max(heights)}")
    rep.check(max(feet) - min(feet) <= 1 and abs(feet[0] - (sv.FOOT + 1)) <= 1, "shared foot line",
              f"rows {min(feet)}..{max(feet)} (target {sv.FOOT + 1})")

    lone = 0
    for c in range(len(COLUMNS)):
        for r in range(WALK + IDLE):
            cell = grid[c][r]
            key = cell[..., 0].astype(np.int32) * 65536 + cell[..., 1].astype(np.int32) * 256 + cell[..., 2]
            outline_key = OUTLINE[0] * 65536 + OUTLINE[1] * 256 + OUTLINE[2]
            key[cell[..., 3] == 0] = -1
            key[key == outline_key] = -1
            q = np.pad(key, 1, constant_values=-1)
            n4 = [q[:-2, 1:-1], q[2:, 1:-1], q[1:-1, :-2], q[1:-1, 2:]]
            solid = np.sum([n >= 0 for n in n4], 0)
            same = np.sum([n == key for n in n4], 0)
            lone += int(((key >= 0) & (solid >= 2) & (same == 0)).sum())
    rep.check(lone == 0, "no lone speckle pixels inside the body", f"{lone}")

    # Shield side from the start poses, not a guess.
    poses = pose_cells(args.poses)
    for c, d in enumerate(COLUMNS):
        want, n = shield_offset(poses[d])
        got = [shield_offset(grid[c][r]) for r in range(WALK + IDLE)]
        if want is None or abs(want) < 2:
            seen = [g for g, _ in got if g is not None]
            rep.check(True, f"shield {d}", f"pose shows {n} blue px: no side to hold" +
                      (f"; sheet frames show blue in {len(seen)}/12" if seen else ""))
            continue
        side = "right" if want > 0 else "left"
        bad = [r for r, (g, _) in enumerate(got) if g is None or g * want <= 0 or abs(g) < 2]
        rep.check(not bad, f"shield {d} on screen-{side} of body", f"pose {want:+.1f}px; bad rows {bad}")

    def head_warm(cell):
        top, foot = body_span(cell)
        band = roles(cell)[top:top + int((foot - top) * 0.3)]
        return int((band == "warm").sum())

    def cross_warm(cell):
        r = roles(cell)
        blue = np.argwhere(r == "blue")
        if not len(blue):
            return 0
        (y0, x0), (y1, x1) = blue.min(0), blue.max(0)
        return int((r[y0:y1 + 1, x0:x1 + 1] == "warm").sum())

    n = COLUMNS.index("N")
    face = max(head_warm(grid[n][r]) for r in range(WALK + IDLE))
    red = min(int((roles(grid[n][r]) == "red").sum()) for r in range(WALK + IDLE))
    rep.check(face <= 6 and red > 200, "back view N shows cape, no face", f"max face px {face}, min cape px {red}")
    s = COLUMNS.index("S")
    gold = min(cross_warm(grid[s][r]) for r in range(WALK + IDLE))
    blue = min(int((roles(grid[s][r]) == "blue").sum()) for r in range(WALK + IDLE))
    face = min(head_warm(grid[s][r]) for r in range(WALK + IDLE))
    rep.check(gold >= 8 and blue >= 60 and face >= 8, "front view keeps shield blue, gold cross, face",
              f"min blue {blue}, cross {gold}, face {face} px per frame")

    first = [grid[c][0] for c in range(len(COLUMNS))]
    worst = None
    for i in range(len(COLUMNS)):
        for j in range(len(COLUMNS)):
            if i == j:
                continue
            d1 = changed(first[i], first[j])
            d2 = changed(first[i], first[j][:, ::-1])
            m = min(d1, d2)
            if worst is None or m < worst[0]:
                worst = (m, COLUMNS[i], COLUMNS[j])
    rep.check(worst[0] >= 300, "8 directions distinct (and not mirrors)",
              f"closest pair {worst[1]}/{worst[2]} differs by {worst[0]} px")

    def shape(a, b):
        return int(((a[..., 3] > 0) != (b[..., 3] > 0)).sum())

    for c, d in enumerate(COLUMNS):
        moves = [changed_lower(grid[c][r], grid[c][(r + 1) % WALK]) for r in range(WALK)]
        contact = changed_lower(grid[c][0], grid[c][4])
        rep.check(min(moves) >= 16 and contact >= 16, f"walk {d} legs move",
                  f"lower-half px per step {moves}, contact 0 vs 4 {contact}")
        walk_shape = float(np.median([shape(grid[c][r], grid[c][(r + 1) % WALK]) for r in range(WALK)]))
        idle_shape = [shape(grid[c][WALK + r], grid[c][WALK + (r + 1) % IDLE]) for r in range(IDLE)]
        idle_col = [changed(grid[c][WALK + r], grid[c][WALK + (r + 1) % IDLE]) for r in range(IDLE)]
        rep.check(min(idle_col) > 0 and max(idle_shape) <= 0.6 * walk_shape, f"idle {d} subtle",
                  f"silhouette px per step {idle_shape} vs walk median {int(walk_shape)}")

    if args.out:
        os.makedirs(args.out, exist_ok=True)
        write_contact(grid, args.concept, os.path.join(args.out, "contact.png"))
        write_gif(grid, range(WALK), os.path.join(args.out, "walk.gif"), 125)
        write_gif(grid, range(WALK, WALK + IDLE), os.path.join(args.out, "idle.gif"), 320)
        print(f"wrote {args.out}/contact.png walk.gif idle.gif")
    print(f"{'OK' if not rep.fails else 'FAILED'}: {rep.fails} failing checks")
    return 1 if rep.fails else 0


def on_ground(cell, k):
    im = Image.new("RGBA", (CELL, CELL), GROUND)
    im.alpha_composite(Image.fromarray(np.ascontiguousarray(cell), "RGBA"))
    return im.resize((CELL * k, CELL * k), Image.NEAREST)


def label(img, text, xy):
    from PIL import ImageDraw
    ImageDraw.Draw(img).text(xy, text, fill=(235, 230, 220, 255))


def write_contact(grid, concept, path):
    n = len(COLUMNS)
    W = CELL * 2 * n
    concept_h = 0
    con = None
    if concept:
        con = Image.open(concept).convert("RGBA")
        con = con.resize((int(con.width * 360 / con.height), 360), Image.LANCZOS)
        concept_h = 360 + 20
    H = concept_h + (CELL + 20) + (CELL * 2 + 20) + n * (CELL * 2 + 4) + 20
    out = Image.new("RGBA", (max(W, con.width if con else 0), H), (30, 32, 40, 255))
    y = 0
    if con:
        out.alpha_composite(con, (0, 0))
        label(out, "concept", (con.width + 10, 10))
        y = concept_h
    label(out, "1x  " + "  ".join(COLUMNS), (4, y + 2))
    for c in range(n):
        out.alpha_composite(on_ground(grid[c][0], 1), (c * CELL, y + 16))
    y += CELL + 20
    label(out, "2x", (4, y + 2))
    for c in range(n):
        out.alpha_composite(on_ground(grid[c][0], 2), (c * CELL * 2, y + 16))
        label(out, COLUMNS[c], (c * CELL * 2 + 6, y + 18))
    y += CELL * 2 + 20
    for c in range(n):
        for r in range(WALK):
            out.alpha_composite(on_ground(grid[c][r], 2), (r * CELL * 2, y))
        label(out, f"walk {COLUMNS[c]}", (6, y + 4))
        y += CELL * 2 + 4
    out.convert("RGB").save(path)


def write_gif(grid, rows, path, ms):
    frames = []
    for r in rows:
        f = Image.new("RGBA", (CELL * 3 * 4, CELL * 3 * 2), GROUND)
        for c in range(len(COLUMNS)):
            f.alpha_composite(on_ground(grid[c][r], 3), ((c % 4) * CELL * 3, (c // 4) * CELL * 3))
            label(f, COLUMNS[c], ((c % 4) * CELL * 3 + 8, (c // 4) * CELL * 3 + 6))
        frames.append(f.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=1)


if __name__ == "__main__":
    sys.exit(main())
