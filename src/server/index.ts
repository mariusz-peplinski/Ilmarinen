import { WebSocket, WebSocketServer } from 'ws';
import {
  NETWORK_PROTOCOL_VERSION,
  type ClientMessage,
  type MapId,
  type NetworkActorState,
  type NetworkPlayerState,
  type NetworkWorldState,
  type ServerMessage,
  isClientMessage
} from '../shared/network-protocol';
import {
  DEFAULT_BLOCK_HEIGHT_SCALE,
  type GeneratedMap,
  INITIAL_CRYSTAL_COUNT,
  MAP_GENERATION_SEED,
  OVERWORLD_SPAWN,
  OVERWORLD_TELEPORT_TILE,
  createNetworkWorldActors,
  createNetworkWorldMaps,
  getGeneratedMapSupportHeight,
  getRandomOverworldTeleportTile
} from '../shared/world-generation';

const DEFAULT_PORT = 8787;
const PLAYER_COLLISION_RADIUS = 0.2;
const MAP_EDGE_PADDING = 0.02;
const SERVER_STEP_HEIGHT = 0.2 * DEFAULT_BLOCK_HEIGHT_SCALE;
const NPC_COLLISION_RADIUS = 0.18;
const FLOWER_COLLISION_RADIUS = 0.17;
const NPC_BODY_HEIGHT = 1.1;
const FLOWER_BODY_HEIGHT = 0.72;
const TRIGGER_RADIUS = 0.7;
const TRIGGER_HEIGHT = 1.2;
const ATTACK_FLASH_TIME = 240;
const TOUCH_FLASH_TIME = 180;
const KNOCKBACK_DECAY = 10;
const KNOCKBACK_STOP_SPEED = 0.08;
const NPC_WANDER_SPEED = 0.48;
const NPC_MOVE_MIN_TIME = 1400;
const NPC_MOVE_MAX_TIME = 3400;
const NPC_IDLE_MIN_TIME = 900;
const NPC_IDLE_MAX_TIME = 2800;
const ACTOR_TICK_MS = 50;

interface ClientConnection {
  socket: WebSocket;
  playerId: string | null;
}

interface ActorSimulationState {
  moveAngle: number;
  moveTimer: number;
  idleTimer: number;
}

const port = Number(process.env.ISOGAME_SERVER_PORT ?? DEFAULT_PORT);
const wss = new WebSocketServer({ port });
const clients = new Set<ClientConnection>();
const players = new Map<string, NetworkPlayerState>();
const actorStates = new Map<string, NetworkActorState>();
const actorSimulationStates = new Map<string, ActorSimulationState>();
let generatedMaps = createNetworkWorldMaps(MAP_GENERATION_SEED, OVERWORLD_TELEPORT_TILE);
let nextPlayerNumber = 1;
let world: NetworkWorldState = {
  overworldSeed: MAP_GENERATION_SEED,
  overworldTeleportTile: { ...OVERWORLD_TELEPORT_TILE },
  crystalCount: INITIAL_CRYSTAL_COUNT,
  collectedCrystalIds: [],
  hostPlayerId: null
};
const collectedCrystalIds = new Set<string>();

const now = (): number => Date.now();

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seed: number): () => number => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const lerp = (start: number, end: number, t: number): number => start + (end - start) * t;

const send = (connection: ClientConnection, message: ServerMessage): void => {
  if (connection.socket.readyState === WebSocket.OPEN) {
    connection.socket.send(JSON.stringify(message));
  }
};

const broadcast = (
  message: ServerMessage,
  except: ClientConnection | null = null
): void => {
  for (const connection of clients) {
    if (connection !== except) {
      send(connection, message);
    }
  }
};

const createPlayer = (id: string, displayName: string): NetworkPlayerState => ({
  id,
  displayName,
  mapId: 'overworld',
  x: OVERWORLD_SPAWN.x,
  y: OVERWORLD_SPAWN.y,
  z: 1,
  vx: 0,
  vy: 0,
  vz: 0,
  grounded: true,
  facing: 4,
  seq: 0
});

const parseClientMessage = (data: WebSocket.RawData): ClientMessage | null => {
  try {
    const parsed: unknown = JSON.parse(data.toString());
    return isClientMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const handleHello = (
  connection: ClientConnection,
  message: Extract<ClientMessage, { type: 'hello' }>
): void => {
  if (connection.playerId) {
    return;
  }

  if (message.protocolVersion !== NETWORK_PROTOCOL_VERSION) {
    connection.socket.close(1002, 'Protocol version mismatch');
    return;
  }

  const playerId = `player-${nextPlayerNumber}`;
  nextPlayerNumber += 1;
  const displayName = message.name.trim().slice(0, 24) || playerId;
  const player = createPlayer(playerId, displayName);

  connection.playerId = playerId;
  players.set(playerId, player);
  if (!world.hostPlayerId) {
    setHostPlayerId(playerId);
  }

  send(connection, {
    type: 'welcome',
    playerId,
    serverTime: now(),
    world,
    players: [...players.values()],
    actors: [...actorStates.values()]
  });
  broadcast({ type: 'playerJoined', serverTime: now(), player }, connection);
  broadcast({ type: 'worldChanged', serverTime: now(), world }, connection);
  console.log(`${playerId} connected as ${displayName}`);
};

const refreshCollectedCrystalIds = (): void => {
  world = {
    ...world,
    collectedCrystalIds: [...collectedCrystalIds]
  };
};

const broadcastInventory = (): void => {
  broadcast({ type: 'inventoryChanged', serverTime: now(), crystalCount: world.crystalCount });
};

const setHostPlayerId = (playerId: string | null): void => {
  world = {
    ...world,
    hostPlayerId: playerId
  };
};

const broadcastMapScreenEffect = (
  mapId: MapId,
  effect: Extract<ServerMessage, { type: 'screenEffect' }>['effect']
): void => {
  for (const connection of clients) {
    const playerId = connection.playerId;
    if (!playerId) {
      continue;
    }

    const player = players.get(playerId);
    if (player?.mapId === mapId) {
      send(connection, { type: 'screenEffect', serverTime: now(), effect });
    }
  }
};

const getActorSimulationState = (actor: NetworkActorState): ActorSimulationState => {
  const existing = actorSimulationStates.get(actor.id);
  if (existing) {
    return existing;
  }

  const random = createSeededRandom(hashString(actor.id));
  const state = {
    moveAngle: random() * Math.PI * 2,
    moveTimer: lerp(NPC_MOVE_MIN_TIME, NPC_MOVE_MAX_TIME, random()),
    idleTimer: lerp(NPC_IDLE_MIN_TIME, NPC_IDLE_MAX_TIME, random())
  };
  actorSimulationStates.set(actor.id, state);
  return state;
};

const getActorCollisionShape = (
  actor: NetworkActorState
): { radius: number; height: number; knockbackScale: number; knockbackable: boolean } => {
  switch (actor.kind) {
    case 'flower':
      return { radius: FLOWER_COLLISION_RADIUS, height: FLOWER_BODY_HEIGHT, knockbackScale: 0.8, knockbackable: true };
    case 'trigger':
      return { radius: TRIGGER_RADIUS, height: TRIGGER_HEIGHT, knockbackScale: 0, knockbackable: false };
    case 'npc-sturdy':
      return { radius: NPC_COLLISION_RADIUS, height: NPC_BODY_HEIGHT, knockbackScale: 0, knockbackable: false };
    case 'npc-mobile':
    case 'npc-stationary':
      return { radius: NPC_COLLISION_RADIUS, height: NPC_BODY_HEIGHT, knockbackScale: 1, knockbackable: true };
    case 'crystal':
      return { radius: 0, height: 0, knockbackScale: 0, knockbackable: false };
  }
};

const isActorInsideActionBox = (
  actor: NetworkActorState,
  event: Extract<ClientMessage, { type: 'attack' | 'interact' }>,
  profile: { reach: number; width: number; height: number }
): boolean => {
  const shape = getActorCollisionShape(actor);
  if (shape.radius <= 0 || actor.mapId !== event.mapId || actor.collected) {
    return false;
  }

  const centerOffset = PLAYER_COLLISION_RADIUS + profile.reach * 0.5;
  const centerX = event.x + event.directionX * centerOffset;
  const centerY = event.y + event.directionY * centerOffset;
  const sideX = -event.directionY;
  const sideY = event.directionX;
  const deltaX = actor.x - centerX;
  const deltaY = actor.y - centerY;
  const localForward = deltaX * event.directionX + deltaY * event.directionY;
  const localSide = deltaX * sideX + deltaY * sideY;
  const halfReach = profile.reach * 0.5 + shape.radius;
  const halfWidth = profile.width * 0.5 + shape.radius;

  if (Math.abs(localForward) > halfReach || Math.abs(localSide) > halfWidth) {
    return false;
  }

  const actionBottom = event.z;
  const actionTop = actionBottom + profile.height;
  const actorTop = actor.z + shape.height;
  return actor.z <= actionTop && actorTop >= actionBottom;
};

const applyAttackToActors = (
  playerId: string,
  event: Extract<ClientMessage, { type: 'attack' }>
): void => {
  const attackProfile = {
    reach: 0.95,
    width: 0.9,
    height: 1.2,
    knockback: 18.4
  };
  const flashUntil = now() + ATTACK_FLASH_TIME;

  for (const actor of actorStates.values()) {
    if (!isActorInsideActionBox(actor, event, attackProfile)) {
      continue;
    }

    const shape = getActorCollisionShape(actor);
    const knockbackX = shape.knockbackable
      ? event.directionX * attackProfile.knockback * shape.knockbackScale
      : 0;
    const knockbackY = shape.knockbackable
      ? event.directionY * attackProfile.knockback * shape.knockbackScale
      : 0;

    actor.attackFlashUntil = flashUntil;
    actor.vx = knockbackX;
    actor.vy = knockbackY;
    actorStates.set(actor.id, actor);
    broadcast({
      type: 'actorEvent',
      serverTime: now(),
      actorId: actor.id,
      event: { type: 'attackFlash', knockbackX, knockbackY }
    });
  }

  broadcast({ type: 'attack', serverTime: now(), playerId, event });
};

const applyInteractToActors = (
  playerId: string,
  event: Extract<ClientMessage, { type: 'interact' }>
): void => {
  const interactionProfile = {
    reach: 0.95,
    width: 0.9,
    height: 1.2
  };

  for (const actor of actorStates.values()) {
    if (!isActorInsideActionBox(actor, event, interactionProfile)) {
      continue;
    }

    actor.touchFlashUntil = now() + TOUCH_FLASH_TIME;
    actorStates.set(actor.id, actor);
    broadcast({
      type: 'actorEvent',
      serverTime: now(),
      actorId: actor.id,
      event: { type: 'touchFlash' }
    });
    break;
  }

  broadcast({ type: 'interact', serverTime: now(), playerId, event });
};

const broadcastActorSnapshot = (actor: NetworkActorState): void => {
  broadcast({ type: 'actorSnapshot', serverTime: now(), actor });
};

const getActorMap = (actor: NetworkActorState): GeneratedMap | null =>
  generatedMaps[actor.mapId] ?? null;

const isTerrainColliding = (
  map: GeneratedMap,
  x: number,
  y: number,
  footZ: number,
  radius: number
): boolean => {
  const r = radius;
  const probePoints = [
    { x, y },
    { x: x + r, y },
    { x: x - r, y },
    { x, y: y + r },
    { x, y: y - r },
    { x: x + r * 0.7071, y: y + r * 0.7071 },
    { x: x - r * 0.7071, y: y + r * 0.7071 },
    { x: x + r * 0.7071, y: y - r * 0.7071 },
    { x: x - r * 0.7071, y: y - r * 0.7071 }
  ];

  return probePoints.some((point) => getGeneratedMapSupportHeight(map, point.x, point.y) > footZ + 0.02);
};

const tryMoveGroundActor = (
  actor: NetworkActorState,
  deltaX: number,
  deltaY: number,
  radius: number,
  allowDropOff: boolean
): boolean => {
  const map = getActorMap(actor);
  if (!map) {
    return false;
  }

  const nextX = Math.max(
    MAP_EDGE_PADDING + radius,
    Math.min(map.width - MAP_EDGE_PADDING - radius, actor.x + deltaX)
  );
  const nextY = Math.max(
    MAP_EDGE_PADDING + radius,
    Math.min(map.height - MAP_EDGE_PADDING - radius, actor.y + deltaY)
  );
  const currentSupport = getGeneratedMapSupportHeight(map, actor.x, actor.y);
  const nextSupport = getGeneratedMapSupportHeight(map, nextX, nextY);

  if (nextSupport > currentSupport + SERVER_STEP_HEIGHT + 0.02) {
    return false;
  }

  if (!allowDropOff && currentSupport - nextSupport > 0.02) {
    return false;
  }

  if (isTerrainColliding(map, nextX, nextY, currentSupport, radius)) {
    return false;
  }

  actor.x = nextX;
  actor.y = nextY;
  actor.z = nextSupport;
  return true;
};

const resetActorStatesFromWorld = (): void => {
  actorStates.clear();
  actorSimulationStates.clear();
  generatedMaps = createNetworkWorldMaps(world.overworldSeed, world.overworldTeleportTile);

  for (const actor of createNetworkWorldActors(
    world.overworldSeed,
    world.overworldTeleportTile,
    collectedCrystalIds
  )) {
    actorStates.set(actor.id, actor);
    getActorSimulationState(actor);
  }
};

resetActorStatesFromWorld();

const handleClientMessage = (connection: ClientConnection, message: ClientMessage): void => {
  if (message.type === 'hello') {
    handleHello(connection, message);
    return;
  }

  const playerId = connection.playerId;
  if (!playerId) {
    return;
  }

  if (message.type === 'playerSnapshot') {
    const previous = players.get(playerId);
    if (!previous) {
      return;
    }

    const player: NetworkPlayerState = {
      ...previous,
      mapId: message.mapId,
      x: message.x,
      y: message.y,
      z: message.z,
      vx: message.vx,
      vy: message.vy,
      vz: message.vz,
      grounded: message.grounded,
      facing: message.facing,
      seq: message.seq
    };
    players.set(playerId, player);
    broadcast({ type: 'playerSnapshot', serverTime: now(), player }, connection);
    return;
  }

  if (message.type === 'attack') {
    applyAttackToActors(playerId, message);
    return;
  }

  if (message.type === 'interact') {
    applyInteractToActors(playerId, message);
    return;
  }

  if (message.type === 'actorTouched') {
    broadcast({
      type: 'actorEvent',
      serverTime: now(),
      actorId: message.actorId,
      event: { type: 'touchFlash' }
    });
    return;
  }

  if (message.type === 'crystalPickedUp') {
    if (collectedCrystalIds.has(message.actorId)) {
      return;
    }

    collectedCrystalIds.add(message.actorId);
    world = {
      ...world,
      crystalCount: world.crystalCount + 1
    };
    refreshCollectedCrystalIds();
    const actor = actorStates.get(message.actorId);
    if (actor) {
      actor.collected = true;
      actorStates.set(actor.id, actor);
      broadcastActorSnapshot(actor);
    }
    broadcast({
      type: 'actorEvent',
      serverTime: now(),
      actorId: message.actorId,
      event: { type: 'pickedUp', playerId }
    });
    broadcastInventory();
    return;
  }

  if (message.type === 'teleport') {
    const previous = players.get(playerId);
    if (previous) {
      players.set(playerId, {
        ...previous,
        mapId: message.targetMapId,
        x: message.targetX,
        y: message.targetY,
        vx: 0,
        vy: 0,
        vz: 0,
        grounded: true
      });
    }

    broadcast({
      type: 'teleport',
      serverTime: now(),
      playerId,
      mapId: message.targetMapId,
      x: message.targetX,
      y: message.targetY
    }, connection);
    return;
  }

  if (message.type === 'regenerateOverworld') {
    if (world.crystalCount <= 0) {
      return;
    }

    const seed = Math.floor(Math.random() * 0x100000000) >>> 0;
    collectedCrystalIds.clear();
    world = {
      ...world,
      crystalCount: world.crystalCount - 1,
      overworldSeed: seed,
      overworldTeleportTile: getRandomOverworldTeleportTile(seed),
      collectedCrystalIds: []
    };
    resetActorStatesFromWorld();
    broadcastInventory();
    broadcastMapScreenEffect('hubWorld', {
      type: 'shake',
      strength: 0.56,
      duration: 0.82,
      frequency: 28,
      audience: { type: 'map', mapId: 'hubWorld' }
    });
    broadcast({ type: 'worldChanged', serverTime: now(), world });
  }
};

wss.on('connection', (socket) => {
  const connection: ClientConnection = { socket, playerId: null };
  clients.add(connection);

  socket.on('message', (data) => {
    const message = parseClientMessage(data);
    if (message) {
      handleClientMessage(connection, message);
    }
  });

  socket.on('close', () => {
    clients.delete(connection);

    if (!connection.playerId) {
      return;
    }

    players.delete(connection.playerId);
    if (connection.playerId === world.hostPlayerId) {
      setHostPlayerId(players.keys().next().value ?? null);
      broadcast({ type: 'worldChanged', serverTime: now(), world });
    }
    broadcast({ type: 'playerLeft', serverTime: now(), playerId: connection.playerId });
    console.log(`${connection.playerId} disconnected`);
  });
});

let lastActorTick = now();
setInterval(() => {
  const currentTime = now();
  const dt = Math.min((currentTime - lastActorTick) / 1000, 0.1);
  lastActorTick = currentTime;

  for (const actor of actorStates.values()) {
    const shape = getActorCollisionShape(actor);
    const speed = Math.hypot(actor.vx, actor.vy);
    if (speed > KNOCKBACK_STOP_SPEED) {
      if (!tryMoveGroundActor(actor, actor.vx * dt, actor.vy * dt, shape.radius, true)) {
        actor.vx = 0;
        actor.vy = 0;
      }
      const decay = Math.exp(-KNOCKBACK_DECAY * dt);
      actor.vx *= decay;
      actor.vy *= decay;
    } else if (actor.kind === 'npc-mobile') {
      const sim = getActorSimulationState(actor);
      if (sim.idleTimer > 0) {
        sim.idleTimer = Math.max(0, sim.idleTimer - ACTOR_TICK_MS);
        actor.vx = 0;
        actor.vy = 0;
      } else {
        sim.moveTimer = Math.max(0, sim.moveTimer - ACTOR_TICK_MS);
        actor.vx = Math.cos(sim.moveAngle) * NPC_WANDER_SPEED;
        actor.vy = Math.sin(sim.moveAngle) * NPC_WANDER_SPEED;
        actor.facing = Math.round(
          (Math.atan2(-actor.vy, actor.vx) + Math.PI / 2) / (Math.PI / 4)
        ) & 7;

        if (!tryMoveGroundActor(actor, actor.vx * dt, actor.vy * dt, shape.radius, false)) {
          actor.vx = 0;
          actor.vy = 0;
          sim.moveTimer = 0;
        }

        if (sim.moveTimer === 0) {
          const random = createSeededRandom(hashString(`${actor.id}:${currentTime}`));
          sim.moveAngle = random() * Math.PI * 2;
          sim.moveTimer = lerp(NPC_MOVE_MIN_TIME, NPC_MOVE_MAX_TIME, random());
          sim.idleTimer = lerp(NPC_IDLE_MIN_TIME, NPC_IDLE_MAX_TIME, random());
        }
      }
    } else {
      actor.vx = 0;
      actor.vy = 0;
    }

    if (Math.hypot(actor.vx, actor.vy) <= KNOCKBACK_STOP_SPEED && actor.kind !== 'npc-mobile') {
      actor.vx = 0;
      actor.vy = 0;
    }

    actorStates.set(actor.id, actor);
    broadcastActorSnapshot(actor);
  }
}, ACTOR_TICK_MS);

console.log(`IsoGame multiplayer server listening on ws://localhost:${port}`);
