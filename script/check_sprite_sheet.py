#!/usr/bin/env python3
"""Local checks for a hero or monster sheet built by script/sprite_from_video.py.

    python3 script/check_sprite_sheet.py mage --out /tmp/approval
    python3 script/check_sprite_sheet.py goblin --out /tmp/approval

HERO is a hero with a check profile in assets/reference/<hero>/hero.json, or
an asset with one in assets/reference/<name>/asset.json (a monster: sheet
<name>-sheet.png, checks run_monster_checks, GIFs walk, attack and death,
plus sheet.png and strip.png). The hero sheet defaults to
priv/static/images/hd2d/<hero>-walk.png, the start poses to
assets/reference/<hero>/video/dirs and the concept to
assets/reference/<hero>/concept.png; --sheet, --poses and --concept override.

Prints one line per check and exits 1 if any fails. With --out it writes
contact.png (concept | 8 directions at 1x and 2x | every walk row at 2x),
walk.gif and idle.gif (all 8 directions at 3x). No CI, no browser.
"""
import argparse
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_from_video as sv  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL, WALK, IDLE, COLUMNS = sv.CELL, sv.WALK, sv.IDLE, sv.COLUMNS
OUTLINE = sv.OUTLINE
GROUND = (58, 66, 52, 255)


def _role_test(spec):
    """A role from hero.json: hue range in degrees ([340, 12] wraps through
    0), with optional strict chroma_gt, light_gt and light_lt bounds. A role
    with "neutral": true names greys (chroma under 0.12) instead, such as
    iron, and needs no hue."""
    lo, hi = spec.get("hue", (0, 360))
    cg, lg, ll = spec.get("chroma_gt"), spec.get("light_gt"), spec.get("light_lt")

    def test(h, l, c):
        in_hue = lo <= h <= hi if lo <= hi else (h >= lo or h <= hi)
        return (in_hue and (cg is None or c > cg) and (lg is None or l > lg)
                and (ll is None or l < ll))
    test.neutral = bool(spec.get("neutral"))
    return test


def _measure(spec):
    return tuple(tuple(x) if isinstance(x, list) else x for x in spec)


def profile(check):
    """The check profile in a hero.json, in the form main reads. "prop" is
    required; null says the figure holds nothing (a wolf), and then it may
    not set prop_dirs or prop_side_below."""
    if check["prop"] is None and ({"prop_dirs", "prop_side_below"} & set(check)):
        raise ValueError("prop is null: prop_dirs and prop_side_below have no prop to measure")
    return {
        "anchors": {k: tuple(v) for k, v in check["anchors"].items()},
        "roles": tuple((r["name"], _role_test(r)) for r in check["roles"]),
        "prop": None if check["prop"] is None else tuple(check["prop"]),
        "prop_dirs": tuple(check.get("prop_dirs", COLUMNS)),
        "prop_side_below": float(check.get("prop_side_below", 0.0)),
        "back": (check["back"]["title"], tuple((n, _measure(m), lo, hi) for n, m, lo, hi in check["back"]["bounds"])),
        "front": (check["front"]["title"], tuple((n, _measure(m), lo, hi) for n, m, lo, hi in check["front"]["bounds"])),
    }


def load_heroes(reference=os.path.join(ROOT, "assets/reference")):
    """Every hero whose assets/reference/<hero>/hero.json has a check profile.
    roles: ordered colour tests on hue in degrees, HLS lightness and chroma;
    the first match names a colour, chroma under 0.12 is neutral unless a
    "neutral" role claims it. anchors:
    concept colours the palette keeps within dE 15. prop: the role whose side
    of the body each start pose fixes. back and front: per-frame floors and
    ceilings on the N and S columns. prop_dirs (default all): the directions
    where the prop sits off the body midline; elsewhere it has no side.
    prop_side_below (default 0, read by the monster checks): the prop's side
    is measured only on prop pixels below this share of the body height from
    the top, so a same-colour part worn on the body (the skeleton's iron
    shoulder plate) does not pull the side to the midline; presence still
    counts every prop pixel. A measure is ["count", role],
    ["head", role, [x0, x1]?] for the top 30% of the body, or
    ["inside", role, box_role] for role pixels inside box_role's bounding box."""
    out = {}
    for name in sorted(os.listdir(reference)):
        path = os.path.join(reference, name, "hero.json")
        if os.path.exists(path):
            with open(path) as fh:
                check = json.load(fh).get("check")
            if check:
                out[name] = profile(check)
                if out[name]["prop"] is None:
                    raise ValueError(f"{name}/hero.json: a hero holds a prop (check prop is null)")
    return out


HEROES = load_heroes()


def load_assets(reference=os.path.join(ROOT, "assets/reference")):
    """Every non-hero asset whose asset.json has a check profile: name ->
    {"profile", "spec", "clips"}. The profile has the hero form (see
    load_heroes); spec is the sheet layout and clips the asset's clip kinds."""
    out = {}
    for name in sorted(os.listdir(reference)):
        path = os.path.join(reference, name, "asset.json")
        if os.path.exists(path):
            with open(path) as fh:
                cfg = json.load(fh)
            if cfg.get("check"):
                out[name] = {"profile": profile(cfg["check"]), "spec": sv.sheet_spec(cfg),
                             "clips": {k: list(v) for k, v in cfg["clips"].items()}}
    return out


ASSETS = load_assets()


def cells(sheet, cell=CELL, rows=WALK + IDLE):
    return [[sheet[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell] for r in range(rows)]
            for c in range(len(COLUMNS))]


def role(rgb, table):
    r, g, b = [v / 255 for v in rgb]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    chroma = max(r, g, b) - min(r, g, b)
    grey = chroma < 0.12
    for name, test in table:
        if test.neutral == grey and test(h, l, chroma):
            return name
    return "neutral" if grey else "other"


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
    h = a.shape[0] // 2
    return int((np.any(a[h:] != b[h:], axis=2)).sum())


def changed(a, b):
    return int(np.any(a != b, axis=2).sum())


def prop_offset(cell, table, prop, below=0.0):
    """(prop centroid x - body centroid x, prop px), or (None, px) under 6
    px. below > 0 counts only prop px under that share of the body span."""
    r = roles(cell, table)
    hit = np.argwhere(r == prop)
    if below:
        top, foot = body_span(cell)
        hit = hit[hit[:, 0] >= top + int((foot - top) * below)]
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


def row_clip(d, r):
    """The clip a 12-row sheet cell comes from: rows 0-7 walk, 8-11 idle.

    view_check calls this with the index of a walk-then-idle frame list, which
    is the same numbering. A 24-row sheet's attack rows share numbers 8-13
    with those idle rows, so the attack and death checks name their own clips."""
    if r < WALK:
        return f"walk-{d}.mp4"
    if r < WALK + IDLE:
        return f"idle-{d}.mp4"
    if r < WALK + sv.ATTACK_ROWS:
        return f"attack-{d}.mp4"
    if r < WALK + sv.ATTACK_ROWS + sv.DEATH_ROWS:
        src = d if d in ("S", "W", "N", "E") else sv.DEATH_FROM[d]
        return f"death-{src}.mp4"
    return f"idle-{d}.mp4"


class Report:
    """Prints one line per check. results keeps (ok, name, detail, clips):
    clips names the inputs a failing check blames, so hero_sprites.py
    precheck can say which clip to regenerate."""

    def __init__(self, quiet=False):
        self.fails = 0
        self.quiet = quiet
        self.results = []

    def check(self, ok, name, detail="", clips=()):
        ok = bool(ok)
        self.results.append((ok, name, detail, tuple(sorted(set(clips))) if not ok else ()))
        if self.quiet:
            if not ok:
                self.fails += 1
            return
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


def view_check(rep, frames, table, title, bounds, d, where=row_clip):
    """Every frame of a view must hold each (label, measure, floor, ceiling)."""
    parts, ok, bad = [], True, set()
    for label_, spec, lo, hi in bounds:
        vals = [measure(f, table, spec) for f in frames]
        if lo is not None:
            ok &= min(vals) >= lo
            bad |= {r for r, v in enumerate(vals) if v < lo}
            parts.append(f"min {label_} {min(vals)}")
        if hi is not None:
            ok &= max(vals) <= hi
            bad |= {r for r, v in enumerate(vals) if v > hi}
            parts.append(f"max {label_} {max(vals)}")
    rep.check(ok, title, ", ".join(parts) + " px per frame", [where(d, r) for r in bad])


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("hero", choices=sorted(HEROES) + sorted(ASSETS))
    ap.add_argument("--sheet")
    ap.add_argument("--poses")
    ap.add_argument("--concept")
    ap.add_argument("--out")
    args = ap.parse_args(argv)
    if args.hero in ASSETS:
        return monster_main(args)
    hero = HEROES[args.hero]
    sheet_path = args.sheet or os.path.join(ROOT, "priv/static/images/hd2d", f"{args.hero}-walk.png")
    poses_dir = args.poses or os.path.join(ROOT, "assets/reference", args.hero, "video/dirs")
    concept = args.concept or os.path.join(ROOT, "assets/reference", args.hero, "concept.png")
    if not os.path.exists(concept):
        concept = None
    sheet = np.asarray(Image.open(sheet_path).convert("RGBA")).copy()
    rep = run_checks(hero, sheet, poses_dir)
    bands = sv.hero_bands(sheet.shape[0])
    rows = WALK + IDLE if not (bands and list(bands["attack"])) else (
        WALK + sv.ATTACK_ROWS + sv.DEATH_ROWS + IDLE)
    grid = cells(sheet, rows=rows)
    if args.out:
        os.makedirs(args.out, exist_ok=True)
        write_contact(grid, concept, os.path.join(args.out, "contact.png"))
        write_gif(grid, range(WALK), os.path.join(args.out, "walk.gif"), 125)
        idle_rows = range(WALK, WALK + IDLE) if rows == WALK + IDLE else bands["idle"]
        write_gif(grid, idle_rows, os.path.join(args.out, "idle.gif"), 320)
        names = "contact.png walk.gif idle.gif"
        if rows != WALK + IDLE:
            write_gif(grid, bands["attack"], os.path.join(args.out, "attack.gif"), 140)
            write_gif(grid, bands["death"], os.path.join(args.out, "death.gif"), 160)
            names += " attack.gif death.gif"
        print(f"wrote {args.out}/{names}")
    print(f"{'OK' if not rep.fails else 'FAILED'}: {rep.fails} failing checks")
    return 1 if rep.fails else 0


def run_checks(hero, sheet, poses_dir, quiet=False):
    """Every sheet check for one hero profile; returns the Report."""
    table = hero["roles"]
    rep = Report(quiet)

    bands = sv.hero_bands(sheet.shape[0])
    # 12 rows stay the only accepted size until attack and death are both present.
    # A taller sheet is walk, attack, death, idle. Anything else still fails this.
    expect_h = sheet.shape[0] if bands and bands["attack"] else CELL * (WALK + IDLE)
    rep.check(sheet.shape == (expect_h, CELL * len(COLUMNS), 4), "sheet size",
              f"{sheet.shape[1]}x{sheet.shape[0]} (want {CELL * len(COLUMNS)}x{expect_h}"
              + ("" if not (bands and bands["attack"]) else
                 f": {WALK} walk, {sv.ATTACK_ROWS} attack, {sv.DEATH_ROWS} death, {IDLE} idle")
              + ")")
    if bands and bands["attack"]:
        grid_rows = WALK + sv.ATTACK_ROWS + sv.DEATH_ROWS + IDLE
        standing = list(bands["walk"]) + list(bands["idle"])
        idle_rows = list(bands["idle"])
    else:
        grid_rows = WALK + IDLE
        standing = range(WALK + IDLE)
        idle_rows = range(WALK, WALK + IDLE)
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
        rep.check(d[j] <= 15, f"palette keeps {name} {rgb}", f"nearest {pal[j]} dE {d[j]:.1f}",
                  [f"dirs/{c}.png" for c in COLUMNS])

    grid = cells(sheet, rows=grid_rows)
    a = alpha > 0
    p = np.pad(a, 1)
    edge = a & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    edge_ok = np.all(sheet[edge][:, :3] == OUTLINE, axis=1)
    rep.check(edge_ok.all() and OUTLINE in colours, "1 px outline on every silhouette edge",
              f"{int((~edge_ok).sum())} edge pixels off-outline")

    heights, feet, where = [], [], []
    for c in range(len(COLUMNS)):
        for r in standing:
            top, foot = body_span(grid[c][r])
            heights.append(foot - top + 1)
            feet.append(foot)
            where.append(row_clip(COLUMNS[c], r))
    rep.check(all(abs(h - sv.HERO) <= HERO_HEIGHT_TOL for h in heights), "height 88 +-2 px",
              f"min {min(heights)} max {max(heights)}",
              [w for w, h in zip(where, heights) if abs(h - sv.HERO) > HERO_HEIGHT_TOL])
    rep.check(max(feet) - min(feet) <= 1 and abs(feet[0] - (sv.FOOT + 1)) <= 1, "shared foot line",
              f"rows {min(feet)}..{max(feet)} (target {sv.FOOT + 1})",
              [w for w, f in zip(where, feet) if abs(f - (sv.FOOT + 1)) > 1])

    lone, speckled = 0, []
    for c in range(len(COLUMNS)):
        for r in standing:
            cell = grid[c][r]
            key = cell[..., 0].astype(np.int32) * 65536 + cell[..., 1].astype(np.int32) * 256 + cell[..., 2]
            outline_key = OUTLINE[0] * 65536 + OUTLINE[1] * 256 + OUTLINE[2]
            key[cell[..., 3] == 0] = -1
            key[key == outline_key] = -1
            q = np.pad(key, 1, constant_values=-1)
            n4 = [q[:-2, 1:-1], q[2:, 1:-1], q[1:-1, :-2], q[1:-1, 2:]]
            solid = np.sum([n >= 0 for n in n4], 0)
            same = np.sum([n == key for n in n4], 0)
            n = int(((key >= 0) & (solid >= 2) & (same == 0)).sum())
            lone += n
            if n:
                speckled.append(row_clip(COLUMNS[c], r))
    rep.check(lone == 0, "no lone speckle pixels inside the body", f"{lone}", speckled)

    # Prop side from the start poses, not a guess.
    prop_name, prop_role = hero["prop"]
    poses = pose_cells(poses_dir)
    for c, d in enumerate(COLUMNS):
        if d not in hero["prop_dirs"]:
            rep.check(True, f"{prop_name} {d}", "on the body midline in this view: no side to hold")
            continue
        want, n = prop_offset(poses[d], table, prop_role)
        rows = list(standing)
        got = [prop_offset(grid[c][r], table, prop_role) for r in rows]
        if want is None or abs(want) < 2:
            seen = [g for g, _ in got if g is not None]
            rep.check(True, f"{prop_name} {d}", f"pose shows {n} {prop_role} px: no side to hold" +
                      (f"; sheet frames show {prop_role} in {len(seen)}/12" if seen else ""))
            continue
        side = "right" if want > 0 else "left"
        bad = [rows[i] for i, (g, _) in enumerate(got) if g is None or g * want <= 0 or abs(g) < 2]
        rep.check(not bad, f"{prop_name} {d} on screen-{side} of body", f"pose {want:+.1f}px; bad rows {bad}",
                  [row_clip(d, r) for r in bad])

    for col, (title, bounds) in (("N", hero["back"]), ("S", hero["front"])):
        c = COLUMNS.index(col)
        view_check(rep, [grid[c][r] for r in standing], table, title, bounds, col)

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
              f"closest pair {worst[1]}/{worst[2]} differs by {worst[0]} px",
              [f"dirs/{worst[1]}.png", f"dirs/{worst[2]}.png", f"walk-{worst[1]}.mp4", f"walk-{worst[2]}.mp4"])

    def shape(a, b):
        return int(((a[..., 3] > 0) != (b[..., 3] > 0)).sum())

    for c, d in enumerate(COLUMNS):
        moves = [changed_lower(grid[c][r], grid[c][(r + 1) % WALK]) for r in range(WALK)]
        contact = changed_lower(grid[c][0], grid[c][4])
        rep.check(min(moves) >= 16 and contact >= 16, f"walk {d} legs move",
                  f"lower-half px per step {moves}, contact 0 vs 4 {contact}", [f"walk-{d}.mp4"])
        walk_shape = float(np.median([shape(grid[c][r], grid[c][(r + 1) % WALK]) for r in range(WALK)]))
        idle_shape = [shape(grid[c][idle_rows[r]], grid[c][idle_rows[(r + 1) % IDLE]]) for r in range(IDLE)]
        idle_col = [changed(grid[c][idle_rows[r]], grid[c][idle_rows[(r + 1) % IDLE]]) for r in range(IDLE)]
        rep.check(min(idle_col) > 0 and max(idle_shape) <= 0.6 * walk_shape, f"idle {d} subtle",
                  f"silhouette px per step {idle_shape} vs walk median {int(walk_shape)}", [f"idle-{d}.mp4"])

    if bands and list(bands["attack"]):
        extra = action_faults(grid, bands)
        for ok, name, detail, clips in extra.results:
            rep.check(ok, name, detail, clips)
    return rep


def action_faults(grid, bands):
    """Attack frames 0 and last take the walk's height. Every attack frame
    takes the foot line. A death's first frame
    does too. Later death frames may lie down, so they are not held to the
    standing height; the lowest pixel stays on the foot line and the cell
    does not clip the body."""
    rep = Report(quiet=True)
    if not bands or not list(bands["attack"]):
        return rep
    target = sv.FOOT + 1
    attack_where = []
    for c, d in enumerate(COLUMNS):
        for r in bands["attack"]:
            top, foot = body_span(grid[c][r])
            attack_where.append((d, r, foot - top + 1, foot))
    heights = [h for _, _, h, _ in attack_where]
    feet = [f for _, _, _, f in attack_where]
    # Frame 0 and the last frame of the attack are the standing pose. A lunge
    # or a raised weapon in between may leave 88. There is no head-line gate:
    # a legitimate lunge moves the head.
    standing = {list(bands["attack"])[0], list(bands["attack"])[-1]}
    bad_h = [f"attack-{d}.mp4" for d, r, h, _ in attack_where
             if r in standing and abs(h - sv.HERO) > HERO_HEIGHT_TOL]
    rep.check(not bad_h, "attack height 88 +-2 px", f"min {min(heights)} max {max(heights)}", bad_h)
    bad_f = [f"attack-{d}.mp4" for d, _, _, f in attack_where if abs(f - target) > 1]
    rep.check(not bad_f and max(feet) - min(feet) <= 1, "attack shares the walk foot line",
              f"rows {min(feet)}..{max(feet)} (target {target})", bad_f)
    def blame(d, r):
        # Attack rows 8-13 share numbers with the 12-row idle rows, so this
        # does not go through row_clip.
        if r in bands["attack"]:
            return f"attack-{d}.mp4"
        src = d if d in ("S", "W", "N", "E") else sv.DEATH_FROM[d]
        return f"death-{src}.mp4"

    death_rows = list(bands["death"])
    starts = []
    death_feet = []
    bad_feet = []
    for c, d in enumerate(COLUMNS):
        top, foot = body_span(grid[c][death_rows[0]])
        starts.append((d, foot - top + 1))
        for r in death_rows:
            _, foot = body_span(grid[c][r])
            death_feet.append(foot)
            if abs(foot - target) > DEATH_FOOT:
                bad_feet.append(blame(d, r))
    rep.check(all(abs(h - sv.HERO) <= HERO_HEIGHT_TOL for _, h in starts),
              "death start height 88 +-2 px", f"{[h for _, h in starts]}",
              [blame(d, death_rows[0]) for d, h in starts if abs(h - sv.HERO) > HERO_HEIGHT_TOL])
    rep.check(not bad_feet, "death feet on the line",
              f"rows {min(death_feet)}..{max(death_feet)} (target {target} +- {DEATH_FOOT})", bad_feet)
    clipped = []
    for c, d in enumerate(COLUMNS):
        for r in list(bands["attack"]) + death_rows:
            cell = grid[c][r]
            ring = np.ones(cell.shape[:2], bool)
            ring[1:-1, 1:-1] = False
            if (cell[..., 3][ring] > 0).any():
                clipped.append(blame(d, r))
    rep.check(not clipped, "attack and death clear of the cell border",
              f"{len(clipped)} cells touch the edge", clipped)
    return rep


def on_ground(cell, k):
    n = cell.shape[0]
    im = Image.new("RGBA", (n, n), GROUND)
    im.alpha_composite(Image.fromarray(np.ascontiguousarray(cell), "RGBA"))
    return im.resize((n * k, n * k), Image.NEAREST)


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


def write_gif(grid, rows, path, ms, k=3):
    frames = []
    n = grid[0][0].shape[0] * k
    for r in rows:
        f = Image.new("RGBA", (n * 4, n * 2), GROUND)
        for c in range(len(COLUMNS)):
            f.alpha_composite(on_ground(grid[c][r], k), ((c % 4) * n, (c // 4) * n))
            label(f, COLUMNS[c], ((c % 4) * n + 8, (c // 4) * n + 6))
        frames.append(f.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=1)


# ---------------------------------------------------------------- monsters

# Hero thresholds are px counts on an 88 px figure; a monster's scale by area.
HERO_DISTINCT = 300
HERO_LEGS = 16
HERO_HEIGHT_TOL = 2      # px: every hero walk and idle frame, and attack frames 0 and last. Not loosened.
START_TOLERANCE = 1      # px: frame 0 of every clip is the start pose at the sheet height
WALK_SWING = 4           # px: the walk height may move this far off it (the spear swings in the height)
ATTACK_FOOT = 1
DEATH_FOOT = 3
DEATH_DOWN = 0.6         # the last death frame is at most this share of the figure height
# A flier (spec.flies, the bat) hovers: its wings sweep far past the walk's
# height and foot line, so it has its own checks in their place, never a
# looser version of them (see run_monster_checks).
HOVER_BOB = 0.3          # share of the figure height the body core of a walk or attack frame stays within of the start pose's
                         # (the core still carries the wing roots: the bat's side-view walks, whose body visibly holds still, measure up to 0.27)
FLIER_CORE = 0.3         # the body core: the largest part left by an opening with a square this share of the figure height
WINGBEAT = 150           # px at the hero's 88 px, by area: a flier's walk sweep, frame 0 vs the walk frame most unlike it


def body_core(cell, height):
    """The opaque mask of a cell without its thin parts (wings, ears, feet):
    the largest connected part left by an opening with a square FLIER_CORE x
    height wide, or the widest square under that which leaves anything (a
    side view's body is narrower); the whole silhouette when even 3 px
    leaves nothing."""
    a = cell[..., 3] > 0
    k = max(3, int(round(FLIER_CORE * height)))
    k -= 1 - k % 2  # odd, so the square has a centre
    for side in range(k, 2, -2):
        core = ndimage.binary_opening(a, np.ones((side, side), bool))
        if core.any():
            lab, n = ndimage.label(core)
            sizes = ndimage.sum(core, lab, range(1, n + 1))
            return lab == int(np.argmax(sizes)) + 1
    return a


def core_y(cell, height):
    return float(np.nonzero(body_core(cell, height))[0].mean())


def area_scaled(n, height):
    return int(np.ceil(n * (height / sv.HERO) ** 2))


def monster_where(spec, have):
    def where(d, r):
        kind = spec.row_kind(r)
        return f"{kind}-{sv.clip_for(have, kind, d)}.mp4"
    return where


def run_monster_checks(asset, sheet, poses_dir, quiet=False):
    """Every sheet check for one monster asset (load_assets entry); returns
    the Report. Rows follow asset["spec"].rows; failures blame the clip a
    cell came from."""
    spec, have, prof = asset["spec"], asset["clips"], asset["profile"]
    table = prof["roles"]
    C, n_rows, H = spec.cell, spec.frames, spec.height
    where = monster_where(spec, have)
    rep = Report(quiet)
    rows = {k: range(spec.first_row(k), spec.first_row(k) + n) for k, n in spec.rows}

    rep.check(sheet.shape == (C * n_rows, C * len(COLUMNS), 4), "sheet size",
              f"{sheet.shape[1]}x{sheet.shape[0]} (want {C * len(COLUMNS)}x{C * n_rows}: "
              f"{', '.join(f'{n} {k}' for k, n in spec.rows)} rows of {C} px)")
    if sheet.shape != (C * n_rows, C * len(COLUMNS), 4):
        return rep
    alpha = sheet[..., 3]
    rep.check(set(np.unique(alpha)) <= {0, 255}, "alpha is 0 or 255")
    opaque = sheet[alpha > 0][:, :3]
    colours = {tuple(int(v) for v in c) for c in np.unique(opaque, axis=0)}
    body_colours = colours - {OUTLINE}
    rep.check(len(body_colours) <= 32, "palette size", f"{len(body_colours)} colours + outline")
    pal = sorted(body_colours)
    pal_lab = sv.srgb_to_lab(np.array(pal, np.float64))
    for name, rgb in prof["anchors"].items():
        d = np.sqrt(((pal_lab - sv.srgb_to_lab(np.array([rgb], np.float64))) ** 2).sum(1))
        j = int(d.argmin())
        rep.check(d[j] <= 15, f"palette keeps {name} {rgb}", f"nearest {pal[j]} dE {d[j]:.1f}",
                  [f"dirs/{c}.png" for c in COLUMNS])
    a = alpha > 0
    p = np.pad(a, 1)
    edge = a & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    edge_ok = np.all(sheet[edge][:, :3] == OUTLINE, axis=1)
    rep.check(edge_ok.all() and OUTLINE in colours, "1 px outline on every silhouette edge",
              f"{int((~edge_ok).sum())} edge pixels off-outline")

    grid = cells(sheet, C, n_rows)
    every = [(c, r) for c in range(len(COLUMNS)) for r in range(n_rows)]
    empty = [(c, r) for c, r in every if not (grid[c][r][..., 3] > 0).any()]
    rep.check(not empty, "every cell has a figure", f"{len(empty)} empty",
              [where(COLUMNS[c], r) for c, r in empty])
    if empty:
        return rep

    ring = np.ones((C, C), bool)
    ring[1:-1, 1:-1] = False
    clipped = [(c, r) for c, r in every if (grid[c][r][..., 3][ring] > 0).any()]
    rep.check(not clipped, "clear of the cell border (nothing cut off)",
              f"{len(clipped)} cells touch the edge" + (f": {[f'{COLUMNS[c]} row {r}' for c, r in clipped]}" if clipped else ""),
              [where(COLUMNS[c], r) for c, r in clipped])

    span = {(c, r): body_span(grid[c][r]) for c, r in every}
    tall = lambda c, r: span[(c, r)][1] - span[(c, r)][0] + 1
    target = spec.foot + 1  # the outline row under the lowest body pixel
    starts = [(c, rows[k][0]) for k in rows for c in range(len(COLUMNS))]
    bad = [(c, r) for c, r in starts if abs(tall(c, r) - H) > START_TOLERANCE]
    rep.check(not bad, f"start frames {H} +-{START_TOLERANCE} px",
              f"{sorted({tall(c, r) for c, r in starts})}", [where(COLUMNS[c], r) for c, r in bad])
    flies = getattr(spec, "flies", False)
    if flies:
        # In place of the walk height, the one walk foot line and the attack
        # feet: the start pose sits on the foot line, and the body core
        # (wings opened away) hangs at the start pose's height in every walk
        # and attack frame.
        w0 = [(c, rows["walk"][0]) for c in range(len(COLUMNS))]
        rep.check(all(abs(span[k][1] - target) <= 1 for k in w0), "flier start pose on the foot line",
                  f"rows {sorted({span[k][1] for k in w0})} (target {target})",
                  [where(COLUMNS[c], r) for c, r in w0 if abs(span[(c, r)][1] - target) > 1])
        base = {c: core_y(grid[c][r], H) for c, r in w0}
        for kind in ("walk", "attack"):
            if kind not in rows:
                continue
            cs_ = [(c, r) for c in range(len(COLUMNS)) for r in rows[kind]]
            off = [core_y(grid[c][r], H) - base[c] for c, r in cs_]
            bob = HOVER_BOB * H
            rep.check(all(abs(o) <= bob for o in off), f"{kind} hovers at the start height +-{bob:.0f} px",
                      f"body core {min(off):+.1f}..{max(off):+.1f} px",
                      [where(COLUMNS[c], r) for (c, r), o in zip(cs_, off) if abs(o) > bob])
    if "walk" in rows and not flies:
        cs_ = [(c, r) for c in range(len(COLUMNS)) for r in rows["walk"]]
        hs = [tall(c, r) for c, r in cs_]
        rep.check(all(abs(h - H) <= WALK_SWING for h in hs), f"walk height {H} +-{WALK_SWING} px",
                  f"min {min(hs)} max {max(hs)}", [where(COLUMNS[c], r) for (c, r), h in zip(cs_, hs) if abs(h - H) > WALK_SWING])
        feet = [span[k][1] for k in cs_]
        rep.check(max(feet) - min(feet) <= 1 and abs(feet[0] - target) <= 1, "walk shares one foot line",
                  f"rows {min(feet)}..{max(feet)} (target {target})",
                  [where(COLUMNS[c], r) for (c, r), f in zip(cs_, feet) if abs(f - target) > 1])
    for kind, tol in (("attack", ATTACK_FOOT), ("death", DEATH_FOOT)):
        if kind not in rows or (flies and kind == "attack"):
            continue
        cs_ = [(c, r) for c in range(len(COLUMNS)) for r in rows[kind]]
        feet = [span[k][1] for k in cs_]
        rep.check(all(abs(f - target) <= tol for f in feet), f"{kind} feet on the line +-{tol} px",
                  f"rows {min(feet)}..{max(feet)} (target {target})",
                  [where(COLUMNS[c], r) for (c, r), f in zip(cs_, feet) if abs(f - target) > tol])

    lone, speckled = 0, []
    outline_key = OUTLINE[0] * 65536 + OUTLINE[1] * 256 + OUTLINE[2]
    for c, r in every:
        cell = grid[c][r]
        key = cell[..., 0].astype(np.int32) * 65536 + cell[..., 1].astype(np.int32) * 256 + cell[..., 2]
        key[cell[..., 3] == 0] = -1
        key[key == outline_key] = -1
        q = np.pad(key, 1, constant_values=-1)
        n4 = [q[:-2, 1:-1], q[2:, 1:-1], q[1:-1, :-2], q[1:-1, 2:]]
        solid = np.sum([x >= 0 for x in n4], 0)
        same = np.sum([x == key for x in n4], 0)
        n = int(((key >= 0) & (solid >= 2) & (same == 0)).sum())
        lone += n
        if n:
            speckled.append(where(COLUMNS[c], r))
    rep.check(lone == 0, "no lone speckle pixels inside the body", f"{lone}", speckled)

    # The prop: present in every walk and attack frame where the start pose
    # shows it off the body midline, and on the pose's side while walking.
    # An attack swings it across the body, so attack frames need it, not its side.
    # A figure that holds nothing (check prop null) has no prop to follow.
    prop_name, prop_role = prof["prop"] or (None, None)
    if prop_name is None:
        rep.check(True, "no held prop", "check prop is null: the figure holds nothing")
    poses = {}
    for d in (COLUMNS if prop_name else ()):
        rgb, al = sv.pose_place(np.asarray(Image.open(os.path.join(poses_dir, f"{d}.png")).convert("RGB")), spec)
        cell = np.zeros((C, C, 4), np.uint8)
        cell[al, :3] = np.clip(rgb[al], 0, 255).astype(np.uint8)
        cell[al, 3] = 255
        poses[d] = cell
    held = [r for k in ("walk", "attack") if k in rows for r in rows[k]]
    for c, d in enumerate(COLUMNS if prop_name else ()):
        if d not in prof["prop_dirs"]:
            rep.check(True, f"{prop_name} {d}", "on the body midline in this view: no side to hold")
            continue
        below = prof["prop_side_below"]
        want, n = prop_offset(poses[d], table, prop_role, below)
        if want is None or abs(want) < 2:
            rep.check(False, f"{prop_name} {d}", f"start pose shows {n} {prop_role} px off the midline, but "
                      f"{d} is in prop_dirs", [f"dirs/{d}.png"])
            continue
        got = {r: prop_offset(grid[c][r], table, prop_role) for r in held}
        gone = [r for r in held if got[r][0] is None]
        rep.check(not gone, f"{prop_name} {d} in every walk and attack frame",
                  f"{prop_role} px per frame {[got[r][1] for r in held]}", [where(d, r) for r in gone])
        side = "right" if want > 0 else "left"
        walk = rows.get("walk", ())
        sides = {r: (prop_offset(grid[c][r], table, prop_role, below)[0] if below else got[r][0]) for r in walk}
        wrong = [r for r in walk if sides[r] is not None and (sides[r] * want <= 0 or abs(sides[r]) < 2)]
        rep.check(not wrong, f"{prop_name} {d} walks on screen-{side} of the body",
                  f"pose {want:+.1f}px; bad rows {wrong}", [where(d, r) for r in wrong])

    for col, (title, bounds) in (("N", prof["back"]), ("S", prof["front"])):
        c = COLUMNS.index(col)
        view_check(rep, [grid[c][r] for r in held], table, title, bounds, col,
                   lambda d, i: where(d, held[i]))

    first = [grid[c][0] for c in range(len(COLUMNS))]
    worst = None
    for i in range(len(COLUMNS)):
        for j in range(len(COLUMNS)):
            if i != j:
                m = min(changed(first[i], first[j]), changed(first[i], first[j][:, ::-1]))
                if worst is None or m < worst[0]:
                    worst = (m, COLUMNS[i], COLUMNS[j])
    floor = area_scaled(HERO_DISTINCT, H)
    rep.check(worst[0] >= floor, "8 directions distinct (and not mirrors)",
              f"closest pair {worst[1]}/{worst[2]} differs by {worst[0]} px (floor {floor} = "
              f"{HERO_DISTINCT} at the hero's 88 px, by area)",
              [f"dirs/{worst[1]}.png", f"dirs/{worst[2]}.png", f"walk-{worst[1]}.mp4", f"walk-{worst[2]}.mp4"])

    def shape(x, y):
        return int(((x[..., 3] > 0) != (y[..., 3] > 0)).sum())

    legs = area_scaled(HERO_LEGS, H)
    for c, d in enumerate(COLUMNS):
        if "walk" in rows:
            w = list(rows["walk"])
            if flies:
                # A wingbeat changes the whole silhouette, not the lower half.
                # The 8 frames may hold one wingbeat or two, so the sweep is
                # frame 0 against the frame most unlike it, not half a cycle on.
                moves = [shape(grid[c][w[i]], grid[c][w[(i + 1) % len(w)]]) for i in range(len(w))]
                sweep = max(shape(grid[c][w[0]], grid[c][r]) for r in w[1:])
                beat = area_scaled(WINGBEAT, H)
                rep.check(min(moves) >= legs and sweep >= beat, f"walk {d} wings beat",
                          f"silhouette px per step {moves} (floor {legs}), sweep from frame 0 {sweep} (floor {beat})",
                          [where(d, w[0])])
            else:
                moves = [changed_lower(grid[c][w[i]], grid[c][w[(i + 1) % len(w)]]) for i in range(len(w))]
                contact = changed_lower(grid[c][w[0]], grid[c][w[len(w) // 2]])
                rep.check(min(moves) >= legs and contact >= legs, f"walk {d} legs move",
                          f"lower-half px per step {moves}, contact 0 vs {len(w) // 2} {contact} (floor {legs})",
                          [where(d, w[0])])
            step = float(np.median([shape(grid[c][w[i]], grid[c][w[(i + 1) % len(w)]]) for i in range(len(w))]))
        if "attack" in rows and "walk" in rows:
            at = list(rows["attack"])
            reach = max(shape(grid[c][at[0]], grid[c][r]) for r in at[1:])
            rep.check(reach >= step, f"attack {d} strikes",
                      f"largest silhouette change from the start {reach} px (floor: walk step median {step:.0f})",
                      [where(d, at[0])])
        if "death" in rows:
            de = list(rows["death"])
            low = tall(c, de[-1])
            rep.check(low <= DEATH_DOWN * H, f"death {d} ends on the ground",
                      f"last frame {low} px tall (at most {DEATH_DOWN:.0%} of {H})", [where(d, de[-1])])

    if "death" in rows:
        for d, src in sv.DEATH_FROM.items():
            if d in have["death"]:
                continue
            c, s_ = COLUMNS.index(d), COLUMNS.index(src)
            same = all(np.array_equal(grid[c][r], grid[s_][r]) for r in rows["death"])
            rep.check(same, f"death {d} reuses death-{src} unmirrored", "" if same else "cells differ",
                      [f"death-{src}.mp4"])
    return rep


def monster_main(args):
    asset = ASSETS[args.hero]
    spec = asset["spec"]
    sheet_path = args.sheet or os.path.join(ROOT, "priv/static/images/hd2d", f"{args.hero}-sheet.png")
    poses_dir = args.poses or os.path.join(ROOT, "assets/reference", args.hero, "video/dirs")
    concept = args.concept or os.path.join(ROOT, "assets/reference", args.hero, "concept.png")
    sheet = np.asarray(Image.open(sheet_path).convert("RGBA")).copy()
    rep = run_monster_checks(asset, sheet, poses_dir)
    if args.out and sheet.shape == (spec.cell * spec.frames, spec.cell * len(COLUMNS), 4):
        os.makedirs(args.out, exist_ok=True)
        write_monster_approval(sheet, spec, concept if os.path.exists(concept) else None, args.out)
        print(f"wrote {args.out}/sheet.png strip.png contact.png " +
              " ".join(f"{k}.gif" for k, _ in spec.rows))
    print(f"{'OK' if not rep.fails else 'FAILED'}: {rep.fails} failing checks")
    return 1 if rep.fails else 0


# Client frame times (assets/js/pictures.js sheetRow): walk and death 160 ms,
# attack 140 ms; death holds its last frame.
GIF_MS = {"walk": 160, "attack": 140, "death": 160, "idle": 320}


def write_monster_approval(sheet, spec, concept, out):
    C = spec.cell
    grid = cells(sheet, C, spec.frames)
    from PIL import ImageDraw
    # The whole sheet at 2x on the ground colour, kinds labelled.
    k = 2
    pad = 70
    im = Image.new("RGBA", (pad + C * k * 8, 20 + C * k * spec.frames), (30, 32, 40, 255))
    for c, d in enumerate(COLUMNS):
        label(im, d, (pad + c * C * k + 6, 4))
        for r in range(spec.frames):
            im.alpha_composite(on_ground(grid[c][r], k), (pad + c * C * k, 20 + r * C * k))
    for kind, n in spec.rows:
        r0 = spec.first_row(kind)
        for i in range(n):
            label(im, f"{kind} {i}", (4, 20 + (r0 + i) * C * k + 4))
    im.convert("RGB").save(os.path.join(out, "sheet.png"))
    # The eight start poses, large.
    k = 6
    strip = Image.new("RGBA", (C * k * 8, C * k + 24), (30, 32, 40, 255))
    for c, d in enumerate(COLUMNS):
        strip.alpha_composite(on_ground(grid[c][0], k), (c * C * k, 24))
        label(strip, d, (c * C * k + 8, 6))
    strip.convert("RGB").save(os.path.join(out, "strip.png"))
    # Contact: concept, then the strip at 3x.
    k = 3
    con = Image.open(concept).convert("RGBA") if concept else None
    if con:
        con = con.resize((int(con.width * 360 / con.height), 360), Image.LANCZOS)
    top = 380 if con else 0
    contact = Image.new("RGBA", (max(C * k * 8, con.width if con else 0), top + C * k + 24), (30, 32, 40, 255))
    if con:
        contact.alpha_composite(con, (0, 0))
        label(contact, "concept", (con.width + 10, 10))
    for c, d in enumerate(COLUMNS):
        contact.alpha_composite(on_ground(grid[c][0], k), (c * C * k, top + 24))
        label(contact, d, (c * C * k + 8, top + 6))
    contact.convert("RGB").save(os.path.join(out, "contact.png"))
    for kind, n in spec.rows:
        r0 = spec.first_row(kind)
        durations = [GIF_MS[kind]] * n
        if kind == "death":
            durations[-1] = 1200
        write_gif(grid, range(r0, r0 + n), os.path.join(out, f"{kind}.gif"), durations, k=3)


if __name__ == "__main__":
    sys.exit(main())
