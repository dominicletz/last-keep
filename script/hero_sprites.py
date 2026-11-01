#!/usr/bin/env python3
"""One entry point for a hero's 8-direction sprite sheet.

    python3 script/hero_sprites.py HERO prep       # concept crop, prompts, views
    python3 script/hero_sprites.py HERO views      # normalize views/v-*.* to k-*.png
    python3 script/hero_sprites.py HERO dirs       # views + 8 start poses from the turntable
    python3 script/hero_sprites.py HERO precheck   # which clips to regenerate, before the build
    python3 script/hero_sprites.py HERO build      # sheet + checks + approval files
    python3 script/hero_sprites.py HERO colours    # concept colours, for the check profile
    python3 script/hero_sprites.py HERO prompts --abs   # prompts with absolute paths

Everything is driven by assets/reference/HERO/hero.json. Only the
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
STRAY = 0.02         # fragments under 2% of the figure outside its box are blanked
BALANCE_BAND = 0.9   # diagonal candidates: balance within 90% of the best
CLIP_FPS = 24
CLIP_FRAMES = 49     # 2 s at 24 fps, last frame = first
WALK_LOOP = 0.5      # last vs first frame, silhouette px, times the walk median
IDLE_LOOP = 0.6
START_POSE = 0.2     # first frame vs dirs/<DIR>.png, times the walk median
IDLE_DRIFT = 0.8     # any idle frame vs its first frame, times the walk median


# ---------------------------------------------------------------- config

def load_config(hero, reference=REFERENCE):
    path = os.path.join(reference, hero, "hero.json")
    if not os.path.exists(path):
        raise SystemExit(f"no {os.path.relpath(path, ROOT)}: write the hero config first")
    with open(path) as fh:
        cfg = json.load(fh)
    for key in ("noun", "possessive", "concept", "design", "items", "turntable"):
        if key not in cfg:
            raise SystemExit(f"{hero}/hero.json is missing {key!r}")
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

def normalize_view(rgb):
    """A generated view on white -> 720x720 white canvas, figure 520 px tall,
    centred, last figure row at y = 639. The figure is min(RGB) < 225.
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
    w = round((x1 - x0) * VIEW_HEIGHT / (y1 - y0))
    crop = Image.fromarray(a).crop((x0, y0, x1, y1)).resize((w, VIEW_HEIGHT), Image.LANCZOS)
    out = Image.new("RGB", (VIEW_CANVAS, VIEW_CANVAS), "white")
    out.paste(crop, (round((VIEW_CANVAS - w) / 2), VIEW_FEET - VIEW_HEIGHT))
    return np.asarray(out)


def view_source(cfg, d):
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = os.path.join(cfg["video"], "views", f"v-{d}.{ext}")
        if os.path.exists(p):
            return p
    return None


def make_views(cfg, log=print):
    done = []
    for d in CARDINALS:
        src = view_source(cfg, d)
        if not src:
            continue
        out = os.path.join(cfg["video"], "views", f"k-{d}.png")
        wrote = save_png(out, normalize_view(np.asarray(Image.open(src).convert("RGB"))))
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
    return f"{item['name']} {where(item, poss)}" + (f" ({p})" if p else "")


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


def build_prompts(cfg):
    """Every GenerateImage / GenerateVideo call for the hero, in order, with
    the exact arguments and where to save the result. Paths are relative to
    the repository root."""
    h, poss, noun = cfg["hero"], cfg["possessive"], cfg["noun"]
    base = f"assets/reference/{h}"
    vid = f"{base}/video"
    design = cfg["design"]
    calls = []
    for d in ("S", "N", "W", "E"):
        items = [item_line(i, d, poss) for i in cfg["items"]]
        items = "; ".join(x for x in items if x)
        front = view_source(cfg, "S")
        front = f"{vid}/views/{os.path.basename(front) if front else 'v-S.png'}"
        refs = [f"{base}/concept.png"] + ([] if d == "S" else [front])
        text = (f"Full-body game character reference of the {noun} from the reference image, "
                f"{VIEW[d].format(poss=poss)}. Same design exactly: {design}. "
                f"{sentence(items)} "
                "Whole figure from the top of the head to the boots, standing in a neutral idle pose, arms relaxed, "
                "feet on the ground, nothing cropped. Plain flat white background, no floor, no shadow, no text, "
                "no other figures. One single view only, not a sheet of several views.")
        calls.append({"id": f"view-{d}", "step": "views", "tool": "GenerateImage",
                      "args": {"description": text, "reference_image_paths": refs, "aspect_ratio": "1:1",
                               "filename": f"{h}-v-{d}.png"},
                      "save_as": f"{vid}/views/v-{d}.png",
                      "then": "hero_sprites.py views" if d == "E" else None})
    t = cfg["turntable"]
    keys = [{"image_path": f"{vid}/views/k-{d}.png", "timestamp_s": t["keyframes"][d]} for d in ("W", "N", "E")]
    turn = (f"Game character turnaround reference. The {noun} stands perfectly still in a neutral idle pose on an "
            f"invisible turntable and rotates a full 360 degrees at a constant speed, turning to show {poss} left "
            f"side, then {poss} back, then {poss} right side, then front again. Locked-off camera, slightly "
            "elevated looking down, no camera movement, no zoom, no perspective change. Plain flat white "
            f"background, even soft lighting. The design stays exactly identical: {t.get('design', design)}. "
            f"{steady_light(cfg)} Crisp sharp detail in every frame, no motion blur, no ghosting, no walking, "
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
    for d in COLUMNS:
        face = DIRECTION[d].format(poss=poss)
        props = "; ".join(x for x in (item_line(i, d, poss) for i in cfg["items"]) if x)
        walk = (f"Game sprite walk cycle. The {noun} walks in place on a treadmill, keeping exactly the facing "
                f"direction of the first frame ({face}). Holding exactly the body angle of the first frame: torso "
                "does not twist. Steady marching walk: legs alternating clearly, slight body bob"
                + "".join(f", {b}" for b in walk_bits) + ". "
                + (f"Props stay where the first frame has them: {props}. " if props else "")
                + f"The {noun} stays exactly centered, does not turn, move or change size. Locked-off camera, no "
                "zoom, plain flat white background, even lighting, crisp frames, no motion blur. Two full steps, "
                "loops seamlessly back to the starting pose.")
        idle = (f"Nearly static game sprite idle loop. The {noun} holds exactly the pose, angle and facing of the "
                f"first frame ({face}) for the whole clip. Only a very small breathing motion: chest and shoulders "
                "rise and fall by a few pixels" + "".join(f", {b}" for b in idle_bits) + ". "
                + (f"{sentence(join_and(stills))[:-1]} stay completely still, a" if stills else "A")
                + "rms do not move, body does not turn, feet do not move, head does not turn. "
                + f"{steady_light(cfg)} Locked camera, no zoom, plain flat white background, even lighting, "
                "crisp frames.")
        for kind, text in (("walk", walk), ("idle", idle)):
            calls.append({"id": f"{kind}-{d}", "step": "precheck", "tool": "GenerateVideo",
                          "args": {"prompt": text, "image_path": f"{vid}/dirs/{d}.png",
                                   "last_frame_path": f"{vid}/dirs/{d}.png", "duration": 2,
                                   "aspect_ratio": "1:1", "resolution": "720p", "filename": f"{h}-{kind}-{d}.mp4"},
                          "save_as": f"{vid}/{kind}-{d}.mp4",
                          "then": "hero_sprites.py precheck" if (kind, d) == ("idle", "SE") else None})
    for c in calls:
        if c["then"] is None:
            del c["then"]
    return {"hero": h, "paths": "relative to the repository root", "calls": calls}


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
             "Generated by `python3 script/hero_sprites.py " + p["hero"] + " prep` from `hero.json`; do not edit.",
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


def pose_alpha(path):
    pose = np.asarray(Image.open(path).convert("RGB"))
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
    clips whose frames failed it."""
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
    poses = {d: pose_alpha(os.path.join(vid, "dirs", f"{d}.png")) for d in COLUMNS}
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
        start = int((first != poses[d]).sum())
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


# ---------------------------------------------------------------- 6 build

def approval_dir(hero, override=None):
    if override:
        return override
    return os.path.join(os.environ.get("HERO_APPROVAL_ROOT", "/workspace/lk/approval"), hero)


def build(cfg, approval=None, log=print):
    """Sheet and normal map, every check, and the approval files: contact.png,
    walk.gif, idle.gif and check.txt. Returns the number of failing checks."""
    import check_sprite_sheet as cs
    h = cfg["hero"]
    if h not in cs.HEROES:
        raise SystemExit(f"{h}/hero.json has no check profile: fill \"check\" before the build")
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
