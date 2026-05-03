import type { ClientMessage, NetworkActorState } from '../shared/network-protocol';

const PLAYER_COLLISION_RADIUS = 0.2;
const NPC_COLLISION_RADIUS = 0.18;
const FLOWER_COLLISION_RADIUS = 0.17;
const NPC_BODY_HEIGHT = 1.1;
const FLOWER_BODY_HEIGHT = 0.72;
const TRIGGER_RADIUS = 0.7;
const TRIGGER_HEIGHT = 1.2;

export interface ActorCollisionShape {
  radius: number;
  height: number;
  knockbackScale: number;
  knockbackable: boolean;
}

export interface ActorActionProfile {
  reach: number;
  width: number;
  height: number;
}

export const ATTACK_ACTION_PROFILE = {
  reach: 0.95,
  width: 0.9,
  height: 1.2,
  knockback: 18.4
} as const;

export const INTERACTION_ACTION_PROFILE = {
  reach: 0.95,
  width: 0.9,
  height: 1.2
} as const;

export function getActorCollisionShape(actor: NetworkActorState): ActorCollisionShape {
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
}

export function isActorInsideActionBox(
  actor: NetworkActorState,
  event: Extract<ClientMessage, { type: 'attack' | 'interact' }>,
  profile: ActorActionProfile
): boolean {
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
}
