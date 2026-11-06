# Engineer video inputs

Built with `python3 script/hero_sprites.py engineer prep|dirs|precheck|build` (see `docs/concepts/SPRITE-PIPELINE.md`).

- `views/v-*.png`: the four generated views; W and E are true profiles. `views/k-*.png` are their normalized copies (`hero_sprites.py engineer views`).
- `turntable.mp4`: 8 s, keyframes W 2 s, N 4 s, E 6 s, first = last = `k-S.png`. Its prompt names the hammer and planks (`turntable.design` in `../hero.json`).
- `dirs/*.png`: start poses. The cardinals are the `k-*.png`. The diagonals are turntable frames (0-based) SW 30, NW 70, NE 118, SE 154, picked by Dominic and pinned in `../hero.json`. The automatic picker chose 30, 70, 118, 170 (`diagonals.json`); at 170 the planks vanish and the view is too frontal.
- `walk-*.mp4`, `idle-*.mp4`: 2 s clips started and ended on `dirs/<DIR>.png`, with the hammer and plank sides recorded in `../prompts.json`. `walk-W.mp4` was regenerated once, because the hammer vanished from one frame of the first take. `precheck` passed all 16.
