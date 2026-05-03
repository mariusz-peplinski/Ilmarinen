import { describe, expect, it } from 'vitest'

import { NETWORK_PROTOCOL_VERSION, isClientMessage } from './network-protocol'

const playerSnapshot = {
  type: 'playerSnapshot',
  seq: 12,
  clientTime: 1234,
  mapId: 'overworld',
  x: 10.5,
  y: 11.5,
  z: 0.382,
  vx: 1,
  vy: 0,
  vz: 0,
  grounded: true,
  facing: 4
}

const attackEvent = {
  type: 'attack',
  seq: 13,
  clientTime: 1250,
  mapId: 'hubWorld',
  x: 15.5,
  y: 18.5,
  z: 0.764,
  directionX: 1,
  directionY: 0,
  facing: 2
}

describe('isClientMessage', () => {
  it('accepts valid client message shapes', () => {
    expect(isClientMessage({
      type: 'hello',
      name: 'Magiusz',
      protocolVersion: NETWORK_PROTOCOL_VERSION
    })).toBe(true)
    expect(isClientMessage(playerSnapshot)).toBe(true)
    expect(isClientMessage(attackEvent)).toBe(true)
    expect(isClientMessage({ ...attackEvent, type: 'interact' })).toBe(true)
    expect(isClientMessage({
      type: 'actorTouched',
      clientTime: 1300,
      actorId: 'npc-mobile-1-2-3',
      actorKind: 'npc'
    })).toBe(true)
    expect(isClientMessage({
      type: 'crystalPickedUp',
      clientTime: 1301,
      actorId: 'crystal-startup-5362014'
    })).toBe(true)
    expect(isClientMessage({
      type: 'teleport',
      clientTime: 1302,
      targetMapId: 'hubWorld',
      targetX: 15.5,
      targetY: 18.5
    })).toBe(true)
    expect(isClientMessage({ type: 'regenerateOverworld', clientTime: 1303 })).toBe(true)
  })

  it('rejects non-object and unknown message values', () => {
    expect(isClientMessage(null)).toBe(false)
    expect(isClientMessage(undefined)).toBe(false)
    expect(isClientMessage('hello')).toBe(false)
    expect(isClientMessage([])).toBe(false)
    expect(isClientMessage({})).toBe(false)
    expect(isClientMessage({ type: 42 })).toBe(false)
    expect(isClientMessage({ type: 'dance' })).toBe(false)
  })

  it('rejects malformed message payloads before the server reads them', () => {
    expect(isClientMessage({ type: 'hello', name: 'Old Client', protocolVersion: '1' })).toBe(false)
    expect(isClientMessage({ ...playerSnapshot, mapId: 'cave' })).toBe(false)
    expect(isClientMessage({ ...playerSnapshot, grounded: 'yes' })).toBe(false)
    expect(isClientMessage({ ...playerSnapshot, x: Number.NaN })).toBe(false)
    expect(isClientMessage({ ...attackEvent, directionY: undefined })).toBe(false)
    expect(isClientMessage({
      type: 'actorTouched',
      clientTime: 1300,
      actorId: 'flower-1-2-0',
      actorKind: 'crystal'
    })).toBe(false)
    expect(isClientMessage({
      type: 'teleport',
      clientTime: 1302,
      targetMapId: 'overworld',
      targetX: 27,
      targetY: Number.POSITIVE_INFINITY
    })).toBe(false)
  })
})
