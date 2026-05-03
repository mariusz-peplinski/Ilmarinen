import type { MapId, NetworkActorState, Vec2 } from './network-protocol';

type TerrainMaterialKey = 'grass' | 'stone' | 'sand' | 'moss';
type ActorPopulationFactor = 'flowers' | 'humans' | 'mixed';

interface TerrainScaleFactor {
  label: string;
  elevationFrequency: number;
  detailFrequency: number;
  moistureFrequency: number;
  roughnessFrequency: number;
  ridgeFrequency: number;
  ridgeMaskFrequency: number;
}

interface TerrainReliefFactor {
  label: string;
  basePower: number;
  baseWeight: number;
  ridgeStrength: number;
  maxHeight: number;
}

export interface GeneratedMap {
  id: MapId;
  width: number;
  height: number;
  heights: number[];
  teleports: Vec2[];
  spawns: {
    mobileNpcCount: number;
    stationaryNpcCount: number;
    sturdyNpcCount: number;
    fixedSturdyNpcs: Array<{
      x: number;
      y: number;
      displayName?: string | null;
    }>;
    fixedTriggers: Array<{
      x: number;
      y: number;
      displayName: string | null;
    }>;
    flowerCount: number;
  };
}

export const MAP_GENERATION_SEED = 0x51f15e;
const MAP_WIDTH = 168;
const MAP_HEIGHT = 144;
const HUB_WORLD_MAP_WIDTH = 30;
const HUB_WORLD_MAP_HEIGHT = 30;
export const DEFAULT_BLOCK_HEIGHT_SCALE = 0.382;
const DEFAULT_MOBILE_NPC_COUNT = 8;
const DEFAULT_STATIONARY_NPC_COUNT = DEFAULT_MOBILE_NPC_COUNT * 4;
const DEFAULT_STURDY_NPC_COUNT = 6;
const DEFAULT_FLOWER_COUNT = 96;
const OVERWORLD_CRYSTAL_PICKUP_COUNT = 2;
export const INITIAL_CRYSTAL_COUNT = 7;
export const OVERWORLD_SPAWN: Vec2 = { x: 12.5, y: 12.5 };
export const OVERWORLD_TELEPORT_TILE: Vec2 = { x: 27, y: 12 };
const HUB_WORLD_TELEPORT_TILE: Vec2 = { x: 15, y: 18 };
const NPC_SPAWN_EXCLUSION_RADIUS = 9;
const FLOWER_VARIANT_COUNT = 12;
const NPC_NAME_POOL = [
  'Mira',
  'Tovin',
  'Pella',
  'Niko',
  'Sable',
  'Jun',
  'Orin',
  'Luma',
  'Brin',
  'Vera',
  'Kito',
  'Marn'
] as const;
const STURDY_NPC_NAME_POOL = ['Anvil', 'Basalt', 'Granite', 'Slate', 'Kern', 'Obel'] as const;
const FLOWER_NAME_POOL = [
  'Aster',
  'Briar',
  'Clover',
  'Dahlia',
  'Iris',
  'Marigold',
  'Poppy',
  'Rue'
] as const;
const TERRAIN_MATERIAL_KEYS: readonly TerrainMaterialKey[] = ['grass', 'stone', 'sand', 'moss'];
const ACTOR_POPULATION_FACTORS: readonly ActorPopulationFactor[] = [
  'flowers',
  'humans',
  'mixed'
];
const TERRAIN_SCALE_FACTORS: readonly TerrainScaleFactor[] = [
  {
    label: 'broad',
    elevationFrequency: 0.034,
    detailFrequency: 0.11,
    moistureFrequency: 0.018,
    roughnessFrequency: 0.045,
    ridgeFrequency: 0.02,
    ridgeMaskFrequency: 0.008
  },
  {
    label: 'balanced',
    elevationFrequency: 0.05,
    detailFrequency: 0.16,
    moistureFrequency: 0.026,
    roughnessFrequency: 0.065,
    ridgeFrequency: 0.028,
    ridgeMaskFrequency: 0.012
  },
  {
    label: 'tight',
    elevationFrequency: 0.072,
    detailFrequency: 0.22,
    moistureFrequency: 0.036,
    roughnessFrequency: 0.092,
    ridgeFrequency: 0.04,
    ridgeMaskFrequency: 0.017
  }
];
const TERRAIN_RELIEF_FACTORS: readonly TerrainReliefFactor[] = [
  {
    label: 'low',
    basePower: 1.35,
    baseWeight: 0.86,
    ridgeStrength: 1.2,
    maxHeight: 4
  },
  {
    label: 'rolling',
    basePower: 1.6,
    baseWeight: 0.76,
    ridgeStrength: 2.2,
    maxHeight: 6
  },
  {
    label: 'sharp',
    basePower: 1.85,
    baseWeight: 0.66,
    ridgeStrength: 3,
    maxHeight: 7
  }
];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const lerp = (start: number, end: number, t: number): number => start + (end - start) * t;

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

function hash2D(seed: number, x: number, y: number): number {
  let hash = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  hash = (hash ^ (hash >>> 13)) | 0;
  hash = Math.imul(hash, 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function hashUnit(seed: number, x: number, y: number, z = 0): number {
  return hash2D(seed ^ Math.imul(z + 1, 2246822519), x, y) / 0xffffffff;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pickSeededValue<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function createWorldGenerationFactors(seed: number): {
  actorPopulation: ActorPopulationFactor;
  dominantMaterial: TerrainMaterialKey;
  terrainScale: TerrainScaleFactor;
  terrainRelief: TerrainReliefFactor;
} {
  const random = createSeededRandom(seed ^ 0xa17cf3d5);
  return {
    actorPopulation: pickSeededValue(ACTOR_POPULATION_FACTORS, random),
    dominantMaterial: pickSeededValue(TERRAIN_MATERIAL_KEYS, random),
    terrainScale: pickSeededValue(TERRAIN_SCALE_FACTORS, random),
    terrainRelief: pickSeededValue(TERRAIN_RELIEF_FACTORS, random)
  };
}

function getSpawnConfigForActorPopulation(
  actorPopulation: ActorPopulationFactor | null
): Pick<GeneratedMap['spawns'], 'mobileNpcCount' | 'stationaryNpcCount' | 'sturdyNpcCount' | 'flowerCount'> {
  switch (actorPopulation) {
    case 'flowers':
      return {
        mobileNpcCount: 0,
        stationaryNpcCount: 0,
        sturdyNpcCount: 0,
        flowerCount: Math.round(DEFAULT_FLOWER_COUNT * 1.65)
      };
    case 'humans':
      return {
        mobileNpcCount: DEFAULT_MOBILE_NPC_COUNT + 3,
        stationaryNpcCount: DEFAULT_STATIONARY_NPC_COUNT + 10,
        sturdyNpcCount: DEFAULT_STURDY_NPC_COUNT + 2,
        flowerCount: 0
      };
    case 'mixed':
    default:
      return {
        mobileNpcCount: DEFAULT_MOBILE_NPC_COUNT,
        stationaryNpcCount: DEFAULT_STATIONARY_NPC_COUNT,
        sturdyNpcCount: DEFAULT_STURDY_NPC_COUNT,
        flowerCount: DEFAULT_FLOWER_COUNT
      };
  }
}

function pickName(namePool: readonly string[], seed: number, x: number, y: number, z = 0): string {
  return namePool[Math.floor(hashUnit(seed, x, y, z) * namePool.length)];
}

function gradientDot(seed: number, gridX: number, gridY: number, dx: number, dy: number): number {
  const angle = hashUnit(seed, gridX, gridY) * Math.PI * 2;
  return Math.cos(angle) * dx + Math.sin(angle) * dy;
}

function perlin2D(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;
  const u = smoothstep(tx);
  const v = smoothstep(ty);
  const n00 = gradientDot(seed, x0, y0, tx, ty);
  const n10 = gradientDot(seed, x1, y0, tx - 1, ty);
  const n01 = gradientDot(seed, x0, y1, tx, ty - 1);
  const n11 = gradientDot(seed, x1, y1, tx - 1, ty - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

function octavePerlin2D(
  seed: number,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  let amplitude = 1;
  let frequency = 1;
  let value = 0;
  let amplitudeSum = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += perlin2D(seed + octave * 97, x * frequency, y * frequency) * amplitude;
    amplitudeSum += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return clamp((value / Math.max(amplitudeSum, 0.0001)) * 0.5 + 0.5, 0, 1);
}

function ridgedNoise2D(
  seed: number,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  return 1 - Math.abs(octavePerlin2D(seed, x, y, octaves, persistence, lacunarity) * 2 - 1);
}

function mapIndex(map: GeneratedMap, x: number, y: number): number {
  return y * map.width + x;
}

export function getGeneratedMapHeight(map: GeneratedMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return 0;
  }
  return map.heights[mapIndex(map, x, y)] ?? 0;
}

function setHeight(map: GeneratedMap, x: number, y: number, height: number): void {
  map.heights[mapIndex(map, x, y)] = height;
}

function getSupportHeight(map: GeneratedMap, x: number, y: number): number {
  return getGeneratedMapSupportHeight(map, x, y);
}

export function getGeneratedMapSupportHeight(map: GeneratedMap, x: number, y: number): number {
  return getGeneratedMapHeight(map, Math.floor(x), Math.floor(y)) * DEFAULT_BLOCK_HEIGHT_SCALE;
}

function createOverworldMap(
  seed: number,
  teleportTile: Vec2,
  useProceduralFactors: boolean
): GeneratedMap {
  const generationFactors = useProceduralFactors ? createWorldGenerationFactors(seed) : null;
  const spawnConfig = getSpawnConfigForActorPopulation(
    generationFactors?.actorPopulation ?? null
  );
  const terrainScale = generationFactors?.terrainScale ?? TERRAIN_SCALE_FACTORS[1];
  const terrainRelief = generationFactors?.terrainRelief ?? TERRAIN_RELIEF_FACTORS[1];
  const map: GeneratedMap = {
    id: 'overworld',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    heights: Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => 0),
    teleports: [teleportTile],
    spawns: {
      mobileNpcCount: spawnConfig.mobileNpcCount,
      stationaryNpcCount: spawnConfig.stationaryNpcCount,
      sturdyNpcCount: spawnConfig.sturdyNpcCount,
      fixedSturdyNpcs: [],
      fixedTriggers: [
        { x: 19.5, y: 12.5, displayName: 'Old Marker' },
        { x: 23.5, y: 13.5, displayName: null }
      ],
      flowerCount: spawnConfig.flowerCount
    }
  };

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const elevation = octavePerlin2D(
        seed,
        x * terrainScale.elevationFrequency,
        y * terrainScale.elevationFrequency,
        5,
        0.5,
        2.2
      );
      const detail = octavePerlin2D(
        seed + 31,
        (x + 140) * terrainScale.detailFrequency,
        (y - 80) * terrainScale.detailFrequency,
        4,
        0.45,
        2.3
      );
      const roughness = octavePerlin2D(
        seed + 103,
        (x + 15) * terrainScale.roughnessFrequency,
        (y + 25) * terrainScale.roughnessFrequency,
        2,
        0.45,
        2.3
      );
      const ridgeField = ridgedNoise2D(
        seed + 149,
        (x - 30) * terrainScale.ridgeFrequency,
        (y + 45) * terrainScale.ridgeFrequency,
        4,
        0.52,
        2.05
      );
      const ridgeMask = Math.pow(
        octavePerlin2D(
          seed + 211,
          (x + 80) * terrainScale.ridgeMaskFrequency,
          (y - 120) * terrainScale.ridgeMaskFrequency,
          3,
          0.55,
          2
        ),
        1.1
      );
      const baseHeightField = Math.pow(
        clamp(elevation * 0.5 + detail * 0.27 - 0.22, 0, 1),
        terrainRelief.basePower
      );
      const ridgeSignal = Math.pow(clamp((ridgeField - 0.4) / 0.6, 0, 1), 2.2);
      const ridgeRegion = Math.pow(clamp((ridgeMask - 0.32) / 0.68, 0, 1), 1.1);
      const normalizedHeightField = clamp(
        baseHeightField * terrainRelief.baseWeight +
          ridgeSignal * ridgeRegion * terrainRelief.ridgeStrength +
          roughness * 0.025,
        0,
        1
      );
      setHeight(
        map,
        x,
        y,
        clamp(
          1 + Math.round(normalizedHeightField * (terrainRelief.maxHeight - 1)),
          1,
          terrainRelief.maxHeight
        )
      );
    }
  }

  for (let y = 10; y <= 14; y += 1) {
    for (let x = 10; x <= 14; x += 1) {
      setHeight(map, x, y, 2);
    }
  }

  return map;
}

function createHubWorldMap(overworldSeed: number, overworldTeleportTile: Vec2): GeneratedMap {
  const map: GeneratedMap = {
    id: 'hubWorld',
    width: HUB_WORLD_MAP_WIDTH,
    height: HUB_WORLD_MAP_HEIGHT,
    heights: Array.from({ length: HUB_WORLD_MAP_WIDTH * HUB_WORLD_MAP_HEIGHT }, () => 0),
    teleports: [HUB_WORLD_TELEPORT_TILE],
    spawns: {
      mobileNpcCount: 0,
      stationaryNpcCount: 0,
      sturdyNpcCount: 0,
      fixedSturdyNpcs: [
        {
          x: 6.5,
          y: 9.5,
          displayName: 'Worldsmith'
        }
      ],
      fixedTriggers: [
        {
          x: HUB_WORLD_TELEPORT_TILE.x + 0.5,
          y: HUB_WORLD_TELEPORT_TILE.y + 0.5,
          displayName: getOverworldSeedLabel(overworldSeed)
        }
      ],
      flowerCount: 0
    }
  };
  const centerX = (HUB_WORLD_MAP_WIDTH - 1) * 0.5;
  const centerY = (HUB_WORLD_MAP_HEIGHT - 1) * 0.5;

  for (let y = 0; y < HUB_WORLD_MAP_HEIGHT; y += 1) {
    for (let x = 0; x < HUB_WORLD_MAP_WIDTH; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy);
      const rim = clamp((distance - 7) / 8, 0, 1);
      const noise = octavePerlin2D(MAP_GENERATION_SEED + 701, x * 0.14, y * 0.14, 3, 0.5, 2);
      setHeight(map, x, y, clamp(3 - Math.floor(rim * 2.5) + (noise > 0.72 ? 1 : 0), 1, 3));
    }
  }

  for (let y = 13; y <= 19; y += 1) {
    for (let x = 13; x <= 17; x += 1) {
      setHeight(map, x, y, 2);
    }
  }
  setHeight(map, HUB_WORLD_TELEPORT_TILE.x, HUB_WORLD_TELEPORT_TILE.y, 2);
  void overworldTeleportTile;
  return map;
}

function getOverworldSeedLabel(seed: number): string {
  return `Overworld seed: ${seed.toString(16).padStart(8, '0')}`;
}

export function getRandomOverworldTeleportTile(seed: number): Vec2 {
  const random = createSeededRandom(seed ^ 0x7e1e90);
  return {
    x: 22 + Math.floor(random() * (MAP_WIDTH - 44)),
    y: 14 + Math.floor(random() * (MAP_HEIGHT - 28))
  };
}

function hasWalkableNeighbor(map: GeneratedMap, tileX: number, tileY: number): boolean {
  const height = getGeneratedMapHeight(map, tileX, tileY);
  return (
    getGeneratedMapHeight(map, tileX + 1, tileY) === height ||
    getGeneratedMapHeight(map, tileX - 1, tileY) === height ||
    getGeneratedMapHeight(map, tileX, tileY + 1) === height ||
    getGeneratedMapHeight(map, tileX, tileY - 1) === height
  );
}

function isTeleportTile(map: GeneratedMap, tileX: number, tileY: number): boolean {
  return map.teleports.some((teleport) => teleport.x === tileX && teleport.y === tileY);
}

function collectNpcSpawnCandidates(
  map: GeneratedMap,
  playerSpawn: Vec2,
  requireMobility: boolean
): Vec2[] {
  const candidates: Vec2[] = [];

  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      if (isTeleportTile(map, x, y)) {
        continue;
      }

      const dx = x + 0.5 - playerSpawn.x;
      const dy = y + 0.5 - playerSpawn.y;
      if (dx * dx + dy * dy < NPC_SPAWN_EXCLUSION_RADIUS * NPC_SPAWN_EXCLUSION_RADIUS) {
        continue;
      }

      if (requireMobility && !hasWalkableNeighbor(map, x, y)) {
        continue;
      }

      candidates.push({ x: x + 0.5, y: y + 0.5 });
    }
  }

  return candidates;
}

function shuffleSpawnCandidates(candidates: Vec2[], seed: number): void {
  const random = createSeededRandom(seed);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }
}

function createNpcActor(
  map: GeneratedMap,
  spawnSeedBase: number,
  kind: 'mobile' | 'stationary' | 'sturdy',
  x: number,
  y: number,
  randomSeed: number,
  displayNameOverride: string | null | undefined = undefined
): NetworkActorState {
  const displayName =
    displayNameOverride === undefined
      ? pickName(
          kind === 'sturdy' ? STURDY_NPC_NAME_POOL : NPC_NAME_POOL,
          randomSeed + 503,
          Math.floor(x),
          Math.floor(y)
        )
      : displayNameOverride;
  void spawnSeedBase;
  return {
    id: `npc-${kind}-${Math.floor(x)}-${Math.floor(y)}-${randomSeed}`,
    kind: `npc-${kind}`,
    mapId: map.id,
    x,
    y,
    z: getSupportHeight(map, x, y),
    vx: 0,
    vy: 0,
    facing: 4,
    displayName
  };
}

function getFlowerDisplayName(randomSeed: number, x: number, y: number): string | null {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  if (hashUnit(randomSeed + 809, tileX, tileY) > 0.35) {
    return null;
  }
  return pickName(FLOWER_NAME_POOL, randomSeed + 811, tileX, tileY);
}

function addNpcActors(
  actors: NetworkActorState[],
  occupiedActorTiles: Set<string>,
  map: GeneratedMap,
  spawnSeedBase: number,
  kind: 'mobile' | 'stationary' | 'sturdy',
  count: number,
  candidates: Vec2[],
  seedOffset: number
): void {
  if (count <= 0) {
    return;
  }

  let spawned = 0;
  for (const candidate of candidates) {
    const tileKey = `${Math.floor(candidate.x)}:${Math.floor(candidate.y)}`;
    if (occupiedActorTiles.has(tileKey)) {
      continue;
    }

    occupiedActorTiles.add(tileKey);
    actors.push(
      createNpcActor(
        map,
        spawnSeedBase,
        kind,
        candidate.x,
        candidate.y,
        spawnSeedBase + seedOffset + actors.filter((actor) => actor.kind.startsWith('npc-')).length * 17
      )
    );
    spawned += 1;
    if (spawned >= count) {
      break;
    }
  }
}

function addMapActors(
  actors: NetworkActorState[],
  map: GeneratedMap,
  spawnSeedBase: number,
  playerSpawn: Vec2,
  collectedCrystalIds: ReadonlySet<string>
): void {
  const occupiedActorTiles = new Set<string>();
  const mobileCandidates = collectNpcSpawnCandidates(map, playerSpawn, true);
  const stationaryCandidates = collectNpcSpawnCandidates(map, playerSpawn, false);
  shuffleSpawnCandidates(mobileCandidates, spawnSeedBase + 601);
  shuffleSpawnCandidates(stationaryCandidates, spawnSeedBase + 907);

  addNpcActors(
    actors,
    occupiedActorTiles,
    map,
    spawnSeedBase,
    'mobile',
    map.spawns.mobileNpcCount,
    mobileCandidates,
    1300
  );
  addNpcActors(
    actors,
    occupiedActorTiles,
    map,
    spawnSeedBase,
    'stationary',
    map.spawns.stationaryNpcCount,
    stationaryCandidates,
    2100
  );
  addNpcActors(
    actors,
    occupiedActorTiles,
    map,
    spawnSeedBase,
    'sturdy',
    map.spawns.sturdyNpcCount,
    stationaryCandidates,
    2500
  );

  map.spawns.fixedSturdyNpcs.forEach((config, index) => {
    const tileX = Math.floor(config.x);
    const tileY = Math.floor(config.y);
    const tileKey = `${tileX}:${tileY}`;
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= map.width ||
      tileY >= map.height ||
      occupiedActorTiles.has(tileKey)
    ) {
      return;
    }

    occupiedActorTiles.add(tileKey);
    actors.push(
      createNpcActor(
        map,
        spawnSeedBase,
        'sturdy',
        config.x,
        config.y,
        spawnSeedBase + 2900 + index * 17,
        config.displayName
      )
    );
  });

  if (map.spawns.flowerCount > 0) {
    const candidates = collectNpcSpawnCandidates(map, playerSpawn, false);
    shuffleSpawnCandidates(candidates, spawnSeedBase + 3001);
    const random = createSeededRandom(spawnSeedBase + 4103);
    let spawned = 0;

    for (const candidate of candidates) {
      const tileKey = `${Math.floor(candidate.x)}:${Math.floor(candidate.y)}`;
      if (occupiedActorTiles.has(tileKey)) {
        continue;
      }

      const variant = Math.floor(random() * FLOWER_VARIANT_COUNT);
      occupiedActorTiles.add(tileKey);
      actors.push({
        id: `flower-${Math.floor(candidate.x)}-${Math.floor(candidate.y)}-${spawned}`,
        kind: 'flower',
        mapId: map.id,
        x: candidate.x,
        y: candidate.y,
        z: getSupportHeight(map, candidate.x, candidate.y),
        vx: 0,
        vy: 0,
        displayName: getFlowerDisplayName(spawnSeedBase + 5303 + spawned * 19, candidate.x, candidate.y),
        variant
      });
      spawned += 1;
      if (spawned >= map.spawns.flowerCount) {
        break;
      }
    }
  }

  if (map.id === 'overworld') {
    const addCrystal = (candidate: Vec2, id: string): boolean => {
      const tileX = Math.floor(candidate.x);
      const tileY = Math.floor(candidate.y);
      const tileKey = `${tileX}:${tileY}`;
      if (
        tileX < 0 ||
        tileY < 0 ||
        tileX >= map.width ||
        tileY >= map.height ||
        isTeleportTile(map, tileX, tileY) ||
        occupiedActorTiles.has(tileKey)
      ) {
        return false;
      }

      occupiedActorTiles.add(tileKey);
      actors.push({
        id,
        kind: 'crystal',
        mapId: map.id,
        x: candidate.x,
        y: candidate.y,
        z: getSupportHeight(map, candidate.x, candidate.y),
        vx: 0,
        vy: 0,
        displayName: 'Crystal',
        collected: collectedCrystalIds.has(id)
      });
      return true;
    };

    if (spawnSeedBase === MAP_GENERATION_SEED) {
      addCrystal(
        { x: OVERWORLD_SPAWN.x + 2, y: OVERWORLD_SPAWN.y },
        `crystal-startup-${MAP_GENERATION_SEED}`
      );
    }

    const candidates = collectNpcSpawnCandidates(map, playerSpawn, false);
    shuffleSpawnCandidates(candidates, spawnSeedBase + 7301);
    let placed = 0;
    for (const candidate of candidates) {
      const tileX = Math.floor(candidate.x);
      const tileY = Math.floor(candidate.y);
      if (addCrystal(candidate, `crystal-${spawnSeedBase}-${tileX}-${tileY}`)) {
        placed += 1;
      }
      if (placed >= OVERWORLD_CRYSTAL_PICKUP_COUNT) {
        break;
      }
    }
  }

  map.spawns.fixedTriggers.forEach((trigger, index) => {
    const tileX = Math.floor(trigger.x);
    const tileY = Math.floor(trigger.y);
    if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
      return;
    }

    actors.push({
      id: `trigger-${map.id}-${tileX}-${tileY}-${index}`,
      kind: 'trigger',
      mapId: map.id,
      x: trigger.x,
      y: trigger.y,
      z: getSupportHeight(map, trigger.x, trigger.y),
      vx: 0,
      vy: 0,
      displayName: trigger.displayName
    });
  });
}

export function createNetworkWorldActors(
  overworldSeed: number,
  overworldTeleportTile: Vec2,
  collectedCrystalIds: ReadonlySet<string>
): NetworkActorState[] {
  const useProceduralFactors = overworldSeed !== MAP_GENERATION_SEED;
  const overworldMap = createOverworldMap(
    overworldSeed,
    overworldTeleportTile,
    useProceduralFactors
  );
  const hubWorldMap = createHubWorldMap(overworldSeed, overworldTeleportTile);
  const actors: NetworkActorState[] = [];

  addMapActors(
    actors,
    overworldMap,
    overworldSeed,
    useProceduralFactors
      ? { x: overworldTeleportTile.x + 0.5, y: overworldTeleportTile.y + 0.5 }
      : OVERWORLD_SPAWN,
    collectedCrystalIds
  );
  addMapActors(
    actors,
    hubWorldMap,
    MAP_GENERATION_SEED + 10000,
    { x: 15.5, y: 18.5 },
    collectedCrystalIds
  );

  return actors;
}

export function createNetworkWorldMaps(
  overworldSeed: number,
  overworldTeleportTile: Vec2
): Record<MapId, GeneratedMap> {
  return {
    overworld: createOverworldMap(
      overworldSeed,
      overworldTeleportTile,
      overworldSeed !== MAP_GENERATION_SEED
    ),
    hubWorld: createHubWorldMap(overworldSeed, overworldTeleportTile)
  };
}
