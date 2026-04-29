# Repository Guidelines

## Project Structure & Module Organization

This repo is an Electron + Vite + TypeScript desktop game prototype. The active renderer is **Three.js**. The older Pixi path is still in the repo as reference, but it is not the live runtime.

- `src/main/`: Electron main-process entry.
- `src/preload/`: preload bridge.
- `src/renderer/src/main.ts`: renderer bootstrap, HUD/debug UI, asset loading.
- `src/renderer/src/three-game.ts`: active game/runtime implementation.
- `src/renderer/src/game.ts`: older Pixi-based prototype/reference path.
- `src/renderer/src/style.css`: HUD/overlay styling.
- `src/renderer/editor.html`: map editor entry.
- `src/renderer/src/editor.ts`: canvas-based map editor.
- `src/renderer/src/editor.css`: map editor styling.
- `characters.png`: player/NPC sprite sheet.
- `Flowers/Flowers_With_Outline_Spritesheet.png`: flower prop sprite sheet used by the current runtime.

## Current Runtime Notes

- The first startup overworld keeps the fixed-seed default profile. Regenerated overworlds derive seed-stable world factors before terrain/spawn generation.
- Current regenerated world factors are:
  - actor population: flowers, humans, or flowers and humans
  - dominant block type: grass, stone, sand, or moss
  - terrain noise scale: broad, balanced, or tight
  - terrain relief: low, rolling, or sharp
- Terrain is generated from layered noise across a `168x144` map, with terraced heights usually in the `1..6` range and up to `7` for sharp regenerated worlds.
- Dominant block type is intended to be strongly dominant, not a light 50/50-style bias.
- Tile columns can mix materials per vertical layer; do not assume one material per stack.
- Opaque terrain is chunked and greedily merged. The nearby front-occlusion layer is still a separate dynamic instanced pass.
- Terrain readability currently uses top-edge bands with debug tuning for width, darken/lighten, and height tint.
- There is a small `hubWorld` map with a Worldsmith actor. Hitting the Worldsmith regenerates the overworld seed, teleport tile, world factors, terrain, and spawn mix.
- The player is a billboard sprite with logical tile-height collision, jump physics, and a local terrain-occlusion rule.
- NPCs are billboard sprites from `characters.png`, split into mobile, stationary, and sturdy sets. Regenerated worlds can intentionally suppress NPCs for flower-only worlds.
- Flower props are billboard sprites from `Flowers/Flowers_With_Outline_Spritesheet.png`, spawned by the map spawn config and treated similarly to stationary actors. Regenerated worlds can intentionally suppress flowers for human-only worlds.
- Actor updates and rendering are gated by an alive radius around the player.
- NPCs, flowers, and triggers can have proximity labels, with debug controls for label radius and font size.
- Fixed trigger volumes exist for markers/teleport labels and can show debug hitboxes.
- The current combat/input prototype supports directional attacks:
  - left click attacks toward the clicked screen direction
  - tapping `Shift` attacks in the current facing direction
  - attacks currently use a temporary visible hurtbox option, fixed-duration timing, simple knockback, and per-target single-hit tracking
- NPCs, flowers, and triggers can flash on touch or on attack. Sturdy NPCs do not use normal knockback.
- Collision is still gameplay/logical collision, not full 3D physics.
- Map teleporting uses a short player fade transition.
- A temporary free camera is enabled: `` ` `` toggles it, left mouse drag rotates/orbits the camera, and `Tab` / `Shift+Tab` still snap back to quarter-turn views.
- The renderer HUD includes a compass, FPS counter, lighting/shadow controls, terrain readability controls, actor-occlusion tuning controls, actor label controls, a trigger-hitbox toggle, and a hurtbox visibility toggle.
- Current caveat: actor ordering and actor-vs-terrain occlusion are still being tuned. Be careful when changing render order, sprite depth settings, proxy placement, or the player/front-terrain overlay path.

## Map Editor Notes

- `npm run editor` and `npm run dev:editor` launch the Electron map editor via `ISOGAME_TOOL=editor`.
- The editor is a separate canvas renderer, not the live Three.js runtime.
- The editor currently supports tile/material painting, height edits, teleport/object placement, local storage save, JSON import/export, and file import.
- Editor documents are JSON with `cells`, `teleports`, and `objects`; they are not yet wired into the runtime loader.

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

`Flowers/Flowers_With_Outline_Spritesheet.png` facts:

- arranged as `6x2`
- currently used as 12 random flower variants
- runtime flower scale is intentionally larger than source-pixel parity right now

## Build, Test, and Development Commands

- `npm run dev`: start the Electron app in development mode.
- `npm run editor`: start the Electron map editor in development mode.
- `npm run dev:editor`: alias for `npm run editor`.
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
- When touching actor rendering, try to keep player, NPC, flower, proxy, shadow, and front-terrain interactions in mind together; many bugs in this codepath come from fixing only one actor type.

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

- `Add startup terrain generation and NPC activity culling`
- `Greedy mesh terrain and stabilize occlusion layering`
- `Add flower props and prototype directional attacks`
