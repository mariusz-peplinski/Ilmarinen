# Performance Optimization Plan

Date: 2026-04-04

This document turns the current performance review into an execution plan for the active Three.js runtime.

The goal is not just "make it faster somehow." The goal is to spend effort in the order that gives the largest real wins first, while avoiding work that will be invalidated by later architecture changes.

## Current Bottleneck Summary

Based on the current code in `src/renderer/src/three-game.ts`, the main costs are:

1. Terrain rendering architecture
2. Terrain occlusion updates
3. Terrain shadow rendering
4. Per-block material and tint handling
5. Only after those: collision, movement, and actor logic

### Why terrain is the main problem

The current runtime generates a `168x144` terrain map and then builds terrain as one `Mesh` per exposed cube layer.

That means we are currently paying for:

- a large number of terrain meshes
- multiple material groups per cube
- shadow work on the same terrain
- per-block occlusion classification

This is the core reason performance will fall off as terrain density, view size, shadows, and actor counts increase.

## Optimization Order

Work should be done in this order:

1. Terrain rendering architecture
2. Occlusion architecture
3. Height tint / material architecture
4. Shadow policy
5. Actor-system and collision micro-optimizations

This order matters because later steps depend on earlier ones.

For example:

- It is not worth heavily optimizing per-block material updates if we plan to remove per-block terrain meshes.
- It is not worth doing sophisticated NPC-side visual occlusion if terrain still forces global terrain scans.
- It is not worth micro-optimizing player collision while terrain rendering dominates frame time.

## Phase 1: Terrain Chunking

### Goal

Replace the current one-mesh-per-exposed-cube terrain with chunked terrain meshes.

### Status

Mostly complete as of 2026-04-04.

Completed in this phase so far:

- terrain now renders through chunked `InstancedMesh` batches instead of one `Mesh` per exposed cube
- terrain now renders exposed top and side faces only instead of full cube instances
- chunked terrain keeps separate normal/front render paths so the current player-centric occlusion model still works

Still pending in this phase:

- greedy merging of coplanar faces

### Implementation Notes

- The current chunked implementation is still an intermediate step, not the final terrain format.
- It now removes bottom faces and hidden interior faces at the geometry level, which is a substantial reduction from the first chunked-cube pass.
- To preserve the current occlusion behavior without a full occlusion rewrite, each chunk currently keeps both opaque and front-terrain instance sets and toggles blocks between them.
- The current face-only path still operates at per-face instance granularity. Greedy meshing is the next step if we want to reduce instance count and vertex count further.
- This is a good bridge architecture for the next step, but not the final optimized terrain representation.

### Why this is first

This is the single highest-impact improvement available.

The current terrain build path creates:

- one `Mesh` per exposed block
- one material array per block
- cloned top materials for tint variation

This drives up draw calls, object count, memory churn, and shadow cost.

### Target outcome

Instead of thousands of individual terrain meshes, we want:

- terrain split into chunks such as `16x16` or `32x32`
- each chunk producing a small number of merged `BufferGeometry` meshes
- static terrain geometry that does not need per-frame transform updates

### Recommended implementation path

#### Step 1A: Chunk the terrain

Status: done on 2026-04-04

Introduce chunk-level terrain data:

- choose a chunk size, likely `16x16` to start
- divide the map into terrain chunks
- build meshes per chunk instead of per block

Expected gain:

- big reduction in mesh count
- much lower scene management overhead
- better foundation for future culling and rebuilds

#### Step 1B: Merge exposed faces, not full boxes

Status: done on 2026-04-04

When generating chunk geometry:

- emit only visible faces
- do not create full `BoxGeometry` cubes for every exposed block
- create face geometry directly into chunk buffers

Expected gain:

- much less geometry
- better GPU efficiency
- much lower memory overhead than individual box meshes

#### Step 1C: Greedy mesh coplanar faces

Status: pending

Once chunked face generation works:

- greedily merge adjacent faces where material and shading class match
- especially merge top surfaces and continuous wall faces

Expected gain:

- major additional drop in triangle count and draw overhead
- best long-term terrain representation for this style of world

### Notes

If greedy meshing feels too large for one pass, we should still do chunked merged faces first. That already gets most of the structural win.

## Phase 2: Local Terrain Occlusion

### Goal

Stop scanning all terrain blocks every time terrain-vs-actor occlusion is updated.

### Current issue

The current occlusion pass walks the entire terrain block list and decides whether each block should render in front of the player.

This is acceptable for a prototype, but not scalable.

It gets especially expensive because:

- terrain is still represented as many individual blocks
- the player updates every frame
- NPC count will grow
- future props/items will add more actor-like cases

### Target outcome

Occlusion work should become:

- local
- actor-aware
- recomputed only when needed

### Recommended implementation path

#### Step 2A: Make occlusion spatial, not global

Store terrain by chunk or spatial region so we can query nearby terrain only.

At minimum:

- look up only chunks near the player
- inspect only blocks/faces that could plausibly overlap the player lane

Expected gain:

- CPU cost becomes proportional to nearby terrain, not whole-map terrain

#### Step 2B: Add dirty-update rules

Do not recompute occlusion every frame if nothing relevant changed.

Good dirty triggers:

- player changed tile
- player changed height band
- player crossed a relevant threshold inside the current tile
- view rotation changed
- camera mode changed in a way that affects projection assumptions

Expected gain:

- avoids repeating the same classification work on static frames

#### Step 2C: Keep full terrain fade player-centric for now

Even after we add more actors, do not immediately generalize the full front-terrain pass to every NPC.

Recommended policy:

- full local terrain occlusion for the player
- no per-NPC terrain fade at first, or only for a very small number of important nearby actors

Why:

- it protects frame time
- it avoids multiplying terrain queries by actor count
- it preserves the best visual quality where it matters most

## Phase 3: Height Tint And Material Architecture

### Goal

Remove dependence on per-block cloned materials for terrain tinting.

### Current issue

Right now top-face tinting depends on cloned top materials per terrain block.

That is workable in a small prototype, but not a good long-term structure when terrain grows and gets rebuilt.

### Target outcome

Height tint should become chunk data, not object-per-block material state.

### Recommended implementation path

#### Step 3A: Move tint into vertex colors

Preferred approach:

- encode tint directly in terrain chunk vertex colors
- rebuild or update chunk color buffers when tint settings change

Expected gain:

- fewer material instances
- simpler state management
- better fit for merged chunk meshes

#### Step 3B: Keep material count small

Try to preserve a very small set of terrain materials.

For example:

- one opaque terrain material
- one front/faded terrain material

Avoid reintroducing large material permutations.

## Phase 4: Shadow Policy

### Goal

Make shadow cost proportional to the visual value we actually get from shadows.

### Current issue

Even with `BasicShadowMap`, shadows are expensive because the terrain architecture is expensive.

Shadows are currently multiplying the cost of a terrain representation that is already too heavy.

### Recommended implementation path

#### Step 4A: Keep shadow settings conservative by default

Good defaults:

- `1024` shadow map or lower
- optional lower `pixelRatio`
- easy debug toggle for terrain shadows

#### Step 4B: Reassess after chunked terrain lands

Do not over-tune shadows before chunking terrain.

After chunked terrain exists, decide:

- whether terrain should cast shadows at all
- whether only some chunk meshes should cast
- whether blob shadows already provide enough readability for actors

#### Step 4C: Be willing to prefer blob shadows

If performance matters more than exact terrain self-shadowing:

- keep actor blob shadows
- reduce or disable terrain shadow casting

This is often the best trade in stylized isometric games.

## Phase 5: Actor, NPC, Collision, And Movement Optimizations

### Goal

Clean up gameplay-side CPU work once rendering is no longer the dominant problem.

### Important note

These are not the first place to spend effort.

They matter later, especially if actor count rises, but right now they are secondary.

### Recommended implementation path

#### Step 5A: Avoid unnecessary actor visual updates

For player and NPC billboards:

- only change sprite frame when the frame index actually changes
- only change sprite tint when tint state actually changes
- avoid redundant `needsUpdate` toggles when nothing changed

#### Step 5B: Add actor spatial queries if counts grow

If NPC/item counts increase significantly:

- add a spatial hash or chunk-based actor registry
- use it for touch checks, interaction checks, and later NPC awareness

This becomes useful when actor-to-actor interactions grow, not before.

#### Step 5C: Convert hot map data to typed arrays if needed

If collision and movement become hot:

- store heights in a typed array
- store material ids as compact numeric enums
- reduce object indirection in hot reads

This is a good medium-term cleanup, but it should not happen ahead of terrain rendering fixes.

#### Step 5D: Precompute simple map facts

Potential precomputations:

- walkable neighbor flags
- equal-height neighbor masks
- chunk bounding info
- terrain exposure summaries

These help both actor AI and chunk/occlusion systems.

## Cheap Wins We Can Do Early

These are not substitutes for architectural fixes, but they are low-cost improvements:

### Early Win 1: Lower pixel ratio cap

Current renderer pixel ratio is capped at `2`.

Potential improvement:

- cap at `1.5` or even `1`

Expected effect:

- immediate GPU reduction on high-DPI screens

### Early Win 2: Freeze static terrain transforms

Once terrain becomes chunked and static:

- set static chunk meshes to not auto-update transforms

Expected effect:

- small but real CPU savings every frame

### Early Win 3: Only update HUD and debug text on intervals

This is already partly in place for the HUD.

Maintain that policy:

- avoid per-frame DOM churn for debug overlays

### Early Win 4: Keep active actor radius strict

The alive radius is already helping.

We should preserve the principle:

- update and render only actors near the player
- keep the radius comfortably beyond the camera, but not dramatically larger than needed

## Recommended Execution Plan

This is the actual order we should follow when implementing:

1. Chunk terrain meshes.
2. Merge terrain faces instead of instantiating block meshes.
3. Add greedy meshing if needed after chunking works.
4. Replace global terrain occlusion scans with local chunk-based queries.
5. Add dirty-update rules for occlusion.
6. Move height tint to chunk/vertex color data.
7. Reevaluate shadow policy after chunked terrain is in.
8. Only then optimize actor-side logic further.

## What Not To Do First

Do not start with these:

- micro-optimizing player movement math
- rewriting NPC wandering logic for speed
- adding complicated actor-vs-actor data structures
- over-engineering touch/collision events
- spending a lot of effort on per-block material tweaks

Those may matter later, but they will not beat the gains from fixing terrain and occlusion architecture.

## Success Criteria

We should consider the optimization effort successful if we achieve most of the following:

- terrain draw structure is chunk-based rather than block-based
- frame time scales mainly with visible/local terrain, not whole-map terrain
- player occlusion is local and dirty-updated
- shadow cost is predictable and intentionally chosen
- adding more NPCs does not immediately collapse performance
- future map complexity can increase without requiring a renderer rewrite

## Immediate Next Step

The next implementation step should be:

### Build chunked terrain meshes

That is the best first move because it reduces:

- draw calls
- object count
- shadow cost
- material churn
- pressure on later occlusion systems

Everything else becomes easier once that lands.
