# Farmer video inputs

Built with `python3 script/hero_sprites.py farmer prep|dirs|precheck|build` (see `docs/concepts/SPRITE-PIPELINE.md`).

- `views/v-*.png`: the four generated views. `views/k-*.png` are their normalized copies (`hero_sprites.py farmer views`).
- `turntable.mp4`: 8 s, keyframes W 2 s, N 4 s, E 6 s, first = last = `k-S.png`.
- `dirs/*.png`: start poses. The cardinals are the `k-*.png`. The diagonals are turntable frames (0-based) SW 42, NW 82, NE 117, SE 158, picked by Dominic and pinned in `../hero.json`. The automatic picker chose 36, 82, 117, 167 (`diagonals.json`).
- `walk-*.mp4`, `idle-*.mp4`: 2 s clips started and ended on `dirs/<DIR>.png`. The walk W, E and SE prompts carry the pitchfork side the clips show, as recorded in `../prompts.json`. `precheck` passed all 16.
