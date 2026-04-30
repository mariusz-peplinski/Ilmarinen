# Multiplayer Plan

This is a practical plan for friendly online co-op with one player hosting a Node/WebSocket server. The design assumes trusted clients: the server coordinates shared state and rebroadcasts updates, but it does not need to be a hard anti-cheat authority.

## Target Experience

- Two players can join the same overworld/hub session over the internet or LAN.
- One player hosts a small Node server; both players run the Electron game as clients.
- The host controls the current world seed, teleport tile, world-factor profile, and shared interaction events.
- Each client sees the other player moving smoothly, facing, jumping, attacking, interacting, teleporting, and causing hit/flash animations.
- Crystals are a shared party inventory resource: any player can pick them up, and any player can spend them.
- World regeneration happens once on the host/server and every client rebuilds the same deterministic world from the same seed data.

## Recommended Architecture

- `src/shared/`: shared TypeScript types and pure helpers used by both client and server.
- `src/server/`: Node WebSocket server, built separately from the Electron renderer.
- `src/renderer/src/network/`: client connection, message handling, interpolation buffers, and local event publishing.
- `ThreeIsoGame`: remains the renderer/gameplay shell, but exposes controlled methods for applying network state and events.

Use the `ws` package for the first version. It is simple, works well in Node, and avoids bringing in a larger multiplayer framework before the protocol is understood.

## Server Model

The server keeps a lightweight room state:

- connected players: id, display name, map id, position, velocity, facing, grounded state, current animation/action
- current overworld seed and teleport tile
- current map id for each player
- shared inventory: current crystal balance
- shared actors: NPCs, flowers, crystals, and triggers with stable ids, names, map id, position, velocity/knockback, active flash timers, pickup state, and interaction flags
- short-lived events: attacks, plain interactions, hit flashes, knockback starts, trigger touches, crystal pickups/spends, teleport starts/finishes, screen effects, overworld regeneration

For trusted co-op, player movement can be client-authoritative:

1. Client simulates its own movement immediately.
2. Client sends position snapshots to the server at a fixed rate, for example 15-30 times per second.
3. Server stores the latest snapshot and rebroadcasts it to other clients.
4. Other clients render that player from an interpolation buffer.

The server should still own session-level state, because that prevents accidental desync:

- assigning player ids
- choosing/regenerating overworld seeds
- deriving/spawning actor ids and names from deterministic map generation
- announcing map transitions
- deciding/broadcasting shared actor interaction results
- deciding/broadcasting shared inventory changes
- ordering interaction events by server time
- sending initial room snapshots to late joiners

## Protocol Sketch

Every message should include a `type`. Most real-time messages should include `serverTime` or `clientTime`.

Client to server:

```ts
type ClientMessage =
  | { type: 'hello'; name: string; protocolVersion: number }
  | { type: 'playerSnapshot'; seq: number; clientTime: number; mapId: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean; facing: number }
  | { type: 'attack'; seq: number; clientTime: number; mapId: string; x: number; y: number; z: number; directionX: number; directionY: number; facing: number }
  | { type: 'interact'; seq: number; clientTime: number; mapId: string; x: number; y: number; z: number; directionX: number; directionY: number; facing: number }
  | { type: 'actorTouched'; clientTime: number; actorId: string; actorKind: 'npc' | 'flower' | 'trigger' }
  | { type: 'crystalPickedUp'; clientTime: number; actorId: string }
  | { type: 'teleport'; clientTime: number; targetMapId: string; targetX: number; targetY: number }
  | { type: 'regenerateOverworld'; clientTime: number };
```

Server to client:

```ts
type ServerMessage =
  | { type: 'welcome'; playerId: string; serverTime: number; world: NetworkWorldState; players: NetworkPlayerState[]; actors: NetworkActorState[] }
  | { type: 'playerJoined'; serverTime: number; player: NetworkPlayerState }
  | { type: 'playerLeft'; serverTime: number; playerId: string }
  | { type: 'playerSnapshot'; serverTime: number; player: NetworkPlayerState }
  | { type: 'attack'; serverTime: number; playerId: string; event: NetworkAttackEvent }
  | { type: 'interact'; serverTime: number; playerId: string; event: NetworkInteractionEvent }
  | { type: 'actorSnapshot'; serverTime: number; actor: NetworkActorState }
  | { type: 'actorEvent'; serverTime: number; actorId: string; event: NetworkActorEvent }
  | { type: 'inventoryChanged'; serverTime: number; crystalCount: number }
  | { type: 'screenEffect'; serverTime: number; effect: NetworkScreenEffectEvent }
  | { type: 'worldChanged'; serverTime: number; world: NetworkWorldState }
  | { type: 'teleport'; serverTime: number; playerId: string; mapId: string; x: number; y: number };
```

`NetworkWorldState` can initially be tiny:

```ts
interface NetworkWorldState {
  overworldSeed: number;
  overworldTeleportTile: { x: number; y: number };
  crystalCount: number;
}
```

The client can derive world factors, terrain, and spawn layout from this, once the generation code is moved into shared pure helpers.

Shared actors should have a compact state shape:

```ts
interface NetworkActorState {
  id: string;
  kind: 'npc-mobile' | 'npc-stationary' | 'npc-sturdy' | 'flower' | 'crystal' | 'trigger';
  mapId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  facing?: number;
  displayName: string | null;
  variant?: number;
  collected?: boolean;
  touchFlashUntil?: number;
  attackFlashUntil?: number;
}

type NetworkActorEvent =
  | { type: 'touchFlash' }
  | { type: 'attackFlash'; knockbackX?: number; knockbackY?: number }
  | { type: 'pickedUp'; playerId: string }
  | { type: 'triggerActivated' };
```

Plain interaction is separate from attack. It uses the same directional box rules as attack, but is triggered by `E`, has its own short interaction event, and routes to plain interaction callbacks such as Worldsmith regeneration. The server should treat attack and interaction as separate event types because they can drive different callbacks on the same actor.

Crystals are the first shared inventory item. The server owns the shared crystal balance, accepts one pickup/spend once, and broadcasts the resulting `inventoryChanged` count to every client. Crystal pickups should have stable actor ids and collected state so late joiners do not see already-collected crystals.

Screen effects should be explicit network events, not hidden side effects of other messages:

```ts
type ScreenEffectAudience =
  | { type: 'localOnly' }
  | { type: 'player'; playerId: string }
  | { type: 'map'; mapId: string }
  | { type: 'room' };

type NetworkScreenEffectEvent =
  | { type: 'flash'; color: string; duration: number; maxOpacity: number; audience: ScreenEffectAudience }
  | { type: 'shake'; strength: number; duration: number; frequency?: number; audience: ScreenEffectAudience };
```

## Screen Effect Synchronization

Full-screen effects must carry broadcast rules because they are player-perception feedback, not always shared world state.

- Teleport white flash: local to the player being teleported. It should play for that client only and should not be broadcast to the whole room.
- Worldsmith/world-generation screen shake: shared with players on the same map as the event source, currently the hub. The server should broadcast it to clients whose player state says `mapId === 'hubWorld'`, not to players in other maps.
- Future map-local events: use the same map-scoped audience rule, even when multiple generated worlds exist at once.
- Truly global events: only use room-wide broadcast when the effect represents something every connected player should feel regardless of map.

Do not infer these rules from the effect type alone. Each effect trigger should choose an audience explicitly, so future effects can reuse flash/shake primitives with different sharing behavior.

## Client Movement Smoothing

Local player:

- simulate immediately from local input
- send snapshots regularly
- no need for rollback/prediction correction in the first trusted version

Remote players:

- keep a timestamped buffer of received snapshots
- render remote players slightly in the past, for example 100 ms
- interpolate `x/y/z`, velocity, grounded state, facing direction, and animation frame
- if the newest snapshot is too old, extrapolate gently for a short cap, for example 150 ms
- if the gap is huge, snap to the latest position

This is enough to hide normal ping and jitter without turning the whole game into a server-authoritative simulation.

## World And Actor Synchronization

The playable target must synchronize all visible shared actors:

- player positions and facing
- attack start events
- plain interaction start events
- NPC/flower/crystal/trigger ids and display names
- NPC/flower/crystal/trigger positions
- NPC/flower knockback
- crystal pickup state
- shared crystal inventory count
- touch flashes caused by any player colliding with an actor
- attack flashes caused by any player hitting an actor
- screen effects whose audience includes the local player
- map teleport events
- overworld regeneration events

Actors should not remain client-local for real co-op. The server should create the actor list from deterministic generation, then send the exact ids, names, variants, and initial positions to every client. Clients render actors from server state.

For friendly trusted co-op, clients can still help with interaction detection:

1. A client detects "I touched actor X", "I picked up crystal X", "I interacted with actor X", or "my attack hit actor X".
2. The client sends the actor id and event to the server.
3. The server trusts it, updates actor flash/knockback/pickup state or shared inventory state, and broadcasts the result.
4. Every client plays the same flash, knockback, pickup disappearance, trigger interaction, or inventory update.

This keeps implementation simpler than fully server-authoritative collision while still making all visible results shared.

Mobile NPC wandering should be server-driven. The server can tick simple NPC movement at a low fixed rate, for example 10-20 Hz, and broadcast actor snapshots. Clients interpolate NPC/flower positions the same way they interpolate remote players.

## Required Refactors

1. Extract shared types:
   - `MapId`, `Vec2`, world seed/teleport state, player network state, attack event state.

2. Extract deterministic world generation:
   - move pure generation helpers out of `three-game.ts` into `src/shared/world-generation.ts`
   - keep rendering-specific terrain mesh code in `three-game.ts`
   - make sure the server and renderer can both derive the same world-factor profile from the same seed
   - make actor spawning deterministic and serializable, including stable actor ids, names, flower variants, NPC kinds, and trigger ids

3. Split actor logic from actor rendering:
   - separate NPC/flower/trigger state data from Three sprite/proxy/shadow objects
   - add methods to create/update/remove actor render objects from `NetworkActorState`
   - let server snapshots/events drive shared actor movement, names, flashes, and knockback

4. Add remote player rendering:
   - create a second actor path for remote player sprites, shadows, depth proxies, and labels
   - reuse the player sprite sheet and facing animation code
   - do not run collision/jump physics for remote players; their state comes from snapshots

5. Add client networking:
   - connect/disconnect UI or simple debug inputs
   - `NetworkClient` class wrapping WebSocket
   - outbound snapshot ticker
   - inbound message dispatch into `ThreeIsoGame`
   - interpolation buffer per remote player
   - interpolation buffer per shared moving actor

6. Add server:
   - `src/server/index.ts`
   - `npm run server`
   - WebSocket room state
   - hello/welcome flow
   - player snapshot rebroadcast
   - shared actor spawn/snapshot/event rebroadcast
   - world regeneration broadcast

7. Add host flow:
   - easiest first version: host runs `npm run server`, then both players type/connect to `ws://host-ip:PORT`
   - later version: Electron main process can launch an embedded server for "Host Game"

## Implementation Phases

### Phase 0: Shared Protocol Skeleton

- Add `ws` dependency and server build/dev script.
- Add shared network message types.
- Add a minimal server that accepts connections, assigns player ids, and broadcasts joins/leaves.
- Add renderer-side `NetworkClient` that can connect and log messages.

Result: clients can join the same room, but gameplay is not synchronized yet.

### Phase 1: Remote Players

- Add remote player sprite/depth/shadow rendering.
- Send local player snapshots 20 times per second.
- Interpolate remote snapshots in the renderer.
- Show remote names/ids as actor labels.

Result: two players can see each other move around smoothly.

### Phase 2: Shared World And Actor Spawn

- Server sends current overworld seed and teleport tile on join.
- Server sends the current shared crystal balance on join.
- Client rebuilds overworld from server world state.
- Server sends the full shared actor list for the player's current world: NPCs, flowers, crystals, and triggers.
- Actor ids, names, flower variants, NPC kinds, crystal collected flags, trigger ids, and initial positions match for everyone.
- Server handles `regenerateOverworld` and broadcasts `worldChanged`.
- Teleport events are broadcast so both clients agree which map each player is on.

Result: both players are in the same generated world, see the same actors, and survive regeneration/teleports.

### Phase 3: Shared Actor Motion And Interactions

- Broadcast attack start events.
- Broadcast plain interaction start events from `E`.
- Render remote attack animations/hurtboxes.
- Render remote interaction hints/hitboxes if debug visualization is enabled.
- Server ticks mobile NPC wandering and broadcasts actor snapshots.
- Broadcast touch flashes for NPCs, flowers, and triggers when any player collides with them.
- Broadcast hit flashes and knockback for NPCs and flowers when any player attacks them.
- Broadcast crystal pickups and the updated shared crystal balance.
- Decide how to handle Worldsmith interactions: server should accept the regenerate request once, spend one shared crystal if available, and broadcast the new world state plus updated crystal balance.

Result: players see the same actor positions, names, flashes, knockback, crystal inventory, pickups, and interaction feedback.

### Phase 4: Polish Actor Authority

- Move any remaining client-only actor state behind server messages.
- Add periodic full actor-state resyncs to recover from packet loss or reconnects.
- Add server-side dedupe for repeated touch/hit messages so one attack does not spam the same flash.
- Keep trusting clients for hit claims, but make the server the only broadcaster of final shared actor results.

Result: everyone sees the same actors in the same positions.

### Phase 5: Usability

- Add a small connection panel: host, join, address, name, status.
- Add reconnect handling.
- Add friendly errors for server unavailable/protocol mismatch.
- Add LAN defaults and a clear port.

Result: playable with friends without terminal juggling.

## Risks And Decisions

- Hosting over the internet still needs port forwarding, VPN, or relay unless both players are on LAN. A relay can come later.
- Deterministic generation is helpful, but runtime actor AI must become server-driven or it will desync.
- Trusted client movement keeps the first implementation simple, but the server should still own world-changing events.
- Trusted client interaction claims keep combat simple, but the server should still own final actor state, flashes, and knockback broadcasts.
- Electron renderer cannot host a listening WebSocket server by itself; hosting should happen in Node, either as a separate process or in Electron main.
- The current `ThreeIsoGame` class is large and private-state-heavy, so adding a narrow network facade will be easier than rewriting it all at once.

## First Concrete Milestone

The best first PR-sized milestone:

1. Add `src/shared/network-types.ts`.
2. Add `src/server/index.ts` with `ws`.
3. Add `npm run server`.
4. Add `NetworkClient` in the renderer.
5. Add temporary connect code using hard-coded `ws://localhost:7777`.
6. Render one remote player from incoming snapshots.
7. Server sends a shared actor list with stable ids/names, and the client renders those actors from network state.

That milestone gives a visible multiplayer loop with the important invariant already in place: both players see the same actors with the same names.
