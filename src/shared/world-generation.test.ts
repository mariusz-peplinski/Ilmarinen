import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BLOCK_HEIGHT_SCALE,
  MAP_GENERATION_SEED,
  OVERWORLD_SPAWN,
  OVERWORLD_TELEPORT_TILE,
  createNetworkWorldActors,
  createNetworkWorldMaps,
  getGeneratedMapHeight,
  getGeneratedMapSupportHeight,
  getRandomOverworldTeleportTile,
  type GeneratedMap
} from './world-generation'
import type { MapId, NetworkActorKind, NetworkActorState, Vec2 } from './network-protocol'

function hashNumbers(values: readonly number[]): string {
  let hash = 2166136261
  for (const value of values) {
    hash ^= value
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function mapSignature(map: GeneratedMap): object {
  return {
    id: map.id,
    width: map.width,
    height: map.height,
    heightHash: hashNumbers(map.heights),
    teleports: map.teleports,
    spawns: map.spawns
  }
}

function actorSignature(actor: NetworkActorState): object {
  return {
    id: actor.id,
    kind: actor.kind,
    mapId: actor.mapId,
    x: actor.x,
    y: actor.y,
    z: actor.z,
    displayName: actor.displayName,
    variant: actor.variant,
    collected: actor.collected ?? false
  }
}

function countActorsByKind(
  actors: readonly NetworkActorState[],
  mapId: MapId
): Record<NetworkActorKind, number> {
  const counts: Record<NetworkActorKind, number> = {
    'npc-mobile': 0,
    'npc-stationary': 0,
    'npc-sturdy': 0,
    flower: 0,
    crystal: 0,
    trigger: 0
  }

  for (const actor of actors) {
    if (actor.mapId === mapId) {
      counts[actor.kind] += 1
    }
  }

  return counts
}

function hasWalkableNeighbor(map: GeneratedMap, tile: Vec2): boolean {
  const height = getGeneratedMapHeight(map, tile.x, tile.y)
  return (
    getGeneratedMapHeight(map, tile.x + 1, tile.y) === height ||
    getGeneratedMapHeight(map, tile.x - 1, tile.y) === height ||
    getGeneratedMapHeight(map, tile.x, tile.y + 1) === height ||
    getGeneratedMapHeight(map, tile.x, tile.y - 1) === height
  )
}

describe('shared world generation', () => {
  it('keeps startup overworld generation deterministic and fixed-profile', () => {
    const maps = createNetworkWorldMaps(MAP_GENERATION_SEED, OVERWORLD_TELEPORT_TILE)
    const repeatMaps = createNetworkWorldMaps(MAP_GENERATION_SEED, OVERWORLD_TELEPORT_TILE)
    const overworld = maps.overworld

    expect(mapSignature(overworld)).toEqual(mapSignature(repeatMaps.overworld))
    expect(overworld.id).toBe('overworld')
    expect(overworld.width).toBe(168)
    expect(overworld.height).toBe(144)
    expect(overworld.heights).toHaveLength(168 * 144)
    expect(overworld.teleports).toEqual([OVERWORLD_TELEPORT_TILE])
    expect(overworld.spawns).toMatchObject({
      mobileNpcCount: 8,
      stationaryNpcCount: 32,
      sturdyNpcCount: 6,
      flowerCount: 96
    })

    for (let y = 10; y <= 14; y += 1) {
      for (let x = 10; x <= 14; x += 1) {
        expect(getGeneratedMapHeight(overworld, x, y)).toBe(2)
      }
    }
    expect(getGeneratedMapSupportHeight(overworld, OVERWORLD_SPAWN.x, OVERWORLD_SPAWN.y))
      .toBe(getGeneratedMapHeight(overworld, 12, 12) * DEFAULT_BLOCK_HEIGHT_SCALE)
  })

  it('keeps generated maps and actors stable for a fixed regenerated seed', () => {
    const seed = 128
    const teleportTile = getRandomOverworldTeleportTile(seed)
    const maps = createNetworkWorldMaps(seed, teleportTile)
    const repeatMaps = createNetworkWorldMaps(seed, teleportTile)
    const actors = createNetworkWorldActors(seed, teleportTile, new Set())
    const repeatActors = createNetworkWorldActors(seed, teleportTile, new Set())

    expect(mapSignature(maps.overworld)).toEqual(mapSignature(repeatMaps.overworld))
    expect(mapSignature(maps.hubWorld)).toEqual(mapSignature(repeatMaps.hubWorld))
    expect(actors.map(actorSignature)).toEqual(repeatActors.map(actorSignature))
  })

  it('places random overworld teleport tiles inside readable, walkable terrain', () => {
    for (const seed of [1, 128, 960, 0xdecafbad]) {
      const teleportTile = getRandomOverworldTeleportTile(seed)
      const overworld = createNetworkWorldMaps(seed, teleportTile).overworld

      expect(teleportTile.x).toBeGreaterThanOrEqual(22)
      expect(teleportTile.x).toBeLessThan(overworld.width - 22)
      expect(teleportTile.y).toBeGreaterThanOrEqual(14)
      expect(teleportTile.y).toBeLessThan(overworld.height - 14)
      expect(overworld.teleports).toEqual([teleportTile])
      expect(getGeneratedMapHeight(overworld, teleportTile.x, teleportTile.y)).toBeGreaterThan(0)
      expect(hasWalkableNeighbor(overworld, teleportTile)).toBe(true)
    }
  })

  it('applies actor population factors to regenerated overworld spawns', () => {
    const flowerSeed = 1
    const mixedSeed = 128
    const humanSeed = 960

    const flowerTile = getRandomOverworldTeleportTile(flowerSeed)
    const mixedTile = getRandomOverworldTeleportTile(mixedSeed)
    const humanTile = getRandomOverworldTeleportTile(humanSeed)

    const flowerMap = createNetworkWorldMaps(flowerSeed, flowerTile).overworld
    const mixedMap = createNetworkWorldMaps(mixedSeed, mixedTile).overworld
    const humanMap = createNetworkWorldMaps(humanSeed, humanTile).overworld

    expect(flowerMap.spawns).toMatchObject({
      mobileNpcCount: 0,
      stationaryNpcCount: 0,
      sturdyNpcCount: 0,
      flowerCount: 158
    })
    expect(mixedMap.spawns).toMatchObject({
      mobileNpcCount: 8,
      stationaryNpcCount: 32,
      sturdyNpcCount: 6,
      flowerCount: 96
    })
    expect(humanMap.spawns).toMatchObject({
      mobileNpcCount: 11,
      stationaryNpcCount: 42,
      sturdyNpcCount: 8,
      flowerCount: 0
    })

    expect(countActorsByKind(createNetworkWorldActors(flowerSeed, flowerTile, new Set()), 'overworld'))
      .toMatchObject({
        'npc-mobile': 0,
        'npc-stationary': 0,
        'npc-sturdy': 0,
        flower: 158
      })
    expect(countActorsByKind(createNetworkWorldActors(mixedSeed, mixedTile, new Set()), 'overworld'))
      .toMatchObject({
        'npc-mobile': 8,
        'npc-stationary': 32,
        'npc-sturdy': 6,
        flower: 96
      })
    expect(countActorsByKind(createNetworkWorldActors(humanSeed, humanTile, new Set()), 'overworld'))
      .toMatchObject({
        'npc-mobile': 11,
        'npc-stationary': 42,
        'npc-sturdy': 8,
        flower: 0
      })
  })

  it('creates unique actor IDs and preserves collected crystal state', () => {
    const collectedCrystalId = `crystal-startup-${MAP_GENERATION_SEED}`
    const actors = createNetworkWorldActors(
      MAP_GENERATION_SEED,
      OVERWORLD_TELEPORT_TILE,
      new Set([collectedCrystalId])
    )
    const ids = actors.map((actor) => actor.id)
    const startupCrystal = actors.find((actor) => actor.id === collectedCrystalId)

    expect(new Set(ids).size).toBe(ids.length)
    expect(startupCrystal?.kind).toBe('crystal')
    expect(startupCrystal?.collected).toBe(true)
    expect(actors.some((actor) => actor.kind === 'npc-sturdy' && actor.displayName === 'Worldsmith'))
      .toBe(true)
    expect(actors.some((actor) => actor.kind === 'trigger' && actor.displayName?.startsWith('Overworld seed:')))
      .toBe(true)
  })
})
