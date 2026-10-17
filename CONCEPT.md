# Last Keep — Game Concept

> Working title. Concept documents only; no tech stack or implementation yet.
> Planned hosting: agentyard.letz.tw

## Pitch

A cooperative, medieval roguelike defense game. A band of heroes founds a
settlement in the middle of the map, grows it into a walled city, and holds out
against endless waves of monsters coming from every side. How long can your
group survive?

The implemented interaction graph is
[`docs/GAME-INTERACTIONS.md`](docs/GAME-INTERACTIONS.md). A line on this page
that is not an edge in that graph is still planned.

## Players

- 2–15 players, co-op.
- Easy start: create a game and send an invite link to friends.

## Core gameplay

- **Hero action, top-down brawler.** Each player controls one hero directly:
  WASD to move, mouse to aim, two skills plus an ultimate.
- **Endless waves with a highscore.** Waves keep getting harder; the score is
  how long the group survives.
- **Every 5th wave** brings a boss or an elite modifier.
- **Waves from all sides.** Monsters attack from every direction, in different
  classes and types. This is not a single-road tower defense.

## Rhythm: waves and the economy phase

Inspired by Kingdom Two Crowns: waves are slower, with a long economy and
building phase between them.

- Players grow fields, gather resources, and build.
- There is no card pick between waves. Roguelike progression comes from what
  the group builds and finds during the economy phase instead, for example a
  mage tower that unlocks spell upgrades, a forge that improves weapons, or
  relics dropped by bosses and elites.

## City building

- Players build a city in the middle of the map.
- Over time they reinforce it with walls and expand outward.
- The city is what the group defends; losing it ends the run.

## Hero roles

Heroes fight, and they also specialize in how they help the settlement.
Examples:

- **Farmer:** expands fields and feeds the group.
- **Engineer:** lays walls and traps faster.
- **Scout:** spots which directions the next waves are coming from.

Medieval fighting archetypes (warriors, mages, rangers and similar) are still
to be combined with these roles.

## UI principles

The screen is mostly diegetic, in the spirit of Kingdom Two Crowns. A sack of coins, not a gold number. Spatial markers stay where a world-space cue is clearer. Meta overlays are rare. Non-diegetic chrome is the leftover.

- Diegetic. It exists in the world. Coins in a pouch on the hero, logs and food stacked by the keep, cracks and fire on the stone, a darker sky for the coming night.
- Spatial. A marker in the world when a label would be worse. The build-range ring, the placement ghost, an offscreen wave call, the hero's name on the figure. Building costs belong here as coin and log icons over the ghost.
- Meta. A light touch on the screen about the body. A vignette when health is low. Do not reach for it first.
- Non-diegetic. Only what cannot live in the world: the invite link, mute and volume, and the score after the keep falls.

`STYLE.md` names the palette and the asset loop. `assets/js/ui.js` is the list of non-diegetic slots. That list may shrink. It may not grow.

## Visual style

- Pixel art rendered from low-poly 3D models at low resolution, upscaled with
  sharp pixels.
- Limited color palette with hard shadows.
- Inspired by Kingdom Two Crowns.
- Each hero is a different body at game zoom: warrior shoulders and shield,
  mage robe and hat, scout hood and bow, farmer straw brim and fork, engineer
  apron and hammer. A pair of monsters keeps two outlines and two bars.
- Sound is synthesized in the browser. Day and night are separate loops. A horn,
  a clear, and the hit, kill, build, keep-bite, and fall cues are oscillators,
  not samples, and nothing is fetched from a CDN.

## Next steps

Playtest round 5 finishes the audio and silhouette build. The theming round starts after it, in this order.

1. The asset pipeline and the verification loop in `STYLE.md`. That pull request does not sculpt the town.
2. The town kit, heroes, monsters, and lighting, generated from that pipeline.
3. The diegetic UI pass, and hero portrait cards taken from the gallery renders.
