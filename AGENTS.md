# Repository Guidelines

## Project Structure & Module Organization

This repo is an Electron + Vite + TypeScript desktop game prototype. The active renderer is now **Three.js**, not PixiJS, though the older Pixi path is still kept in the repo as reference.

- `src/main/`: Electron main-process entry.
- `src/preload/`: preload bridge.
- `src/renderer/src/main.ts`: renderer bootstrap, HUD/compass setup, asset loading.
- `src/renderer/src/three-game.ts`: active game/runtime implementation.
- `src/renderer/src/game.ts`: older Pixi-based prototype/reference path.
- `src/renderer/src/style.css`: HUD/overlay styling.
- Root assets: `characters.png`, `new-tileset.png`.

## Current Runtime Notes

- Terrain is rendered as real 3D cubes in Three.js.
- Terrain is generated on startup from layered noise over a `168x144` map, with terraced heights currently in the `1..6` range.
- Tile columns can now mix materials per vertical layer; do not assume one material per stack.
- Actors are billboard sprites from `characters.png`.
- Collision is **not** full 3D physics; gameplay still uses logical tile/height checks.
- The player now uses a small fake-capsule plan-view collision radius (`PLAYER_COLLISION_RADIUS`) instead of a pure point.
- Actor-vs-terrain occlusion uses a **local multi-pass** rule for nearby cubes, not a global sorter.
- There are two NPC groups in the current prototype: a few slow wandering NPCs and a larger stationary set. Both are only active/visible inside an alive radius around the player.
- A temporary free camera is enabled: `` ` `` toggles it, left mouse drag rotates/orbits the camera, and `Tab` / `Shift+Tab` still snap back to quarter-turn views.
- The renderer HUD now includes a compass, FPS counter, and lighting/shadow debug controls.
- Current perf caveat: terrain is still built as one mesh per exposed cube layer, so shadows and map density are the first things to scrutinize when performance drops.

## Asset Notes

`new-tileset.png` atlas facts:

- cells are `32x32`
- columns have a `2px` gutter
- rows have no gutter
- art is bottom-aligned
- visible tile art is effectively `32x24`
- bottom `8px` is wall/thickness
- next `16px` is the top diamond surface

These are source-art facts. Do **not** treat the atlas as ordinary flat top/side textures without checking the projection assumptions first.

## Build, Test, and Development Commands

- `npm run dev`: start the Electron app in development mode.
- `npm run typecheck`: run TypeScript checks.
- `npm run build`: build renderer/main/preload bundles.
- `npm run dist`: package the app.

Before committing rendering/gameplay work, run:

- `npm run typecheck`
- `npm run build`

## Coding Style & Naming Conventions

- TypeScript, 2-space indentation, semicolon-free style.
- `camelCase` for variables/functions, `PascalCase` for classes/interfaces, `UPPER_SNAKE_CASE` for gameplay constants.
- Keep gameplay/math helpers small and explicit.
- Prefer changing `three-game.ts` for active gameplay/rendering work unless intentionally touching the old Pixi path.
- Prefer deterministic startup generation and debug-friendly constants over hard-coded one-off map edits unless the change is explicitly about authored content.

## Direction Convention

Screen-direction language has been sanity-checked:

- default `N-up` view:
  - `+X = SE`
  - `-X = NW`
  - `+Y = SW`
  - `-Y = NE`
- `Tab` rotates `+90`
- `Shift+Tab` rotates `-90`

## Commit Guidance

Use short, imperative, outcome-focused commit messages, for example:

- `Add first working Three.js cube prototype`
- `Refine 3D occlusion and temporary orbit camera`
- `Add startup terrain generation and NPC activity culling`
