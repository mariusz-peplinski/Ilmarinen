# IsoGame Prototype

Desktop isometric prototype built with Electron, Vite, TypeScript, and Three.js.

## Controls

- `WASD` or arrow keys: move in screen-relative isometric directions
- `Space`: jump
- `Tab` / `Shift+Tab`: rotate the orthographic view in 90-degree steps
- `` ` ``: toggle debug free camera
- left mouse drag: orbit the free camera while debug free camera is enabled

## Current Runtime

- Terrain is generated on startup from layered noise over a `168x144` map.
- Tile heights are terraced and currently range from `1` to `6`.
- Terrain stacks can mix materials per layer instead of forcing one material for the whole column.
- The player uses a billboard sprite, logical tile-height collision, variable jump height, and a local terrain-occlusion pass.
- NPCs are split into a small set of slow wandering actors and a larger set of stationary actors.
- NPC processing and rendering are gated by an alive radius around the player that is intentionally larger than the visible camera footprint.
- A HUD, compass, lighting debug panel, free-camera toggle, and FPS counter are available in the renderer.

## Scripts

- `npm run dev`: launch the desktop game in development mode
- `npm run typecheck`: run TypeScript checks without emitting files
- `npm run build`: build the application bundles
- `npm run dist`: build a packaged desktop artifact

## Notes

- The active gameplay/runtime lives in `src/renderer/src/three-game.ts`.
- The older PixiJS path is still kept in the repo as reference, but Three.js is the active renderer.
- Terrain is still built as one mesh per exposed cube layer, so generated maps, shadows, and large actor counts are expected to be the next major optimization targets.
- `new-tileset.png` remains in the repo for future art integration once the gameplay/rendering foundations settle.
