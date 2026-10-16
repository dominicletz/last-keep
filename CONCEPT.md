# Last Keep — Game Concept

> Working title. Concept documents only; no tech stack or implementation yet.
> Planned hosting: agentyard.letz.tw

## Pitch

A cooperative, medieval roguelike defense game. A band of heroes founds a
settlement in the middle of the map, grows it into a walled city, and holds out
against endless waves of monsters coming from every side. How long can your
group survive?

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
- A short (about 15 seconds) shop / card pick between waves offers roguelike
  upgrades.
- Open question: how the short card pick and the long building phase fit
  together (for example, the card pick at the start of each building phase).

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

## Visual style

- Pixel art rendered from low-poly 3D models at low resolution, upscaled with
  sharp pixels.
- Limited color palette with hard shadows.
- Inspired by Kingdom Two Crowns.

## Next steps

1. Write a style guide (palette, lighting, pixel density, UI tone).
2. Draft images for monsters, heroes, and the overall theme.
3. Only after that: implementation planning.
