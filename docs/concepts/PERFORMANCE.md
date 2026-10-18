# Performance and smooth motion

This page records one headless match and the budgets the next change has to meet. The match is the evidence. The budgets are the bar for the harness that follows.

## What was measured

One run on 18 Oct 2026, on a 4-core VM whose load average was 0.00 before the match. The browser was headless Chromium through SwiftShader (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`). No page error was logged. The keep took damage and the wave counter reached 7, so the samples are from a live fight.

Each run seated six heroes (farmer, warrior, mage, engineer, scout, and a second warrior). The measured page held attack and aimed at the nearest monster. Five other Chromium pages did the same on the same machine, so the frame times below are an upper bound for this VM. Draw calls, triangles, geometries, textures, and the JS heap are counts from the measured page.

The desktop viewport was 1280 by 800. The phone viewport was 844 by 390 with touch. Sampling was every 5 seconds from the opening build through wave 7. `paintFrame` was timed as two spans. `renderer.render` is the submit. The following `sampleYard` read is four `readPixels` of a 40 by 20 patch, and that read waits until the GPU finishes the frame. On this driver the submit returned in about 10 ms and the wait carried the rest of the paint.

`renderer.render` returns before the raster finishes. The limiter for the paint the player waits on is that flush, and behind the flush is SwiftShader drawing about 900 shadow-casting meshes. This run had no discrete GPU. 16.7 ms is the target for a later desktop GPU measurement.

## What the match did

Live top-level meshes stayed near 45 during an empty build and rose into the 60s only while monsters were on the field. `renderer.info.memory.geometries` climbed through the empty builds as well.

Desktop geometries at the first sample of each build, with zero monsters:

| Build for wave | Geometries | Draw calls |
| --- | --- | --- |
| 1 | 741 | 865 |
| 2 | 817 | 862 |
| 3 | 1204 | 865 |
| 4 | 1749 | 865 |
| 5 | 2409 | 865 |
| 6 | 2996 | 866 |
| 7 | 3691 | 864 |

The phone run started at 819 geometries and reached 3743 at the build for wave 7. Empty-yard draw calls stayed at 969 to 973. Textures stayed at 4 on both viewports. Shader programs went from 6 to 8.

From the build for wave 2 to the build for wave 5, desktop geometries went from 817 to 2409. From the build for wave 4 to the build for wave 7 they went from 1749 to 3691. The phone run moved from 875 to 2485 and from 1848 to 3743 over those same spans. Live meshes were back near 45 at each of those builds. The geometries were no longer in the scene.

During desktop wave 6 the monster count fell from 15 to 5 while geometries rose from 3249 to 3665. Draw calls peaked at 1043 and triangles at 13436. Phone wave 6 peaked at 16 monsters, 1236 draw calls, 15820 triangles, and 3721 geometries.

`performance.memory.usedJSHeapSize` sawtooths. Desktop troughs stayed between 24 MB and 32 MB and peaks between 50 MB and 62 MB. The phone troughs stayed between 26 MB and 35 MB. The floor stayed flat across seven waves. The objects that accumulate are the GPU geometries `renderer.info` still counts.

Paint p95 for a 5 second window, submit plus the readback wait:

| | Desktop p95 | Phone p95 |
| --- | --- | --- |
| Empty build, early | 345 ms to 386 ms | 181 ms to 251 ms |
| Wave 6 windows | 366 ms, 396 ms, 424 ms | 216 ms, 207 ms, 256 ms |
| `renderer.render` alone, typical p95 | 8 ms to 17 ms | 7 ms to 15 ms |

A few desktop windows spiked (670 ms, 756 ms, and two submits near 300 ms). The typical window did not get slower from wave 1 to wave 7. The geometry leak did not show up as a slower paint inside these seven waves. It is still a leak. The unreclaimed buffers are the thing that grows every wave, and this run was not long enough to watch them slow the driver.

Facing is a separate fault. `sync` writes `mesh.rotation.y` from the snapshot in one assignment. Across the desktop match that path recorded 675 turns, and the largest step in most 5 second windows was 3.1 radians. That is a half turn in one applied snapshot. The phone match recorded 739 turns with the same largest step. Position already blends in `poseAt` over 45 ms. The server tick is 50 ms, so a new snapshot usually arrives before that blend finishes. `drawDue` aims for a paint every 50 ms while input is fresh and every 250 ms when the page is idle. On this machine the readback wait is longer than both of those gaps, so the paint lands when the flush returns.

## Why the numbers move

`sync` removes a mesh from the scene and from the `meshes` map. It does not call `dispose` on the geometry. `addBurst` allocates a new sphere and material, then `scene.remove` drops the mesh when the burst ends, again without `dispose`. Rebuilding the keep does the same `scene.remove`. `pieceMesh` sets `castShadow` on every voxel box, and the sun already casts a 256 map, while contact discs draw a second shadow on the ground. Materials for shared colors are cached. Each box allocates its own geometry.

`paintFrame` calls `sampleYard` on every paint so the test can read `field`. That read is what flushed SwiftShader. The yard grade does not need to run on every paint of a real match.

The pixel-art lane owns the voxel mesher and the ground materials. Disposal, pooling, the facing blend, and the harness sit in the entity update and in `motion.js`.

## Budgets

These are ceilings. A later change may only lower one.

- Geometries at the first sample of the build for wave N+3 are less than or equal to the first sample of the build for wave N. This run fails that. 817 grew to 2409, and 1749 grew to 3691.
- Textures stay at 4.
- Empty-yard draw calls stay at or under 868 on the desktop viewport and 973 on the 844 by 390 viewport. Empty-yard triangles stay at or under 11552 and 12880 for those same viewports. This run held that line. Wave 6 with monsters may use up to 1043 calls and 13436 triangles on desktop, and 1236 calls and 15820 triangles on the phone viewport.
- JS heap trough after a wave does not rise across three waves. This run held that line. The trough stayed under 35 MB.
- The paint the player waits on, submit plus any forced read, has a target of p95 under 16.7 ms on a desktop GPU and under 33 ms on the phone viewport at wave 6 with about 16 monsters and six heroes. SwiftShader does not meet that target today. The CI ceiling starts at the measured wave-6 window p95 from this run, 424 ms on desktop and 256 ms on the phone viewport, and only moves down. A check that required 33 ms on this driver would fail before any fix existed.
- A rendered facing step is at most 0.7 radians. A half turn takes at least five steps. This run fails that. Steps of 3.1 radians were applied in one snapshot.

## What changes

Stop calling `sampleYard` from every `paintFrame`. A test that wants the yard grade calls it on purpose. The match loop paints without a flush.

When `sync` drops a mesh, dispose its geometry. Do that for bursts and for the keep mesh that a rank change removes. Pool the shot sphere and the burst sphere. Today each projectile and each death allocates a new geometry. Leave the greedy voxel boxes as they are. If empty-yard draw calls are still near 900 after disposal, instancing lands in the mesher the pixel-art lane edits. Off-screen monsters are already hidden. That hide stays.

Facing joins the pose track. The rendered yaw moves on the shortest arc, and each step is capped at 0.7 radians, so a half turn takes at least five frames. The server snapshot remains the target. The position blend uses the 50 ms tick. The current window is 45 ms, which ends as the next snapshot arrives.

## How to verify

`e2e/scenarios.js` grows a scripted match with six seats through at least three waves and records paint percentiles plus `renderer.info`. The run fails if geometries or the JS heap trough rise from wave N to wave N+3, if empty-yard draw calls or triangles exceed the ceilings above, or if the paint p95 exceeds the CI ceiling. Those ceilings only move down.

A unit test on the facing step feeds a half turn and checks that no step exceeds 0.7 radians and that the half turn takes at least five steps. Heroes and monsters share that step.

The live smoke reads the same counters once on the deployed page and fails if geometries grew across the waves that smoke can see, or if a facing step in that sample exceeds 0.7 radians. The 16.7 ms target stays on a desktop GPU run.
