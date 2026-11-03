#!/usr/bin/env python3
"""Local tests for script/hero_sprites.py: python3 script/test_hero_sprites.py

Runs on the committed warrior and mage inputs; the precheck test builds a
mage sheet in memory twice, so the whole file takes about two minutes."""

import io
import json
import os
import re
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
ASSETS = ["goblin", "skeleton", "wolf", "bat"]  # non-hero figures with an asset.json (docs/ART-REDO.md)
APPROVED = {"mage": {"SW": 46, "NW": 67, "NE": 122, "SE": 156},
            "warrior": {"SW": 20, "NW": 74, "NE": 122, "SE": 166},
            "scout": {"SW": 32, "NW": 72, "NE": 120, "SE": 164},
            "farmer": {"SW": 42, "NW": 82, "NE": 117, "SE": 158},
            "engineer": {"SW": 30, "NW": 70, "NE": 118, "SE": 154}}


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


    def test_a_wide_view_is_refused_at_the_default_height_and_fits_a_lower_one(self):
        # A wolf side-on is about twice as long as it is tall: at 520 px it
        # would be cropped by the 720 canvas, so normalize_view refuses it,
        # and asset.json "view_height" fits it whole with the same foot line.
        img = np.full((500, 1000, 3), 255, np.uint8)
        img[150:450, 100:900] = (60, 58, 64)  # 800 x 300: aspect 2.67
        with self.assertRaises(ValueError):
            hs.normalize_view(img)
        img = np.full((500, 1000, 3), 255, np.uint8)
        img[150:450, 200:800] = (60, 58, 64)  # 600 x 300: aspect 2
        out = hs.normalize_view(img, 300)
        ys, xs = np.nonzero(out.min(2) < hs.VIEW_MIN)
        self.assertEqual((ys.min(), ys.max() + 1), (hs.VIEW_FEET - 300, hs.VIEW_FEET))
        self.assertEqual((xs.min(), xs.max() + 1), (60, 660))
        # 2 x 320 = 640 is the widest that keeps VIEW_SIDE on each side; 321 is too wide.
        _, xs = np.nonzero(hs.normalize_view(img, 320).min(2) < hs.VIEW_MIN)
        self.assertEqual(xs.max() + 1 - xs.min(), hs.VIEW_CANVAS - 2 * hs.VIEW_SIDE)
        with self.assertRaises(ValueError):
            hs.normalize_view(img, 321)

    def test_make_views_uses_the_asset_view_height_and_names_a_view_too_wide(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "wolf", "video", "views"))
            shutil.copyfile(os.path.join(hs.REFERENCE, "wolf", "asset.json"), os.path.join(tmp, "wolf", "asset.json"))
            cfg = hs.load_config("wolf", reference=tmp)
            img = np.full((500, 1000, 3), 255, np.uint8)
            img[200:450, 250:750] = (60, 58, 64)  # 500 x 250
            Image.fromarray(img).save(os.path.join(cfg["video"], "views", "v-W.png"))
            self.assertEqual(hs.make_views(cfg, log=lambda *a: None), ["W"])
            out = np.asarray(Image.open(os.path.join(cfg["video"], "views", "k-W.png")).convert("RGB"))
            ys, _ = np.nonzero(out.min(2) < hs.VIEW_MIN)
            self.assertEqual(ys.max() + 1 - ys.min(), cfg["view_height"])
            cfg["view_height"] = hs.VIEW_HEIGHT
            with self.assertRaises(SystemExit) as e:
                hs.make_views(cfg, log=lambda *a: None)
            self.assertIn("v-W.png", str(e.exception))


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
        # clean front-right 3/4 at 162. Warrior picks came from an older eye pass; scout, farmer and engineer picks are Dominic's.
        # The engineer SE pick is 16 frames before the picker's 170, where the planks vanish and the view is too frontal.
        slack = {"mage": {"SW": 2, "NW": 12, "NE": 12, "SE": 8},
                 "warrior": {"SW": 10, "NW": 6, "NE": 6, "SE": 10},
                 "scout": {"SW": 6, "NW": 8, "NE": 6, "SE": 6},
                 "farmer": {"SW": 8, "NW": 4, "NE": 4, "SE": 10},
                 "engineer": {"SW": 0, "NW": 0, "NE": 0, "SE": 16}}
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

    def test_farmer_pitchfork_sides_match_the_clips(self):
        c = self.calls("farmer")
        self.assertIn("pitchfork with iron tines in his right hand (in front of the body, on the image-left side)",
                      c["walk-W"]["args"]["prompt"])
        self.assertIn("pitchfork with iron tines in his right hand (on the image-right side)", c["walk-SE"]["args"]["prompt"])
        self.assertIn("pitchfork with iron tines in his right hand (on the image-right side)", c["walk-E"]["args"]["prompt"])

    def test_engineer_hammer_and_plank_sides_match_the_clips(self):
        c = self.calls("engineer")
        self.assertIn("iron hammer in his right hand (low in front of the legs, on the image-left side)",
                      c["walk-W"]["args"]["prompt"])
        self.assertIn("iron hammer in his right hand (partly hidden behind the body)", c["walk-NW"]["args"]["prompt"])
        self.assertIn("iron hammer in his right hand (toward the camera)", c["walk-E"]["args"]["prompt"])
        self.assertIn("bundle of wooden planks on his back (toward the camera, on the image-left side)",
                      c["walk-N"]["args"]["prompt"])
        self.assertIn("bundle of wooden planks on his back (on the image-left side, partly hidden behind the body)",
                      c["walk-SE"]["args"]["prompt"])

    def test_turntable_design_can_name_the_held_items(self):
        turn = self.calls("engineer")["turntable"]["args"]["prompt"]
        self.assertIn("brown boots, iron hammer held low in his right hand, bundle of wooden planks on his back.", turn)
        view = self.calls("engineer")["view-S"]["args"]["description"]
        self.assertNotIn("hammer held low", view)
        scout = hs.load_config("scout")["design"]
        self.assertIn(scout, self.calls("scout")["turntable"]["args"]["prompt"])

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
        for h in HEROES + ASSETS:
            cfg = hs.load_config(h)
            p = hs.build_prompts(cfg)
            self.assertEqual(read(os.path.join(cfg["dir"], "prompts.json")).decode(), json.dumps(p, indent=1) + "\n", h)
            self.assertEqual(read(os.path.join(cfg["dir"], "prompts.md")).decode(), hs.prompts_markdown(p), h)


class AssetTest(unittest.TestCase):
    """Non-hero figures: the goblin is the first (docs/ART-REDO.md)."""

    def calls(self, a):
        return {c["id"]: c for c in hs.build_prompts(hs.load_config(a))["calls"]}

    def test_goblin_config_is_a_monster_with_its_clip_kinds(self):
        cfg = hs.load_config("goblin")
        self.assertEqual(cfg["type"], "monster")
        self.assertEqual(cfg["clips"], {"walk": hs.COLUMNS, "attack": hs.COLUMNS, "death": hs.CARDINALS})
        for h in HEROES:
            self.assertEqual(hs.load_config(h)["type"], "hero", h)
            self.assertEqual(hs.load_config(h)["clips"], {"walk": hs.COLUMNS, "idle": hs.COLUMNS}, h)

    def test_goblin_sheet_keeps_the_hero_texel(self):
        # monsters.js draws the goblin 18 world units tall; at 32/88 units per
        # texel that is 50 px, so the goblin's pixels are the hero's size.
        with open(os.path.join(hs.ROOT, "assets/js/monsters.js")) as fh:
            world = float(re.search(r"goblin: (\d+)", fh.read()).group(1))
        sheet = hs.load_config("goblin")["sheet"]
        self.assertEqual(sheet["world_height"], world)
        self.assertEqual(sheet["height"], hs.sheet_height(world))
        self.assertEqual(hs.sheet_height(32), 88)

    def test_goblin_calls_are_views_turntable_then_walk_attack_death(self):
        ids = list(self.calls("goblin"))
        self.assertEqual(ids[:5], ["view-S", "view-N", "view-W", "view-E", "turntable"])
        want = [f"{k}-{d}" for d in hs.COLUMNS for k in ("walk", "attack", "death")
                if k != "death" or d in hs.CARDINALS]
        self.assertEqual(ids[5:], want)
        self.assertNotIn("idle-S", ids)

    def test_goblin_front_view_takes_the_hero_style_reference(self):
        c = self.calls("goblin")
        s = c["view-S"]["args"]
        self.assertEqual(s["reference_image_paths"], ["assets/reference/goblin/concept.png",
                                                      "assets/reference/engineer/video/views/v-S.png"])
        for ref in s["reference_image_paths"]:
            self.assertTrue(os.path.exists(os.path.join(hs.ROOT, ref)), ref)
        self.assertIn("draw only one goblin", s["description"])
        self.assertIn("Match the rendering style of the second reference image", s["description"])
        self.assertIn("to the feet,", s["description"])
        w = c["view-W"]["args"]
        self.assertEqual(w["reference_image_paths"], ["assets/reference/goblin/concept.png",
                                                      "assets/reference/goblin/video/views/v-S.png"])
        self.assertNotIn("rendering style", w["description"])

    def test_goblin_attack_and_death_prompts(self):
        c = self.calls("goblin")
        attack, death = c["attack-E"]["args"], c["death-N"]["args"]
        self.assertIn("jabs the spear straight ahead", attack["prompt"])
        self.assertIn("returns exactly to the starting pose", attack["prompt"])
        self.assertIn("torso does not twist", attack["prompt"])
        self.assertEqual(attack["image_path"], attack["last_frame_path"])
        self.assertEqual(death["image_path"], "assets/reference/goblin/video/dirs/N.png")
        self.assertNotIn("last_frame_path", death)
        self.assertIn("lies still on the ground", death["prompt"])
        self.assertIn("Quick hunched goblin walk", c["walk-S"]["args"]["prompt"])
        self.assertEqual(c["attack-SE"].get("then"), "hero_sprites.py precheck")
        self.assertEqual([k for k, v in c.items() if v.get("then") == "hero_sprites.py precheck"], ["attack-SE"])

    def test_view_notes_add_one_sentence_to_one_view(self):
        # The E view was regenerated with this sentence after the first take
        # lost the spear; prompts.json must say what was sent.
        cfg = hs.load_config("goblin")
        note = cfg["view_notes"]["E"]
        c = self.calls("goblin")
        e = c["view-E"]["args"]["description"]
        self.assertIn("(toward the camera). " + note + " Whole figure", e)
        for d in ("S", "N", "W"):
            self.assertNotIn(note, c[f"view-{d}"]["args"]["description"], d)
        self.assertEqual(sum(note in json.dumps(v) for v in c.values()), 1)
        for h in HEROES:
            self.assertNotIn("view_notes", hs.load_config(h), h)

    def test_skeleton_sheet_keeps_the_hero_texel_in_a_wider_cell(self):
        # monsters.js draws the skeleton 22 world units tall: 60 px at the hero
        # texel (docs/ART-REDO.md). The 88 px cell leaves room for the slash.
        with open(os.path.join(hs.ROOT, "assets/js/monsters.js")) as fh:
            world = float(re.search(r"skeleton: (\d+)", fh.read()).group(1))
        cfg = hs.load_config("skeleton")
        self.assertEqual(cfg["type"], "monster")
        self.assertEqual(cfg["sheet"], {"world_height": world, "height": 60, "cell": 88})
        self.assertEqual(cfg["clips"], {"walk": hs.COLUMNS, "attack": hs.COLUMNS, "death": hs.CARDINALS})

    def test_skeleton_concept_is_the_registry_crop(self):
        cfg = hs.load_config("skeleton")
        with open(os.path.join(hs.ROOT, "assets/models/registry.js")) as fh:
            x, y, w, h = map(int, re.search(r'monster\("skeleton", \d+, \d+, crop\((\d+), (\d+), (\d+), (\d+)\)\)',
                                            fh.read()).groups())
        self.assertEqual(cfg["concept"]["box"], [x, y, x + w, y + h])
        crop = np.asarray(Image.open(os.path.join(hs.ROOT, cfg["concept"]["source"])).convert("RGB").crop((x, y, x + w, y + h)))
        self.assertEqual(png_bytes(crop), read(os.path.join(cfg["dir"], "concept.png")))

    def test_a_visible_weapon_is_asked_for_in_every_view_and_never_hidden(self):
        # The goblin's first view-E lost its spear: an item with "visible": true
        # gets its own sentence in all four views, and no prompt places it
        # "partly hidden behind the body" (the W view would, by its hand).
        cfg = hs.load_config("skeleton")
        sword = cfg["items"][0]
        self.assertIs(sword["visible"], True)
        line = hs.visible_line(sword, "his")
        c = self.calls("skeleton")
        for d in ("S", "N", "W", "E"):
            self.assertIn(line, c[f"view-{d}"]["args"]["description"], d)
            self.assertIn("in full view)", c[f"view-{d}"]["args"]["description"], d)
        for k, v in c.items():
            self.assertNotIn("partly hidden", json.dumps(v), k)
        self.assertIn("(in full view)", c["view-W"]["args"]["description"])
        self.assertIn("slashes it across", c["attack-SW"]["args"]["prompt"])
        self.assertIn("heap of bones", c["death-E"]["args"]["prompt"])
        self.assertIn("no shield", c["view-S"]["args"]["description"])
        # Without the flag the W view still says where the hand hides it.
        plain = dict(sword)
        del plain["visible"]
        self.assertIn("partly hidden behind the body", hs.item_line(plain, "W", "his"))

    def test_skeleton_clip_overrides_reproduce_the_second_takes_exactly(self):
        # Nine skeleton clips failed the first precheck and were regenerated
        # with these phrase changes. prompts.json must be what was sent: each
        # overridden clip is the plain prompt with exactly these swaps, and
        # every other call is untouched.
        cfg = hs.load_config("skeleton")
        plain = dict(cfg)
        del plain["clip_overrides"]
        base = {c["id"]: c for c in hs.build_prompts(plain)["calls"]}
        got = self.calls("skeleton")
        gait = ("Stiff jerky skeleton march: knees bent,",
                "Stiff upright skeleton march at full standing height: knees only slightly bent, never crouching "
                "or lowering the body,")
        bob = ("slight body bob", "very slight body bob")
        nw = ("blade below his shoulders.", "blade below his shoulders, the blade clearly visible beside his body in "
              "every frame, never hanging straight down or hidden behind him.")
        # walk-E, take 3: the gait carries the sword arm, the item walk text is dropped.
        e = ("Stiff jerky skeleton march: knees bent, legs alternating clearly, bony arms swinging a little, slight "
             "body bob, sword held low and angled forward in his right hand, blade below his shoulders.",
             "Stiff jerky skeleton march: knees bent, legs alternating clearly, slight body bob; his right arm stays "
             "still, bent at the elbow and held forward, the sword pointing forward and down ahead of his front foot "
             "like a fixed rod the whole time, blade below his shoulders; only his left arm swings, the sword arm "
             "never swings back.")
        slash = "raises the sword to his shoulder and slashes it across in front of him toward the facing direction"
        wide = (slash, "raises the sword to his shoulder and swings it in a big, wide, full-arm sweep far out in front "
                "of him toward the facing direction, the arm fully extended and the blade reaching well beyond his body")
        south = (slash, "raises the sword only to his shoulder, never above or in front of his head, so his skull stays "
                 "fully visible and uncovered the whole time, and slashes it across in front of his chest toward the "
                 "facing direction")
        fall = "drops the sword and collapses straight down into a loose heap of bones on the ground."
        heap = ("lets the sword drop beside its feet, and collapses straight down in place into a loose heap of bones "
                "on the exact spot where it stood. It does not leap, lunge, step or fall forward toward the camera; "
                "the bones pile up where its feet were.")
        # attack-E and attack-W, take 3: an overhead chop.
        chop = (slash, "raises the sword high above his head with the arm fully up, then chops it down in a big "
                "overhead arc far out in front of him toward the facing direction, leaning his torso forward into the "
                "blow, until the blade points straight out ahead at waist height, the arm fully extended")
        # death-W, take 3: a compact pile, the sword under his feet.
        pile = ("rattles, " + fall, "rattles, lets the sword fall straight down so it lies flat right under his feet, "
                "crosswise to his facing, and crumples down onto his knees and then into a compact pile of bones no "
                "wider than his standing stride, on the exact spot where he stood. He does not tip, lean or fall "
                "forward; the bones pile up where his feet were.")
        swaps = {"walk-SW": [gait, bob], "walk-NW": [gait, bob, nw], "walk-E": [e],
                 "attack-E": [chop], "attack-W": [chop], "attack-NW": [wide], "attack-S": [south],
                 "death-S": [(fall, heap)], "death-W": [pile]}
        self.assertEqual(set(got), set(base))
        for cid, call in base.items():
            want = json.loads(json.dumps(call))
            for old, new in swaps.get(cid, []):
                self.assertEqual(want["args"]["prompt"].count(old), 1, (cid, old))
                want["args"]["prompt"] = want["args"]["prompt"].replace(old, new)
            self.assertEqual(got[cid], want, cid)
        self.assertEqual(sorted(k for k in cfg["clip_overrides"] if not k.startswith("_")), sorted(swaps))
        for h in HEROES + ["goblin"]:
            self.assertNotIn("clip_overrides", hs.load_config(h), h)

    def test_a_bad_clip_override_is_refused(self):
        base = json.loads(read(os.path.join(hs.REFERENCE, "skeleton", "asset.json")))
        bad = [{"death-SW": {"death": "falls"}}, {"walk-S": {"attack": "jabs"}}, {"walk-S": {"walk": "low"}}, {"walk-S": {"walk": [" "]}},
               {"attack-S": {"attack": " "}}, {"walk-S": {}}, {"idle-S": {"gait": "x"}}, ["walk-S"]]
        for over in bad:
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "g"))
                with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                    json.dump(dict(base, clip_overrides=over), fh)
                with self.assertRaises(SystemExit, msg=over):
                    hs.load_config("g", reference=tmp)

    def test_visible_leaves_every_other_prompt_file_alone(self):
        for h in HEROES + ["goblin"]:
            cfg = hs.load_config(h)
            self.assertFalse(any("visible" in i for i in cfg["items"]), h)
            self.assertNotIn("stays clearly visible in full", read(os.path.join(cfg["dir"], "prompts.json")).decode(), h)

    def test_a_bad_asset_config_is_refused(self):
        base = json.loads(read(os.path.join(hs.REFERENCE, "goblin", "asset.json")))
        bad = [("type", "dragon"), ("clips", {"walk": ["S", "UP"]}), ("clips", {"attack": ["S"], "walk": ["S"]}),
               ("sheet", {"world_height": 18, "height": 60, "cell": 80}),
               ("sheet", {"world_height": 18, "height": 50, "cell": 60}),
               ("view_notes", {"SE": "a diagonal view is not generated"}), ("view_notes", {"E": " "}),
               ("view_notes", ["E"]),
               ("items", [{"name": "sword", "at": "right hand", "visible": "yes"}]),
               ("items", [{"name": "cloak", "at": "body", "visible": True}])]
        for key, value in bad:
            cfg = dict(base, **{key: value})
            if key == "clips" and "attack" in value:
                cfg.pop("attack")
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "g"))
                with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                    json.dump(cfg, fh)
                with self.assertRaises(SystemExit, msg=(key, value)):
                    hs.load_config("g", reference=tmp)
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "g"))
            with open(os.path.join(tmp, "g", "hero.json"), "w") as fh:
                json.dump(base, fh)
            with self.assertRaises(SystemExit):
                hs.load_config("g", reference=tmp)

    def test_wolf_is_a_quadruped_in_a_hero_sized_cell(self):
        # monsters.js draws the wolf 18 world units tall: 50 px at the hero
        # texel, ear tips to paws. It is about twice as long, and the lunge
        # reaches further, so the cell is 128 (docs/ART-REDO.md).
        with open(os.path.join(hs.ROOT, "assets/js/monsters.js")) as fh:
            world = float(re.search(r"wolf: (\d+)", fh.read()).group(1))
        cfg = hs.load_config("wolf")
        self.assertEqual(cfg["type"], "monster")
        self.assertEqual(cfg["sheet"], {"world_height": world, "height": 50, "cell": 128})
        self.assertEqual(cfg["clips"], {"walk": hs.COLUMNS, "attack": hs.COLUMNS, "death": hs.CARDINALS})
        self.assertEqual(cfg["items"], [])
        self.assertEqual(cfg["view_height"], 300)
        # A 2:1 side view fits the canvas at 300 px, with VIEW_SIDE to spare.
        self.assertLessEqual(2 * cfg["view_height"], hs.VIEW_CANVAS - 2 * hs.VIEW_SIDE)
        with open(os.path.join(hs.ROOT, "assets/models/registry.js")) as fh:
            x, y, w, h = map(int, re.search(r'monster\("wolf", \d+, \d+, crop\((\d+), (\d+), (\d+), (\d+)\)\)',
                                            fh.read()).groups())
        self.assertEqual(cfg["concept"]["box"], [x, y, x + w, y + h])
        crop = np.asarray(Image.open(os.path.join(hs.ROOT, cfg["concept"]["source"])).convert("RGB").crop((x, y, x + w, y + h)))
        self.assertEqual(png_bytes(crop), read(os.path.join(cfg["dir"], "concept.png")))

    def test_wolf_prompts_describe_an_animal_on_the_spot(self):
        c = self.calls("wolf")
        self.assertEqual(len(c), 25)
        for d in ("S", "N", "W", "E"):
            v = c[f"view-{d}"]["args"]["description"]
            self.assertIn("draw only one wolf", v)
            self.assertIn("on all four paws", v)
            # Take 3: "from its nose to the tip of its tail" pushed view-S to a
            # three-quarter view; the spine sentence pins it straight on.
            self.assertNotIn("nose to the tip of its tail", v)
            self.assertIn("the spine points exactly along the view direction", v)
            self.assertNotIn("arms relaxed", v)
            self.assertNotIn("top of the head", v)
        for k, v in c.items():
            text = json.dumps(v["args"])
            self.assertNotIn("  ", text, k)  # no empty items sentence
            self.assertNotIn("Props stay", text, k)
        self.assertIn("trot on the spot", c["walk-NW"]["args"]["prompt"])
        self.assertIn("hind paws stay planted on the same spot", c["attack-E"]["args"]["prompt"])
        # Take 2 (clip_overrides): the take-1 deaths reared, leapt or ended
        # with the head or tail up; walk-SW trotted too fast to loop.
        for d in hs.CARDINALS:
            p = c[f"death-{d}"]["args"]["prompt"]
            self.assertIn("sinks straight down onto its belly", p, d)
            self.assertIn("head resting on the ground", p, d)
            self.assertIn("rears up, rises on its hind legs, ", p, d)
            self.assertIn("leaps or jumps", p, d)
            self.assertNotIn("collapses down onto its side", p, d)
        # Take 3: death-E still sprang off its paws, death-S rose onto its
        # hind legs and death-N started off the pose; death-W passed take 2.
        for d in ("S", "E", "N"):
            p = c[f"death-{d}"]["args"]["prompt"]
            self.assertIn("holds the exact first-frame pose perfectly still for a moment", p, d)
            self.assertIn("never springs", p, d)
        for d in ("S", "N"):
            self.assertIn("All four paws stay on the ground the whole time", c[f"death-{d}"]["args"]["prompt"], d)
        self.assertNotIn("first-frame pose perfectly still", c["death-W"]["args"]["prompt"])
        self.assertIn("does not move away from the camera, up the frame", c["death-N"]["args"]["prompt"])
        # Take 4: death-N hopped up mid-fall (feet 11 px over the line) and
        # death-E ended with its head lifted (31 px tall, limit 30).
        self.assertIn("its hind legs fold first, then its front legs", c["death-N"]["args"]["prompt"])
        self.assertIn("its back only ever gets lower, frame by frame, never higher", c["death-N"]["args"]["prompt"])
        # Take 5: death-E kept its head down but ended resting on its belly,
        # legs tucked (32 px tall): paws that all stay on the ground cannot
        # end on its side, so death-E rolls onto its side without that line.
        e = c["death-E"]["args"]["prompt"]
        self.assertIn("rolls over onto its side on the exact spot where it stood, its legs toward the camera", e)
        self.assertIn("It ends lying on its side, not resting on its belly", e)
        self.assertIn("its head is never lifted again", e)
        self.assertIn("Its body only ever moves down, never up", e)
        self.assertNotIn("All four paws stay on the ground", e)
        for d in ("S", "W", "N"):
            self.assertNotIn("not resting on its belly", c[f"death-{d}"]["args"]["prompt"], d)
        for d in ("S", "W"):
            self.assertNotIn("hind legs fold first", c[f"death-{d}"]["args"]["prompt"], d)
        self.assertIn("one full stride a second", c["walk-SW"]["args"]["prompt"])
        for d in hs.COLUMNS:
            if d != "SW":
                self.assertNotIn("one full stride a second", c[f"walk-{d}"]["args"]["prompt"], d)
        self.assertEqual(c["view-S"]["args"]["reference_image_paths"],
                         ["assets/reference/wolf/concept.png", "assets/reference/engineer/video/views/v-S.png"])

    def test_troll_is_the_ogre_with_a_visible_club_in_a_slam_sized_cell(self):
        # monsters.js draws the troll 34 world units tall: 94 px at the hero
        # texel (32/88), head to feet. The slam lifts the club about 50 px
        # over his head, so the cell is 160, not 94 + 16.
        with open(os.path.join(hs.ROOT, "assets/js/monsters.js")) as fh:
            world = float(re.search(r"troll: (\d+)", fh.read()).group(1))
        cfg = hs.load_config("troll")
        self.assertEqual(cfg["type"], "monster")
        self.assertEqual(cfg["noun"], "ogre")
        self.assertEqual(round(world * 88 / 32), 94)
        self.assertEqual(cfg["sheet"], {"world_height": world, "height": 94, "cell": 160})
        self.assertGreaterEqual(cfg["sheet"]["cell"] - 8 - cfg["sheet"]["height"], 50)
        self.assertEqual(cfg["clips"], {"walk": hs.COLUMNS, "attack": hs.COLUMNS, "death": hs.CARDINALS})
        self.assertNotIn("flies", cfg)
        (club,) = cfg["items"]
        self.assertEqual((club["at"], club["still"], club.get("visible")), ("left hand", "club", True))
        # The concept box is the registry crop, widened so the club head is in it.
        with open(os.path.join(hs.ROOT, "assets/models/registry.js")) as fh:
            x, y, w, h = map(int, re.search(r'monster\("troll", \d+, \d+, crop\((\d+), (\d+), (\d+), (\d+)\)',
                                            fh.read()).groups())
        bx0, by0, bx1, by1 = cfg["concept"]["box"]
        self.assertTrue(bx0 >= x and by0 >= y and bx1 >= x + w and by1 >= y + h)
        crop = np.asarray(Image.open(os.path.join(hs.ROOT, cfg["concept"]["source"])).convert("RGB").crop((bx0, by0, bx1, by1)))
        self.assertEqual(png_bytes(crop), read(os.path.join(cfg["dir"], "concept.png")))

    def test_troll_prompts_slam_on_the_spot_and_keep_the_club_in_view(self):
        calls = hs.build_prompts(hs.load_config("troll"))["calls"]
        self.assertEqual(len(calls), 25)
        self.assertEqual([c["id"] for c in calls[:5]], ["view-S", "view-N", "view-W", "view-E", "turntable"])
        self.assertEqual(calls[3].get("then"), "hero_sprites.py views")
        self.assertEqual(calls[0]["args"]["reference_image_paths"],
                         ["assets/reference/troll/concept.png", "assets/reference/engineer/video/views/v-S.png"])
        for c in calls[:4]:
            d = c["args"]["description"]
            self.assertIn("draw only the ogre with his spiked club and nothing else", d)
            self.assertIn("in his left hand", d)
            self.assertIn("not hidden behind the body", d)
            self.assertNotIn("partly hidden behind the body", d)
        self.assertIn("(on the image-right side, in full view)", calls[0]["args"]["description"])
        by = {c["id"]: c["args"].get("prompt", "") for c in calls}
        for d in hs.COLUMNS:
            self.assertIn("slams it straight down onto the ground just in front of him", by[f"attack-{d}"])
            self.assertIn("he does not step or jump", by[f"attack-{d}"])
        for d in hs.CARDINALS:
            self.assertIn("holds the exact first-frame pose still for a moment", by[f"death-{d}"])
            self.assertIn("His body only ever moves down, never up.", by[f"death-{d}"])

    def test_troll_view_e_puts_the_far_hand_club_and_the_face_on_the_right(self):
        # view-E faced screen-left twice: "right side toward the camera"
        # fought "club in his left hand, in full view", the left hand being
        # the far one in a right profile. view-E now says where the far hand
        # holds the club and which way the face points; S, N and W, already
        # generated, keep their text.
        cfg = hs.load_config("troll")
        calls = {c["id"]: c["args"].get("description") for c in hs.build_prompts(cfg)["calls"]}
        e = calls["view-E"]
        self.assertIn("in his left hand (his far hand, held forward past his belly so the spiked head of the club "
                      "shows in front of him on the image-right side, in full view)", e)
        self.assertIn("his face, tusks and nose point to the right edge of the image", e)
        self.assertIn("each foot joined to its leg", e)
        self.assertNotIn("image-left", e)
        self.assertLess(e.index("right profile view, facing screen-right"), e.index("his far hand"))
        for d in ("S", "N", "W"):
            self.assertNotIn("far hand", calls[f"view-{d}"], d)
            self.assertNotIn("right edge of the image", calls[f"view-{d}"], d)
        self.assertIn("in his left hand (on the image-right side, in full view)", calls["view-S"])
        self.assertIn("in his left hand (on the image-left side, in full view)", calls["view-N"])
        self.assertIn("in his left hand (toward the camera, in full view)", calls["view-W"])

    def test_bat_take_2_hangs_at_one_height(self):
        # Take 1 bobbed up to 30 px in the walks (the gait allowed "a slight
        # bob") and swooped up to 36 px into the bites; the retakes hold the
        # body still and leave the passing clips' text alone.
        calls = {c["id"]: c["args"].get("prompt") for c in hs.build_prompts(hs.load_config("bat"))["calls"]}
        bob = "The body hangs at exactly the same height in every frame: it does not bob, rise or sink, only the wings move."
        rise = "Its body stays at exactly the same height the whole time: it does not rise, swoop up or dip"
        for d in ("S", "SW", "NW", "SE"):
            self.assertIn(bob, calls[f"walk-{d}"])
            self.assertNotIn("slight bob", calls[f"walk-{d}"])
        for d in ("W", "N", "NE", "E"):
            self.assertIn("slight bob", calls[f"walk-{d}"])
            self.assertNotIn(bob, calls[f"walk-{d}"])
        self.assertIn(rise, calls["attack-SW"])
        # Take 3: the bites still rose (N 32 px, SE 25, NE 20, S 16) or dropped
        # (E 14), and attack-NW with its wings held in barely changed.
        steady = "Its wings keep flapping in the same steady wingbeat as its hover all through the bite"
        self.assertIn(steady, calls["attack-E"])
        self.assertNotIn("wings stay close in", calls["attack-E"])
        # Take 4: S, NW, N, NE and SE left the hover on a third take: the
        # lunge carries the body (up the frame in the back views) and attack-N
        # turned to face the camera. They bite on the spot, never lunge or turn.
        spot = "stays hovering on the exact spot and bites without moving its body: its wings keep the same steady wingbeat as its hover"
        nolunge = ("There is no lunge: its body, chest and feet stay on the same spot in the frame at exactly the same height "
                   "from the first frame to the last")
        for d in ("S", "NW", "N", "NE", "SE"):
            p = calls[f"attack-{d}"]
            self.assertIn(spot, p, d)
            self.assertIn(nolunge, p, d)
            self.assertIn("keeps facing the same way and never turns", p, d)
            self.assertNotIn("lunges", p, d)
            self.assertNotIn("biting lunge", p, d)
        self.assertIn("Its back stays toward the camera the whole time, so its face is never seen", calls["attack-N"])
        for d in ("S", "NW", "NE", "SE", "E", "W", "SW"):
            self.assertNotIn("face is never seen", calls[f"attack-{d}"], d)
        for d in ("W", "SW", "E"):
            self.assertNotIn(spot, calls[f"attack-{d}"], d)
        for d in ("W", "SW"):
            self.assertNotIn(steady, calls[f"attack-{d}"])
        self.assertNotIn(rise, calls["attack-W"])
        for d in hs.CARDINALS:
            self.assertNotIn(rise, calls[f"death-{d}"])

    def test_bat_check_profile_tells_front_from_back(self):
        # The back never shows the red face; the front keeps its lit chest
        # and membrane. The start poses hold the bounds.
        import check_sprite_sheet as cs
        import sprite_from_video as sv
        cfg = hs.load_config("bat")
        a = cs.ASSETS["bat"]
        prof, spec = a["profile"], a["spec"]
        self.assertTrue(spec.flies)
        self.assertIsNone(prof["prop"])
        self.assertEqual(cs.role((112, 40, 36), prof["roles"]), "red")
        self.assertEqual(cs.role((172, 49, 41), prof["roles"]), "red")
        self.assertEqual(cs.role((100, 85, 78), prof["roles"]), "light")
        self.assertEqual(cs.role((48, 40, 35), prof["roles"]), "fur")
        self.assertEqual(cs.role((49, 29, 25), prof["roles"]), "fur")
        pal = sv.build_palette(sv.monster_palette_samples(os.path.join(cfg["video"], "dirs"), spec), k=spec.colours)
        lab = sv.srgb_to_lab(np.array(pal, np.float64))
        for name, rgb in prof["anchors"].items():
            d = np.sqrt(((lab - sv.srgb_to_lab(np.array([rgb], np.float64))) ** 2).sum(1)).min()
            self.assertLessEqual(d, 15, name)
        cell = {}
        for d in ("S", "N"):
            rgb, al = sv.pose_place(np.asarray(Image.open(os.path.join(cfg["video"], "dirs", f"{d}.png")).convert("RGB")), spec)
            cell[d] = sv.outline(sv.quantize(rgb, al, lab, pal))
        self.assertEqual(prof["back"][1], (("red", ("count", "red"), None, 2),))
        self.assertEqual(prof["front"][1], (("light", ("count", "light"), 45, None),))
        for d, (_, bounds) in (("S", prof["front"]), ("N", prof["back"])):
            for name, m, lo, hi in bounds:
                v = cs.measure(cell[d], prof["roles"], m)
                self.assertTrue((lo is None or v >= lo) and (hi is None or v <= hi), (d, name, v))
        self.assertEqual(cs.measure(cell["S"], prof["roles"], ("count", "red")), 11)
        self.assertEqual(cs.measure(cell["N"], prof["roles"], ("count", "red")), 0)

    def test_wolf_check_profile_holds_no_prop_and_tells_front_from_back(self):
        # The jaws are the weapon: prop null and no prop settings. Every
        # wolf colour is a grey, so every role is neutral; the pale ash of
        # the muzzle, throat and legs is what the S view has and N lacks.
        import check_sprite_sheet as cs
        cfg = hs.load_config("wolf")
        prof = cs.ASSETS["wolf"]["profile"]
        self.assertIsNone(prof["prop"])
        self.assertFalse({"prop_dirs", "prop_side_below"} & set(cfg["check"]))
        self.assertTrue(all(r.get("neutral") for r in cfg["check"]["roles"] if r["name"] != "mouth"))
        self.assertEqual(cs.role((102, 97, 97), prof["roles"]), "ash")
        self.assertEqual(cs.role((40, 39, 45), prof["roles"]), "fur")
        self.assertEqual(cs.role((41, 22, 18), prof["roles"]), "mouth")
        self.assertEqual(cs.role((82, 35, 26), prof["roles"]), "mouth")
        front = {n: (m, lo, hi) for n, m, lo, hi in prof["front"][1]}
        back = {n: (m, lo, hi) for n, m, lo, hi in prof["back"][1]}
        self.assertEqual(front["ash"], (("count", "ash"), 102, None))
        # The back may show at most half the front's ash floor, so a wolf
        # turned to face the camera in the N column fails.
        self.assertEqual(back["ash"], (("count", "ash"), None, front["ash"][1] // 2))
        self.assertEqual(back["muzzle"], (("head", "ash"), None, 2))

    def test_bat_is_a_flier_in_a_wing_sized_cell(self):
        # monsters.js draws the bat 16 world units tall: 44 px at the hero
        # texel. The wingspan is about twice that and a wingbeat sweeps
        # above and below the start pose. 112 was the first guess; dead on its
        # back with the wings spread flat, take 1 touched the cell edge, so 128.
        with open(os.path.join(hs.ROOT, "assets/js/monsters.js")) as fh:
            world = float(re.search(r"bat: (\d+)", fh.read()).group(1))
        cfg = hs.load_config("bat")
        self.assertEqual(cfg["type"], "monster")
        self.assertIs(cfg["flies"], True)
        self.assertEqual(cfg["sheet"], {"world_height": world, "height": 44, "cell": 128})
        self.assertEqual(cfg["clips"], {"walk": hs.COLUMNS, "attack": hs.COLUMNS, "death": hs.CARDINALS})
        self.assertEqual(cfg["items"], [])
        # A spread-wing front view up to 2.6 times as wide as tall still fits.
        self.assertLessEqual(2.6 * cfg["view_height"], hs.VIEW_CANVAS - 2 * hs.VIEW_SIDE)
        # The concept box reaches below the registry card crop, which cuts the
        # bat off below its eyes, and spans the same wings.
        with open(os.path.join(hs.ROOT, "assets/models/registry.js")) as fh:
            x, y, w, h = map(int, re.search(r'monster\("bat", \d+, \d+, crop\((\d+), (\d+), (\d+), (\d+)\)',
                                            fh.read()).groups())
        x0, y0, x1, y1 = cfg["concept"]["box"]
        self.assertTrue(y0 <= y and y + h + 30 <= y1, (cfg["concept"]["box"], (x, y, w, h)))
        self.assertLessEqual(abs(x0 - x) + abs(x1 - (x + w)), 30)
        crop = np.asarray(Image.open(os.path.join(hs.ROOT, cfg["concept"]["source"])).convert("RGB").crop((x0, y0, x1, y1)))
        self.assertEqual(png_bytes(crop), read(os.path.join(cfg["dir"], "concept.png")))

    def test_bat_prompts_hover_instead_of_walking(self):
        c = self.calls("bat")
        self.assertEqual(len(c), 24)  # no view-W: mirror_views flips v-E
        for k, v in c.items():
            text = json.dumps(v["args"])
            for grounded in hs.GROUNDED.values():
                self.assertNotIn(grounded, text, k)
            self.assertNotIn("  ", text, k)
            self.assertNotIn("Props stay", text, k)
        for d in hs.COLUMNS:
            w = c[f"walk-{d}"]["args"]["prompt"]
            self.assertIn("The bat hovers in place in the air, flapping its wings, keeping", w)
            self.assertIn("Two full wingbeats, loops seamlessly", w)
            self.assertIn("The bat stays exactly centered, it hangs in the air at the same height, no turning",
                          c[f"attack-{d}"]["args"]["prompt"])
        for d in hs.CARDINALS:
            self.assertIn("drops straight down onto the ground just below where it hovered", c[f"death-{d}"]["args"]["prompt"])
            self.assertNotIn("last_frame_path", c[f"death-{d}"]["args"])
        for d in ("S", "N", "E"):
            v = c[f"view-{d}"]["args"]["description"]
            self.assertIn("draw only the big bat", v)
            self.assertIn("the body faces exactly along the view direction", v)
        t = c["turntable"]["args"]["prompt"]
        self.assertIn("The bat hangs perfectly still in the air on an invisible turntable with its wings spread wide and "
                      "frozen and rotates", t)
        self.assertIn("no ghosting, no flapping, no text", t)

    def test_mirror_views_drops_the_mirrored_call_and_moves_then(self):
        c = self.calls("bat")
        self.assertEqual([k for k in c if k.startswith("view-")], ["view-S", "view-N", "view-E"])
        self.assertEqual(c["view-E"]["then"], "hero_sprites.py views")
        self.assertIsNone(c["view-N"].get("then"))
        cfg = hs.load_config("bat")
        cfg["mirror_views"] = {"E": "W"}
        p = {x["id"]: x for x in hs.build_prompts(cfg)["calls"]}
        self.assertNotIn("view-E", p)
        self.assertEqual(p["view-W"]["then"], "hero_sprites.py views")
        for h in HEROES + ["goblin", "skeleton", "wolf"]:
            self.assertNotIn("mirror_views", hs.load_config(h), h)
            views = [x for x in self.calls(h) if x.startswith("view-")]
            self.assertEqual(views, ["view-S", "view-N", "view-W", "view-E"], h)
            self.assertEqual(self.calls(h)["view-E"]["then"], "hero_sprites.py views", h)

    def test_views_builds_the_mirrored_view_from_its_source(self):
        # The parent's hand-made v-W (a flip of v-E) is exactly what views
        # builds, and k-W is then the exact flip of k-E.
        bat = hs.load_config("bat")
        with tempfile.TemporaryDirectory() as tmp:
            views = os.path.join(tmp, "b", "video", "views")
            os.makedirs(views)
            shutil.copyfile(os.path.join(bat["dir"], "asset.json"), os.path.join(tmp, "b", "asset.json"))
            for d in ("S", "N", "E"):
                shutil.copyfile(os.path.join(bat["video"], "views", f"v-{d}.png"), os.path.join(views, f"v-{d}.png"))
            cfg = hs.load_config("b", reference=tmp)
            self.assertIsNone(hs.mirror_view(dict(cfg, mirror_views={"E": "W"}), "E", log=lambda *_: None))
            self.assertEqual(sorted(hs.make_views(cfg, log=lambda *_: None)), ["E", "N", "S", "W"])
            px = lambda path: np.asarray(Image.open(path).convert("RGB"))
            self.assertTrue(np.array_equal(px(os.path.join(views, "v-W.png")),
                                           px(os.path.join(bat["video"], "views", "v-W.png"))))
            self.assertTrue(np.array_equal(px(os.path.join(views, "v-W.png")), px(os.path.join(views, "v-E.png"))[:, ::-1]))
            for d in hs.CARDINALS:
                self.assertTrue(np.array_equal(px(os.path.join(views, f"k-{d}.png")),
                                               px(os.path.join(bat["video"], "views", f"k-{d}.png"))), d)
            self.assertTrue(np.array_equal(px(os.path.join(views, "k-W.png")), px(os.path.join(views, "k-E.png"))[:, ::-1]))
            # Run again: nothing changes. A stray generated v-W.jpg is refused.
            logs = []
            hs.make_views(cfg, log=logs.append)
            self.assertTrue(all(x.startswith("same ") for x in logs), logs)
            Image.new("RGB", (8, 8), "white").save(os.path.join(views, "v-W.jpg"))
            with self.assertRaises(SystemExit):
                hs.make_views(cfg, log=lambda *_: None)

    def test_a_bad_mirror_views_is_refused(self):
        base = json.loads(read(os.path.join(hs.REFERENCE, "bat", "asset.json")))
        for value in ({"W": "W"}, {"N": "S"}, {"S": "N"}, {"W": "E", "E": "W"}, ["W", "E"], "W", {"W": "N"}):
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "g"))
                with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                    json.dump(dict(base, mirror_views=value), fh)
                with self.assertRaises(SystemExit, msg=value):
                    hs.load_config("g", reference=tmp)
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "g"))
            with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                json.dump(dict(base, view_notes={"W": "Wings spread."}), fh)
            with self.assertRaises(SystemExit):
                hs.load_config("g", reference=tmp)
        hero = json.loads(read(os.path.join(hs.REFERENCE, "mage", "hero.json")))
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "m"))
            with open(os.path.join(tmp, "m", "hero.json"), "w") as fh:
                json.dump(dict(hero, mirror_views={"W": "E"}), fh)
            with self.assertRaises(SystemExit):
                hs.load_config("m", reference=tmp)

    def test_grounded_words_are_what_every_walking_figure_already_says(self):
        # FLIER replaces exactly these phrases, so every committed prompt of a
        # figure on its feet still says them, byte for byte.
        self.assertEqual(set(hs.FLIER), set(hs.GROUNDED))
        for h in HEROES + ["goblin", "skeleton", "wolf"]:
            c = self.calls(h)
            self.assertIn("walks in place on a treadmill", c["walk-S"]["args"]["prompt"], h)
            self.assertIn("Two full steps", c["walk-S"]["args"]["prompt"], h)
            self.assertIn("stands perfectly still in a neutral idle pose on an invisible turntable", c["turntable"]["args"]["prompt"], h)
            self.assertIn("no walking", c["turntable"]["args"]["prompt"], h)
            if "attack-S" in c:
                self.assertIn("feet stay planted", c["attack-S"]["args"]["prompt"], h)

    def test_flies_is_true_on_a_monster_or_absent(self):
        base = json.loads(read(os.path.join(hs.REFERENCE, "bat", "asset.json")))
        for value in (False, "yes", 1, None):
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "g"))
                with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                    json.dump(dict(base, flies=value), fh)
                with self.assertRaises(SystemExit, msg=value):
                    hs.load_config("g", reference=tmp)
        hero = json.loads(read(os.path.join(hs.REFERENCE, "mage", "hero.json")))
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "m"))
            with open(os.path.join(tmp, "m", "hero.json"), "w") as fh:
                json.dump(dict(hero, flies=True), fh)
            with self.assertRaises(SystemExit):
                hs.load_config("m", reference=tmp)

    def test_view_pose_and_view_height_leave_every_other_asset_alone(self):
        for h in HEROES + ["goblin", "skeleton"]:
            cfg = hs.load_config(h)
            self.assertNotIn("view_pose", cfg, h)
            self.assertNotIn("view_height", cfg, h)
            self.assertIn("standing in a neutral idle pose, arms relaxed, feet on the ground",
                          self.calls(h)["view-S"]["args"]["description"], h)

    def test_a_bad_view_height_or_view_pose_is_refused(self):
        base = json.loads(read(os.path.join(hs.REFERENCE, "wolf", "asset.json")))
        for key, value in (("view_height", 150), ("view_height", 521), ("view_height", 300.0), ("view_height", "300"),
                           ("view_pose", " "), ("view_pose", 3)):
            with tempfile.TemporaryDirectory() as tmp:
                os.makedirs(os.path.join(tmp, "g"))
                with open(os.path.join(tmp, "g", "asset.json"), "w") as fh:
                    json.dump(dict(base, **{key: value}), fh)
                with self.assertRaises(SystemExit, msg=(key, value)):
                    hs.load_config("g", reference=tmp)

    def test_prep_rewrites_nothing_on_the_committed_goblin(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "goblin"), os.path.join(tmp, "goblin"))
            cfg = hs.load_config("goblin", reference=tmp)
            log = []
            self.assertFalse(hs.crop_concept(cfg))
            hs.write_prompts(cfg, log=log.append)
            self.assertTrue(log and all(line.startswith("same ") for line in log), log)


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


class MonsterPrecheckTest(unittest.TestCase):
    def test_monster_precheck_names_the_clips_to_regenerate(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "goblin"), os.path.join(tmp, "goblin"))
            vid = os.path.join(tmp, "goblin", "video")
            cfg = hs.load_config("goblin", reference=tmp)
            # An attack cut short: wrong format, and it ends mid-jab.
            src = os.path.join(tmp, "attack-E.mp4")
            shutil.move(os.path.join(vid, "attack-E.mp4"), src)
            subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-frames:v", "14", "-an", "-y",
                            os.path.join(vid, "attack-E.mp4")], check=True)
            lines = []
            problems = hs.precheck(cfg, log=lines.append)
            self.assertIn("attack-E.mp4", problems)
            self.assertTrue(any(w.startswith("format") for w in problems["attack-E.mp4"]), problems)
            self.assertTrue(any(w.startswith("loop does not close") for w in problems["attack-E.mp4"]), problems)
            # Every flag names a clip (never the whole sheet), and only clips that exist.
            for clip in problems:
                self.assertTrue(os.path.exists(os.path.join(vid, clip)), (clip, problems))
            # Death clips are inspected once each, without a loop check;
            # the diagonals reuse them.
            deaths = [x for x in lines if x.startswith("death-")]
            self.assertEqual(sorted(x.split(":")[0] for x in deaths), [f"death-{d}.mp4" for d in "ENSW"])
            self.assertTrue(all("no loop (death)" in x for x in deaths), deaths)

    def test_start_pose_is_compared_at_the_clip_frame_size(self):
        # The wolf's death clips come back 960 px from a 720 px start pose.
        # Placed straight from 720 px, the pose sits on another sub-pixel
        # grid than the clip's frame 0 even when frame 0 is the pose: every
        # death-N take "differed" by about 20 px (limit 0.2 x walk median 90).
        import sprite_from_video as sv
        from scipy import ndimage
        cfg = hs.load_config("wolf")
        spec, dirs = sv.sheet_spec(cfg), os.path.join(cfg["video"], "dirs")
        limit = hs.START_POSE * 90

        def cell(rgb):
            return ndimage.binary_dilation(sv.pose_place(rgb, spec)[1], hs.CROSS)

        def upscaled(d):
            # The generator's own resize, a different filter from pose_at's.
            return np.asarray(Image.open(os.path.join(dirs, f"{d}.png")).convert("RGB").resize((960, 960), Image.BICUBIC))
        frame0 = {"rgb": upscaled("N")}
        pose = os.path.join(dirs, "N.png")
        self.assertEqual(hs.pose_at(pose, frame0).shape, (960, 960, 3))
        same = int((cell(frame0["rgb"]) != cell(hs.pose_at(pose, frame0))).sum())
        raw = int((cell(frame0["rgb"]) != cell(np.asarray(Image.open(pose).convert("RGB")))).sum())
        self.assertLessEqual(same, 6)
        self.assertGreater(raw, 3 * same)
        # A clip that really starts elsewhere (turned to NE) still fails.
        turned = int((cell(upscaled("NE")) != cell(hs.pose_at(pose, frame0))).sum())
        self.assertGreater(turned, 2 * limit)
        # A 720 px clip compares against the pose as it is.
        self.assertTrue((hs.pose_at(pose, {"rgb": np.zeros((720, 720, 3), np.uint8)})
                         == np.asarray(Image.open(pose).convert("RGB"))).all())

    def test_monster_precheck_reports_a_missing_cardinal_death(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(os.path.join(hs.REFERENCE, "goblin"), os.path.join(tmp, "goblin"))
            os.remove(os.path.join(tmp, "goblin", "video", "death-N.mp4"))
            problems = hs.precheck(hs.load_config("goblin", reference=tmp), log=lambda *a, **k: None)
            self.assertEqual(problems, {"death-N.mp4": ["missing"]})


if __name__ == "__main__":
    unittest.main()
