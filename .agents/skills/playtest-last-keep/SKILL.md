---
name: playtest-last-keep
description: "Run a Last Keep playtest with five specialists in one room. Use when reviewing a local or deployed build by playing, not when the browser proof suite is the check."
disable-model-invocation: true
---

# Playtest Last Keep

Five specialists play together in one room. They do not split into separate games. Each report uses that person's lens, names a severity, attaches a screenshot, and ends with a top 3. The aggregate keeps one section per speciality, then one merged ranked fix list.

1. Gameplay — fun, pacing, difficulty, co-op, controls, and goals.
2. Graphics — the 3D pixel-art picture, readability, effects, the HUD, the camera, and framing.
3. Music and sound — what audio exists, and what is missing: ambient day and night, combat, a hit, a death, a build, and a wave horn. If the build is silent, the fix list includes a first audio layer.
4. Game logic — rules, the economy, the wave state machine, damage and cooldowns, sync, and exploits. Cross-check the screen against the snapshot.
5. Character design — heroes, monsters, bosses, elites, and the keep. Silhouettes, distinctness, and the medieval roles in `CONCEPT.md`.

Gameplay and game logic both read `docs/GAME-INTERACTIONS.md` and `docs/interactions.json`. A role with no incoming or outgoing edge, or a concept line that is still `planned`, is a finding.

Append every finding to `playtests/BACKLOG.md` with an id, the source and round, the speciality, the severity, and the status. Re-check items already marked done. Do not drop an item. When an item is done, name the test that guards it.

Do not copy `e2e/scenarios.js` into this skill. The browser proof is `.agents/skills/verify-last-keep/SKILL.md`. This skill is the playtest. The specialist bots are not part of this skill yet. `playtests/BACKLOG.md` item LK-025 records that they still need to be built.
