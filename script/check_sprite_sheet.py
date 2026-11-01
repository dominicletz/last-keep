#!/usr/bin/env python3
"""Local checks for a hero sheet built by script/sprite_from_video.py.

    python3 script/check_sprite_sheet.py mage --out /tmp/approval

HERO is a key of HEROES. The sheet defaults to
priv/static/images/hd2d/<hero>-walk.png, the start poses to
assets/reference/<hero>/video/dirs and the concept to
assets/reference/<hero>/concept.png; --sheet, --poses and --concept override.

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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL, WALK, IDLE, COLUMNS = sv.CELL, sv.WALK, sv.IDLE, sv.COLUMNS
OUTLINE = sv.OUTLINE
GROUND = (58, 66, 52, 255)
HEAD = (54, 74)  # columns around the head centre (x = 64) that hold the face


def _warm(h, l, chroma):
    return 14 <= h <= 50 and chroma > 0.2 and l > 0.25


# What each hero must keep. roles: ordered (name, test on hue in degrees,
# HLS lightness, chroma); the first match names a colour, chroma under 0.12 is
# neutral. anchors: concept colours the palette keeps within dE 15. prop: the
# role whose side of the body each start pose fixes. back and front: per-frame
# floors and ceilings on the N and S columns. A measure is ("count", role),
# ("head", role[, columns]) for the top 30% of the body, or ("inside", role,
# box_role) for role pixels inside box_role's bounding box.
HEROES = {
    "warrior": {
        # Sampled from assets/reference/warrior/concept.png (cape from the N
        # pose, since the concept is a front view).
        "anchors": {"shield blue": (32, 56, 82), "gold cross": (170, 122, 65), "skin": (152, 103, 61),
                    "red cape": (67, 21, 17)},
        "roles": (("blue", lambda h, l, c: 195 <= h <= 245),
                  ("red", lambda h, l, c: (h >= 340 or h <= 12) and l < 0.45),
                  ("warm", _warm)),  # gold cross, face, belt buckle: same hue family here
        "prop": ("shield", "blue"),
        "back": ("back view N shows cape, no face",
                 (("face", ("head", "warm"), None, 6), ("cape", ("count", "red"), 201, None))),
        "front": ("front view keeps shield blue, gold cross, face",
                  (("blue", ("count", "blue"), 60, None), ("cross", ("inside", "warm", "blue"), 8, None),
                   ("face", ("head", "warm"), 8, None))),
    },
    "mage": {
        # Sampled from assets/reference/mage/concept.png: crystal facet,
        # cheek, robe skirt, shoulder trim, staff shaft.
        "anchors": {"crystal cyan": (7, 147, 195), "skin": (209, 148, 99), "robe blue": (36, 64, 98),
                    "gold trim": (198, 151, 79), "staff brown": (78, 48, 24)},
        # The crystal is a saturated cyan; the robe blue sits past 205 degrees.
        "roles": (("crystal", lambda h, l, c: 180 <= h <= 200 and c > 0.5),
                  ("blue", lambda h, l, c: 205 <= h <= 235),
                  ("warm", _warm)),  # gold trim and face share a hue here
        "prop": ("staff crystal", "crystal"),
        # The staff head sits beside the head, so the face is counted only in
        # the head columns. Measured on the approved poses: back <= 8, front >= 44.
        "back": ("back view N shows hood, no face",
                 (("face", ("head", "warm", HEAD), None, 10), ("robe", ("count", "blue"), 1001, None))),
        "front": ("front view keeps robe blue, gold trim, crystal, face",
                  (("blue", ("count", "blue"), 600, None), ("trim", ("count", "warm"), 150, None),
                   ("crystal", ("count", "crystal"), 40, None), ("face", ("head", "warm", HEAD), 30, None))),
    },
}


def cells(sheet):
    return [[sheet[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] for r in range(WALK + IDLE)]
            for c in range(len(COLUMNS))]


def role(rgb, table):
    r, g, b = [v / 255 for v in rgb]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    chroma = max(r, g, b) - min(r, g, b)
    if chroma < 0.12:
        return "neutral"
    for name, test in table:
        if test(h, l, chroma):
            return name
    return "other"


def roles(cell, table):
    out = np.full(cell.shape[:2], "", object)
    a = cell[..., 3] > 0
    cache = {}
    for y, x in np.argwhere(a):
        k = tuple(int(v) for v in cell[y, x, :3])
        if k not in cache:
            cache[k] = "outline" if k == OUTLINE else role(k, table)
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


def prop_offset(cell, table, prop):
    r = roles(cell, table)
    hit = np.argwhere(r == prop)
    body = np.argwhere(cell[..., 3] > 0)
    if len(hit) < 6:
        return None, len(hit)
    return float(hit[:, 1].mean() - body[:, 1].mean()), len(hit)


def measure(cell, table, spec):
    r = roles(cell, table)
    kind, name = spec[0], spec[1]
    if kind == "count":
        return int((r == name).sum())
    if kind == "head":
        top, foot = body_span(cell)
        band = r[top:top + int((foot - top) * 0.3)]
        if len(spec) > 2:
            band = band[:, spec[2][0]:spec[2][1]]
        return int((band == name).sum())
    if kind == "inside":
        box = np.argwhere(r == spec[2])
        if not len(box):
            return 0
        (y0, x0), (y1, x1) = box.min(0), box.max(0)
        return int((r[y0:y1 + 1, x0:x1 + 1] == name).sum())
    raise ValueError(spec)


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


def view_check(rep, frames, table, title, bounds):
    """Every frame of a view must hold each (label, measure, floor, ceiling)."""
    parts, ok = [], True
    for label_, spec, lo, hi in bounds:
        vals = [measure(f, table, spec) for f in frames]
        if lo is not None:
            ok &= min(vals) >= lo
            parts.append(f"min {label_} {min(vals)}")
        if hi is not None:
            ok &= max(vals) <= hi
            parts.append(f"max {label_} {max(vals)}")
    rep.check(ok, title, ", ".join(parts) + " px per frame")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("hero", choices=sorted(HEROES))
    ap.add_argument("--sheet")
    ap.add_argument("--poses")
    ap.add_argument("--concept")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    hero = HEROES[args.hero]
    table = hero["roles"]
    sheet_path = args.sheet or os.path.join(ROOT, "priv/static/images/hd2d", f"{args.hero}-walk.png")
    poses_dir = args.poses or os.path.join(ROOT, "assets/reference", args.hero, "video/dirs")
    concept = args.concept or os.path.join(ROOT, "assets/reference", args.hero, "concept.png")
    if not os.path.exists(concept):
        concept = None
    sheet = np.asarray(Image.open(sheet_path).convert("RGBA")).copy()
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
    for name, rgb in hero["anchors"].items():
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

    # Prop side from the start poses, not a guess.
    prop_name, prop_role = hero["prop"]
    poses = pose_cells(poses_dir)
    for c, d in enumerate(COLUMNS):
        want, n = prop_offset(poses[d], table, prop_role)
        got = [prop_offset(grid[c][r], table, prop_role) for r in range(WALK + IDLE)]
        if want is None or abs(want) < 2:
            seen = [g for g, _ in got if g is not None]
            rep.check(True, f"{prop_name} {d}", f"pose shows {n} {prop_role} px: no side to hold" +
                      (f"; sheet frames show {prop_role} in {len(seen)}/12" if seen else ""))
            continue
        side = "right" if want > 0 else "left"
        bad = [r for r, (g, _) in enumerate(got) if g is None or g * want <= 0 or abs(g) < 2]
        rep.check(not bad, f"{prop_name} {d} on screen-{side} of body", f"pose {want:+.1f}px; bad rows {bad}")

    for col, (title, bounds) in (("N", hero["back"]), ("S", hero["front"])):
        c = COLUMNS.index(col)
        view_check(rep, [grid[c][r] for r in range(WALK + IDLE)], table, title, bounds)

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
        write_contact(grid, concept, os.path.join(args.out, "contact.png"))
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
