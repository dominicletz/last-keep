# LastKeep

TLC reached 395 states and 1909 steps. The chart draws 19 states and 41 arrows.
The chart does not draw 398 steps that stay in one chart state.
The view hides 234 steps, so the chart does not draw them.
The step you sit down changes Session, You, Table and Keep at the same time.
The step a connected page sends restart changes Session and You, or You and Keep, or Session, You and Keep, or Session and Keep, at the same time.
The step the room closes changes Session, You, Table and Keep at the same time.
The step you press New keep changes Session and You, or Session, You and Keep, or Session and Keep, at the same time.

## NoRestartBeforeTheFall (fixed in P0)
The original TLC run found a 3-step counterexample in `tlc-NoRestartBeforeTheFall.out` because `GameChannel` forwarded `"restart"` with no phase check:
0. Session Choosing a hero, You Not in the yard, Table No table, Keep No keep
1. you sit down: Session Waiting for the host, You On the ring, Table Just the host, Keep Can still rise
2. the host starts the night: Session Day, You On the ring, Table Just the host, Keep Can still rise
3. a connected page sends restart: Session Waiting for the host, You On the ring, Table Just the host, Keep Can still rise

**Fix**: `Sim.restart/1` and `Room.handle_cast(:restart, ...)` now only restart when `phase == :over`. Guarded by `restart does nothing before the keep falls` and `a restart push is ignored before the keep falls`.

Host ownership also migrates to the lowest-numbered connected seat (`Sim.host_public_id/1`) when `p1` disconnects so a lobby hold cannot deadlock.

## Rules that hold
TypeOK, NoVictoryScreen, RankStops, DownOnlyAfterAFight, OutsideIsEmpty, NoDeadlock, NoNewSeatOnFallen, NoRespawnOnFallen, OnlyTheHostStarts, RaiseOnlyAtTheKeep, RespawnLandsOffTheKeep, FallOnlyFromTheNight
