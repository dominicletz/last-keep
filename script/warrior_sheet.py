#!/usr/bin/env python3
"""Hand-built warrior sheet for the HD-2D picture.

The mesh is boxes. Blender 4.2.9 writes the .blend and the .glb when this file
runs under ``blender --background --python``. The pixels come from the
rasterizer below, not from Cycles, so a second run matches the committed sheet
byte for byte. ``python3 script/warrior_sheet.py --check`` is the CI rebuild.

The hero card is 32 world units tall. ``pixelStep(168, 400)`` is 0.84, so the
fill is ``round(32 / 0.84)`` = 38 px inside a 64 px cell. A 1 px outline of
RGB 24 then sits on the outside of that fill. The camera elevation is
``atan(0.9 / sqrt(2))``, the game's follow slope. Column 0 is south, and the
orbit is clockwise: S, SW, W, NW, N, NE, E, SE. The shield is the hero's left,
which is the viewer's right on column 0.
"""

import math
import os
import struct
import sys
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SHEET = os.path.join(ROOT, "priv/static/images/hd2d/warrior-walk.png")
NORMAL = os.path.join(ROOT, "priv/static/images/hd2d/warrior-walk-normal.png")
BLEND = os.path.join(ROOT, "assets/models/warrior.blend")
GLB = os.path.join(ROOT, "assets/models/warrior.glb")

CELL = 64
HI = CELL * 2
DIRS = 8
WALK = 8
IDLE = 4
ROWS = WALK + IDLE
WORLD_H = 32
TEXEL = 0.84
FILL = round(WORLD_H / TEXEL)
ELEV = math.atan(0.9 / math.sqrt(2))
OUTLINE = (24, 24, 24)

# Three bands per material. These tuples are the palette.
BANDS = {
    "plate": ((232, 228, 224), (181, 175, 170), (112, 108, 104)),
    "helmet": ((90, 96, 104), (58, 64, 72), (32, 36, 42)),
    "cape": ((176, 48, 42), (122, 28, 28), (72, 16, 18)),
    "shield": ((92, 122, 158), (56, 81, 111), (32, 48, 70)),
    "gold": ((240, 206, 110), (196, 154, 64), (128, 96, 32)),
    "skin": ((214, 164, 128), (176, 124, 96), (120, 80, 64)),
    "beard": ((92, 64, 44), (62, 42, 30), (36, 24, 18)),
    "sword": ((210, 214, 216), (150, 156, 160), (78, 84, 90)),
    "belt": ((120, 78, 42), (78, 50, 28), (46, 30, 18)),
    "boot": ((72, 52, 36), (48, 34, 24), (28, 20, 14)),
}


def palette():
    colors = {OUTLINE}
    for bands in BANDS.values():
        colors.update(bands)
    return colors


def add(boxes, name, cx, cy, cz, sx, sy, sz):
    boxes.append((name, cx, cy, cz, sx, sy, sz))


def figure(frame, idle):
    """Chunky plate, open helmet, beard, belt, cape, sword in the right hand,
    blue kite shield on the left arm. The hero faces +Z. Left is +X, which is
    the viewer's right when the camera sits on +Z.

    The sword tip stays above the boot sole. ``fit_fill`` scales the whole
    opaque span, so a blade below the feet would become the baseline."""
    boxes = []
    # Contacts are 0 and 4. The forward foot is the one with the larger z.
    # arm swings the sword hand toward the camera when the left foot leads.
    poses = (
        (0.18, 0.00, -0.16, 0.00, 0.10),
        (0.10, 0.06, -0.06, 0.00, 0.06),
        (0.00, 0.16, 0.00, 0.00, 0.00),
        (-0.08, 0.08, 0.10, 0.00, -0.06),
        (-0.16, 0.00, 0.18, 0.00, -0.10),
        (-0.08, 0.00, 0.10, 0.06, -0.06),
        (0.00, 0.00, 0.00, 0.16, 0.00),
        (0.10, 0.00, -0.08, 0.08, 0.06),
    )
    if idle:
        lz, ly, rz, ry, arm = 0.0, 0.0, 0.0, 0.0, (0.0, 0.03, 0.0, -0.03)[frame]
    else:
        lz, ly, rz, ry, arm = poses[frame]

    def leg(side, z, lift):
        x = 0.14 * side
        add(boxes, "boot", x, 0.07 + lift, z, 0.18, 0.14, 0.22)
        add(boxes, "plate", x, 0.26 + lift * 0.35, z * 0.65, 0.16, 0.26, 0.16)
        add(boxes, "plate", x, 0.48 + lift * 0.12, z * 0.25, 0.18, 0.20, 0.18)

    leg(1, lz, ly)
    leg(-1, rz, ry)
    add(boxes, "belt", 0, 0.62, 0.02, 0.42, 0.10, 0.26)
    add(boxes, "gold", 0, 0.62, 0.16, 0.08, 0.06, 0.04)
    add(boxes, "plate", 0, 0.90, 0.02, 0.46, 0.42, 0.28)
    add(boxes, "plate", 0.30, 1.06, 0.02, 0.22, 0.16, 0.24)
    add(boxes, "plate", -0.30, 1.06, 0.02, 0.22, 0.16, 0.24)
    add(boxes, "gold", 0.30, 1.00, 0.14, 0.08, 0.06, 0.05)
    add(boxes, "gold", -0.30, 1.00, 0.14, 0.08, 0.06, 0.05)
    add(boxes, "cape", 0, 0.72, -0.18, 0.40, 0.78, 0.08)
    add(boxes, "gold", 0.12, 1.06, -0.10, 0.05, 0.05, 0.05)
    add(boxes, "gold", -0.12, 1.06, -0.10, 0.05, 0.05, 0.05)
    # Crest is the unique top. The skull sits behind the open face.
    add(boxes, "helmet", 0, 1.28, -0.04, 0.30, 0.30, 0.24)
    add(boxes, "helmet", 0, 1.48, 0.00, 0.14, 0.08, 0.14)
    add(boxes, "helmet", 0, 1.56, 0.00, 0.05, 0.08, 0.08)
    add(boxes, "helmet", 0, 1.38, 0.10, 0.26, 0.08, 0.08)
    add(boxes, "skin", 0, 1.22, 0.08, 0.14, 0.12, 0.05)
    add(boxes, "beard", 0, 1.12, 0.10, 0.12, 0.08, 0.05)
    add(boxes, "helmet", -0.04, 1.24, 0.11, 0.035, 0.035, 0.03)
    add(boxes, "helmet", 0.04, 1.24, 0.11, 0.035, 0.035, 0.03)
    add(boxes, "plate", 0.40, 0.86 + arm * 0.15, 0.08, 0.12, 0.28, 0.12)
    add(boxes, "plate", 0.44, 0.66, 0.12, 0.12, 0.12, 0.12)
    add(boxes, "shield", 0.56, 0.78, 0.20, 0.24, 0.20, 0.06)
    add(boxes, "shield", 0.56, 0.62, 0.20, 0.28, 0.16, 0.06)
    add(boxes, "shield", 0.56, 0.48, 0.20, 0.16, 0.14, 0.06)
    add(boxes, "gold", 0.56, 0.68, 0.24, 0.05, 0.38, 0.03)
    add(boxes, "gold", 0.56, 0.74, 0.24, 0.18, 0.05, 0.03)
    add(boxes, "plate", -0.40, 0.88 - arm * 0.1, 0.10 + arm, 0.12, 0.26, 0.12)
    add(boxes, "plate", -0.46, 0.70, 0.18 + arm, 0.10, 0.10, 0.10)
    add(boxes, "gold", -0.52, 0.72, 0.22 + arm, 0.16, 0.045, 0.05)
    add(boxes, "sword", -0.56, 0.50, 0.24 + arm * 0.4, 0.07, 0.40, 0.05)
    add(boxes, "gold", -0.46, 0.78, 0.16 + arm, 0.05, 0.05, 0.05)
    return boxes


def faces(box):
    name, cx, cy, cz, sx, sy, sz = box
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    x0, x1 = cx - hx, cx + hx
    y0, y1 = cy - hy, cy + hy
    z0, z1 = cz - hz, cz + hz
    corners = [
        (x0, y0, z0),
        (x1, y0, z0),
        (x1, y1, z0),
        (x0, y1, z0),
        (x0, y0, z1),
        (x1, y0, z1),
        (x1, y1, z1),
        (x0, y1, z1),
    ]
    quads = [
        (0, 1, 2, 3, (0, 0, -1)),
        (5, 4, 7, 6, (0, 0, 1)),
        (4, 0, 3, 7, (-1, 0, 0)),
        (1, 5, 6, 2, (1, 0, 0)),
        (3, 2, 6, 7, (0, 1, 0)),
        (4, 5, 1, 0, (0, -1, 0)),
    ]
    tris = []
    for a, b, c, d, normal in quads:
        tris.append((corners[a], corners[b], corners[c], normal, name))
        tris.append((corners[a], corners[c], corners[d], normal, name))
    return tris


def norm(v):
    length = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return (v[0] / length, v[1] / length, v[2] / length)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def add3(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def scale3(v, s):
    return (v[0] * s, v[1] * s, v[2] * s)


def camera(column):
    yaw = -column * (math.pi / 4)
    flat = math.cos(ELEV)
    eye = (
        math.sin(yaw) * flat * 6,
        math.sin(ELEV) * 6 + 0.8,
        math.cos(yaw) * flat * 6,
    )
    target = (0, 0.8, 0)
    forward = norm((target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]))
    right = norm((forward[2], 0, -forward[0]))
    # right was built in the ground plane. Rebuild from the real up so the
    # elevated camera still has a level horizon.
    world_up = (0, 1, 0)
    right = norm((
        world_up[1] * forward[2] - world_up[2] * forward[1],
        world_up[2] * forward[0] - world_up[0] * forward[2],
        world_up[0] * forward[1] - world_up[1] * forward[0],
    ))
    up = norm((
        forward[1] * right[2] - forward[2] * right[1],
        forward[2] * right[0] - forward[0] * right[2],
        forward[0] * right[1] - forward[1] * right[0],
    ))
    return eye, right, up, forward


def project(point, eye, right, up, forward, scale, origin):
    rel = (point[0] - eye[0], point[1] - eye[1], point[2] - eye[2])
    # right comes out as -X on the south shot. Negating the screen x puts
    # the hero's left (the shield, +X) on the viewer's right.
    x = origin - dot(rel, right) * scale
    y = origin - dot(rel, up) * scale
    z = dot(rel, forward)
    return x, y, z


def shade(name, normal, light):
    facing = max(0.0, dot(normal, light))
    bands = BANDS[name]
    if facing > 0.62:
        return bands[0]
    if facing > 0.28:
        return bands[1]
    return bands[2]


def raster(boxes, column):
    eye, right, up, forward = camera(column)
    light = norm(add3(add3(scale3(right, -0.35), scale3(up, 0.8)), scale3(forward, 0.4)))
    scale = (FILL * 2) / 1.60
    origin = HI / 2
    color = bytearray(HI * HI * 4)
    normal_px = bytearray(HI * HI * 4)
    depth = [1e9] * (HI * HI)
    for box in boxes:
        for a, b, c, face_n, name in faces(box):
            pa = project(a, eye, right, up, forward, scale, origin)
            pb = project(b, eye, right, up, forward, scale, origin)
            pc = project(c, eye, right, up, forward, scale, origin)
            paint_tri(color, normal_px, depth, pa, pb, pc, face_n, name, light, right, up, forward)
    return downsample(color), downsample(normal_px)


def paint_tri(color, normal_px, depth, a, b, c, face_n, name, light, right, up, forward):
    minx = max(0, int(min(a[0], b[0], c[0])))
    maxx = min(HI - 1, int(max(a[0], b[0], c[0])))
    miny = max(0, int(min(a[1], b[1], c[1])))
    maxy = min(HI - 1, int(max(a[1], b[1], c[1])))
    area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    if abs(area) < 1e-6:
        return
    rgb = shade(name, face_n, light)
    nx = int((dot(face_n, right) * 0.5 + 0.5) * 255)
    ny = int((dot(face_n, up) * 0.5 + 0.5) * 255)
    nz = int((dot(face_n, forward) * 0.5 + 0.5) * 255)
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            px = x + 0.5
            py = y + 0.5
            w0 = (b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)
            w1 = (c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)
            w2 = (a[0] - px) * (b[1] - py) - (b[0] - px) * (a[1] - py)
            if area > 0:
                if w0 < 0 or w1 < 0 or w2 < 0:
                    continue
            elif w0 > 0 or w1 > 0 or w2 > 0:
                continue
            z = (w0 * a[2] + w1 * b[2] + w2 * c[2]) / area
            slot = y * HI + x
            if z >= depth[slot]:
                continue
            depth[slot] = z
            o = slot * 4
            color[o : o + 4] = bytes((rgb[0], rgb[1], rgb[2], 255))
            normal_px[o : o + 4] = bytes((nx, ny, nz, 255))


def downsample(src):
    out = bytearray(CELL * CELL * 4)
    for y in range(CELL):
        for x in range(CELL):
            o = (y * CELL + x) * 4
            s = ((y * 2) * HI + (x * 2)) * 4
            out[o : o + 4] = src[s : s + 4]
    return out


def outline(cell):
    src = bytes(cell)
    for y in range(CELL):
        for x in range(CELL):
            o = (y * CELL + x) * 4
            if src[o + 3]:
                continue
            hit = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if not dx and not dy:
                        continue
                    xx, yy = x + dx, y + dy
                    if xx < 0 or yy < 0 or xx >= CELL or yy >= CELL:
                        continue
                    if src[(yy * CELL + xx) * 4 + 3]:
                        hit = True
            if hit:
                cell[o : o + 4] = bytes((OUTLINE[0], OUTLINE[1], OUTLINE[2], 255))
    return cell


def outline_normal(albedo, normal):
    for i in range(0, len(albedo), 4):
        normal[i + 3] = albedo[i + 3]
        if albedo[i : i + 3] == bytes(OUTLINE) and normal[i + 3]:
            # The outline has no surface. Keep a flat normal so the alpha matches.
            if normal[i] == 0 and normal[i + 1] == 0 and normal[i + 2] == 0:
                normal[i : i + 3] = bytes((128, 128, 255))
    return normal


def opaque_rows(cell):
    rows = []
    for y in range(CELL):
        if any(cell[(y * CELL + x) * 4 + 3] for x in range(CELL)):
            rows.append(y)
    return rows


def fit_fill(cell, normal):
    rows = opaque_rows(cell)
    if not rows:
        raise SystemExit("empty cell")
    top, bot = rows[0], rows[-1]
    src_h = bot - top + 1
    xs = []
    for y in range(top, bot + 1):
        for x in range(CELL):
            if cell[(y * CELL + x) * 4 + 3]:
                xs.append(x)
    left, right = min(xs), max(xs)
    src_w = right - left + 1
    fitted = bytearray(CELL * CELL * 4)
    fitted_n = bytearray(CELL * CELL * 4)
    dest_h = FILL
    dest_w = max(1, round(src_w * FILL / src_h))
    ox = max(0, (CELL - dest_w) // 2)
    oy = max(0, (CELL - dest_h) // 2)
    for y in range(dest_h):
        sy = top + min(src_h - 1, y * src_h // dest_h)
        for x in range(dest_w):
            sx = left + min(src_w - 1, x * src_w // dest_w)
            if ox + x >= CELL or oy + y >= CELL:
                continue
            dst = ((oy + y) * CELL + ox + x) * 4
            src = (sy * CELL + sx) * 4
            fitted[dst : dst + 4] = cell[src : src + 4]
            fitted_n[dst : dst + 4] = normal[src : src + 4]
    return fitted, fitted_n


def align_feet(cell, normal, baseline):
    rows = opaque_rows(cell)
    if not rows:
        raise SystemExit("empty cell")
    shift = baseline - rows[-1]
    if shift == 0:
        return cell, normal
    moved = bytearray(CELL * CELL * 4)
    moved_n = bytearray(CELL * CELL * 4)
    for y in range(CELL):
        ny = y + shift
        if ny < 0 or ny >= CELL:
            continue
        moved[ny * CELL * 4 : (ny + 1) * CELL * 4] = cell[y * CELL * 4 : (y + 1) * CELL * 4]
        moved_n[ny * CELL * 4 : (ny + 1) * CELL * 4] = normal[y * CELL * 4 : (y + 1) * CELL * 4]
    return moved, moved_n


def render_sheet():
    albedo = bytearray(CELL * DIRS * CELL * ROWS * 4)
    normal = bytearray(CELL * DIRS * CELL * ROWS * 4)
    baseline = None
    for row in range(ROWS):
        idle = row >= WALK
        frame = row - WALK if idle else row
        boxes = figure(frame, idle)
        for column in range(DIRS):
            color, norms = raster(boxes, column)
            # Columns 3, 4, and 5 are NW, N, and NE. The open face can leave
            # one grazing texel after the nearest scale. Those views are the
            # back of the head, so that texel becomes helmet.
            if column in (3, 4, 5):
                skin = set(BANDS["skin"])
                helm = BANDS["helmet"][1]
                for i in range(0, len(color), 4):
                    if color[i + 3] and tuple(color[i : i + 3]) in skin:
                        color[i : i + 3] = bytes(helm)
            # The yaw changes how tall a box projects. Nearest-scale the fill
            # to round(32 / 0.84) before the outline so every cell shares a height.
            color, norms = fit_fill(color, norms)
            color = outline(color)
            norms = outline_normal(color, norms)
            if baseline is None:
                baseline = opaque_rows(color)[-1]
            color, norms = align_feet(color, norms, baseline)
            blit(albedo, color, column, row)
            blit(normal, norms, column, row)
    return albedo, normal


def blit(sheet, cell, column, row):
    width = CELL * DIRS
    for y in range(CELL):
        src = y * CELL * 4
        dst = ((row * CELL + y) * width + column * CELL) * 4
        sheet[dst : dst + CELL * 4] = cell[src : src + CELL * 4]


def png(rgba, width, height):
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def cell_of(sheet, column, row):
    width = CELL * DIRS
    out = bytearray(CELL * CELL * 4)
    for y in range(CELL):
        src = ((row * CELL + y) * width + column * CELL) * 4
        out[y * CELL * 4 : (y + 1) * CELL * 4] = sheet[src : src + CELL * 4]
    return out


def boot_pixels(cell):
    boots = set(BANDS["boot"])
    found = []
    for i in range(0, len(cell), 4):
        if cell[i + 3] and tuple(cell[i : i + 3]) in boots:
            found.append(i // 4)
    return found


def boot_lead(cell):
    """Mean x of the boot pixels in the lowest rows. The forward foot is closer
    to the camera, so it owns those rows. Left foot is the viewer's right."""
    found = boot_pixels(cell)
    if not found:
        raise SystemExit("no boots")
    bottom = max(p // CELL for p in found)
    lead = [p % CELL for p in found if p // CELL >= bottom - 3]
    if not lead:
        raise SystemExit("no lead boot")
    return sum(lead) / len(lead)


def lower_diff(a, b):
    changed = 0
    start = (CELL // 2) * CELL * 4
    for i in range(start, len(a), 4):
        if a[i : i + 4] != b[i : i + 4]:
            changed += 1
    return changed


def validate(albedo, normal):
    colors = palette()
    skin = set(BANDS["skin"])
    cape = set(BANDS["cape"])
    shield = set(BANDS["shield"])
    heights = set()
    feet = set()
    for row in range(ROWS):
        for column in range(DIRS):
            pix = cell_of(albedo, column, row)
            norms = cell_of(normal, column, row)
            ys = opaque_rows(pix)
            heights.add(ys[-1] - ys[0] + 1)
            feet.add(ys[-1])
            for i in range(0, len(pix), 4):
                if pix[i + 3] != norms[i + 3]:
                    raise SystemExit("normal alpha drifted")
                if pix[i + 3] and tuple(pix[i : i + 3]) not in colors:
                    raise SystemExit("pixel outside the palette")
            if column in (3, 4, 5):
                if any(tuple(pix[i : i + 3]) in skin for i in range(0, len(pix), 4) if pix[i + 3]):
                    raise SystemExit(f"face on a back view column {column}")
                if not any(tuple(pix[i : i + 3]) in cape for i in range(0, len(pix), 4) if pix[i + 3]):
                    raise SystemExit(f"cape missing on column {column}")
            if column == 0 and row == 0:
                xs = [
                    i // 4 % CELL
                    for i in range(0, len(pix), 4)
                    if pix[i + 3] and tuple(pix[i : i + 3]) in shield
                ]
                if not xs or sum(xs) / len(xs) <= CELL / 2:
                    raise SystemExit("shield is not on the viewer's right")
                if not any(tuple(pix[i : i + 3]) in skin for i in range(0, len(pix), 4) if pix[i + 3]):
                    raise SystemExit("front has no face")
    if heights != {FILL + 2}:
        raise SystemExit(f"height {heights}, want {FILL + 2}")
    if len(feet) != 1:
        raise SystemExit(f"feet {feet}")
    front = cell_of(albedo, 0, 0)
    passed = cell_of(albedo, 0, 2)
    if front == passed:
        raise SystemExit("walk frames match")
    if boot_lead(front) <= CELL / 2:
        raise SystemExit("contact 0 does not lead with the left foot")
    other = cell_of(albedo, 0, 4)
    if boot_lead(other) >= CELL / 2:
        raise SystemExit("contact 4 does not lead with the right foot")
    low = lower_diff(front, passed)
    if low < 8:
        raise SystemExit(f"walk legs moved {low} px")
    for column in range(1, DIRS):
        other = cell_of(albedo, column, 0)
        if other == front:
            raise SystemExit("direction matches the front")
        mirrored = bytearray(CELL * CELL * 4)
        for y in range(CELL):
            for x in range(CELL):
                mirrored[(y * CELL + (CELL - 1 - x)) * 4 : (y * CELL + (CELL - 1 - x)) * 4 + 4] = other[
                    (y * CELL + x) * 4 : (y * CELL + x) * 4 + 4
                ]
        if mirrored == front:
            raise SystemExit("direction is the front mirrored")


def write_outputs():
    albedo, normal = render_sheet()
    validate(albedo, normal)
    os.makedirs(os.path.dirname(SHEET), exist_ok=True)
    with open(SHEET, "wb") as handle:
        handle.write(png(albedo, CELL * DIRS, CELL * ROWS))
    with open(NORMAL, "wb") as handle:
        handle.write(png(normal, CELL * DIRS, CELL * ROWS))
    export_mesh()
    return albedo, normal


def export_mesh():
    try:
        import bpy
    except ImportError:
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    vertices = []
    face_list = []
    for box in figure(0, False):
        for tri_a, tri_b, tri_c, _normal, _name in faces(box):
            start = len(vertices)
            vertices.extend((tri_a, tri_b, tri_c))
            face_list.append((start, start + 1, start + 2))
    mesh = bpy.data.meshes.new("warrior")
    mesh.from_pydata(vertices, [], face_list)
    mesh.update()
    obj = bpy.data.objects.new("warrior", mesh)
    bpy.context.collection.objects.link(obj)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB")


def main():
    check = "--check" in sys.argv
    if check and os.path.exists(SHEET):
        before = open(SHEET, "rb").read()
        before_n = open(NORMAL, "rb").read()
        write_outputs()
        after = open(SHEET, "rb").read()
        after_n = open(NORMAL, "rb").read()
        if before != after or before_n != after_n:
            raise SystemExit("warrior sheet is not a byte-for-byte rebuild")
        return
    write_outputs()


if __name__ == "__main__":
    main()
