export const NETWORK_PROTOCOL_VERSION = 1;

export type MapId = 'overworld' | 'hubWorld';

export interface Vec2 {
  x: number;
  y: number;
}

export interface NetworkWorldState {
  overworldSeed: number;
  overworldTeleportTile: Vec2;
  crystalCount: number;
  collectedCrystalIds: string[];
  hostPlayerId: string | null;
}

export interface NetworkPlayerState {
  id: string;
  displayName: string;
  mapId: MapId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  facing: number;
  seq: number;
}

export type NetworkActorKind =
  | 'npc-mobile'
  | 'npc-stationary'
  | 'npc-sturdy'
  | 'flower'
  | 'crystal'
  | 'trigger';

export interface NetworkActorState {
  id: string;
  kind: NetworkActorKind;
  mapId: MapId;
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

export interface NetworkAttackEvent {
  seq: number;
  clientTime: number;
  mapId: MapId;
  x: number;
  y: number;
  z: number;
  directionX: number;
  directionY: number;
  facing: number;
}

export interface NetworkInteractionEvent extends NetworkAttackEvent {}

export type NetworkActorEvent =
  | { type: 'touchFlash' }
  | { type: 'attackFlash'; knockbackX?: number; knockbackY?: number }
  | { type: 'pickedUp'; playerId: string }
  | { type: 'triggerActivated' };

export type ScreenEffectAudience =
  | { type: 'localOnly' }
  | { type: 'player'; playerId: string }
  | { type: 'map'; mapId: MapId }
  | { type: 'room' };

export type NetworkScreenEffectEvent =
  | {
      type: 'flash';
      color: string;
      duration: number;
      maxOpacity: number;
      audience: ScreenEffectAudience;
    }
  | {
      type: 'shake';
      strength: number;
      duration: number;
      frequency?: number;
      audience: ScreenEffectAudience;
    };

export type ClientMessage =
  | { type: 'hello'; name: string; protocolVersion: number }
  | ClientPlayerSnapshotMessage
  | NetworkAttackEvent & { type: 'attack' }
  | NetworkInteractionEvent & { type: 'interact' }
  | { type: 'actorTouched'; clientTime: number; actorId: string; actorKind: 'npc' | 'flower' | 'trigger' }
  | { type: 'crystalPickedUp'; clientTime: number; actorId: string }
  | { type: 'teleport'; clientTime: number; targetMapId: MapId; targetX: number; targetY: number }
  | { type: 'regenerateOverworld'; clientTime: number };

export interface ClientPlayerSnapshotMessage {
  type: 'playerSnapshot';
  seq: number;
  clientTime: number;
  mapId: MapId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  facing: number;
}

export type ServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      serverTime: number;
      world: NetworkWorldState;
      players: NetworkPlayerState[];
      actors: NetworkActorState[];
    }
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
  | { type: 'teleport'; serverTime: number; playerId: string; mapId: MapId; x: number; y: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMapId(value: unknown): value is MapId {
  return value === 'overworld' || value === 'hubWorld';
}

function hasNumberFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => isFiniteNumber(value[field]));
}

function isNetworkEventMessage(value: Record<string, unknown>): boolean {
  return (
    isMapId(value.mapId) &&
    hasNumberFields(value, ['seq', 'clientTime', 'x', 'y', 'z', 'directionX', 'directionY', 'facing'])
  );
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'hello':
      return typeof value.name === 'string' && isFiniteNumber(value.protocolVersion);
    case 'playerSnapshot':
      return (
        isMapId(value.mapId) &&
        typeof value.grounded === 'boolean' &&
        hasNumberFields(value, ['seq', 'clientTime', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'facing'])
      );
    case 'attack':
    case 'interact':
      return isNetworkEventMessage(value);
    case 'actorTouched':
      return (
        isFiniteNumber(value.clientTime) &&
        typeof value.actorId === 'string' &&
        (value.actorKind === 'npc' || value.actorKind === 'flower' || value.actorKind === 'trigger')
      );
    case 'crystalPickedUp':
      return isFiniteNumber(value.clientTime) && typeof value.actorId === 'string';
    case 'teleport':
      return (
        isFiniteNumber(value.clientTime) &&
        isMapId(value.targetMapId) &&
        isFiniteNumber(value.targetX) &&
        isFiniteNumber(value.targetY)
      );
    case 'regenerateOverworld':
      return isFiniteNumber(value.clientTime);
    default:
      return false;
  }
}
