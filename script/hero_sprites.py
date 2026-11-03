#!/usr/bin/env python3
"""One entry point for a hero's (or another figure's) 8-direction sprite sheet.

    python3 script/hero_sprites.py HERO prep       # concept crop, prompts, views
    python3 script/hero_sprites.py HERO views      # mirror_views flips, then normalize views/v-*.* to k-*.png
    python3 script/hero_sprites.py HERO dirs       # views + 8 start poses from the turntable
    python3 script/hero_sprites.py HERO precheck   # which clips to regenerate, before the build
    python3 script/hero_sprites.py HERO build      # sheet + checks + approval files
    python3 script/hero_sprites.py HERO colours    # concept colours, for the check profile
    python3 script/hero_sprites.py HERO prompts --abs   # prompts with absolute paths

Everything is driven by assets/reference/HERO/hero.json, or by
assets/reference/ASSET/asset.json for a non-hero figure ("type": "monster"; see
docs/ART-REDO.md). A non-hero asset runs prep, views, dirs and prompts; it runs
every step, with the sheet layout from its "sheet" block. Only the
GenerateImage and GenerateVideo calls are manual; prep writes them, with every
input path, to assets/reference/HERO/prompts.json and prompts.md. Every step
is deterministic: re-running it writes the same bytes, and a PNG whose pixels
already match is left alone. See docs/concepts/SPRITE-PIPELINE.md.
"""
import argparse
import contextlib
import io
import json
import math
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sprite_from_video as sv  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFERENCE = os.path.join(ROOT, "assets/reference")
COLUMNS = sv.COLUMNS
CARDINALS = ["S", "W", "N", "E"]
# Each diagonal sits between two cardinals on the turntable.
DIAGONALS = {"SW": ("S", "W"), "NW": ("W", "N"), "NE": ("N", "E"), "SE": ("E", "S")}
# Facing in degrees, turning from S (camera) through W (screen-left).
ANGLE = {"S": 0, "SW": 45, "W": 90, "NW": 135, "N": 180, "NE": 225, "E": 270, "SE": 315}

VIEW_MIN = 225       # min(RGB) below this is figure, for views and the picker
VIEW_HEIGHT = 520    # normalized figure height on the 720 canvas
VIEW_CANVAS = 720
VIEW_FEET = 640      # the figure's last row is VIEW_FEET - 1
VIEW_SIDE = 40       # a normalized view keeps this much white on each side
VIEW_HEIGHT_MIN = 200  # asset.json "view_height" floor: a quadruped's side view is wide, not small
STRAY = 0.02         # fragments under 2% of the figure outside its box are blanked
BALANCE_BAND = 0.9   # diagonal candidates: balance within 90% of the best
CLIP_FPS = 24
CLIP_FRAMES = 49     # 2 s at 24 fps, last frame = first
WALK_LOOP = 0.5      # last vs first frame, silhouette px, times the walk median
IDLE_LOOP = 0.6
START_POSE = 0.2     # first frame vs dirs/<DIR>.png, times the walk median
IDLE_DRIFT = 0.8     # any idle frame vs its first frame, times the walk median
ATTACK_LOOP = WALK_LOOP  # a monster attack ends back on its start pose like a walk loop


# ---------------------------------------------------------------- config

# Clip kinds and their default directions. A hero has a walk and an idle in all
# eight. An asset.json lists its own in "clips", e.g. {"walk": [...8],
# "attack": [...8], "death": ["S", "W", "N", "E"]}.
CLIP_KINDS = ("walk", "idle", "attack", "death")
HERO_CLIPS = {"walk": COLUMNS, "idle": COLUMNS}
TYPES = ("hero", "monster")
# One sheet texel in world units: the hero's 32-unit body over its 88 px.
TEXEL = 32 / 88


def sheet_height(world_height):
    """Sheet height in px (outline included) of a figure world_height units
    tall at the hero texel, so every figure shares the hero's pixel size."""
    return int(round(world_height / TEXEL))


def load_config(hero, reference=REFERENCE):
    path = os.path.join(reference, hero, "hero.json")
    if not os.path.exists(path):
        path = os.path.join(reference, hero, "asset.json")
    if not os.path.exists(path):
        raise SystemExit(f"no {os.path.relpath(os.path.join(reference, hero, 'hero.json'), ROOT)} "
                         f"or asset.json: write the config first")
    with open(path) as fh:
        cfg = json.load(fh)
    name = os.path.basename(path)
    for key in ("noun", "possessive", "concept", "design", "items", "turntable"):
        if key not in cfg:
            raise SystemExit(f"{hero}/{name} is missing {key!r}")
    kind = cfg.get("type", "hero")
    if kind not in TYPES:
        raise SystemExit(f"{hero}/{name}: type {kind!r} is not one of {TYPES}")
    if (kind == "hero") != (name == "hero.json"):
        raise SystemExit(f"{hero}/{name}: a hero config is hero.json, any other type is asset.json")
    clips = cfg.get("clips", HERO_CLIPS)
    for k, dirs in clips.items():
        if k not in CLIP_KINDS or not dirs or any(d not in COLUMNS for d in dirs):
            raise SystemExit(f"{hero}/{name}: clips {k!r} {dirs!r} (kinds {CLIP_KINDS}, directions {COLUMNS})")
        if k in ("attack", "death") and not cfg.get(k):
            raise SystemExit(f"{hero}/{name}: clips has {k!r} but no {k!r} motion text")
    for item in cfg["items"]:
        if "visible" in item and (item["visible"] is not True or item.get("at") in (None, "", "body")):
            raise SystemExit(f"{hero}/{name}: item {item.get('name')!r}: visible is true on a held item, or absent")
    notes = cfg.get("view_notes", {})
    if not isinstance(notes, dict) or any(d not in ("S", "N", "W", "E") or not isinstance(t, str) or not t.strip()
                                          for d, t in notes.items()):
        raise SystemExit(f"{hero}/{name}: view_notes maps S, N, W or E to one sentence, got {notes!r}")
    # Per-clip prompt overrides: a clip regenerated with different wording
    # (asset.json "clip_overrides", e.g. {"walk-NW": {"gait": ..., "walk": [...]}})
    # so prompts.json keeps saying exactly what was sent. A walk may override
    # its gait and its item walk texts ([] drops them), an attack its attack, a death its death.
    over = cfg.get("clip_overrides", {})
    allowed = {"walk": ("gait", "walk"), "idle": (), "attack": ("attack",), "death": ("death",)}
    if not isinstance(over, dict):
        raise SystemExit(f"{hero}/{name}: clip_overrides maps clip ids to fields, got {over!r}")
    for cid, fields in over.items():
        if cid.startswith("_"):
            continue
        k, _, d = cid.partition("-")
        if k not in clips or d not in clips[k] or not isinstance(fields, dict) or not fields:
            raise SystemExit(f"{hero}/{name}: clip_overrides {cid!r} is not one of its clips")
        for f, v in fields.items():
            ok = isinstance(v, str) and v.strip() if f != "walk" else (
                isinstance(v, list) and all(isinstance(x, str) and x.strip() for x in v))
            if f not in allowed[k] or not ok:
                raise SystemExit(f"{hero}/{name}: clip_overrides {cid!r} field {f!r} (a {k} takes {allowed[k]})")
    # A wide figure (a quadruped side-on) normalizes its views shorter so
    # the side view fits the canvas; every view of one asset shares it.
    vh = cfg.get("view_height", VIEW_HEIGHT)
    if type(vh) is not int or not VIEW_HEIGHT_MIN <= vh <= VIEW_HEIGHT:
        raise SystemExit(f"{hero}/{name}: view_height {vh!r} is a whole number of px from {VIEW_HEIGHT_MIN} to {VIEW_HEIGHT}")
    # The views' last sentence for a figure that is not a person standing
    # upright (a quadruped has no arms and its length matters too).
    if "view_pose" in cfg and not (isinstance(cfg["view_pose"], str) and cfg["view_pose"].strip()):
        raise SystemExit(f"{hero}/{name}: view_pose is one sentence, got {cfg['view_pose']!r}")
    # A flier (the bat) hovers instead of walking: its "walk" clips are a
    # wingbeat in place, its attack does not plant feet, and the turntable
    # holds it in the air with its wings still (see FLIER below).
    if "flies" in cfg and (cfg["flies"] is not True or kind == "hero"):
        raise SystemExit(f"{hero}/{name}: flies is true on a monster, or absent")
    # A left-right symmetric figure (the bat) mirrors one side view from the
    # other instead of generating it: {"W": "E"} makes views/v-W.png the
    # horizontal flip of v-E, and prompts.json has no view-W call. Only W and
    # E mirror into each other; a hero holds its items in one hand, so never.
    mirror = cfg.get("mirror_views", {})
    if not isinstance(mirror, dict) or len(mirror) > 1 or any(
            (d, s) not in (("W", "E"), ("E", "W")) for d, s in mirror.items()):
        raise SystemExit(f"{hero}/{name}: mirror_views is {{\"W\": \"E\"}} or {{\"E\": \"W\"}}, got {mirror!r}")
    if mirror and kind == "hero":
        raise SystemExit(f"{hero}/{name}: mirror_views is for symmetric creatures; a hero's items are handed")
    if set(mirror) & set(notes):
        raise SystemExit(f"{hero}/{name}: view_notes for the mirrored view {sorted(set(mirror) & set(notes))} is never sent")
    if kind != "hero":
        sheet = cfg.get("sheet") or {}
        for key in ("world_height", "height", "cell"):
            if not isinstance(sheet.get(key), (int, float)):
                raise SystemExit(f"{hero}/{name}: sheet needs {key!r}")
        if sheet["height"] != sheet_height(sheet["world_height"]):
            raise SystemExit(f"{hero}/{name}: sheet height {sheet['height']} is not world_height "
                             f"{sheet['world_height']} at the hero texel ({sheet_height(sheet['world_height'])})")
        if sheet["cell"] % 8 or sheet["cell"] < sheet["height"] + 16:
            raise SystemExit(f"{hero}/{name}: cell {sheet['cell']} must be a multiple of 8 with 16 px over the figure")
    cfg["type"] = kind
    cfg["clips"] = {k: list(v) for k, v in clips.items()}
    cfg["hero"] = hero
    cfg["dir"] = os.path.join(reference, hero)
    cfg["video"] = os.path.join(reference, hero, "video")
    return cfg


def rel(path):
    return os.path.relpath(path, ROOT)


def save_png(path, arr):
    """Write arr as PNG unless the file already holds the same pixels.
    Returns True when it wrote."""
    if os.path.exists(path):
        old = np.asarray(Image.open(path).convert("RGB"))
        if old.shape == arr.shape and np.array_equal(old, arr):
            return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(np.ascontiguousarray(arr, np.uint8)).save(path)
    return True


def copy_if_changed(src, dst):
    if os.path.exists(dst):
        with open(src, "rb") as a, open(dst, "rb") as b:
            if a.read() == b.read():
                return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    return True


def write_text(path, text):
    if os.path.exists(path):
        with open(path) as fh:
            if fh.read() == text:
                return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(text)
    return True


# ---------------------------------------------------------------- 1 concept

def crop_concept(cfg):
    """concept.png: a crop of a shared concept sheet ({"source", "box"} in
    source pixels) or a file kept as is ({"file"})."""
    out = os.path.join(cfg["dir"], "concept.png")
    c = cfg["concept"]
    if "file" in c:
        if not os.path.exists(os.path.join(ROOT, c["file"])):
            raise SystemExit(f"concept file {c['file']} is missing")
        return False
    im = Image.open(os.path.join(ROOT, c["source"])).convert("RGB")
    return save_png(out, np.asarray(im.crop(tuple(c["box"]))))


# ---------------------------------------------------------------- 2 views

def normalize_view(rgb, height=VIEW_HEIGHT):
    """A generated view on white -> 720x720 white canvas, figure height px
    tall (520 unless asset.json sets "view_height"), centred, last figure row
    at y = 639. The figure is min(RGB) < 225. A figure that would come out
    wider than the canvas less VIEW_SIDE on each side is refused, never
    cropped: a long body (a wolf's side view) needs a lower view_height.
    Fragments under 2% of the largest blob that reach outside its box are
    blanked, so a stray speck cannot widen the box and change the scale.
    Specks inside the box stay; the sheet build drops them."""
    a = np.array(rgb, np.uint8)
    mask = a.min(2) < VIEW_MIN
    lab, n = ndimage.label(mask)
    if n == 0:
        raise ValueError("no figure on the view")
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    boxes = ndimage.find_objects(lab)
    my, mx = boxes[main - 1]
    for i in range(1, n + 1):
        if i == main or sizes[i - 1] >= STRAY * sizes[main - 1]:
            continue
        by, bx = boxes[i - 1]
        if by.start < my.start or by.stop > my.stop or bx.start < mx.start or bx.stop > mx.stop:
            a[lab == i] = 255
            mask[lab == i] = False
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    w = round((x1 - x0) * height / (y1 - y0))
    if w > VIEW_CANVAS - 2 * VIEW_SIDE:
        raise ValueError(f"view is {w} px wide at {height} px tall (at most {VIEW_CANVAS - 2 * VIEW_SIDE}): "
                         f"set a lower view_height in asset.json")
    crop = Image.fromarray(a).crop((x0, y0, x1, y1)).resize((w, height), Image.LANCZOS)
    out = Image.new("RGB", (VIEW_CANVAS, VIEW_CANVAS), "white")
    out.paste(crop, (round((VIEW_CANVAS - w) / 2), VIEW_FEET - height))
    return np.asarray(out)


def view_source(cfg, d):
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = os.path.join(cfg["video"], "views", f"v-{d}.{ext}")
        if os.path.exists(p):
            return p
    return None


def mirror_view(cfg, d, log=print):
    """views/v-<d>.png as the horizontal flip of the view it mirrors
    (asset.json "mirror_views"); None until that view is there."""
    src = view_source(cfg, cfg["mirror_views"][d])
    if not src:
        return None
    out = os.path.join(cfg["video"], "views", f"v-{d}.png")
    for ext in ("jpg", "jpeg", "webp"):
        stale = os.path.join(cfg["video"], "views", f"v-{d}.{ext}")
        if os.path.exists(stale):
            raise SystemExit(f"{rel(stale)}: v-{d} is mirrored from v-{cfg['mirror_views'][d]}; delete it")
    wrote = save_png(out, np.asarray(Image.open(src).convert("RGB"))[:, ::-1])
    log(f"{'wrote' if wrote else 'same '} {rel(out)} (mirror of {rel(src)})")
    return out


def make_views(cfg, log=print):
    done = []
    for d in cfg.get("mirror_views", {}):
        mirror_view(cfg, d, log)
    for d in CARDINALS:
        src = view_source(cfg, d)
        if not src:
            continue
        out = os.path.join(cfg["video"], "views", f"k-{d}.png")
        try:
            norm = normalize_view(np.asarray(Image.open(src).convert("RGB")), cfg.get("view_height", VIEW_HEIGHT))
        except ValueError as e:
            raise SystemExit(f"{rel(src)}: {e}")
        wrote = save_png(out, norm)
        log(f"{'wrote' if wrote else 'same '} {rel(out)}")
        done.append(d)
    return done


# ---------------------------------------------------------------- 3 dirs

def figure_mask(rgb):
    return rgb.min(2) < VIEW_MIN


def key_frames(cfg, n_frames):
    """Frame index of each cardinal on the turntable: S at 0 and at the end."""
    t = cfg["turntable"]
    fps = t.get("fps", 24)
    at = {"S": 0}
    for d, s in t["keyframes"].items():
        at[d] = int(round(s * fps))
    at["S_end"] = n_frames - 1
    return at


def pick_diagonals(frames, cards, at):
    """For each diagonal, the turntable frame most evenly between its two
    cardinals: balance = min(dA, dB) / max(dA, dB), d = silhouette pixels
    that differ from the cardinal image. Among frames within 90% of the best
    balance the sharpest (Laplacian variance on the figure) wins; ties go to
    the earlier frame."""
    masks = {d: figure_mask(cards[d]) for d in CARDINALS}
    out = {}
    for diag, (a, b) in DIAGONALS.items():
        lo = at[a]
        hi = at["S_end"] if b == "S" else at[b]
        rows = []
        for t in range(lo + 1, hi):
            m = figure_mask(frames[t])
            da = int((m ^ masks[a]).sum())
            db = int((m ^ masks[b]).sum())
            bal = min(da, db) / max(da, db, 1)
            rows.append((t, bal, da, db, m))
        best = max(r[1] for r in rows)
        band = [r for r in rows if r[1] >= BALANCE_BAND * best]
        sharp = {r[0]: sv.sharpness(frames[r[0]], r[4]) for r in band}
        t = max(band, key=lambda r: (sharp[r[0]], -r[0]))[0]
        out[diag] = {"frame": t, "balance": round(best, 3), "band": [band[0][0], band[-1][0]]}
    return out


def make_dirs(cfg, log=print):
    """dirs/<DIR>.png: cardinals from views/k-*.png (or the committed pose when
    a hero has no view sources), diagonals from the turntable, pinned frames
    from hero.json first. Writes video/diagonals.json with both."""
    make_views(cfg, log)
    dirs = os.path.join(cfg["video"], "dirs")
    for d in CARDINALS:
        k = os.path.join(cfg["video"], "views", f"k-{d}.png")
        dst = os.path.join(dirs, f"{d}.png")
        if os.path.exists(k):
            log(f"{'wrote' if copy_if_changed(k, dst) else 'same '} {rel(dst)}")
        elif not os.path.exists(dst):
            raise SystemExit(f"no views/v-{d}.* and no {rel(dst)}: generate the {d} view first")
    tt = os.path.join(cfg["video"], "turntable.mp4")
    if not os.path.exists(tt):
        raise SystemExit(f"no {rel(tt)}: generate the turntable first (see prompts.md)")
    frames = sv.run_ffmpeg_frames(tt)
    cards = {d: np.asarray(Image.open(os.path.join(dirs, f"{d}.png")).convert("RGB")) for d in CARDINALS}
    picked = pick_diagonals(frames, cards, key_frames(cfg, len(frames)))
    pins = cfg.get("diagonals") or {}
    used = {}
    for d in DIAGONALS:
        t = int(pins.get(d, picked[d]["frame"]))
        used[d] = t
        dst = os.path.join(dirs, f"{d}.png")
        wrote = save_png(dst, frames[t])
        how = "pinned" if d in pins else "picked"
        log(f"{'wrote' if wrote else 'same '} {rel(dst)}: frame {t} ({how}; picker {picked[d]['frame']})")
    record = {"frames": len(frames), "picker": picked, "used": used,
              "pinned": sorted(d for d in DIAGONALS if d in pins)}
    write_text(os.path.join(cfg["video"], "diagonals.json"), json.dumps(record, indent=1, sort_keys=True) + "\n")
    return record


# ---------------------------------------------------------------- 4 prompts

DIRECTION = {
    "S": "facing the camera",
    "SW": "three-quarter front view, facing down and to screen-left",
    "W": "facing screen-left, {poss} left side toward the camera",
    "NW": "seen from behind and to the left, facing up and to screen-left",
    "N": "seen from directly behind, back to the camera",
    "NE": "seen from behind and to the right, facing up and to screen-right",
    "E": "facing screen-right, {poss} right side toward the camera",
    "SE": "three-quarter front view, facing down and to screen-right",
}
VIEW = {
    "S": "front view, facing the camera",
    "N": "back view, seen from directly behind, back to the camera",
    "W": "left profile view, facing screen-left, {poss} left side toward the camera",
    "E": "right profile view, facing screen-right, {poss} right side toward the camera",
}
# Where an item sits on the body, in the S view: x to image-right, z toward the camera.
PLACE = {"right": (-1.0, 0.0), "left": (1.0, 0.0), "back": (0.0, -1.0), "front": (0.0, 1.0)}


def place_vector(at):
    words = at.split()
    if "back" in words and ("right" in words or "left" in words):
        side = PLACE["right" if "right" in words else "left"]
        return (side[0] * 0.5, -0.87)
    for w in ("right", "left", "back", "front"):
        if w in words:
            return PLACE[w]
    return None


def placement(item, d):
    """Where the item shows on screen in direction d: the item's own "sides"
    entry if it has one ("image-left", "image-right", or a phrase used as
    written), else the body position turned to the facing."""
    sides = item.get("sides") or {}
    if d in sides:
        side = sides[d]
        return f"on the {side} side" if side in ("image-left", "image-right") else side
    v = place_vector(item.get("at", ""))
    if v is None:
        return ""
    th = math.radians(ANGLE[d])
    x = v[0] * math.cos(th) - v[1] * math.sin(th)
    z = v[0] * math.sin(th) + v[1] * math.cos(th)
    parts = []
    if x <= -0.5:
        parts.append("on the image-left side")
    elif x >= 0.5:
        parts.append("on the image-right side")
    if z >= 0.5:
        parts.append("toward the camera")
    elif z <= -0.5:
        parts.append("partly hidden behind the body")
    return ", ".join(parts)


def where(item, poss):
    at = item.get("at", "")
    if at == "body" or not at:
        return ""
    words = at.split()
    if words[-1] == "hand":
        return f"in {poss} {at}"
    if words[-1] in ("arm", "hip"):
        return f"{'on' if words[-1] == 'arm' else 'at'} {poss} {at}"
    if words == ["back"]:
        return f"on {poss} back"
    if "back" in words:
        return f"over {poss} {' '.join(w for w in words if w != 'back')}"
    return f"at {poss} {at}"


def item_line(item, d, poss):
    if item.get("at") == "body":
        return ""
    p = placement(item, d)
    if item.get("visible"):
        # A weapon the figure must show in every view (the goblin's first
        # view-E lost its spear): never "partly hidden behind the body".
        p = ", ".join([x for x in p.split(", ") if x and x != "partly hidden behind the body"]
                      + ["in full view"])
    return f"{item['name']} {where(item, poss)}" + (f" ({p})" if p else "")


def visible_line(item, poss):
    """The sentence a view adds for an item with "visible": true."""
    return (f"The {item['name']} stays clearly visible in full in this view, held out clear of "
            f"{poss} body: not hidden behind the body, not dropped, not cut off.")


def sentence(text):
    text = text.strip()
    return text[0].upper() + text[1:] + ("" if text.endswith(".") else ".") if text else ""


def join_and(words):
    words = list(words)
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def steady_light(cfg):
    glows = [i["glows"] for i in cfg["items"] if i.get("glows")]
    if glows:
        return (f"No flashing, glowing or pulsing light: {join_and(glows)} keeps exactly the same "
                f"brightness and colour in every frame, no glow, no halo.")
    return "No flashing, glowing or pulsing light: every colour keeps exactly the same brightness in every frame."


# The prompt words that assume a figure standing on its feet, and what a
# flier (asset.json "flies": true) says instead. Everything else is shared.
GROUNDED = {
    "walk_lead": "walks in place on a treadmill",
    "walk_beats": "Two full steps",
    "attack_hold": "feet stay planted",
    "turn_pose": "stands perfectly still in a neutral idle pose on an invisible turntable",
    "turn_still": "no walking",
}
FLIER = {
    "walk_lead": "hovers in place in the air, flapping its wings",
    "walk_beats": "Two full wingbeats",
    "attack_hold": "it hangs in the air at the same height",
    "turn_pose": "hangs perfectly still in the air on an invisible turntable with its wings spread wide and frozen",
    "turn_still": "no flapping",
}


def build_prompts(cfg):
    """Every GenerateImage / GenerateVideo call for the hero, in order, with
    the exact arguments and where to save the result. Paths are relative to
    the repository root."""
    h, poss, noun = cfg["hero"], cfg["possessive"], cfg["noun"]
    base = f"assets/reference/{h}"
    vid = f"{base}/video"
    design = cfg["design"]
    words = FLIER if cfg.get("flies") else GROUNDED
    calls = []
    mirror = cfg.get("mirror_views", {})
    views = [d for d in ("S", "N", "W", "E") if d not in mirror]
    for d in views:
        items = [item_line(i, d, poss) for i in cfg["items"]]
        items = "; ".join(x for x in items if x)
        front = view_source(cfg, "S")
        front = f"{vid}/views/{os.path.basename(front) if front else 'v-S.png'}"
        refs = [f"{base}/concept.png"] + (list(cfg.get("style_refs", [])) if d == "S" else [front])
        source = cfg.get("source_note", "")
        # A per-view sentence for a take that lost a prop (asset.json "view_notes").
        note = cfg.get("view_notes", {}).get(d, "")
        note = f" {sentence(note)}" if note else ""
        note += "".join(f" {visible_line(i, poss)}" for i in cfg["items"] if i.get("visible"))
        style = (" Match the rendering style of the second reference image exactly: the same chunky voxel pixel-art "
                 "look, block size, outline-free shading and soft lighting, but not its design."
                 if d == "S" and cfg.get("style_refs") else "")
        pose = cfg.get("view_pose") or (f"Whole figure from the top of the head to the {cfg.get('feet', 'boots')}, "
                                         "standing in a neutral idle pose, arms relaxed, feet on the ground, nothing cropped")
        # Items, notes and the style line; a figure with no items (the wolf) has none of the first two.
        mid = f"{sentence(items)}{note}{style}".strip()
        text = (f"Full-body game character reference of the {noun} from the reference image, "
                f"{VIEW[d].format(poss=poss)}.{(' ' + sentence(source)) if source else ''} Same design exactly: {design}. "
                f"{mid + ' ' if mid else ''}"
                f"{sentence(pose)} Plain flat white background, no floor, no shadow, no text, "
                "no other figures. One single view only, not a sheet of several views.")
        calls.append({"id": f"view-{d}", "step": "views", "tool": "GenerateImage",
                      "args": {"description": text, "reference_image_paths": refs, "aspect_ratio": "1:1",
                               "filename": f"{h}-v-{d}.png"},
                      "save_as": f"{vid}/views/v-{d}.png",
                      "then": "hero_sprites.py views" if d == views[-1] else None})
    t = cfg["turntable"]
    keys = [{"image_path": f"{vid}/views/k-{d}.png", "timestamp_s": t["keyframes"][d]} for d in ("W", "N", "E")]
    turn = (f"Game character turnaround reference. The {noun} {words['turn_pose']} and rotates a full 360 degrees at a constant speed, turning to show {poss} left "
            f"side, then {poss} back, then {poss} right side, then front again. Locked-off camera, slightly "
            "elevated looking down, no camera movement, no zoom, no perspective change. Plain flat white "
            f"background, even soft lighting. The design stays exactly identical: {t.get('design', design)}. "
            f"{steady_light(cfg)} Crisp sharp detail in every frame, no motion blur, no ghosting, {words['turn_still']}, "
            "no text.")
    calls.append({"id": "turntable", "step": "dirs", "tool": "GenerateVideo",
                  "args": {"prompt": turn, "image_path": f"{vid}/views/k-S.png",
                           "last_frame_path": f"{vid}/views/k-S.png", "keyframes": keys,
                           "duration": t["seconds"], "aspect_ratio": "1:1", "resolution": "720p",
                           "filename": f"{h}-turntable.mp4"},
                  "save_as": f"{vid}/turntable.mp4", "then": "hero_sprites.py dirs"})
    walk_bits = [i["walk"] for i in cfg["items"] if i.get("walk")]
    idle_bits = [i["idle"] for i in cfg["items"] if i.get("idle")]
    stills = [i["still"] for i in cfg["items"] if i.get("still")]
    gait = cfg.get("gait", "Steady marching walk: legs alternating clearly, slight body bob")
    clips = cfg["clips"] if "clips" in cfg else HERO_CLIPS
    order = [(k, d) for d in COLUMNS for k in CLIP_KINDS if d in clips.get(k, ())]
    over = cfg.get("clip_overrides", {})
    for d in COLUMNS:
        face = DIRECTION[d].format(poss=poss)
        ow, oa, od = (over.get(f"{k}-{d}", {}) for k in ("walk", "attack", "death"))
        props = "; ".join(x for x in (item_line(i, d, poss) for i in cfg["items"]) if x)
        walk = (f"Game sprite walk cycle. The {noun} {words['walk_lead']}, keeping exactly the facing "
                f"direction of the first frame ({face}). Holding exactly the body angle of the first frame: torso "
                "does not twist. " + ow.get("gait", gait)
                + "".join(f", {b}" for b in ow.get("walk", walk_bits)) + ". "
                + (f"Props stay where the first frame has them: {props}. " if props else "")
                + f"The {noun} stays exactly centered, does not turn, move or change size. Locked-off camera, no "
                "zoom, plain flat white background, even lighting, crisp frames, no motion blur. "
                f"{words['walk_beats']}, loops seamlessly back to the starting pose.")
        idle = (f"Nearly static game sprite idle loop. The {noun} holds exactly the pose, angle and facing of the "
                f"first frame ({face}) for the whole clip. Only a very small breathing motion: chest and shoulders "
                "rise and fall by a few pixels" + "".join(f", {b}" for b in idle_bits) + ". "
                + (f"{sentence(join_and(stills))[:-1]} stay completely still, a" if stills else "A")
                + "rms do not move, body does not turn, feet do not move, head does not turn. "
                + f"{steady_light(cfg)} Locked camera, no zoom, plain flat white background, even lighting, "
                "crisp frames.")
        attack = (f"Game sprite attack. The {noun} keeps exactly the facing direction of the first frame ({face}) "
                  f"and the body angle of the first frame: torso does not twist away. In one quick motion it "
                  f"{oa.get('attack', cfg.get('attack', ''))}, then returns exactly to the starting pose and holds it for the last "
                  "frames. "
                  + (f"Props stay where the first frame has them: {props}. " if props else "")
                  + f"The {noun} stays exactly centered, {words['attack_hold']}, no turning, no change of size. "
                  f"{steady_light(cfg)} Locked-off camera, no zoom, plain flat white background, even lighting, "
                  "crisp frames, no motion blur, no speed lines, no effects.")
        death = (f"Game sprite death. The {noun} starts exactly in the pose and facing of the first frame ({face}). "
                 f"It is struck down: it {od.get('death', cfg.get('death', ''))}. It lies still on the ground for the last half "
                 f"second. The body stays centered on the same spot and does not slide out of frame. "
                 f"{steady_light(cfg)} No blood, no gore, no fading, no particles, no effects. Locked-off camera, "
                 "no zoom, plain flat white background, even lighting, crisp frames, no motion blur.")
        for kind, text in (("walk", walk), ("idle", idle), ("attack", attack), ("death", death)):
            if d not in clips.get(kind, ()):
                continue
            args = {"prompt": text, "image_path": f"{vid}/dirs/{d}.png",
                    "last_frame_path": f"{vid}/dirs/{d}.png", "duration": 2,
                    "aspect_ratio": "1:1", "resolution": "720p", "filename": f"{h}-{kind}-{d}.mp4"}
            if kind == "death":
                del args["last_frame_path"]  # a fall ends on the ground, not on the start pose
            calls.append({"id": f"{kind}-{d}", "step": "precheck", "tool": "GenerateVideo",
                          "args": args,
                          "save_as": f"{vid}/{kind}-{d}.mp4",
                          "then": "hero_sprites.py precheck" if (kind, d) == order[-1] else None})
    for c in calls:
        if c["then"] is None:
            del c["then"]
    out = {"hero": h, "paths": "relative to the repository root", "calls": calls}
    if cfg.get("type", "hero") != "hero":
        out["type"] = cfg["type"]  # a hero's prompts.json carries no type key
    return out


def absolute(prompts, root=ROOT):
    def fix(v, key=""):
        if isinstance(v, dict):
            return {k: fix(x, k) for k, x in v.items()}
        if isinstance(v, list):
            return [fix(x, key) for x in v]
        if isinstance(v, str) and (key.endswith("path") or key.endswith("paths") or key == "save_as"):
            return os.path.join(root, v)
        return v
    out = fix(prompts)
    out["paths"] = "absolute"
    return out


def prompts_markdown(p):
    lines = [f"# {p['hero']} generation calls", "",
             "Generated by `python3 script/hero_sprites.py " + p["hero"] + " prep` from `" + ("asset.json" if "type" in p else "hero.json") + "`; do not edit.",
             "Paths are relative to the repository root (`hero_sprites.py " + p["hero"] + " prompts --abs` prints "
             "them absolute). Save each result at `save_as`, then run the step named in `then`.", ""]
    for c in p["calls"]:
        lines += [f"## {c['id']} ({c['tool']})", "", f"Save as `{c['save_as']}`." +
                  (f" Then run `{c['then']}`." if c.get("then") else ""), "", "```json",
                  json.dumps(c["args"], indent=1), "```", ""]
    return "\n".join(lines)


def write_prompts(cfg, log=print):
    p = build_prompts(cfg)
    for name, text in (("prompts.json", json.dumps(p, indent=1) + "\n"), ("prompts.md", prompts_markdown(p))):
        path = os.path.join(cfg["dir"], name)
        log(f"{'wrote' if write_text(path, text) else 'same '} {rel(path)}")
    return p


# ---------------------------------------------------------------- 5 precheck

CROSS = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)


def cell_alpha(frame, scale):
    """The frame's silhouette in its sheet cell, outline included: exactly the
    alpha the sheet build gives it."""
    top, foot = sv.span(frame["mask"])
    own = min(max(sv.FILL / (foot - top + 1), scale * 0.95), scale * 1.05)
    _, a = sv.place(frame, own, sv.head_centre(frame["mask"]), foot)
    return ndimage.binary_dilation(a, CROSS)


def pose_at(path, frame):
    """A start pose (dirs/<d>.png) as RGB at the clip's frame size. A clip
    can come back at another size than its 720 px first frame (the wolf's
    deaths are 960 px): the generator scaled the pose up, so the pose is
    scaled the same way (Lanczos) before it is cut out and placed. Placing
    the 720 px pose instead puts the outline on another sub-pixel grid: the
    wolf death-N frame 0 was the pose itself yet differed by 20 px from it
    on all three takes, against 1 to 4 px on the resized pose."""
    img = Image.open(path).convert("RGB")
    h, w = frame["rgb"].shape[:2]
    if img.size != (w, h):
        img = img.resize((w, h), Image.LANCZOS)
    return np.asarray(img)


def pose_alpha(path, frame=None):
    pose = np.asarray(Image.open(path).convert("RGB")) if frame is None else pose_at(path, frame)
    m = sv.cut_out(pose)
    top, foot = sv.span(m)
    _, a = sv.place({"rgb": pose, "mask": m}, sv.FILL / (foot - top + 1), sv.head_centre(m), foot)
    return ndimage.binary_dilation(a, CROSS)


def clip_format(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate", "-of", "json", path],
                         check=True, capture_output=True, text=True).stdout
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return s["width"], s["height"], float(num) / float(den)


def precheck(cfg, log=print):
    """Per-clip problems before the build: {clip: [reasons]}. Format (square,
    24 fps, 49 frames), loop closes (last frame vs first), starts on its pose,
    an idle never strays far from its first frame, then every sheet check on an in-memory build, each failure blamed on the
    clips whose frames failed it. A monster goes to monster_precheck."""
    if cfg["type"] != "hero":
        return monster_precheck(cfg, log)
    vid = cfg["video"]
    problems = {}

    def flag(clip, why):
        problems.setdefault(clip, []).append(why)

    missing = [f"{k}-{d}.mp4" for d in COLUMNS for k in ("walk", "idle")
               if not os.path.exists(os.path.join(vid, f"{k}-{d}.mp4"))]
    missing += [f"dirs/{d}.png" for d in COLUMNS if not os.path.exists(os.path.join(vid, "dirs", f"{d}.png"))]
    if missing:
        for m in missing:
            flag(m, "missing")
        return problems
    walk_median = {}

    def inspect(d, kind, frames, picks, scale):
        clip = f"{kind}-{d}.mp4"
        w, h, fps = clip_format(os.path.join(vid, clip))
        if w != h or round(fps) != CLIP_FPS or len(frames) != CLIP_FRAMES:
            flag(clip, f"format {w}x{h} {fps:g} fps {len(frames)} frames (want square, {CLIP_FPS} fps, "
                       f"{CLIP_FRAMES} frames: 2 s with last frame = first)")
        if kind == "walk":
            cells = [cell_alpha(frames[i], scale) for i in picks]
            walk_median[d] = float(np.median([int((cells[r] != cells[(r + 1) % sv.WALK]).sum())
                                              for r in range(sv.WALK)]))
        med = walk_median[d]
        first, last = cell_alpha(frames[0], scale), cell_alpha(frames[-1], scale)
        loop = int((first != last).sum())
        limit = (WALK_LOOP if kind == "walk" else IDLE_LOOP) * med
        if loop > limit:
            flag(clip, f"loop does not close: last frame differs from the first by {loop} silhouette px "
                       f"(limit {limit:.0f} = {WALK_LOOP if kind == 'walk' else IDLE_LOOP} x walk median {med:.0f})")
        if kind == "idle":
            drift = max(int((cell_alpha(f, scale) != first).sum()) for f in frames)
            if drift > IDLE_DRIFT * med:
                flag(clip, f"idle moves too much: a frame differs from the first by {drift} silhouette px "
                           f"(limit {IDLE_DRIFT * med:.0f} = {IDLE_DRIFT} x walk median {med:.0f})")
        start = int((first != pose_alpha(os.path.join(vid, "dirs", f"{d}.png"), frames[0])).sum())
        if start > START_POSE * med:
            flag(clip, f"does not start on dirs/{d}.png: first frame differs by {start} silhouette px "
                       f"(limit {START_POSE * med:.0f} = {START_POSE} x walk median {med:.0f})")
        log(f"{clip}: {len(frames)} frames, loop {loop} px, start {start} px, walk median {med:.0f}")

    with contextlib.redirect_stderr(io.StringIO()):
        sheet, pal, plan = sv.build(vid, inspect)
    import check_sprite_sheet as cs
    hero = cs.HEROES.get(cfg["hero"])
    if hero is None:
        log(f"{cfg['hero']}/hero.json has no check profile: sheet checks skipped (fill \"check\" first)")
        return problems
    rep = cs.run_checks(hero, sheet, os.path.join(vid, "dirs"), quiet=True)
    for ok, name, detail, clips in rep.results:
        if ok:
            continue
        for clip in clips or ("sheet",):
            flag(clip, f"{name}: {detail}")
    return problems


def monster_precheck(cfg, log=print):
    """precheck for a monster asset: every clip in its "clips" has the format;
    walk and attack loops close (an attack ends on its start pose); every
    clip starts on its dirs pose; a death has no loop. Silhouettes are the
    cells build_monster places, measured against the walk of the same
    direction. Then run_monster_checks on the in-memory sheet."""
    vid = cfg["video"]
    spec, have = sv.sheet_spec(cfg), cfg["clips"]
    problems = {}

    def flag(clip, why):
        problems.setdefault(clip, []).append(why)

    missing = [f"{k}-{d}.mp4" for k, dirs in have.items() for d in dirs
               if not os.path.exists(os.path.join(vid, f"{k}-{d}.mp4"))]
    missing += [f"dirs/{d}.png" for d in COLUMNS if not os.path.exists(os.path.join(vid, "dirs", f"{d}.png"))]
    for kind, _ in spec.rows:
        for d in COLUMNS:
            try:
                sv.clip_for(have, kind, d)
            except SystemExit as e:
                missing.append(f"{kind}-{d}.mp4 ({e})")
    if missing:
        for m in missing:
            flag(m, "missing")
        return problems
    poses = {}

    def pose(d, frame):
        """dirs/<d>.png placed as a cell, scaled first to the clip's frame size."""
        key = (d, frame["rgb"].shape[:2])
        if key not in poses:
            _, a = sv.pose_place(pose_at(os.path.join(vid, "dirs", f"{d}.png"), frame), spec)
            poses[key] = ndimage.binary_dilation(a, CROSS)
        return poses[key]
    walk_median = {}

    def inspect(d, kind, frames, picks, scale, placer):
        clip = f"{kind}-{d}.mp4"
        w, h, fps = clip_format(os.path.join(vid, clip))
        if w != h or round(fps) != CLIP_FPS or len(frames) != CLIP_FRAMES:
            flag(clip, f"format {w}x{h} {fps:g} fps {len(frames)} frames (want square, {CLIP_FPS} fps, "
                       f"{CLIP_FRAMES} frames: 2 s with last frame = first)")

        def alpha(i):
            return ndimage.binary_dilation(placer(i)[1], CROSS)
        if kind == "walk":
            cells = [alpha(i) for i in picks]
            walk_median[d] = float(np.median([int((cells[r] != cells[(r + 1) % len(cells)]).sum())
                                              for r in range(len(cells))]))
        med = walk_median[d]
        first = alpha(0)
        loop = None
        if kind in ("walk", "attack"):
            loop = int((first != alpha(len(frames) - 1)).sum())
            k = WALK_LOOP if kind == "walk" else ATTACK_LOOP
            if loop > k * med:
                flag(clip, f"loop does not close: last frame differs from the first by {loop} silhouette px "
                           f"(limit {k * med:.0f} = {k} x walk median {med:.0f})")
        start = int((first != pose(d, frames[0])).sum())
        if start > START_POSE * med:
            flag(clip, f"does not start on dirs/{d}.png: first frame differs by {start} silhouette px "
                       f"(limit {START_POSE * med:.0f} = {START_POSE} x walk median {med:.0f})")
        log(f"{clip}: {len(frames)} frames, " + (f"loop {loop} px, " if loop is not None else "no loop (death), ")
            + f"start {start} px, picks {picks}, walk median {med:.0f}")

    with contextlib.redirect_stderr(io.StringIO()):
        sheet, pal, plan = sv.build_monster(vid, spec, have, inspect)
    import check_sprite_sheet as cs
    asset = cs.ASSETS.get(cfg["hero"])
    if asset is None:
        log(f"{cfg['hero']}/asset.json has no check profile: sheet checks skipped (fill \"check\" first)")
        return problems
    rep = cs.run_monster_checks(asset, sheet, os.path.join(vid, "dirs"), quiet=True)
    for ok, name, detail, clips in rep.results:
        if not ok:
            for clip in clips or ("sheet",):
                flag(clip, f"{name}: {detail}")
    return problems


# ---------------------------------------------------------------- 6 build

def approval_dir(hero, override=None):
    if override:
        return override
    return os.path.join(os.environ.get("HERO_APPROVAL_ROOT", "/workspace/lk/approval"), hero)


def build(cfg, approval=None, log=print):
    """Sheet and normal map, every check, and the approval files: contact.png,
    walk.gif, idle.gif and check.txt (a monster: sheet.png, strip.png,
    contact.png, one GIF per clip kind and check.txt). Returns the number of
    failing checks."""
    import check_sprite_sheet as cs
    h = cfg["hero"]
    if h not in (cs.HEROES if cfg["type"] == "hero" else cs.ASSETS):
        name = "hero.json" if cfg["type"] == "hero" else "asset.json"
        raise SystemExit(f"{h}/{name} has no check profile: fill \"check\" before the build")
    sv.main([h])
    out = approval_dir(h, approval)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        code = cs.main([h, "--out", out])
    text = buf.getvalue()
    write_text(os.path.join(out, "check.txt"), text)
    log(text, end="")
    log(f"approval files in {out}")
    return code


# ---------------------------------------------------------------- colours

def concept_colours(cfg, k=12):
    """The concept's main colours with hue, lightness and chroma, to write the
    check profile's anchors and role ranges from."""
    import colorsys
    im = np.asarray(Image.open(os.path.join(cfg["dir"], "concept.png")).convert("RGB")).reshape(-1, 3)
    lo, hi = im.min(1), im.max(1)
    keep = im[(hi > 40) & (lo < 235)].astype(np.float64)  # drop the dark sheet backdrop and white
    pal = sv.build_palette(keep, k=k)
    lab = sv.srgb_to_lab(keep)
    plab = sv.srgb_to_lab(np.array(pal, np.float64))
    idx = ((lab[:, None] - plab[None]) ** 2).sum(2).argmin(1)
    rows = []
    for j, c in enumerate(pal):
        r, g, b = [v / 255 for v in c]
        hh, ll, _ = colorsys.rgb_to_hls(r, g, b)
        rows.append((float((idx == j).mean()), c, round(hh * 360), round(ll, 2), round(max(r, g, b) - min(r, g, b), 2)))
    return sorted(rows, reverse=True)


# ---------------------------------------------------------------- CLI

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("hero")
    ap.add_argument("step", choices=["prep", "views", "dirs", "precheck", "build", "colours", "prompts"])
    ap.add_argument("--approval", help="approval folder (default $HERO_APPROVAL_ROOT/<hero>, "
                                       "HERO_APPROVAL_ROOT defaults to /workspace/lk/approval)")
    ap.add_argument("--abs", action="store_true", help="prompts: print with absolute paths")
    args = ap.parse_args(argv)
    cfg = load_config(args.hero)
    if args.step == "prep":
        crop_concept(cfg)
        print(f"concept {rel(os.path.join(cfg['dir'], 'concept.png'))}")
        write_prompts(cfg)
        make_views(cfg)
        return 0
    if args.step == "views":
        make_views(cfg)
        return 0
    if args.step == "dirs":
        rec = make_dirs(cfg)
        print("picker " + " ".join(f"{d}={rec['picker'][d]['frame']}" for d in DIAGONALS) +
              " | used " + " ".join(f"{d}={rec['used'][d]}" for d in DIAGONALS))
        return 0
    if args.step == "precheck":
        problems = precheck(cfg)
        if not problems:
            print("precheck OK: every clip passes; run build")
            return 0
        print("regenerate before the build:")
        for clip in sorted(problems):
            for why in problems[clip]:
                print(f"  {clip}: {why}")
        return 1
    if args.step == "build":
        return build(cfg, args.approval)
    if args.step == "colours":
        for share, c, hh, ll, ch in concept_colours(cfg):
            print(f"{share:6.1%}  rgb{c}  hue {hh:3d}  light {ll:.2f}  chroma {ch:.2f}")
        return 0
    if args.step == "prompts":
        p = build_prompts(cfg)
        print(json.dumps(absolute(p) if args.abs else p, indent=1))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
