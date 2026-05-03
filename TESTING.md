# Testing Strategy

This project is an Electron + Vite + TypeScript desktop game prototype with an active Three.js renderer, a WebSocket multiplayer server, and shared deterministic world generation. The testing strategy should protect the deterministic and networked parts first, then add focused renderer smoke tests and a small amount of visual regression coverage.

The goal is not to automate every frame of the game. The goal is to catch regressions in world generation, gameplay rules, multiplayer state ownership, and app boot/render health while keeping manual playtesting for feel, readability, and tuning.

## Testing Priorities

1. Test shared deterministic logic first.
2. Extract and test server simulation without WebSockets.
3. Pull pure gameplay math out of the renderer when behavior needs coverage.
4. Add Electron/WebGL smoke tests through a small test bridge.
5. Add targeted fixed-seed visual regression tests only where screenshots are stable.
6. Keep a short manual playtest checklist for feel and rendering judgment.

## Recommended Tooling

Add Vitest for fast TypeScript unit and integration tests:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

The repo should keep Vitest discovery scoped to this project's source tree through `vitest.config.ts`, so unrelated folders in the workspace are not collected.

Recommended dev dependencies:

```sh
npm install -D vitest @vitest/coverage-v8
```

Later, add Playwright when renderer and multiplayer smoke tests are ready:

```sh
npm install -D @playwright/test
```

Keep `npm run typecheck` and `npm run build` as required pre-commit checks for rendering/gameplay work.

## Unit Tests

Unit tests should focus on deterministic pure logic. These should be fast, run in Node, and avoid Electron, DOM, canvas, or WebGL.

### Shared World Generation

Primary file:

- `src/shared/world-generation.ts`

Suggested test file:

- `src/shared/world-generation.test.ts`

Test cases:

- Same seed produces the same map dimensions, terrain heights, teleport tile, actor manifest, crystal IDs, and world factors.
- Different regenerated seeds usually produce different world factors and terrain signatures.
- Startup overworld keeps the fixed-seed default profile.
- Regenerated overworld factors always stay within allowed values:
  - actor population: `flowers`, `humans`, `mixed`
  - dominant block type: `grass`, `stone`, `sand`, `moss`
  - terrain noise scale: `broad`, `balanced`, `tight`
  - terrain relief: `low`, `rolling`, `sharp`
- Dominant block type is strongly dominant across generated terrain, not just a weak 50/50-style bias.
- Terrain heights stay within expected ranges for each relief profile.
- Support heights are valid for every tile and never read outside the map.
- Teleport tiles are within map bounds and have a walkable neighbor.
- Tile columns may contain mixed materials by vertical layer; tests should not assume one material per stack.
- Actor IDs are unique and stable for a fixed seed.
- Flower-only worlds spawn no NPC humans.
- Human-only worlds spawn no flowers.
- Mixed worlds can spawn both flowers and humans.
- Crystal count and collected crystal state initialize consistently.
- Hub world generation correctly references the current overworld seed and teleport tile.

Implementation notes:

- Prefer snapshot-like compact signatures over full map snapshots. For example, hash height arrays, material counts, actor IDs, and teleport coordinates.
- Avoid brittle assertions against every generated tile unless the test is specifically guarding a golden seed.
- Keep a few named golden seeds for regressions around cliffs, teleport placement, actor population suppression, and dominant material bias.

### Network Protocol

Primary file:

- `src/shared/network-protocol.ts`

Suggested test file:

- `src/shared/network-protocol.test.ts`

Test cases:

- Valid client messages pass `isClientMessage`.
- Missing `type`, non-object payloads, null, arrays, and malformed JSON-shaped objects fail.
- Unknown message types fail.
- Required fields for important message types are validated where the current guard supports it.
- Protocol version behavior is explicit for `hello` or connection setup messages.

Implementation note:

- If `isClientMessage` currently only validates the shape shallowly, either test that current behavior honestly or tighten the guard before relying on it for security or correctness.

## Server Simulation Tests

The multiplayer server owns shared world state while connected. To test this cleanly, gradually extract room/gameplay state from `src/server/index.ts` into a pure or mostly pure module.

Suggested module:

- `src/server/room-simulation.ts`

Suggested test file:

- `src/server/room-simulation.test.ts`

The extracted module should be usable without opening a WebSocket port. It should accept commands/intents and return state changes plus outbound events/messages.

Test cases:

- Player join creates a unique player ID and returns current world state.
- Player leave removes the player and broadcasts removal.
- Player snapshots update server player state.
- Remote player snapshots can be produced from stored state.
- World regeneration updates:
  - overworld seed
  - overworld teleport tile
  - world factors
  - actor manifest
  - terrain support maps
  - crystal state
- Regeneration broadcasts the same world state to every connected client.
- Attacks apply to shared actors once per target per attack.
- Attack results produce consistent flash, knockback, harvest, smash, or damage events.
- Sturdy NPCs do not use normal knockback.
- Touch and interact events produce server-owned visible shared results.
- Crystal pickup can only be applied once per crystal ID.
- Crystal spending cannot underflow.
- Teleport messages update the correct map and player position.
- Mobile NPC wandering avoids cliff drops and steep climbs.
- Knockback decay respects terrain support and blocked cells.
- Shared actors do not continue independent client-side simulation while connected.

Implementation notes:

- Use deterministic fake clocks or explicit `tick(deltaMs)` calls.
- Keep random behavior seeded.
- Return outbound messages from simulation methods instead of sending them directly inside the simulation layer.
- Keep WebSocket parsing, connection lifecycle, and interval timers in the thin server entrypoint.

## WebSocket Integration Tests

After room simulation is extracted, add a smaller number of integration tests for the actual server transport.

Suggested test file:

- `src/server/server.integration.test.ts`

Test cases:

- Server starts on an ephemeral port.
- One client connects and receives `welcome` plus world state.
- Two clients connect and receive each other's player snapshots.
- Client A attacks a shared actor and both clients receive the same actor event.
- Client A picks up a crystal and both clients see the shared crystal state update.
- Client A regenerates the overworld and all clients receive the same seed, teleport tile, factors, and actor manifest.
- Malformed messages do not crash the server.

Implementation notes:

- Prefer using the `ws` client directly for these tests.
- Start the server in-process if possible.
- If the current server entrypoint starts immediately on import, refactor to export a `createServer` or `startServer` helper.

## Renderer Gameplay Tests

The active renderer lives in `src/renderer/src/three-game.ts`, which is large, visual, and stateful. Avoid trying to unit-test the whole class directly. Instead, extract pure helpers as behavior stabilizes.

Good extraction candidates:

- `src/shared/direction.ts`
- `src/shared/combat.ts`
- `src/shared/terrain-collision.ts`
- `src/shared/actor-visibility.ts`
- `src/shared/actor-spawn.ts`

Test cases:

- Direction convention:
  - default `N-up`: `+X = SE`, `-X = NW`, `+Y = SW`, `-Y = NE`
  - `Tab` rotates `+90`
  - `Shift+Tab` rotates `-90`
- Click attack direction is derived from screen-space click vector.
- `Shift` attack uses current facing direction.
- Attack hurtbox includes intended targets and excludes nearby non-targets.
- Each target can only be hit once per attack.
- Jump and collision logic respect logical tile height.
- Movement allows reasonable step-ups and rejects steep climbs.
- Actor alive-radius gating includes nearby actors and excludes distant actors.
- Terrain occlusion decisions are stable for player, NPC, flowers, proxy, shadow, and front-terrain overlay cases.
- Label visibility follows radius and debug font settings.

Implementation notes:

- Any helper moved from `three-game.ts` should stay deterministic and independent from Three.js where possible.
- Keep renderer-specific object creation in the renderer. Test math and decisions, not Three.js object internals.

## Electron And WebGL Smoke Tests

Renderer smoke tests should verify that the actual app boots and renders, without trying to assert every visual detail.

Use Playwright or an Electron-compatible Playwright setup once the app has a stable test entry.

Recommended test bridge:

```ts
declare global {
  interface Window {
    __isogameTest?: {
      getState: () => unknown
      setSeed: (seed: number) => void
      tick: (deltaMs: number) => void
      teleport: (mapId: string, x: number, y: number) => void
      getCanvasPixelStats: () => {
        width: number
        height: number
        nonTransparentPixels: number
        uniqueColorEstimate: number
      }
    }
  }
}
```

Expose this only in development or test mode, for example behind `import.meta.env.DEV` or a dedicated test flag.

Smoke test cases:

- App boots without console errors.
- Main canvas exists and has nonblank pixels.
- Startup overworld loads with the expected fixed seed.
- Player render state exists.
- Character and flower textures load.
- `Tab` and `Shift+Tab` rotate camera orientation.
- Backtick toggles free camera.
- Left click creates an attack state or server attack intent.
- `Shift` creates a facing-direction attack.
- Worldsmith interaction regenerates overworld seed, teleport tile, world factors, terrain, and spawn mix.
- Teleport fade reaches completion and lands on the target map.
- Multiplayer HUD can connect and disconnect from a local server.

Implementation notes:

- Prefer stable state assertions through `window.__isogameTest` over fragile DOM text checks.
- Use fixed viewport sizes and fixed seeds.
- Disable or control animation time during tests where possible.
- Capture console errors and fail on unexpected ones.

## Visual Regression Tests

Use visual regression sparingly. WebGL screenshots can be noisy, especially with shadows, antialiasing, animation, and GPU differences.

Good candidates:

- Startup overworld at fixed seed, fixed camera angle, fixed viewport.
- Hub world at fixed seed, fixed camera angle, fixed viewport.
- Player partially occluded by front terrain.
- NPC/flower billboard visibility behind and in front of terrain.
- Terrain top-edge readability at a few debug presets.
- Trigger hitbox debug overlay enabled.
- Hurtbox visibility enabled during an attack.

Implementation notes:

- Freeze time before screenshot capture.
- Use deterministic seed and camera orientation.
- Prefer a small number of high-value golden screenshots.
- Set a reasonable diff threshold.
- Do not block routine gameplay iteration on noisy cosmetic diffs unless the area is intentionally under visual lock.

## Manual Playtest Checklist

Some qualities are better judged by playing the game than by tests.

Run this checklist before merging substantial rendering, terrain, camera, combat, or multiplayer changes:

- App boots cleanly in `npm run dev`.
- Startup overworld feels readable.
- Regenerated worlds show meaningful variety.
- Dominant terrain material is visually obvious.
- Player movement feels responsive.
- Jumping and height collision feel fair.
- Camera quarter-turns match direction convention.
- Free camera toggle and drag controls work.
- Player, NPCs, flowers, proxies, shadows, and front terrain layer correctly in common cases.
- Labels appear at useful distances without cluttering the screen.
- Attacks read clearly in clicked direction and facing direction.
- Touch, attack, and sturdy NPC reactions are understandable.
- Teleport fade feels smooth.
- Worldsmith regeneration is clear and does not leave stale actors or terrain.
- Multiplayer connect/disconnect works.
- Two clients see the same shared actors, crystals, teleports, and regenerated world.

## Continuous Checks

Recommended local checks before committing rendering or gameplay work:

```sh
npm run typecheck
npm run test
npm run build
```

If renderer smoke tests are added:

```sh
npm run test:e2e
```

For multiplayer work, also run a manual or automated two-client check with:

```sh
npm run server
npm run dev
```

## Suggested Rollout

### Phase 1: Foundation

- Add Vitest and test scripts.
- Add tests for `src/shared/world-generation.ts`.
- Add tests for `src/shared/network-protocol.ts`.
- Keep all tests Node-only and fast.

### Phase 2: Server Ownership

- Extract room simulation from `src/server/index.ts`.
- Add deterministic server simulation tests.
- Add small WebSocket integration tests.

### Phase 3: Gameplay Helper Extraction

- Extract direction, combat, collision, and visibility helpers only as needed.
- Add focused tests for each extracted helper.
- Avoid renderer-wide unit tests.

### Phase 4: Renderer Smoke

- Add a development/test-only renderer test bridge.
- Add Electron/WebGL boot tests.
- Add canvas nonblank pixel checks.
- Add a few interaction smoke tests.

### Phase 5: Visual Regression

- Add fixed-seed screenshots for the smallest stable set of high-risk views.
- Keep visual baselines intentional and reviewed.

## What Not To Test Heavily

Avoid deep automated tests for:

- Exact animation frame-by-frame output.
- Every Three.js object property.
- Full-map pixel-perfect screenshots for every seed.
- Manual tuning values that are expected to change often.
- The old Pixi prototype path unless it becomes active again.

Instead, test the deterministic decisions that produce those visuals and use smoke/manual testing for the final rendered experience.
