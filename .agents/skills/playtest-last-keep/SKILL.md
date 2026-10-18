---
name: playtest-last-keep
description: "Run a Last Keep playtest with five specialists in one shared room. Use when a round of human-like play should produce screenshots and a written report, not when the browser proof suite is the check."
disable-model-invocation: true
---

# Playtest Last Keep

Five specialists play together in one room. They do not split into separate games. Each one may pick a hero. The report is written from the speciality, not from the hero's role. The browser proof stays `.agents/skills/verify-last-keep/SKILL.md`. This skill does not copy the steps in `e2e/scenarios.js`.

## Harness

`e2e/playtest/room.js` joins the party. It calls `createHost` and `joinQuery` from `e2e/scenarios.js`. `e2e/playtest/cli.js` keeps that party open so each specialist can be driven one action at a time.

```sh
node e2e/playtest/cli.js serve playtests/live
node e2e/playtest/cli.js shot playtests/live
node e2e/playtest/cli.js act playtests/live '{"player":"Ada","hold":["KeyW"],"ms":800}'
node e2e/playtest/cli.js act playtests/live '{"player":"Bram","build":"1","click":{"x":700,"y":420}}'
node e2e/playtest/cli.js stop playtests/live
```

`shot` writes `playtests/live/shots/NN-Name.png` and a sibling `.json` snapshot. The snapshot is for the game-logic specialist and for the aggregate. Gameplay, graphics, music, and character design choose the next action from the picture. Clicks are pixels on the 1280 by 800 screenshot. Keys are `KeyW`, `KeyA`, `KeyS`, `KeyD`. `build` is `1` through `6`. `skill` is `q`, `e`, or `r`. `start` presses the host's start button.

Unset `BASE_URL` for a local server. Set it to `https://agentyard.letz.tw` to play the deployed game. The local Chrome path is `CHROME_PATH`.

Phones play with the touch joystick and the portrait buttons, in landscape. A feed tap uses the `f` bit, and lifting the thumb clears it so the next heal can rise. The build row names the building and its cost, and portrait is a full-screen rotate card. Far from the keep, the roster and the relic lines stay above the build bar. This harness stays the 1280 by 800 mouse and keyboard room. Do not drive a specialist with the stick.

`e2e/playtest.spec.js` is the harness check: five heroes, one roster, and a warrior who walks. The HUD captions (wave, relics, resources, roster, abilities, builds) should read on the yard without a stack of panels.

## Specialists

They share one room. The hero is only the seat they play.

1. Gameplay, Ada, warrior, host. Starts the night. Judges whether a minute of play is readable, fair, and worth another minute. Reads `docs/GAME-INTERACTIONS.md`.
2. Graphics, Lux, mage. Judges whether bodies, buildings, the yard, and the night read at a glance. The wave line sits in the yard and stays off the sacks and the other world pins.
3. Music and sound, Bram, engineer. Judges what is heard. Name the day loop, the night loop, the horn, the clear, and the hit, kill, build, keep, and fall cues if they play. If the build is silent, the report says so. Mute and volume should survive a reload.
4. Game logic, Pip, scout. Cross-checks the screenshot against the saved snapshot and against `docs/GAME-INTERACTIONS.md`. A planned edge is a finding. Screen and state that disagree are a finding. A hero's health on the fallen screen is the same snapshot the fight HUD reads. A downed hero is not refilled because the keep died on that tick.
5. Character design, Nia, farmer. Judges whether each hero and monster reads as that character at fight zoom, and whether the roster says who is who. A hero that only reads in the close-up is a finding. The warrior is steel plate, a helmet with a visor slit, pauldrons, a kite shield with a gold cross, and a silver sword. The mage is a pointed hat, a deep blue robe that flares, gold trim, and a staff. The scout is a green hood, a cloak, and a bow. The farmer is a straw hat, denim, and a pitchfork. A brim that covers the body is a finding. The engineer is leather, an apron, and a hammer. A hero whose head leaves the top of the frame is a finding. Steel that goes orange or mint at dusk or night is a finding.

## Report

`playtests/round-N.md` has one section per speciality, in the order above. Each section has what that lens saw, bugs with the screenshot path, and a top 3. The aggregate then dedupes and ranks by severity and how many specialists hit it. Disagreements stay in the list. Append every new finding to `playtests/BACKLOG.md`. Re-check items already marked done.

Upgrades come from buildings and finds. There is no card pick.

The waiting yard is a whole frame, not one patch. `frameMood` fails contrast under 9 or a lime share over 0.08. Dusk fails a cool wash over 0.25 or a warm tail under 0.03. Night fails the flat-field contrast. `frameGround` fails when the near-ground spread is under 8. That is the 25th percentile of block deviation from 42% to 90% of the frame. `twoPlayerNight` reads the framebuffer in day, dusk, and night. A formula that passes while the canvas is a flat tint is not a pass. The pine wall is `forestLook.wall`, at least 80, inside the seventy stumps and felled logs.

A bat or a dark rider that is darker than the night grass is not on the yard, even when the snapshot says the body is in frame. The wings are bone, the rider's helm and cuirass are plate, and both wear a bone rim. `paradeShowsEveryKind` reads those pixels.

The town ring of houses is staked by the keep raise, and wheat beyond a click is farmer labor. The town cottages are timber and thatch and the outer ring is felled wood. A raise whose wood and gold cover the offer stakes that ring from the woods. Feed still needs the hero beside the keep. The wave clock moves on every tick while the keep stands and the room is not waiting to start. Frenzy does not freeze the phase.
