# IsoGame Prototype

Desktop isometric action prototype built with Electron, Vite, TypeScript, and Three.js.

## Controls

- `WASD` or arrow keys: move in screen-relative isometric directions
- `Space`: jump
- left click: attack toward the clicked screen direction
- tap `Shift`: attack in the current facing direction
- `Tab` / `Shift+Tab`: rotate the orthographic view in 90-degree steps
- `` ` ``: toggle debug free camera
- left mouse drag: orbit the free camera while debug free camera is enabled

## Current Runtime

- Terrain is generated on startup from layered noise over a `168x144` map.
- Heights are terraced and currently range from `1` to `6`.
- Tile columns can mix materials per vertical layer.
- Opaque terrain is rendered from chunked merged meshes; the nearby front-occlusion layer is still a separate dynamic pass.
- The player uses a billboard sprite, logical tile-height collision, variable jump height, and a local terrain-occlusion pass.
- NPCs are split into a small wandering group and a larger stationary group.
- Flower props are randomly sprinkled around the map from `Flowers/Flowers_With_Outline_Spritesheet.png`.
- NPCs and flowers can be touched and attacked; attacks currently use a visible debug hurtbox and simple knockback.
- NPC, flower, and other non-player actor processing is gated by an alive radius around the player.
- The renderer includes a HUD, compass, FPS counter, and debug controls for lighting, shadows, terrain readability, actor-occlusion tuning, and hurtbox visibility.

## Scripts

- `npm run dev`: launch the desktop game in development mode
- `npm run typecheck`: run TypeScript checks without emitting files
- `npm run build`: build the application bundles
- `npm run dist`: build a packaged desktop artifact

## Notes

- The active gameplay/runtime lives in `src/renderer/src/three-game.ts`.
- The older PixiJS path is still kept in the repo as reference, but Three.js is the active renderer.
- Current rendering work is focused on actor ordering and actor-vs-terrain occlusion polish rather than terrain meshing itself.
- `new-tileset.png` remains in the repo for future art integration once the gameplay/rendering foundations settle.
