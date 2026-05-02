# IsoGame Prototype

Desktop isometric action prototype built with Electron, Vite, TypeScript, Three.js, and a small WebSocket multiplayer server.

## Controls

- `WASD` or arrow keys: move in screen-relative isometric directions
- `Space`: jump
- left click: attack toward the clicked screen direction
- tap `Shift`: attack in the current facing direction
- `Tab` / `Shift+Tab`: rotate the orthographic view in 90-degree steps
- `` ` ``: toggle debug free camera
- left mouse drag: orbit the free camera while debug free camera is enabled

## Current Runtime

- The main overworld is generated from layered noise over a `168x144` map.
- The first startup overworld keeps the default fixed-seed profile; regenerated overworlds derive seed-stable world factors for actor population, dominant block type, terrain noise scale, and terrain relief.
- Regenerated terrain can be broad, balanced, or tight in noise scale, with low, rolling, or sharp relief. Heights are terraced and currently range from `1` to `7` depending on relief.
- Dominant block type is strongly biased per regenerated world across grass, stone, sand, or moss.
- Tile columns can mix materials per vertical layer.
- Opaque terrain is rendered from chunked merged meshes; the nearby front-occlusion layer is still a separate dynamic pass.
- A small hub world links back to the current overworld. Hitting the Worldsmith generates a new overworld seed, teleport tile, and world-factor profile.
- The player uses a billboard sprite, logical tile-height collision, variable jump height, and a local terrain-occlusion pass.
- NPCs use `characters.png` and include mobile, stationary, and sturdy variants. Regenerated overworlds can spawn flowers only, humans only, or both.
- Flower props use `Flowers/Flowers_With_Outline_Spritesheet.png` and are treated as billboard actors.
- NPCs, flowers, and triggers can show proximity labels. NPCs and flowers flash on touch or attack; attacks currently use a debug hurtbox, simple knockback, and per-target single-hit tracking.
- NPC, flower, trigger, and other non-player actor processing is gated by an alive radius around the player.
- The renderer includes a HUD, compass, FPS counter, and debug controls for lighting, shadows, terrain readability, actor-occlusion tuning, actor labels, trigger hitboxes, and hurtbox visibility.

## Multiplayer

- `npm run server` starts the WebSocket room server on `ws://localhost:8787`.
- Run the server in one terminal, then run one or more `npm run dev` clients and connect through the in-game Multiplayer panel.
- The server assigns player IDs, tracks connected players, owns the current overworld seed, teleport tile, crystal count, collected crystals, and world regeneration.
- Shared protocol types live in `src/shared/network-protocol.ts`.
- Shared deterministic world/actor helpers live in `src/shared/world-generation.ts`; the server uses them to build terrain support maps and authoritative actor manifests.
- The server owns shared actor simulation while clients are connected: attack hit detection, touch/attack flashes, knockback decay, terrain-aware actor movement, mobile NPC wandering, crystal pickup/spend flow, teleports, and world-regeneration broadcasts.
- Clients still simulate the local player immediately for responsive movement. Remote players are interpolated from network snapshots, and shared NPC/flower/crystal/trigger visuals are driven by server snapshots/events while connected.
- Current multiplayer is trusted co-op authority, not an anti-cheat architecture. Some intents are still detected locally and reported to the server, which owns the visible shared result.
- Current cleanup target: the renderer still has local terrain/spawn generation paths for rendering and offline play; more of that should move onto the shared generation module over time.

## Map Editor

- `npm run editor` or `npm run dev:editor`: launch the Electron map editor instead of the game.
- The editor supports tile/material painting, height edits, teleport/object placement, local save, JSON import/export, and file import.
- The editor is a canvas-based tool path under `src/renderer/editor.html`, `src/renderer/src/editor.ts`, and `src/renderer/src/editor.css`.

## Scripts

- `npm run dev`: launch the desktop game in development mode
- `npm run server`: launch the multiplayer WebSocket server
- `npm run editor`: launch the map editor in development mode
- `npm run dev:editor`: alias for `npm run editor`
- `npm run typecheck`: run TypeScript checks without emitting files
- `npm run build`: build the application bundles
- `npm run dist`: build a packaged desktop artifact

## Notes

- The active gameplay/runtime lives in `src/renderer/src/three-game.ts`.
- The browser-side multiplayer wrapper lives in `src/renderer/src/network/network-client.ts`.
- The multiplayer server lives in `src/server/index.ts`.
- Shared network protocol and world-generation code lives under `src/shared/`.
- The older PixiJS path is still kept in the repo as reference, but Three.js is the active renderer.
- Current rendering work is focused on actor ordering and actor-vs-terrain occlusion polish rather than terrain meshing itself.
- `new-tileset.png` remains in the repo for future art integration once the gameplay/rendering foundations settle.
