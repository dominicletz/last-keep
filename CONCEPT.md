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

- **Hero action, top-down brawler.** Each player controls one hero directly.
  A keyboard uses WASD to move, the mouse to aim, and Q, E, and R for the two
  skills and the ultimate. A touch screen, including a phone that opened the
  invite, uses a joystick under the left thumb and portrait buttons for the
  strike and those three skills. The cooldown sits on the button. Building and
  paying stay where the hero stands. One context button appears only when a
  place, a raise, or a feed is in reach. Landscape is the play orientation.
  Portrait shows a short rotate prompt, on a phone or a tablet. A keyboard on
  the same device still moves and casts.
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

1. Write a style guide (palette, lighting, pixel density, UI tone).
2. Draft images for monsters, heroes, and the overall theme.
3. Only after that: implementation planning.
