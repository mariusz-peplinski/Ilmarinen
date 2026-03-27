# 3D Migration Plan

Date: 2026-03-27

## Decision

We will pivot the renderer from PixiJS-only isometric sorting to a real 3D scene built with **Three.js**.

Why this choice:

- Three.js is a 3D-first engine with mature orthographic camera support.
- Three.js has built-in `Sprite` support for billboards, which fits our character/NPC art style well.
- A real 3D scene gives us stable depth-buffered terrain and actor occlusion, which is the main pain point in the current 2D approach.
- `pixi3d` is viable in principle, but it is an add-on around a 2D-first stack. If we are paying the cost of a renderer rewrite, we should land on a stronger long-term foundation.

## Core Architecture

- Keep Electron and the current app shell.
- Replace PixiJS world rendering with a Three.js scene rendered into the same app.
- Use an **orthographic camera** with four 90-degree view rotations (`N-up`, `E-up`, `S-up`, `W-up`).
- Build terrain as real 3D block geometry:
  - each tile cell becomes a box or set of faces in 3D space
  - we are intentionally **keeping cubes** for now because they help with procgen, caves, houses, and removable ceilings/roofs
- Keep actors as billboard sprites:
  - `characters.png` remains the source sheet
  - sprite anchor stays at the feet
  - jumping is real vertical movement in world `z`
- Handle actor-vs-terrain occlusion with a **local multi-pass rule**, not a global sorter:
  - most terrain renders normally
  - nearby terrain that should appear in front of an actor is rendered in a later pass
  - this keeps cube terrain while avoiding a full return to 2D sorting logic

## What We Keep

- Current map data and height/material logic
- Current movement feel targets:
  - acceleration / deceleration
  - variable jump height
  - faster falling than rising
  - controls rotating with the camera
- Current debug HUD ideas
- Current asset files

## What We Replace

- PixiJS terrain drawing
- Custom 2D z-sorting / occlusion logic
- Terrain offset calibration hacks
- Sort-anchor debug overlay

## Implementation Phases

## Phase 1: Renderer Skeleton

- Add `three` dependency.
- Create a `ThreeIsoGame` renderer class beside the current `IsoGame`.
- Render a flat test scene with:
  - orthographic camera
  - one terrain box
  - one billboard actor
  - camera follow
  - `Tab` / `Shift+Tab` rotation

Goal: prove the camera model and sprite billboarding.

## Phase 2: Terrain

Current status: in progress

- Convert map cells into 3D terrain meshes.
- Start simple:
  - one box per visible height layer
  - simple material mapping
- Then optimize if needed:
  - merged geometry per material
  - instancing for repeated blocks

Goal: correct terrain shape and occlusion before gameplay polish.

## Phase 2A: Local Actor Occlusion

- Keep cube terrain and billboard actors.
- Remove billboard bias experiments once the new pass is in place.
- Classify only nearby terrain blocks around each actor into:
  - normal terrain
  - terrain that must render after the actor
- Render in passes:
  - normal terrain
  - actor
  - front terrain

Goal: preserve the cube workflow while fixing the most visible billboard/cube clipping cases.

## Phase 3: Actor

- Port player movement and jumping into 3D coordinates.
- Keep gameplay on the same logical grid scale as today.
- Use billboard sprites for actor visuals.
- Restore walk-cycle animation and shadow.

Goal: match current feel, but with depth handled by the 3D scene.

## Phase 4: Collision

- Rebuild terrain collision against 3D tile heights.
- Preserve:
  - free movement
  - step-up rules
  - steerable jumps
  - camera-relative controls

Goal: parity with current movement behavior.

## Phase 5: Debug + Polish

- Recreate HUD status info.
- Add camera/view debug info.
- Add optional helpers for:
  - tile bounds
  - actor feet position
  - collision probes

## Risks

- Our terrain atlas is pre-rendered isometric art, not authored as neutral 3D textures. We may need to crop or reinterpret it carefully for top/side texturing.
- Three.js sprites are easy; animated atlas handling is extra work we must implement ourselves.
- We should expect a temporary regression period while movement and collision are reconnected.
- Keeping cubes means actor occlusion will need some custom logic near walls and cliffs. This is acceptable, but we should keep it local to nearby terrain so performance stays predictable.

## Recommended Execution Strategy

Do **not** mutate the current Pixi renderer into a hybrid.

Instead:

1. Build the Three.js path in parallel.
2. Get one flat map + one actor working.
3. Port movement/collision.
4. Remove the old Pixi terrain renderer only after parity is good enough.

This keeps risk lower and gives us a working reference while rewriting.
