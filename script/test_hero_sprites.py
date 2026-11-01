#!/usr/bin/env python3
"""Local tests for script/hero_sprites.py: python3 script/test_hero_sprites.py

Runs on the committed warrior and mage inputs; the precheck test builds a
mage sheet in memory twice, so the whole file takes about two minutes."""

import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hero_sprites as hs  # noqa: E402

HEROES = ["engineer", "farmer", "mage", "scout", "warrior"]
APPROVED = {"mage": {"SW": 46, "NW": 67, "NE": 122, "SE": 156},
            "warrior": {"SW": 20, "NW": 74, "NE": 122, "SE": 166}}


def png_bytes(arr):
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


def read(path):
    with open(path, "rb") as fh:
        return fh.read()


class ConfigTest(unittest.TestCase):
    def test_every_hero_config_loads_and_names_its_items(self):
        for h in HEROES:
            cfg = hs.load_config(h)
            self.assertIn(cfg["possessive"], ("his", "her", "their"), h)
            self.assertTrue(cfg["items"], h)
            for item in cfg["items"]:
                self.assertTrue(item["name"] and item["at"], (h, item))
                for d in item.get("sides", {}):
                    self.assertIn(d, hs.COLUMNS, (h, item))
            self.assertLessEqual(set(cfg.get("diagonals") or {}), set(hs.DIAGONALS), h)
            c = cfg["concept"]
            self.assertTrue("file" in c or ("source" in c and len(c["box"]) == 4), h)

    def test_approved_heroes_pin_their_diagonals(self):
        for h, pins in APPROVED.items():
            self.assertEqual(hs.load_config(h)["diagonals"], pins)


class ConceptAndViewsTest(unittest.TestCase):
    def test_concept_crop_reproduces_the_mage_concept(self):
        cfg = hs.load_config("mage")
        c = cfg["concept"]
        crop = np.asarray(Image.open(os.path.join(hs.ROOT, c["source"])).convert("RGB").crop(tuple(c["box"])))
        self.assertEqual(png_bytes(crop), read(os.path.join(cfg["dir"], "concept.png")))

    def test_view_normalization_reproduces_the_mage_keyframes_byte_for_byte(self):
        cfg = hs.load_config("mage")
        for d in hs.CARDINALS:
            src = hs.view_source(cfg, d)
            self.assertIsNotNone(src, d)
            out = hs.normalize_view(np.asarray(Image.open(src).convert("RGB")))
            self.assertEqual(png_bytes(out), read(os.path.join(cfg["video"], "views", f"k-{d}.png")), d)

    def test_view_normalization_blanks_a_stray_speck_outside_the_figure(self):
        img = np.full((400, 400, 3), 255, np.uint8)
        img[100:300, 150:250] = (40, 60, 120)
        clean = hs.normalize_view(img)
        img[10:14, 10:14] = 0
        out = hs.normalize_view(img)
        self.assertTrue(np.array_equal(out, clean))
        ys, xs = np.nonzero(out.min(2) < hs.VIEW_MIN)
        self.assertEqual((ys.min(), ys.max() + 1), (hs.VIEW_FEET - hs.VIEW_HEIGHT, hs.VIEW_FEET))


class DirsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frames = {h: hs.sv.run_ffmpeg_frames(os.path.join(hs.load_config(h)["video"], "turntable.mp4"))
                      for h in APPROVED}

    def cards(self, h):
        dirs = os.path.join(hs.load_config(h)["video"], "dirs")
        return {d: np.asarray(Image.open(os.path.join(dirs, f"{d}.png")).convert("RGB")) for d in hs.CARDINALS}

    def test_picker_lands_near_the_hand_picked_diagonals(self):
        # mage SW 46 is the approved pick; SE 156 was picked by eye over a
        # clean front-right 3/4 at 162. Warrior picks came from an older eye pass.
        slack = {"mage": {"SW": 2, "NW": 12, "NE": 12, "SE": 8},
                 "warrior": {"SW": 10, "NW": 6, "NE": 6, "SE": 10}}
        for h in APPROVED:
            cfg = hs.load_config(h)
            picked = hs.pick_diagonals(self.frames[h], self.cards(h), hs.key_frames(cfg, len(self.frames[h])))
            for d, t in APPROVED[h].items():
                self.assertLessEqual(abs(picked[d]["frame"] - t), slack[h][d], (h, d, picked[d]))
                a, b = hs.DIAGONALS[d]
                lo = hs.key_frames(cfg, 193)[a]
                self.assertGreater(picked[d]["frame"], lo, (h, d))

    def test_pinned_frames_reproduce_the_committed_diagonals_byte_for_byte(self):
        for h, pins in APPROVED.items():
            dirs = os.path.join(hs.load_config(h)["video"], "dirs")
            for d, t in pins.items():
                self.assertEqual(png_bytes(self.frames[h][t]), read(os.path.join(dirs, f"{d}.png")), (h, d))


class PromptsTest(unittest.TestCase):
    def calls(self, h):
        return {c["id"]: c for c in hs.build_prompts(hs.load_config(h))["calls"]}

    def test_every_hero_gets_views_turntable_walk_and_idle_calls(self):
        for h in HEROES:
            ids = list(self.calls(h))
            self.assertEqual(ids[:5], ["view-S", "view-N", "view-W", "view-E", "turntable"], h)
            self.assertEqual(sorted(ids[5:]), sorted(f"{k}-{d}" for d in hs.COLUMNS for k in ("walk", "idle")), h)

    def test_view_prompts_name_the_hand_and_the_image_side(self):
        c = self.calls("scout")
        self.assertIn("longbow in their right hand (on the image-left side)", c["view-S"]["args"]["description"])
        self.assertIn("longbow in their right hand (partly hidden behind the body)", c["view-W"]["args"]["description"])
        self.assertIn("longbow in their right hand (on the image-right side)", c["view-N"]["args"]["description"])
        self.assertIn("spyglass at their left hip (on the image-right side)", c["view-S"]["args"]["description"])
        self.assertIn("One single view only", c["view-E"]["args"]["description"])
        self.assertEqual(c["view-S"]["args"]["reference_image_paths"], ["assets/reference/scout/concept.png"])

    def test_mage_staff_sides_follow_the_override(self):
        c = self.calls("mage")
        self.assertIn("(on the image-left side)", c["walk-NW"]["args"]["prompt"])
        self.assertIn("(on the image-right side)", c["walk-SE"]["args"]["prompt"])

    def test_walk_and_idle_prompts_carry_the_lessons(self):
        for h in HEROES:
            c = self.calls(h)
            for d in hs.COLUMNS:
                walk, idle = c[f"walk-{d}"]["args"], c[f"idle-{d}"]["args"]
                self.assertIn("torso does not twist", walk["prompt"])
                self.assertIn("No flashing, glowing or pulsing light", idle["prompt"])
                self.assertIn("head does not turn", idle["prompt"])
                for a in (walk, idle):
                    self.assertEqual(a["image_path"], a["last_frame_path"])
                    self.assertEqual(a["image_path"], f"assets/reference/{h}/video/dirs/{d}.png")
                    self.assertEqual(a["duration"], 2)
        self.assertIn("the cyan crystal keeps exactly the same brightness", self.calls("mage")["idle-E"]["args"]["prompt"])

    def test_turntable_call_uses_the_keyframes(self):
        a = self.calls("scout")["turntable"]["args"]
        self.assertEqual(a["image_path"], "assets/reference/scout/video/views/k-S.png")
        self.assertEqual(a["last_frame_path"], a["image_path"])
        self.assertEqual([(k["image_path"][-7:], k["timestamp_s"]) for k in a["keyframes"]],
                         [("k-W.png", 2), ("k-N.png", 4), ("k-E.png", 6)])
        self.assertEqual((a["duration"], a["resolution"]), (8, "720p"))

    def test_committed_prompt_files_are_current(self):
        for h in HEROES:
            cfg = hs.load_config(h)
            p = hs.build_prompts(cfg)
            self.assertEqual(read(os.path.join(cfg["dir"], "prompts.json")).decode(), json.dumps(p, indent=1) + "\n", h)
            self.assertEqual(read(os.path.join(cfg["dir"], "prompts.md")).decode(), hs.prompts_markdown(p), h)


class IdempotencyTest(unittest.TestCase):
    def test_prep_views_and_dirs_rewrite_nothing_on_the_committed_mage(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "mage"), os.path.join(tmp, "mage"))
            before = {f: read(os.path.join(dp, f)) for dp, _, fs in os.walk(tmp) for f in fs}
            cfg = hs.load_config("mage", reference=tmp)
            log = []
            hs.make_dirs(cfg, log=log.append)
            hs.write_prompts(cfg, log=log.append)
            self.assertTrue(log and all(line.startswith("same ") for line in log), log)
            after = {f: read(os.path.join(dp, f)) for dp, _, fs in os.walk(tmp) for f in fs}
            self.assertEqual(before, after)


class PrecheckTest(unittest.TestCase):
    def test_precheck_names_the_clips_to_regenerate(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "mage"), os.path.join(tmp, "mage"))
            vid = os.path.join(tmp, "mage", "video")
            cfg = hs.load_config("mage", reference=tmp)
            self.assertEqual(hs.precheck(cfg, log=lambda *a, **k: None), {})
            # An idle that walks, and a walk cut short so its loop cannot close.
            shutil.copyfile(os.path.join(vid, "walk-E.mp4"), os.path.join(vid, "idle-E.mp4"))
            src = os.path.join(tmp, "walk-S.mp4")
            shutil.move(os.path.join(vid, "walk-S.mp4"), src)
            subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-frames:v", "30", "-an", "-y",
                            os.path.join(vid, "walk-S.mp4")], check=True)
            problems = hs.precheck(cfg, log=lambda *a, **k: None)
            self.assertIn("idle-E.mp4", problems)
            self.assertTrue(any(w.startswith("idle moves too much") for w in problems["idle-E.mp4"]), problems)
            self.assertIn("walk-S.mp4", problems)
            self.assertTrue(any(w.startswith("format") for w in problems["walk-S.mp4"]), problems)
            self.assertTrue(any(w.startswith("loop does not close") for w in problems["walk-S.mp4"]), problems)
            self.assertLessEqual(set(problems), {"idle-E.mp4", "walk-S.mp4"}, problems)


if __name__ == "__main__":
    unittest.main()
