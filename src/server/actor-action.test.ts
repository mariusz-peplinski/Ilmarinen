import { describe, expect, it } from 'vitest'

import type { ClientMessage, NetworkActorState } from '../shared/network-protocol'
import {
  ATTACK_ACTION_PROFILE,
  getActorCollisionShape,
  isActorInsideActionBox
} from './actor-action'

const attackEvent: Extract<ClientMessage, { type: 'attack' }> = {
  type: 'attack',
  seq: 1,
  clientTime: 100,
  mapId: 'overworld',
  x: 10,
  y: 10,
  z: 1,
  directionX: 1,
  directionY: 0,
  facing: 2
}

function createActor(overrides: Partial<NetworkActorState>): NetworkActorState {
  return {
    id: 'actor-1',
    kind: 'npc-mobile',
    mapId: 'overworld',
    x: 10.7,
    y: 10,
    z: 1,
    vx: 0,
    vy: 0,
    displayName: 'Target',
    ...overrides
  }
}

describe('server actor action helpers', () => {
  it('classifies collision shapes for knockback behavior', () => {
    expect(getActorCollisionShape(createActor({ kind: 'npc-mobile' }))).toMatchObject({
      knockbackable: true,
      knockbackScale: 1
    })
    expect(getActorCollisionShape(createActor({ kind: 'flower' }))).toMatchObject({
      knockbackable: true,
      knockbackScale: 0.8
    })
    expect(getActorCollisionShape(createActor({ kind: 'npc-sturdy' }))).toMatchObject({
      knockbackable: false,
      knockbackScale: 0
    })
    expect(getActorCollisionShape(createActor({ kind: 'crystal' }))).toMatchObject({
      radius: 0,
      knockbackable: false
    })
  })

  it('includes actors inside the directional action box', () => {
    expect(isActorInsideActionBox(createActor({ x: 10.7, y: 10 }), attackEvent, ATTACK_ACTION_PROFILE))
      .toBe(true)
    expect(isActorInsideActionBox(createActor({ x: 10.7, y: 10.52 }), attackEvent, ATTACK_ACTION_PROFILE))
      .toBe(true)
  })

  it('excludes actors behind, beside, collected, on another map, or outside height range', () => {
    expect(isActorInsideActionBox(createActor({ x: 9.6, y: 10 }), attackEvent, ATTACK_ACTION_PROFILE))
      .toBe(false)
    expect(isActorInsideActionBox(createActor({ x: 10.7, y: 10.8 }), attackEvent, ATTACK_ACTION_PROFILE))
      .toBe(false)
    expect(isActorInsideActionBox(createActor({ x: 10.7, y: 10, collected: true }), attackEvent, ATTACK_ACTION_PROFILE))
      .toBe(false)
    expect(isActorInsideActionBox(createActor({ x: 10.7, y: 10, mapId: 'hubWorld' }), attackEvent, ATTACK_ACTION_PROFILE))
      .toBe(false)
    expect(isActorInsideActionBox(createActor({ x: 10.7, y: 10, z: 3 }), attackEvent, ATTACK_ACTION_PROFILE))
      .toBe(false)
  })
})
