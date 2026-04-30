import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  CircleGeometry,
  MeshBasicMaterial,
  DoubleSide,
  DirectionalLight,
  BasicShadowMap
} from 'three';

type MaterialKey = 'grass' | 'stone' | 'sand' | 'moss' | 'portal';
type TerrainMaterialKey = Exclude<MaterialKey, 'portal'>;
type MapId = 'overworld' | 'hubWorld';
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

interface WorldGenerationFactors {
  actorPopulation: ActorPopulationFactor;
  dominantMaterial: TerrainMaterialKey;
  terrainScale: TerrainScaleFactor;
  terrainRelief: TerrainReliefFactor;
}

interface Cell {
  height: number;
  materials: MaterialKey[];
}

interface TeleportTile {
  x: number;
  y: number;
  targetMapId: MapId;
  targetX: number;
  targetY: number;
}

interface MapSpawnConfig {
  mobileNpcCount: number;
  stationaryNpcCount: number;
  sturdyNpcCount: number;
  fixedSturdyNpcs: FixedSturdyNpcSpawnConfig[];
  fixedTriggers: TriggerSpawnConfig[];
  flowerCount: number;
}

interface MapData {
  id: MapId;
  width: number;
  height: number;
  cells: Cell[];
  teleports: TeleportTile[];
  spawns: MapSpawnConfig;
  generationFactors: WorldGenerationFactors | null;
}

interface Vec2 {
  x: number;
  y: number;
}

interface ScreenBasis {
  top: Vec2;
  right: Vec2;
  topNorm: Vec2;
  rightNorm: Vec2;
}

interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
}

type NpcKind = 'mobile' | 'stationary' | 'sturdy';
type ActorHitInteraction = 'regenerateOverworld';
type ActorPlainInteraction = 'inspect' | 'regenerateOverworld';

interface FixedSturdyNpcSpawnConfig {
  x: number;
  y: number;
  displayName?: string | null;
  onHitInteraction?: ActorHitInteraction;
  onPlainInteraction?: ActorPlainInteraction;
}

interface NpcState {
  id: string;
  kind: NpcKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  walkTime: number;
  currentDirection: number;
  active: boolean;
  speed: number;
  moveAngle: number;
  moveTimer: number;
  idleTimer: number;
  knockbackVX: number;
  knockbackVY: number;
  touchFlashTimer: number;
  attackFlashTimer: number;
  playerTouching: boolean;
  knockbackable: boolean;
  displayName: string | null;
  labelRangeFactor: number;
  labelFontSizeFactor: number;
  onHitInteraction: ActorHitInteraction | null;
  onPlainInteraction: ActorPlainInteraction | null;
  labelElement: HTMLDivElement;
  baseTint: Color;
  spriteMaterial: SpriteMaterial;
  sprite: Sprite;
  depthProxy: Mesh;
  shadow: Mesh;
}

interface FlowerState {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
  knockbackVX: number;
  knockbackVY: number;
  touchFlashTimer: number;
  attackFlashTimer: number;
  playerTouching: boolean;
  displayName: string | null;
  labelRangeFactor: number;
  labelFontSizeFactor: number;
  onHitInteraction: ActorHitInteraction | null;
  onPlainInteraction: ActorPlainInteraction | null;
  labelElement: HTMLDivElement;
  spriteMaterial: SpriteMaterial;
  sprite: Sprite;
  depthProxy: Mesh;
  shadow: Mesh;
  frameTexture: CanvasTexture;
}

interface CrystalPickupState {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
  collected: boolean;
  displayName: string;
  labelRangeFactor: number;
  labelFontSizeFactor: number;
  labelElement: HTMLDivElement;
  spriteMaterial: SpriteMaterial;
  sprite: Sprite;
  depthProxy: Mesh;
  shadow: Mesh;
}

interface TriggerSpawnConfig {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  displayName: string | null;
  labelRangeFactor?: number;
  labelFontSizeFactor?: number;
}

interface TriggerState {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  active: boolean;
  touchFlashTimer: number;
  attackFlashTimer: number;
  playerTouching: boolean;
  displayName: string | null;
  labelRangeFactor: number;
  labelFontSizeFactor: number;
  onHitInteraction: ActorHitInteraction | null;
  onPlainInteraction: ActorPlainInteraction | null;
  labelElement: HTMLDivElement;
  debugMesh: Mesh;
}

type AttackInteractionKind = 'damage' | 'harvest' | 'smash';

interface AttackProfile {
  duration: number;
  cooldown: number;
  reach: number;
  width: number;
  height: number;
  knockback: number;
  damage: number;
  interactionKind: AttackInteractionKind;
  affectsNpcs: boolean;
  affectsFlowers: boolean;
  affectsTriggers: boolean;
}

interface ActiveAttackState {
  profile: AttackProfile;
  worldDirection: Vec2;
  remaining: number;
  hitTargets: Set<string>;
  facingDirectionIndex: number;
}

interface ActivePlainInteractionState {
  profile: AttackProfile;
  worldDirection: Vec2;
  remaining: number;
  hitTarget: boolean;
  facingDirectionIndex: number;
}

type TerrainSideDirection = 'east' | 'west' | 'south' | 'north';

interface TerrainOpaqueTopColorSpan {
  material: MaterialKey;
  heightTintBaseOpacity: number;
  isEdgeBand: boolean;
  brightness: number;
  startVertex: number;
  vertexCount: number;
}

interface TerrainChunkRender {
  opaqueTopMesh: Mesh | null;
  opaqueTopEdgeMesh: Mesh | null;
  frontTopMesh: InstancedMesh | null;
  frontTopEdgeMesh: InstancedMesh | null;
  opaqueSideMesh: Mesh | null;
  frontSideMesh: InstancedMesh | null;
  opaqueTopColorSpans: TerrainOpaqueTopColorSpan[];
  opaqueTopEdgeColorSpans: TerrainOpaqueTopColorSpan[];
}

interface TerrainFaceBinding {
  type: 'top' | 'top-edge' | 'side';
  rotationY: number;
  frontIndex: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
}

interface TerrainBlockInstance {
  x: number;
  y: number;
  z: number;
  material: MaterialKey;
  heightTintBaseOpacity: number;
  renderColor: Color;
  chunk: TerrainChunkRender;
  topFace: TerrainFaceBinding | null;
  topEdgeFaces: TerrainFaceBinding[];
  sideFaces: TerrainFaceBinding[];
  currentFront: boolean;
}

interface TerrainBlockBuildData {
  x: number;
  y: number;
  z: number;
  material: MaterialKey;
  hasTop: boolean;
  sideDirections: TerrainSideDirection[];
}

interface TerrainChunkBuildData {
  chunkX: number;
  chunkY: number;
  blocks: TerrainBlockBuildData[];
}

interface TerrainGeometryBuffers {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

interface OcclusionTuning {
  lateralRange: number;
  frontMin: number;
  frontMax: number;
  minHeightAboveFeet: number;
  actorHeightPadding: number;
}

interface TerrainOcclusionActor {
  x: number;
  y: number;
  footZ: number;
  bodyHeight: number;
}

interface DragState {
  pointerId: number;
  lastX: number;
  lastY: number;
}

type TeleportTransitionPhase = 'fadeOut' | 'fadeIn';

interface TeleportTransitionState {
  phase: TeleportTransitionPhase;
  timer: number;
  targetMapId: MapId;
  targetX: number;
  targetY: number;
}

interface ScreenFlashState {
  delay: number;
  duration: number;
  elapsed: number;
  maxOpacity: number;
}

type ScreenShakeEnvelope = (progress: number) => number;

interface ScreenShakeState {
  duration: number;
  elapsed: number;
  strength: number;
  frequency: number;
  seed: number;
  envelope: ScreenShakeEnvelope;
}

interface LightingDebugState {
  ambientIntensity: number;
  sunIntensity: number;
  shadowsEnabled: boolean;
  shadowQuality: number;
  sunAngleDegrees: number;
  sunElevationDegrees: number;
  heightTintStrength: number;
  topEdgeBandBrightness: number;
  topEdgeBandWidth: number;
  topEdgeBandLighten: boolean;
}

interface ActorOcclusionDebugState {
  proxyWidthFactor: number;
  proxyHeightFactor: number;
  spriteCameraBias: number;
  proxyCameraBias: number;
  showAttackHurtbox: boolean;
  showTriggerHitboxes: boolean;
}

interface ActorLabelDebugState {
  radius: number;
  fontSize: number;
}

const MAX_RUN_SPEED = 5.4;
const GROUND_ACCEL = 18;
const GROUND_TURN_ACCEL = 34;
const GROUND_START_ACCEL_FACTOR = 0.35;
const GROUND_ACCEL_CURVE = 1.5;
const AIR_ACCEL = 8;
const GROUND_FRICTION = 8;
const AIR_FRICTION = 1.5;
const BASE_JUMP_SPEED = 9.8;
const BASE_RISE_GRAVITY = 16;
const BASE_LOW_JUMP_GRAVITY = 60;
const BASE_FALL_GRAVITY = 42;
const MAX_JUMP_HOLD_TIME = 0.3;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER_TIME = 0.12;
const BASE_STEP_HEIGHT = 0.2;
const BASE_GROUND_SNAP = 0.08;
const MAP_EDGE_PADDING = 0.02;
const PLAYER_COLLISION_RADIUS = 0.2;
const NPC_COLLISION_RADIUS = 0.18;
const WALK_FRAME_TIME = 0.12;
const TELEPORT_FADE_DURATION = 0.25;
const TELEPORT_FLASH_DELAY = 0;
const TELEPORT_FLASH_DURATION = 0.65;
const TELEPORT_FLASH_OPACITY = 0.82;
const WORLDSMITH_SHAKE_DURATION = 0.82;
const WORLDSMITH_SHAKE_STRENGTH = 0.56;
const DEFAULT_SCREEN_SHAKE_FREQUENCY = 28;
const DEFAULT_ACTOR_LABEL_RADIUS = 6.5;
const DEFAULT_ACTOR_LABEL_FONT_SIZE = 24;
const PLAYER_BODY_HEIGHT = 1.2;
const OCCLUSION_HEIGHT_EPSILON = 0.01;
const VIEW_NAMES = ['N', 'E', 'S', 'W'] as const;
const SCREEN_DIRECTION_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 24;
const CHARACTER_SCALE = 1.35;
const FRUSTUM_HEIGHT = 18;
const MAP_WIDTH = 168;
const MAP_HEIGHT = 144;
const HUB_WORLD_MAP_WIDTH = 30;
const HUB_WORLD_MAP_HEIGHT = 30;
const OVERWORLD_SPAWN: Vec2 = { x: 12.5, y: 12.5 };
const OVERWORLD_TELEPORT_TILE: Vec2 = { x: 27, y: 12 };
const HUB_WORLD_TELEPORT_TILE: Vec2 = { x: 15, y: 18 };
const HUB_WORLD_SPAWN: Vec2 = { x: 15.5, y: 18.5 };
const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 300;
const DEFAULT_CAMERA_DISTANCE = 25;
const DEFAULT_CAMERA_HEIGHT = 25;
const DEFAULT_BLOCK_HEIGHT_SCALE = 0.382;
const DEFAULT_AMBIENT_INTENSITY = 1.35;
const DEFAULT_SUN_INTENSITY = 1.15;
const DEFAULT_SUN_AZIMUTH = Math.PI / 4;
const DEFAULT_SUN_ELEVATION = 0.9;
const DEFAULT_HEIGHT_TINT_STRENGTH = 0.35;
const DEFAULT_SHADOW_QUALITY = 1024;
const FREE_CAMERA_MIN_PITCH = 0.38;
const FREE_CAMERA_MAX_PITCH = 1.2;
const AIRBORNE_FRAME_INDEX = 0;
const SHADOW_CAMERA_RADIUS = 14;
const HUD_UPDATE_INTERVAL = 1;
const MAP_GENERATION_SEED = 0x51f15e;
const DEFAULT_MOBILE_NPC_COUNT = 8;
const DEFAULT_STATIONARY_NPC_COUNT = DEFAULT_MOBILE_NPC_COUNT * 4;
const DEFAULT_STURDY_NPC_COUNT = 6;
const DEFAULT_FLOWER_COUNT = 96;
const INITIAL_CRYSTAL_COUNT = 7;
const OVERWORLD_CRYSTAL_PICKUP_COUNT = 2;
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
const MOBILE_NPC_TINT = '#74a9ff';
const STATIONARY_NPC_TINT = '#ff7979';
const STURDY_NPC_TINT = '#777777';
const NPC_TOUCH_FLASH_TINT = '#ffe66d';
const NPC_TOUCH_FLASH_TIME = 0.18;
const NPC_TOUCH_FLASH_COLOR = new Color(NPC_TOUCH_FLASH_TINT);
const ATTACK_FLASH_TIME = 0.24;
const ATTACK_FLASH_COLOR = new Color('#ff3b3b');
const FLOWER_BASE_COLOR = new Color('#ffffff');
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
const HUB_SEED_LABEL_PREFIX = 'Overworld seed';
const KNOCKBACK_DECAY = 10;
const KNOCKBACK_STOP_SPEED = 0.08;
const ACTOR_ALIVE_RADIUS = 28;
const NPC_SPAWN_EXCLUSION_RADIUS = 9;
const FLOWER_SHEET_COLUMNS = 6;
const FLOWER_SHEET_ROWS = 2;
const FLOWER_VARIANT_COUNT = FLOWER_SHEET_COLUMNS * FLOWER_SHEET_ROWS;
const FLOWER_COLLISION_RADIUS = 0.17;
const NPC_IDLE_MIN_TIME = 0.9;
const NPC_IDLE_MAX_TIME = 2.8;
const NPC_MOVE_MIN_TIME = 1.4;
const NPC_MOVE_MAX_TIME = 3.4;
const NPC_WALK_SPEED_MIN = 0.38;
const NPC_WALK_SPEED_MAX = 0.72;
const FLOWER_WORLD_WIDTH = 1.84;
const FLOWER_WORLD_HEIGHT = 1.84;
const FLOWER_SHADOW_SCALE = 0.62;
const CRYSTAL_SHEET_CELL_SIZE = 16;
const CRYSTAL_SHEET_FRAME_X = 1;
const CRYSTAL_SHEET_FRAME_Y = 1;
const CRYSTAL_WORLD_WIDTH = 0.68;
const CRYSTAL_WORLD_HEIGHT = 0.68;
const CRYSTAL_COLLISION_RADIUS = 0.28;
const CRYSTAL_SHADOW_SCALE = 0.38;
const CRYSTAL_LABEL_RANGE_FACTOR = 0.31;
const CRYSTAL_LABEL_FONT_SIZE_FACTOR = 0.62;
const DEFAULT_ATTACK_PROFILE: AttackProfile = {
  duration: 0.3,
  cooldown: 0.22,
  reach: 0.95,
  width: 0.9,
  height: 1.2,
  knockback: 18.4,
  damage: 1,
  interactionKind: 'damage',
  affectsNpcs: true,
  affectsFlowers: true,
  affectsTriggers: true
};
const DEFAULT_PLAIN_INTERACTION_PROFILE: AttackProfile = {
  ...DEFAULT_ATTACK_PROFILE,
  duration: 0.08,
  cooldown: 0,
  knockback: 0,
  damage: 0,
  interactionKind: 'smash'
};
const TERRAIN_CHUNK_SIZE = 16;
const ACTOR_DEPTH_PROXY_RENDER_ORDER = -10;
const ACTOR_SHADOW_RENDER_ORDER = 10;
const ACTOR_SPRITE_RENDER_ORDER = 11;
const ACTOR_SORT_RENDER_ORDER_BASE = 40;
const ACTOR_SORT_RENDER_ORDER_SCALE = 100;
const DEFAULT_ACTOR_SPRITE_CAMERA_BIAS = 0.03;
const DEFAULT_ACTOR_DEPTH_PROXY_CAMERA_BIAS = 0.01;
const DEPTH_TESTED_SPRITE_CAMERA_BIAS_MULTIPLIER = 6;
const ACTOR_SPRITE_WORLD_WIDTH = CHARACTER_SCALE * (CHARACTER_FRAME_WIDTH / CHARACTER_FRAME_HEIGHT);
const DEFAULT_ACTOR_DEPTH_PROXY_WIDTH_FACTOR = 0.72;
const DEFAULT_ACTOR_DEPTH_PROXY_HEIGHT_FACTOR = 0.92;
const NPC_DEPTH_PROXY_WIDTH_FACTOR = 0.98;
const NPC_DEPTH_PROXY_HEIGHT_FACTOR = 1.02;
const FLOWER_DEPTH_PROXY_WIDTH_FACTOR = 0.94;
const FLOWER_DEPTH_PROXY_HEIGHT_FACTOR = 1;
const PLAYER_DEPTH_PROXY_WIDTH = ACTOR_SPRITE_WORLD_WIDTH * DEFAULT_ACTOR_DEPTH_PROXY_WIDTH_FACTOR;
const PLAYER_DEPTH_PROXY_HEIGHT = PLAYER_BODY_HEIGHT * DEFAULT_ACTOR_DEPTH_PROXY_HEIGHT_FACTOR;
const NPC_BODY_HEIGHT = 1.1;
const NPC_DEPTH_PROXY_WIDTH = ACTOR_SPRITE_WORLD_WIDTH * NPC_DEPTH_PROXY_WIDTH_FACTOR;
const NPC_DEPTH_PROXY_HEIGHT = NPC_BODY_HEIGHT * NPC_DEPTH_PROXY_HEIGHT_FACTOR;
const FLOWER_BODY_HEIGHT = 0.72;
const FLOWER_DEPTH_PROXY_WIDTH = FLOWER_WORLD_WIDTH * FLOWER_DEPTH_PROXY_WIDTH_FACTOR;
const FLOWER_DEPTH_PROXY_HEIGHT = FLOWER_BODY_HEIGHT * FLOWER_DEPTH_PROXY_HEIGHT_FACTOR;
const ATTACK_HURTBOX_ELEVATION = 0.04;
const INTERACTION_HURTBOX_ELEVATION = 0.06;
const DEFAULT_TERRAIN_TOP_EDGE_BAND_WIDTH = 0.12;
const TERRAIN_TOP_EDGE_BAND_ELEVATION = 0.01;
const DEFAULT_TERRAIN_TOP_EDGE_BAND_BRIGHTNESS = 0.62;
const HIDDEN_TERRAIN_INSTANCE_Y = -10000;
const HIDDEN_TERRAIN_INSTANCE_SCALE = 0.0001;
const DEFAULT_OCCLUSION_TUNING: OcclusionTuning = {
  lateralRange: 0.4,
  frontMin: 0.7,
  frontMax: 2.75,
  minHeightAboveFeet: 0,
  actorHeightPadding: 0.9
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const approach = (value: number, target: number, delta: number): number => {
  if (value < target) {
    return Math.min(value + delta, target);
  }

  return Math.max(value - delta, target);
};

const lerp = (start: number, end: number, t: number): number => start + (end - start) * t;

const length = (x: number, y: number): number => Math.hypot(x, y);

const easeInOut = (progress: number): number =>
  0.5 - Math.cos(clamp(progress, 0, 1) * Math.PI) * 0.5;

const screenShakeFalloffEnvelope: ScreenShakeEnvelope = (progress) =>
  Math.pow(1 - clamp(progress, 0, 1), 2);

const screenShakeEaseInOutEnvelope: ScreenShakeEnvelope = (progress) =>
  Math.sin(easeInOut(progress) * Math.PI);

const getMoveKeyScreenDirection = (code: string): Vec2 | null => {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return { x: 0, y: 1 };
    case 'KeyS':
    case 'ArrowDown':
      return { x: 0, y: -1 };
    case 'KeyA':
    case 'ArrowLeft':
      return { x: -1, y: 0 };
    case 'KeyD':
    case 'ArrowRight':
      return { x: 1, y: 0 };
    default:
      return null;
  }
};

const getCompassDirection = (x: number, y: number): string => {
  const angle = Math.atan2(y, x);
  const octant = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return SCREEN_DIRECTION_NAMES[octant];
};

class InputController {
  private readonly keys = new Set<string>();
  private readonly moveKeyPressOrder: string[] = [];
  private jumpQueued = false;
  private attackQueued = false;
  private interactQueued = false;
  private rotateQueued = 0;
  private freeCameraToggleQueued = false;

  constructor() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) {
          this.jumpQueued = true;
        }
      }

      if (event.code === 'Tab') {
        event.preventDefault();
        if (!event.repeat) {
          this.rotateQueued += event.shiftKey ? -1 : 1;
        }
      }

      if (event.code === 'Backquote') {
        event.preventDefault();
        if (!event.repeat) {
          this.freeCameraToggleQueued = true;
        }
      }

      if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat) {
        this.attackQueued = true;
      }

      if (event.code === 'KeyE' && !event.repeat) {
        this.interactQueued = true;
      }

      if (getMoveKeyScreenDirection(event.code) && !event.repeat) {
        const existingIndex = this.moveKeyPressOrder.indexOf(event.code);
        if (existingIndex >= 0) {
          this.moveKeyPressOrder.splice(existingIndex, 1);
        }
        this.moveKeyPressOrder.push(event.code);
      }

      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);

      const existingIndex = this.moveKeyPressOrder.indexOf(event.code);
      if (existingIndex >= 0) {
        this.moveKeyPressOrder.splice(existingIndex, 1);
      }
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.moveKeyPressOrder.length = 0;
      this.jumpQueued = false;
      this.attackQueued = false;
      this.interactQueued = false;
      this.rotateQueued = 0;
      this.freeCameraToggleQueued = false;
    });
  }

  public getScreenMoveVector(): Vec2 {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      y += 1;
    }

    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      y -= 1;
    }

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      x -= 1;
    }

    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      x += 1;
    }

    const magnitude = length(x, y);
    if (magnitude > 0) {
      x /= magnitude;
      y /= magnitude;
    }

    return { x, y };
  }

  public getFacingScreenMoveVector(): Vec2 | null {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      y += 1;
    }

    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      y -= 1;
    }

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      x -= 1;
    }

    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      x += 1;
    }

    if (
      x === 0 &&
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) &&
      (this.keys.has('KeyD') || this.keys.has('ArrowRight'))
    ) {
      x = this.getLatestHeldAxisDirection('x');
    }

    if (
      y === 0 &&
      (this.keys.has('KeyW') || this.keys.has('ArrowUp')) &&
      (this.keys.has('KeyS') || this.keys.has('ArrowDown'))
    ) {
      y = this.getLatestHeldAxisDirection('y');
    }

    const magnitude = length(x, y);
    return magnitude > 0 ? { x: x / magnitude, y: y / magnitude } : null;
  }

  private getLatestHeldAxisDirection(axis: 'x' | 'y'): number {
    for (let index = this.moveKeyPressOrder.length - 1; index >= 0; index -= 1) {
      const code = this.moveKeyPressOrder[index];
      if (!this.keys.has(code)) {
        continue;
      }

      const direction = getMoveKeyScreenDirection(code);
      if (!direction) {
        continue;
      }

      const axisValue = axis === 'x' ? direction.x : direction.y;
      if (axisValue !== 0) {
        return axisValue;
      }
    }

    return 0;
  }

  public consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  public consumeAttack(): boolean {
    const queued = this.attackQueued;
    this.attackQueued = false;
    return queued;
  }

  public consumeInteract(): boolean {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  public consumeRotate(): number {
    const queued = this.rotateQueued;
    this.rotateQueued = 0;
    return queued;
  }

  public consumeFreeCameraToggle(): boolean {
    const queued = this.freeCameraToggleQueued;
    this.freeCameraToggleQueued = false;
    return queued;
  }

  public isJumpHeld(): boolean {
    return this.keys.has('Space');
  }
}

function mapIndex(map: MapData, x: number, y: number): number {
  return y * map.width + x;
}

function getCell(map: MapData, x: number, y: number): Cell {
  return map.cells[mapIndex(map, x, y)];
}

function getHeight(map: MapData, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return 0;
  }

  return getCell(map, x, y).height;
}

function getBlockMaterial(map: MapData, x: number, y: number, z: number): MaterialKey {
  const cell = getCell(map, x, y);
  return cell.materials[z] ?? cell.materials[cell.materials.length - 1] ?? 'stone';
}

function setColumn(
  map: MapData,
  x: number,
  y: number,
  height: number,
  materials: MaterialKey[]
): void {
  const cell = getCell(map, x, y);
  cell.height = height;
  cell.materials = Array.from({ length: height }, (_, z) =>
    materials[z] ?? materials[materials.length - 1] ?? 'stone'
  );
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

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

function createWorldGenerationFactors(seed: number): WorldGenerationFactors {
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
): Pick<MapSpawnConfig, 'mobileNpcCount' | 'stationaryNpcCount' | 'sturdyNpcCount' | 'flowerCount'> {
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

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v);
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

  const normalized = value / Math.max(amplitudeSum, 0.0001);
  return clamp(normalized * 0.5 + 0.5, 0, 1);
}

function ridgedNoise2D(
  seed: number,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  const base = octavePerlin2D(seed, x, y, octaves, persistence, lacunarity);
  return 1 - Math.abs(base * 2 - 1);
}

function chooseWeightedMaterial(
  seed: number,
  x: number,
  y: number,
  z: number,
  weights: Partial<Record<MaterialKey, number>>
): MaterialKey {
  const entries = Object.entries(weights) as [MaterialKey, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + Math.max(weight, 0), 0);
  let pick = hashUnit(seed + 401, x, y, z) * totalWeight;

  for (const [material, weight] of entries) {
    pick -= Math.max(weight, 0);
    if (pick <= 0) {
      return material;
    }
  }

  return entries[entries.length - 1]?.[0] ?? 'stone';
}

function biasWeightsTowardDominantMaterial(
  weights: Partial<Record<MaterialKey, number>>,
  dominantMaterial: TerrainMaterialKey | null,
  bonusWeight: number
): Partial<Record<MaterialKey, number>> {
  if (!dominantMaterial) {
    return weights;
  }

  const biasedWeights: Partial<Record<MaterialKey, number>> = {};

  for (const material of TERRAIN_MATERIAL_KEYS) {
    const weight = weights[material] ?? 0;
    biasedWeights[material] = material === dominantMaterial ? weight + bonusWeight : weight * 0.25;
  }

  return biasedWeights;
}

function buildColumnMaterials(
  seed: number,
  x: number,
  y: number,
  height: number,
  elevation: number,
  moisture: number,
  roughness: number,
  dominantMaterial: TerrainMaterialKey | null = null
): MaterialKey[] {
  const materials: MaterialKey[] = [];
  const isDryLowland = elevation < 0.42 && moisture < 0.48;
  const topMaterial = chooseWeightedMaterial(
    seed,
    x,
    y,
    height,
    biasWeightsTowardDominantMaterial(
      {
        sand: isDryLowland ? 3.6 : 0.5 + Math.max(0, 0.45 - moisture) * 1.7,
        grass: 1.8 + moisture * 1.2 + Math.max(0, elevation - 0.4),
        moss: 0.9 + moisture * 1.8 + roughness * 0.7,
        stone: 0.45 + Math.max(0, elevation - 0.7) * 1.8 + roughness * 0.5
      },
      dominantMaterial,
      18
    )
  );

  for (let z = 0; z < height; z += 1) {
    const depthFromTop = height - z - 1;

    if (depthFromTop === 0) {
      materials.push(topMaterial);
      continue;
    }

    if (depthFromTop === 1) {
      materials.push(
        chooseWeightedMaterial(
          seed,
          x,
          y,
          z,
          biasWeightsTowardDominantMaterial(
            {
              sand: topMaterial === 'sand' ? 1.8 : 0.35,
              grass: topMaterial === 'grass' ? 1.4 : 0.3,
              moss: topMaterial === 'moss' ? 1.5 : 0.7 + moisture * 0.8,
              stone: 1.8 + roughness * 0.9 + Math.max(0, elevation - 0.55)
            },
            dominantMaterial,
            14
          )
        )
      );
      continue;
    }

    materials.push(
      chooseWeightedMaterial(
        seed,
        x,
        y,
        z,
        biasWeightsTowardDominantMaterial(
          {
            sand: isDryLowland ? 0.7 : 0.15,
            grass: 0.1,
            moss: 1 + moisture * 0.6,
            stone: 3 + roughness * 1.4 + elevation
          },
          dominantMaterial,
          12
        )
      )
    );
  }

  return materials;
}

function getOverworldSeedLabel(seed: number): string {
  return `${HUB_SEED_LABEL_PREFIX}: ${seed.toString(16).padStart(8, '0')}`;
}

function getActorPopulationLabel(actorPopulation: ActorPopulationFactor): string {
  switch (actorPopulation) {
    case 'flowers':
      return 'flowers';
    case 'humans':
      return 'humans';
    case 'mixed':
      return 'flowers + humans';
  }
}

function getWorldGenerationFactorLabel(factors: WorldGenerationFactors | null): string {
  if (!factors) {
    return 'World factors: default startup profile';
  }

  return (
    `World factors: ${getActorPopulationLabel(factors.actorPopulation)}, ` +
    `${factors.dominantMaterial} blocks, ` +
    `${factors.terrainScale.label} noise, ` +
    `${factors.terrainRelief.label} relief`
  );
}

function getRandomOverworldTeleportTile(seed: number): Vec2 {
  const random = createSeededRandom(seed ^ 0x7e1e90);
  return {
    x: 22 + Math.floor(random() * (MAP_WIDTH - 44)),
    y: 14 + Math.floor(random() * (MAP_HEIGHT - 28))
  };
}

function createOverworldMap(
  seed = MAP_GENERATION_SEED,
  teleportTile: Vec2 = OVERWORLD_TELEPORT_TILE,
  useProceduralFactors = false
): MapData {
  const generationFactors = useProceduralFactors ? createWorldGenerationFactors(seed) : null;
  const spawnConfig = getSpawnConfigForActorPopulation(
    generationFactors?.actorPopulation ?? null
  );
  const terrainScale = generationFactors?.terrainScale ?? TERRAIN_SCALE_FACTORS[1];
  const terrainRelief = generationFactors?.terrainRelief ?? TERRAIN_RELIEF_FACTORS[1];
  const dominantMaterial = generationFactors?.dominantMaterial ?? null;
  const map: MapData = {
    id: 'overworld',
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    cells: Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => ({
      height: 0,
      materials: []
    })),
    teleports: [
      {
        x: teleportTile.x,
        y: teleportTile.y,
        targetMapId: 'hubWorld',
        targetX: HUB_WORLD_SPAWN.x,
        targetY: HUB_WORLD_SPAWN.y
      }
    ],
    generationFactors,
    spawns: {
      mobileNpcCount: spawnConfig.mobileNpcCount,
      stationaryNpcCount: spawnConfig.stationaryNpcCount,
      sturdyNpcCount: spawnConfig.sturdyNpcCount,
      fixedSturdyNpcs: [],
      fixedTriggers: [
        {
          x: 19.5,
          y: 12.5,
          width: 1.2,
          depth: 1.2,
          height: 1.1,
          displayName: 'Old Marker',
          labelRangeFactor: 1.15
        },
        {
          x: 23.5,
          y: 13.5,
          width: 0.7,
          depth: 0.7,
          height: 0.8,
          displayName: null,
          labelRangeFactor: 0.6
        }
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
      const moisture = octavePerlin2D(
        seed + 67,
        (x - 60) * terrainScale.moistureFrequency,
        (y + 110) * terrainScale.moistureFrequency,
        3,
        0.5,
        2
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
      const ridgeBoost = ridgeSignal * ridgeRegion;
      const normalizedHeightField = clamp(
        baseHeightField * terrainRelief.baseWeight +
          ridgeBoost * terrainRelief.ridgeStrength +
          roughness * 0.025,
        0,
        1
      );
      const shapedHeightField = normalizedHeightField;
      const terracedHeight = clamp(
        1 + Math.round(shapedHeightField * (terrainRelief.maxHeight - 1)),
        1,
        terrainRelief.maxHeight
      );
      const materials = buildColumnMaterials(
        seed,
        x,
        y,
        terracedHeight,
        shapedHeightField,
        moisture,
        roughness,
        dominantMaterial
      );
      const cell = getCell(map, x, y);
      cell.height = terracedHeight;
      cell.materials = materials;
    }
  }

  const spawnHeight = 2;
  for (let y = 10; y <= 14; y += 1) {
    for (let x = 10; x <= 14; x += 1) {
      setColumn(
        map,
        x,
        y,
        spawnHeight,
        buildColumnMaterials(seed, x, y, spawnHeight, 0.5, 0.58, 0.32, dominantMaterial)
      );
    }
  }

  const teleportCell = getCell(map, teleportTile.x, teleportTile.y);
  teleportCell.materials = [
    ...teleportCell.materials.slice(0, -1),
    'portal'
  ];

  return map;
}

function createHubWorldMap(
  overworldSeed = MAP_GENERATION_SEED,
  overworldTeleportTile: Vec2 = OVERWORLD_TELEPORT_TILE
): MapData {
  const map: MapData = {
    id: 'hubWorld',
    width: HUB_WORLD_MAP_WIDTH,
    height: HUB_WORLD_MAP_HEIGHT,
    cells: Array.from({ length: HUB_WORLD_MAP_WIDTH * HUB_WORLD_MAP_HEIGHT }, () => ({
      height: 0,
      materials: []
    })),
    teleports: [
      {
        x: HUB_WORLD_TELEPORT_TILE.x,
        y: HUB_WORLD_TELEPORT_TILE.y,
        targetMapId: 'overworld',
        targetX: overworldTeleportTile.x + 0.5,
        targetY: overworldTeleportTile.y + 0.5
      }
    ],
    generationFactors: null,
    spawns: {
      mobileNpcCount: 0,
      stationaryNpcCount: 0,
      sturdyNpcCount: 0,
      fixedSturdyNpcs: [
        {
          x: 13.5,
          y: 16.5,
          displayName: 'Worldsmith',
          onPlainInteraction: 'regenerateOverworld'
        }
      ],
      fixedTriggers: [
        {
          x: HUB_WORLD_TELEPORT_TILE.x + 0.5,
          y: HUB_WORLD_TELEPORT_TILE.y + 0.5,
          width: 2.2,
          depth: 2.2,
          height: 2.6,
          displayName: getOverworldSeedLabel(overworldSeed),
          labelRangeFactor: 99,
          labelFontSizeFactor: 1.25
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
      const height = clamp(3 - Math.floor(rim * 2.5) + (noise > 0.72 ? 1 : 0), 1, 3);
      setColumn(
        map,
        x,
        y,
        height,
        buildColumnMaterials(MAP_GENERATION_SEED, x + 300, y + 300, height, 0.48, 0.7, 0.22)
      );
    }
  }

  const portalHeight = 2;
  for (let y = 13; y <= 19; y += 1) {
    for (let x = 13; x <= 17; x += 1) {
      setColumn(
        map,
        x,
        y,
        portalHeight,
        buildColumnMaterials(MAP_GENERATION_SEED, x + 300, y + 300, portalHeight, 0.48, 0.7, 0.22)
      );
    }
  }

  setColumn(map, HUB_WORLD_TELEPORT_TILE.x, HUB_WORLD_TELEPORT_TILE.y, portalHeight, [
    'stone',
    'portal'
  ]);

  return map;
}

function createTerrainTopGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.5, 0);
  const colorValues = new Array(geometry.getAttribute('position').count * 3).fill(1);
  geometry.setAttribute('color', new Float32BufferAttribute(colorValues, 3));
  return geometry;
}

function createTerrainSideGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(1, 1).translate(0, 0, 0.5);
  const colorValues = new Array(geometry.getAttribute('position').count * 3).fill(1);
  geometry.setAttribute('color', new Float32BufferAttribute(colorValues, 3));
  return geometry;
}

function getTerrainSideRotation(direction: TerrainSideDirection): number {
  switch (direction) {
    case 'east':
      return Math.PI / 2;
    case 'west':
      return -Math.PI / 2;
    case 'south':
      return 0;
    case 'north':
      return Math.PI;
  }
}

function loadFrameTexture(
  image: HTMLImageElement,
  column: number,
  row: number,
  frameWidth = CHARACTER_FRAME_WIDTH,
  frameHeight = CHARACTER_FRAME_HEIGHT,
  contextLabel = 'frame'
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error(`Failed to create 2D context for ${contextLabel} extraction.`);
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    column * frameWidth,
    row * frameHeight,
    frameWidth,
    frameHeight,
    0,
    0,
    frameWidth,
    frameHeight
  );

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function getFrameDataUrl(
  image: HTMLImageElement,
  column: number,
  row: number,
  frameWidth: number,
  frameHeight: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create 2D context for crystal counter icon extraction.');
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    column * frameWidth,
    row * frameHeight,
    frameWidth,
    frameHeight,
    0,
    0,
    frameWidth,
    frameHeight
  );
  return canvas.toDataURL('image/png');
}

export class ThreeIsoGame {
  private readonly root: HTMLDivElement;
  private readonly hudStatus: HTMLDivElement;
  private readonly compassLabels: Record<'top' | 'right' | 'bottom' | 'left', HTMLSpanElement>;
  private readonly renderer = new WebGLRenderer({ antialias: false, alpha: true });
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(
    -10,
    10,
    10,
    -10,
    CAMERA_NEAR,
    CAMERA_FAR
  );
  private readonly terrainGroup = new Group();
  private readonly actorDepthGroup = new Group();
  private readonly actorGroup = new Group();
  private readonly actorLabelLayer = document.createElement('div');
  private readonly screenFlashLayer = document.createElement('div');
  private readonly crystalCounterElement = document.createElement('div');
  private readonly crystalCounterValue = document.createElement('span');
  private readonly input = new InputController();
  private currentOverworldSeed = MAP_GENERATION_SEED;
  private currentOverworldTeleportTile: Vec2 = { ...OVERWORLD_TELEPORT_TILE };
  private readonly maps: Record<MapId, MapData> = {
    overworld: createOverworldMap(),
    hubWorld: createHubWorldMap()
  };
  private map: MapData = this.maps.overworld;
  private readonly terrainBlocks: TerrainBlockInstance[] = [];
  private readonly terrainBlockColumns = new Map<string, TerrainBlockInstance[]>();
  private readonly terrainChunks: TerrainChunkRender[] = [];
  private readonly frameTextures: CanvasTexture[][];
  private readonly flowerFrameTextures: CanvasTexture[];
  private readonly crystalFrameTexture: CanvasTexture;
  private readonly spriteMaterial: SpriteMaterial;
  private readonly playerSprite: Sprite;
  private readonly playerDepthProxy: Mesh;
  private readonly shadowMesh: Mesh;
  private readonly npcs: NpcState[] = [];
  private readonly flowers: FlowerState[] = [];
  private readonly crystals: CrystalPickupState[] = [];
  private readonly triggers: TriggerState[] = [];
  private readonly occupiedActorTiles = new Set<string>();
  private readonly collectedCrystalIds = new Set<string>();
  private readonly terrainTopGeometry = createTerrainTopGeometry();
  private readonly terrainSideGeometry = createTerrainSideGeometry();
  private readonly shadowGeometry = new CircleGeometry(0.26, 24);
  private readonly attackDebugGeometry = new BoxGeometry(1, 1, 1);
  private readonly triggerDebugGeometry = new BoxGeometry(1, 1, 1);
  private readonly playerDepthProxyGeometry = new BoxGeometry(
    PLAYER_DEPTH_PROXY_WIDTH,
    PLAYER_DEPTH_PROXY_HEIGHT,
    PLAYER_DEPTH_PROXY_WIDTH
  );
  private readonly npcDepthProxyGeometry = new BoxGeometry(
    NPC_DEPTH_PROXY_WIDTH,
    NPC_DEPTH_PROXY_HEIGHT,
    NPC_DEPTH_PROXY_WIDTH
  );
  private readonly flowerDepthProxyGeometry = new BoxGeometry(
    FLOWER_DEPTH_PROXY_WIDTH,
    FLOWER_DEPTH_PROXY_HEIGHT,
    FLOWER_DEPTH_PROXY_WIDTH
  );
  private readonly crystalDepthProxyGeometry = new BoxGeometry(
    CRYSTAL_WORLD_WIDTH * 0.45,
    CRYSTAL_WORLD_HEIGHT * 0.8,
    CRYSTAL_WORLD_WIDTH * 0.45
  );
  private readonly actorShadowMaterial = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide
  });
  private readonly attackDebugMaterial = new MeshBasicMaterial({
    color: 0xff4f4f,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: false
  });
  private readonly interactionDebugMaterial = new MeshBasicMaterial({
    color: 0x43ff72,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: false
  });
  private readonly triggerDebugMaterial = new MeshBasicMaterial({
    color: 0x00f6ff,
    transparent: true,
    opacity: 0.85,
    wireframe: true,
    depthWrite: false,
    depthTest: false
  });
  private readonly actorDepthProxyMaterial = (() => {
    const material = new MeshBasicMaterial();
    material.colorWrite = false;
    material.depthWrite = true;
    material.depthTest = true;
    return material;
  })();
  private readonly terrainOpaqueMaterial = new MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true
  });
  private readonly terrainTopEdgeMaterial = new MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  private readonly terrainFrontTopEdgeMaterial = new MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false
  });
  private readonly terrainFrontMaterial = new MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  private readonly reusableTerrainMatrix = new Matrix4();
  private readonly hiddenTerrainMatrix = new Matrix4();
  private readonly reusableTerrainPosition = new Vector3();
  private readonly reusableTerrainScale = new Vector3();
  private readonly reusableTerrainQuaternion = new Quaternion();
  private readonly reusableTerrainAxisY = new Vector3(0, 1, 0);
  private readonly reusableCameraDirection = new Vector3();
  private readonly cameraShakeOffset = new Vector3();
  private readonly cameraShakeWorldRight = new Vector3();
  private readonly cameraShakeWorldUp = new Vector3();
  private readonly cameraShakeFocus = new Vector3();
  private readonly cameraFocus = new Vector3();
  private readonly cameraDesiredFocus = new Vector3();
  private readonly screenVelocity = new Vector2();
  private readonly occlusionTuning: OcclusionTuning = { ...DEFAULT_OCCLUSION_TUNING };
  private readonly ambientLight = new AmbientLight(0xffffff, DEFAULT_AMBIENT_INTENSITY);
  private readonly sunLight = new DirectionalLight(0xfff1d6, DEFAULT_SUN_INTENSITY);
  private readonly attackDebugMesh = new Mesh(this.attackDebugGeometry, this.attackDebugMaterial);
  private readonly interactionDebugMesh = new Mesh(
    this.attackDebugGeometry,
    this.interactionDebugMaterial
  );
  private shadowQuality = DEFAULT_SHADOW_QUALITY;
  private heightTintStrength = DEFAULT_HEIGHT_TINT_STRENGTH;
  private terrainTopEdgeBandBrightness = DEFAULT_TERRAIN_TOP_EDGE_BAND_BRIGHTNESS;
  private terrainTopEdgeBandWidth = DEFAULT_TERRAIN_TOP_EDGE_BAND_WIDTH;
  private terrainTopEdgeBandLighten = false;
  private actorDepthProxyWidthFactor = DEFAULT_ACTOR_DEPTH_PROXY_WIDTH_FACTOR;
  private actorDepthProxyHeightFactor = DEFAULT_ACTOR_DEPTH_PROXY_HEIGHT_FACTOR;
  private actorSpriteCameraBias = DEFAULT_ACTOR_SPRITE_CAMERA_BIAS;
  private actorDepthProxyCameraBias = DEFAULT_ACTOR_DEPTH_PROXY_CAMERA_BIAS;
  private actorLabelRadius = DEFAULT_ACTOR_LABEL_RADIUS;
  private actorLabelFontSize = DEFAULT_ACTOR_LABEL_FONT_SIZE;
  private showAttackHurtbox = true;
  private showTriggerHitboxes = false;
  private sunAzimuth = DEFAULT_SUN_AZIMUTH;
  private sunElevation = DEFAULT_SUN_ELEVATION;
  private dragState: DragState | null = null;
  // Debug-only terrain inspection camera. This is intentionally not a gameplay camera:
  // it does not drive compass logic, control remapping, or quarter-turn view state.
  private freeCameraEnabled = false;
  private cameraDistance = DEFAULT_CAMERA_DISTANCE;
  private cameraHeight = DEFAULT_CAMERA_HEIGHT;
  private blockHeightScale = DEFAULT_BLOCK_HEIGHT_SCALE;
  private cameraYaw = Math.PI / 4;
  private cameraPitch = 0.62;
  private walkTime = 0;
  private currentDirection = 4;
  private viewRotation = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpHoldTimer = 0;
  private hudUpdateTimer = 0;
  private lastFrameTime = performance.now();
  private attackCooldownTimer = 0;
  private activeAttack: ActiveAttackState | null = null;
  private activePlainInteraction: ActivePlainInteractionState | null = null;
  private teleportArmed = true;
  private teleportTransition: TeleportTransitionState | null = null;
  private screenFlash: ScreenFlashState | null = null;
  private screenShake: ScreenShakeState | null = null;
  private playerOpacity = 1;
  private crystalCount = INITIAL_CRYSTAL_COUNT;

  private readonly player: PlayerState = {
    x: OVERWORLD_SPAWN.x,
    y: OVERWORLD_SPAWN.y,
    z: DEFAULT_BLOCK_HEIGHT_SCALE,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true
  };

  public constructor(
    root: HTMLDivElement,
    hudStatus: HTMLDivElement,
    compass: HTMLDivElement,
    characterImage: HTMLImageElement,
    flowerImage: HTMLImageElement,
    crystalSheetImage: HTMLImageElement
  ) {
    this.root = root;
    this.hudStatus = hudStatus;
    this.compassLabels = {
      top: this.getCompassLabel(compass, 'top'),
      right: this.getCompassLabel(compass, 'right'),
      bottom: this.getCompassLabel(compass, 'bottom'),
      left: this.getCompassLabel(compass, 'left')
    };

    this.frameTextures = Array.from({ length: 8 }, (_, direction) => [
      loadFrameTexture(characterImage, direction, 1),
      loadFrameTexture(characterImage, direction, 2),
      loadFrameTexture(characterImage, direction, 3)
    ]);
    const flowerFrameWidth = Math.floor(flowerImage.width / FLOWER_SHEET_COLUMNS);
    const flowerFrameHeight = Math.floor(flowerImage.height / FLOWER_SHEET_ROWS);
    this.flowerFrameTextures = Array.from(
      { length: FLOWER_VARIANT_COUNT },
      (_, index) =>
        loadFrameTexture(
          flowerImage,
          index % FLOWER_SHEET_COLUMNS,
          Math.floor(index / FLOWER_SHEET_COLUMNS),
          flowerFrameWidth,
          flowerFrameHeight,
          'flower frame'
        )
    );
    this.crystalFrameTexture = loadFrameTexture(
      crystalSheetImage,
      CRYSTAL_SHEET_FRAME_X,
      CRYSTAL_SHEET_FRAME_Y,
      CRYSTAL_SHEET_CELL_SIZE,
      CRYSTAL_SHEET_CELL_SIZE,
      'crystal pickup'
    );
    const crystalCounterIcon = document.createElement('img');
    crystalCounterIcon.alt = '';
    crystalCounterIcon.src = getFrameDataUrl(
      crystalSheetImage,
      CRYSTAL_SHEET_FRAME_X,
      CRYSTAL_SHEET_FRAME_Y,
      CRYSTAL_SHEET_CELL_SIZE,
      CRYSTAL_SHEET_CELL_SIZE
    );
    this.crystalCounterElement.className = 'crystal-counter';
    this.crystalCounterElement.append(this.crystalCounterValue, crystalCounterIcon);
    this.updateCrystalCounter();

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = BasicShadowMap;
    this.root.prepend(this.renderer.domElement);
    this.actorLabelLayer.className = 'actor-label-layer';
    this.root.appendChild(this.actorLabelLayer);
    this.screenFlashLayer.className = 'screen-flash';
    this.root.appendChild(this.screenFlashLayer);
    this.root.appendChild(this.crystalCounterElement);

    this.scene.background = new Color('#111821');
    this.hiddenTerrainMatrix.makeScale(
      HIDDEN_TERRAIN_INSTANCE_SCALE,
      HIDDEN_TERRAIN_INSTANCE_SCALE,
      HIDDEN_TERRAIN_INSTANCE_SCALE
    );
    this.hiddenTerrainMatrix.setPosition(0, HIDDEN_TERRAIN_INSTANCE_Y, 0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(this.shadowQuality, this.shadowQuality);
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 0;
    this.scene.add(this.ambientLight);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.scene.add(this.terrainGroup);
    this.scene.add(this.actorDepthGroup);
    this.applyTerrainScale();
    this.scene.add(this.actorGroup);
    this.attackDebugMesh.visible = false;
    this.attackDebugMesh.renderOrder = ACTOR_SPRITE_RENDER_ORDER + 4;
    this.attackDebugMesh.castShadow = false;
    this.attackDebugMesh.receiveShadow = false;
    this.actorGroup.add(this.attackDebugMesh);
    this.interactionDebugMesh.visible = false;
    this.interactionDebugMesh.renderOrder = ACTOR_SPRITE_RENDER_ORDER + 5;
    this.interactionDebugMesh.castShadow = false;
    this.interactionDebugMesh.receiveShadow = false;
    this.actorGroup.add(this.interactionDebugMesh);

    this.buildTerrain();

    this.spriteMaterial = this.createActorSpriteMaterial(
      this.frameTextures[this.currentDirection][1],
      '#ffffff',
      true
    );
    this.playerSprite = this.createActorSprite(this.spriteMaterial);
    this.playerDepthProxy = this.createActorDepthProxy(this.playerDepthProxyGeometry);
    this.actorDepthGroup.add(this.playerDepthProxy);
    this.actorGroup.add(this.playerSprite);

    this.shadowMesh = this.createActorShadow();
    this.actorGroup.add(this.shadowMesh);
    this.spawnNpcs();
    this.spawnFlowers();
    this.spawnCrystals();
    this.spawnTriggers();
    this.refreshActorDepthProxyScales();

    this.updateCompass();
    this.refreshLighting();
    this.updateNpcActivity();
    this.updateNpcVisuals();
    this.updateFlowerActivity();
    this.updateFlowerVisuals();
    this.updateCrystalActivity();
    this.updateCrystalVisuals();
    this.updateTriggerActivity();
    this.updateTriggerVisuals();
    this.updatePlayerVisuals();
    this.updateCamera(1 / 60, true);
    this.updateActorLabels();
    this.updateHud();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.handlePointerUp);
    this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    this.renderer.setAnimationLoop(this.animate);
  }

  public setDebugCameraDistance(value: number): void {
    this.cameraDistance = clamp(value, 8, 28);
    this.updateCamera(1 / 60, true);
  }

  public setDebugCameraHeight(value: number): void {
    this.cameraHeight = clamp(value, 6, 28);
    this.updateCamera(1 / 60, true);
  }

  public resetDebugCameraTuning(): void {
    this.cameraDistance = DEFAULT_CAMERA_DISTANCE;
    this.cameraHeight = DEFAULT_CAMERA_HEIGHT;
    this.updateCamera(1 / 60, true);
  }

  public getDebugCameraTuning(): { distance: number; height: number } {
    return {
      distance: this.cameraDistance,
      height: this.cameraHeight
    };
  }

  public setDebugBlockHeightScale(value: number): void {
    const nextScale = clamp(value, 0.2, 1);
    const scaleRatio = nextScale / this.blockHeightScale;

    if (this.player.grounded) {
      this.player.z = this.getSupportHeight(this.player.x, this.player.y, nextScale);
      this.player.vz = 0;
    } else {
      this.player.z *= scaleRatio;
      this.player.vz *= scaleRatio;
    }

    this.blockHeightScale = nextScale;
    this.refreshTerrainTransforms();
    this.updateNpcActivity();
    this.updateNpcVisuals();
    this.updatePlayerVisuals();
    this.updateCamera(1 / 60, true);
  }

  public resetDebugBlockHeightScale(): void {
    this.setDebugBlockHeightScale(DEFAULT_BLOCK_HEIGHT_SCALE);
  }

  public getDebugBlockHeightScale(): number {
    return this.blockHeightScale;
  }

  public setDebugAmbientIntensity(value: number): void {
    this.ambientLight.intensity = clamp(value, 0, 3);
  }

  public setDebugSunIntensity(value: number): void {
    this.sunLight.intensity = clamp(value, 0, 3);
  }

  public setDebugSunAngleDegrees(value: number): void {
    this.sunAzimuth = (value * Math.PI) / 180;
    this.updateShadowRig();
  }

  public setDebugSunElevationDegrees(value: number): void {
    this.sunElevation = (clamp(value, 15, 85) * Math.PI) / 180;
    this.updateShadowRig();
  }

  public setDebugHeightTintStrength(value: number): void {
    this.heightTintStrength = clamp(value, 0, 1);
    this.refreshTerrainReadability();
  }

  public setDebugTopEdgeBandBrightness(value: number): void {
    this.terrainTopEdgeBandBrightness = clamp(value, 0.3, 1);
    this.refreshTerrainReadability();
  }

  public setDebugTopEdgeBandWidth(value: number): void {
    this.terrainTopEdgeBandWidth = clamp(value, 0.04, 0.4);
    this.buildTerrain();
    this.refreshLighting();
  }

  public setDebugTopEdgeBandLighten(enabled: boolean): void {
    this.terrainTopEdgeBandLighten = enabled;
    this.refreshTerrainReadability();
  }

  public setDebugShadowsEnabled(enabled: boolean): void {
    this.sunLight.castShadow = enabled;
    this.renderer.shadowMap.enabled = enabled;
    this.refreshTerrainShadowFlags();
  }

  public setDebugShadowQuality(value: number): void {
    const options = [256, 512, 1024, 2048, 4096];
    const nearest = options.reduce((best, option) =>
      Math.abs(option - value) < Math.abs(best - value) ? option : best
    );
    this.shadowQuality = nearest;
    this.sunLight.shadow.mapSize.set(nearest, nearest);
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
  }

  public getDebugLighting(): LightingDebugState {
    return {
      ambientIntensity: this.ambientLight.intensity,
      sunIntensity: this.sunLight.intensity,
      shadowsEnabled: this.sunLight.castShadow,
      shadowQuality: this.shadowQuality,
      sunAngleDegrees: (this.sunAzimuth * 180) / Math.PI,
      sunElevationDegrees: (this.sunElevation * 180) / Math.PI,
      heightTintStrength: this.heightTintStrength,
      topEdgeBandBrightness: this.terrainTopEdgeBandBrightness,
      topEdgeBandWidth: this.terrainTopEdgeBandWidth,
      topEdgeBandLighten: this.terrainTopEdgeBandLighten
    };
  }

  public setDebugActorDepthProxyWidthFactor(value: number): void {
    this.actorDepthProxyWidthFactor = clamp(value, 0.3, 1.4);
    this.refreshActorDepthProxyScales();
  }

  public setDebugActorDepthProxyHeightFactor(value: number): void {
    this.actorDepthProxyHeightFactor = clamp(value, 0.3, 1.4);
    this.refreshActorDepthProxyScales();
  }

  public setDebugActorSpriteCameraBias(value: number): void {
    this.actorSpriteCameraBias = clamp(value, 0, 0.1);
  }

  public setDebugActorDepthProxyCameraBias(value: number): void {
    this.actorDepthProxyCameraBias = clamp(value, 0, 0.1);
  }

  public setDebugShowAttackHurtbox(enabled: boolean): void {
    this.showAttackHurtbox = enabled;
    this.updateAttackDebugVisual();
  }

  public setDebugShowTriggerHitboxes(enabled: boolean): void {
    this.showTriggerHitboxes = enabled;
    this.updateTriggerVisuals();
  }

  public getDebugActorOcclusion(): ActorOcclusionDebugState {
    return {
      proxyWidthFactor: this.actorDepthProxyWidthFactor,
      proxyHeightFactor: this.actorDepthProxyHeightFactor,
      spriteCameraBias: this.actorSpriteCameraBias,
      proxyCameraBias: this.actorDepthProxyCameraBias,
      showAttackHurtbox: this.showAttackHurtbox,
      showTriggerHitboxes: this.showTriggerHitboxes
    };
  }

  public setDebugActorLabelRadius(value: number): void {
    this.actorLabelRadius = clamp(value, 0, 24);
    this.updateActorLabels();
  }

  public setDebugActorLabelFontSize(value: number): void {
    this.actorLabelFontSize = clamp(value, 8, 48);
    this.updateActorLabels();
  }

  public getDebugActorLabels(): ActorLabelDebugState {
    return {
      radius: this.actorLabelRadius,
      fontSize: this.actorLabelFontSize
    };
  }

  private readonly handleResize = (): void => {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    const aspect = width / Math.max(height, 1);

    this.camera.left = (-FRUSTUM_HEIGHT * aspect) / 2;
    this.camera.right = (FRUSTUM_HEIGHT * aspect) / 2;
    this.camera.top = FRUSTUM_HEIGHT / 2;
    this.camera.bottom = -FRUSTUM_HEIGHT / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.updateActorLabels();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.freeCameraEnabled) {
      if (event.button === 0) {
        event.preventDefault();
        this.tryStartPlayerAttack(event.clientX, event.clientY);
      }
      return;
    }

    if (event.button !== 0) {
      return;
    }

    this.dragState = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY
    };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - this.dragState.lastX;
    const dy = event.clientY - this.dragState.lastY;
    this.dragState.lastX = event.clientX;
    this.dragState.lastY = event.clientY;

    this.cameraYaw -= dx * 0.01;
    this.cameraPitch = clamp(
      this.cameraPitch + dy * 0.006,
      FREE_CAMERA_MIN_PITCH,
      FREE_CAMERA_MAX_PITCH
    );
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    this.renderer.domElement.releasePointerCapture(event.pointerId);
    this.dragState = null;
  };

  private readonly animate = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 1 / 30);
    this.lastFrameTime = now;

    this.update(dt);
    this.renderer.clear();

    this.terrainGroup.visible = false;
    this.actorGroup.visible = false;
    this.actorDepthGroup.visible = true;
    this.renderer.render(this.scene, this.camera);

    this.terrainGroup.visible = true;
    this.actorGroup.visible = true;
    this.actorDepthGroup.visible = false;
    this.renderer.render(this.scene, this.camera);
  };

  private tryStartPlayerAttack(clientX: number, clientY: number): void {
    if (this.activeAttack || this.activePlainInteraction || this.attackCooldownTimer > 0) {
      return;
    }

    const worldDirection = this.getAttackWorldDirectionFromPointer(clientX, clientY);
    const facingDirectionIndex = this.getActorFacingDirection(worldDirection.x, worldDirection.y);
    this.currentDirection = facingDirectionIndex;
    this.activeAttack = {
      profile: DEFAULT_ATTACK_PROFILE,
      worldDirection,
      remaining: DEFAULT_ATTACK_PROFILE.duration,
      hitTargets: new Set<string>(),
      facingDirectionIndex
    };
    this.updateAttackDebugVisual();
  }

  private tryStartPlayerAttackInFacingDirection(): void {
    if (this.activeAttack || this.activePlainInteraction || this.attackCooldownTimer > 0) {
      return;
    }

    const worldDirection = this.getAttackWorldDirectionFromFacing(this.currentDirection);
    this.activeAttack = {
      profile: DEFAULT_ATTACK_PROFILE,
      worldDirection,
      remaining: DEFAULT_ATTACK_PROFILE.duration,
      hitTargets: new Set<string>(),
      facingDirectionIndex: this.currentDirection
    };
    this.updateAttackDebugVisual();
  }

  private tryStartPlayerInteractionInFacingDirection(): void {
    if (this.activeAttack || this.activePlainInteraction) {
      return;
    }

    const worldDirection = this.getAttackWorldDirectionFromFacing(this.currentDirection);
    this.activePlainInteraction = {
      profile: DEFAULT_PLAIN_INTERACTION_PROFILE,
      worldDirection,
      remaining: DEFAULT_PLAIN_INTERACTION_PROFILE.duration,
      hitTarget: false,
      facingDirectionIndex: this.currentDirection
    };
    this.updateInteractionDebugVisual();
  }

  private getAttackWorldDirectionFromPointer(clientX: number, clientY: number): Vec2 {
    const playerScreen = this.getWorldScreenPosition(
      this.player.x,
      this.player.z + PLAYER_BODY_HEIGHT * 0.55,
      this.player.y
    );
    const deltaX = clientX - playerScreen.x;
    const deltaY = clientY - playerScreen.y;
    const lengthSq = deltaX * deltaX + deltaY * deltaY;

    if (lengthSq < 1e-6) {
      return this.getAttackWorldDirectionFromFacing(this.currentDirection);
    }

    const snappedAngle = Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) * (Math.PI / 4);
    const screenX = Math.cos(snappedAngle);
    const screenY = Math.sin(snappedAngle);
    const basis = this.getPlaneBasis();

    return {
      x: screenX * basis.rightNorm.x - screenY * basis.topNorm.x,
      y: screenX * basis.rightNorm.y - screenY * basis.topNorm.y
    };
  }

  private getAttackWorldDirectionFromFacing(facingDirectionIndex: number): Vec2 {
    const angle = ((facingDirectionIndex - 2) * Math.PI) / 4;
    const screenX = Math.cos(angle);
    const screenY = Math.sin(angle);
    const basis = this.getPlaneBasis();

    return {
      x: screenX * basis.rightNorm.x - screenY * basis.topNorm.x,
      y: screenX * basis.rightNorm.y - screenY * basis.topNorm.y
    };
  }

  private getActorFacingDirectionFromScreenMove(screenDirection: Vec2): number {
    const angle = Math.atan2(-screenDirection.y, screenDirection.x);
    const rawDirection = Math.round((angle + Math.PI / 2) / (Math.PI / 4));
    return (rawDirection % 8 + 8) % 8;
  }

  private updatePlayerFacingFromInputIntent(): void {
    if (this.activeAttack || this.activePlainInteraction) {
      return;
    }

    const facingMove = this.input.getFacingScreenMoveVector();
    if (facingMove) {
      this.currentDirection = this.getActorFacingDirectionFromScreenMove(facingMove);
    }
  }

  private getWorldScreenPosition(x: number, y: number, z: number): Vec2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const projected = new Vector3(x, y, z).project(this.camera);

    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height
    };
  }

  private getCompassLabel(
    compass: HTMLDivElement,
    slot: 'top' | 'right' | 'bottom' | 'left'
  ): HTMLSpanElement {
    const label = compass.querySelector<HTMLSpanElement>(`[data-slot="${slot}"]`);

    if (!label) {
      throw new Error(`Expected compass label for slot "${slot}".`);
    }

    return label;
  }

  private createTerrainRenderMesh(
    geometry: PlaneGeometry,
    material: MeshLambertMaterial,
    count: number,
    renderOrder: number
  ): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, Math.max(count, 1));
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = this.sunLight.castShadow;
    mesh.receiveShadow = this.sunLight.castShadow;
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    mesh.setMatrixAt(0, this.hiddenTerrainMatrix);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  private createTerrainStaticMesh(
    geometry: BufferGeometry,
    material: MeshLambertMaterial,
    renderOrder: number
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = this.sunLight.castShadow;
    mesh.receiveShadow = this.sunLight.castShadow;
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  private createTerrainGeometryBuffers(): TerrainGeometryBuffers {
    return {
      positions: [],
      normals: [],
      colors: [],
      indices: []
    };
  }

  private writeTerrainQuadColor(
    colorBuffer: number[],
    startVertex: number,
    vertexCount: number,
    color: Color
  ): void {
    for (let index = 0; index < vertexCount; index += 1) {
      const colorIndex = (startVertex + index) * 3;
      colorBuffer[colorIndex] = color.r;
      colorBuffer[colorIndex + 1] = color.g;
      colorBuffer[colorIndex + 2] = color.b;
    }
  }

  private appendTerrainQuad(
    buffers: TerrainGeometryBuffers,
    vertices: Array<[number, number, number]>,
    normal: [number, number, number],
    color: Color
  ): { startVertex: number; vertexCount: number } {
    const startVertex = buffers.positions.length / 3;

    for (const [x, y, z] of vertices) {
      buffers.positions.push(x, y, z);
      buffers.normals.push(normal[0], normal[1], normal[2]);
    }

    this.writeTerrainQuadColor(buffers.colors, startVertex, vertices.length, color);
    buffers.indices.push(
      startVertex,
      startVertex + 1,
      startVertex + 2,
      startVertex,
      startVertex + 2,
      startVertex + 3
    );

    return {
      startVertex,
      vertexCount: vertices.length
    };
  }

  private createTerrainBufferGeometry(buffers: TerrainGeometryBuffers): BufferGeometry | null {
    if (buffers.indices.length === 0) {
      return null;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(buffers.normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(buffers.colors, 3));
    geometry.setIndex(buffers.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  private getTerrainTopRenderColor(material: MaterialKey, heightTintBaseOpacity: number): Color {
    const baseColor = this.getTopBaseColor(material);
    const tintColor = this.getHeightTintColor(material);
    const tintMix = heightTintBaseOpacity * this.heightTintStrength;
    return baseColor.lerp(tintColor, tintMix);
  }

  private getTerrainSideColor(material: MaterialKey, direction: TerrainSideDirection): Color {
    const shade = direction === 'east' || direction === 'west' ? 0.7 : 0.58;
    return this.getTopBaseColor(material).multiplyScalar(shade);
  }

  private applyTopEdgeBandTone(color: Color): Color {
    if (this.terrainTopEdgeBandLighten) {
      return color.lerp(new Color(1, 1, 1), 1 - this.terrainTopEdgeBandBrightness);
    }

    return color.multiplyScalar(this.terrainTopEdgeBandBrightness);
  }

  private writeTerrainFaceTransform(
    mesh: InstancedMesh,
    index: number,
    block: TerrainBlockInstance,
    face: TerrainFaceBinding
  ): void {
    this.reusableTerrainPosition.set(
      block.x + 0.5 + (face.offsetX ?? 0),
      block.z + 0.5 + (face.offsetY ?? 0),
      block.y + 0.5 + (face.offsetZ ?? 0)
    );
    this.reusableTerrainScale.set(face.scaleX ?? 1, face.scaleY ?? 1, face.scaleZ ?? 1);
    this.reusableTerrainQuaternion.setFromAxisAngle(this.reusableTerrainAxisY, face.rotationY);
    this.reusableTerrainMatrix.compose(
      this.reusableTerrainPosition,
      this.reusableTerrainQuaternion,
      this.reusableTerrainScale
    );
    mesh.setMatrixAt(index, this.reusableTerrainMatrix);
  }

  private getFrontTerrainFaceMesh(chunk: TerrainChunkRender, face: TerrainFaceBinding): InstancedMesh | null {
    if (face.type === 'top') {
      return chunk.frontTopMesh;
    }

    if (face.type === 'top-edge') {
      return chunk.frontTopEdgeMesh;
    }

    return chunk.frontSideMesh;
  }

  private getTerrainBlockColumnKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  private addTerrainBlockToColumn(block: TerrainBlockInstance): void {
    const key = this.getTerrainBlockColumnKey(block.x, block.y);
    const column = this.terrainBlockColumns.get(key);

    if (column) {
      column.push(block);
    } else {
      this.terrainBlockColumns.set(key, [block]);
    }
  }

  private setTerrainBlockFrontState(block: TerrainBlockInstance, renderInFront: boolean): void {
    if (block.currentFront === renderInFront) {
      return;
    }

    block.currentFront = renderInFront;
    const allFaces = [
      ...(block.topFace ? [block.topFace] : []),
      ...block.topEdgeFaces,
      ...block.sideFaces
    ];

    for (const face of allFaces) {
      const frontMesh = this.getFrontTerrainFaceMesh(block.chunk, face);

      if (!frontMesh) {
        continue;
      }

      if (renderInFront) {
        this.writeTerrainFaceTransform(frontMesh, face.frontIndex, block, face);
      } else {
        frontMesh.setMatrixAt(face.frontIndex, this.hiddenTerrainMatrix);
      }
    }

    if (block.chunk.frontTopMesh) {
      block.chunk.frontTopMesh.instanceMatrix.needsUpdate = true;
    }
    if (block.chunk.frontTopEdgeMesh) {
      block.chunk.frontTopEdgeMesh.instanceMatrix.needsUpdate = true;
    }
    if (block.chunk.frontSideMesh) {
      block.chunk.frontSideMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateTerrainColorSpans(mesh: Mesh | null, spans: TerrainOpaqueTopColorSpan[]): void {
    const colorAttribute = mesh?.geometry.getAttribute('color');

    if (!colorAttribute) {
      return;
    }

    const colorArray = colorAttribute.array as Float32Array;

    for (const span of spans) {
      const brightness = span.isEdgeBand ? this.terrainTopEdgeBandBrightness : span.brightness;
      const color = span.isEdgeBand
        ? this.applyTopEdgeBandTone(
            this.getTerrainTopRenderColor(span.material, span.heightTintBaseOpacity)
          )
        : this
            .getTerrainTopRenderColor(span.material, span.heightTintBaseOpacity)
            .multiplyScalar(brightness);
      for (let index = 0; index < span.vertexCount; index += 1) {
        const colorIndex = (span.startVertex + index) * 3;
        colorArray[colorIndex] = color.r;
        colorArray[colorIndex + 1] = color.g;
        colorArray[colorIndex + 2] = color.b;
      }
    }

    colorAttribute.needsUpdate = true;
  }

  private updateChunkOpaqueTopColors(chunk: TerrainChunkRender): void {
    this.updateTerrainColorSpans(chunk.opaqueTopMesh, chunk.opaqueTopColorSpans);
    this.updateTerrainColorSpans(chunk.opaqueTopEdgeMesh, chunk.opaqueTopEdgeColorSpans);
  }

  private updateTerrainBlockColor(block: TerrainBlockInstance): void {
    if (!block.topFace && block.topEdgeFaces.length === 0) {
      return;
    }

    block.renderColor.copy(
      this.getTerrainTopRenderColor(block.material, block.heightTintBaseOpacity)
    );
    if (block.topFace) {
      block.chunk.frontTopMesh?.setColorAt(block.topFace.frontIndex, block.renderColor);
    }

    const edgeColor = this.applyTopEdgeBandTone(block.renderColor.clone());
    for (const face of block.topEdgeFaces) {
      block.chunk.frontTopEdgeMesh?.setColorAt(face.frontIndex, edgeColor);
    }
  }

  private setActorSpritePosition(
    sprite: Sprite,
    x: number,
    y: number,
    z: number,
    biasMultiplier = 0
  ): void {
    sprite.position.set(x, y, z);

    if (biasMultiplier > 0) {
      this.camera.getWorldDirection(this.reusableCameraDirection);
      sprite.position.addScaledVector(
        this.reusableCameraDirection,
        -this.actorSpriteCameraBias * biasMultiplier
      );
    }
  }

  private getActorRenderOrder(worldX: number, worldY: number, footZ: number, offset = 0): number {
    const basis = this.getPlaneBasis();
    const frontness = -(worldX * basis.topNorm.x + worldY * basis.topNorm.y);
    const lateral = worldX * basis.rightNorm.x + worldY * basis.rightNorm.y;
    const heightBias = footZ / Math.max(this.blockHeightScale, 0.001) * 0.02;
    return (
      ACTOR_SORT_RENDER_ORDER_BASE +
      Math.round((frontness + lateral * 0.01 + heightBias) * ACTOR_SORT_RENDER_ORDER_SCALE) +
      offset
    );
  }

  private updateAttackDebugVisual(): void {
    if (!this.activeAttack || !this.showAttackHurtbox) {
      this.attackDebugMesh.visible = false;
      return;
    }

    this.updateActionDebugMesh(
      this.attackDebugMesh,
      this.activeAttack.profile,
      this.activeAttack.worldDirection,
      ATTACK_HURTBOX_ELEVATION
    );
  }

  private updateInteractionDebugVisual(): void {
    if (!this.activePlainInteraction || !this.showAttackHurtbox) {
      this.interactionDebugMesh.visible = false;
      return;
    }

    this.updateActionDebugMesh(
      this.interactionDebugMesh,
      this.activePlainInteraction.profile,
      this.activePlainInteraction.worldDirection,
      INTERACTION_HURTBOX_ELEVATION
    );
  }

  private updateActionDebugMesh(
    mesh: Mesh,
    profile: AttackProfile,
    worldDirection: Vec2,
    elevation: number
  ): void {
    const centerOffset = PLAYER_COLLISION_RADIUS + profile.reach * 0.5;
    const centerX = this.player.x + worldDirection.x * centerOffset;
    const centerZ = this.player.y + worldDirection.y * centerOffset;
    mesh.visible = true;
    mesh.position.set(
      centerX,
      this.player.z + profile.height * 0.5 + elevation,
      centerZ
    );
    mesh.rotation.set(0, Math.atan2(worldDirection.x, worldDirection.y), 0);
    mesh.scale.set(profile.width, profile.height, profile.reach);
  }

  private createActorDepthProxy(geometry: BoxGeometry): Mesh {
    const proxy = new Mesh(geometry, this.actorDepthProxyMaterial);
    proxy.castShadow = false;
    proxy.receiveShadow = false;
    proxy.renderOrder = ACTOR_DEPTH_PROXY_RENDER_ORDER;
    proxy.frustumCulled = false;
    return proxy;
  }

  private setActorDepthProxyPosition(proxy: Mesh, x: number, footY: number, z: number, proxyHeight: number): void {
    proxy.position.set(x, footY + proxyHeight * 0.5, z);
    this.camera.getWorldDirection(this.reusableCameraDirection);
    proxy.position.addScaledVector(this.reusableCameraDirection, this.actorDepthProxyCameraBias);
  }

  private refreshActorDepthProxyScales(): void {
    const widthScale = this.actorDepthProxyWidthFactor / DEFAULT_ACTOR_DEPTH_PROXY_WIDTH_FACTOR;
    const heightScale = this.actorDepthProxyHeightFactor / DEFAULT_ACTOR_DEPTH_PROXY_HEIGHT_FACTOR;

    this.playerDepthProxy.scale.set(widthScale, heightScale, widthScale);

    for (const npc of this.npcs) {
      npc.depthProxy.scale.set(widthScale, heightScale, widthScale);
    }

    for (const flower of this.flowers) {
      flower.depthProxy.scale.set(widthScale, heightScale, widthScale);
    }

    for (const crystal of this.crystals) {
      crystal.depthProxy.scale.set(widthScale, heightScale, widthScale);
    }
  }

  private getActorProxyDimensions(baseWidth: number, baseHeight: number): {
    width: number;
    height: number;
  } {
    return {
      width:
        baseWidth * (this.actorDepthProxyWidthFactor / DEFAULT_ACTOR_DEPTH_PROXY_WIDTH_FACTOR),
      height:
        baseHeight * (this.actorDepthProxyHeightFactor / DEFAULT_ACTOR_DEPTH_PROXY_HEIGHT_FACTOR)
    };
  }

  private createActorSpriteMaterial(
    frameTexture: CanvasTexture,
    tintHex = '#ffffff',
    depthTest = false,
    depthWrite = false
  ): SpriteMaterial {
    return new SpriteMaterial({
      map: frameTexture,
      color: new Color(tintHex),
      transparent: true,
      alphaTest: 0.25,
      depthWrite,
      depthTest
    });
  }

  private createActorSprite(material: SpriteMaterial): Sprite {
    return this.createBillboardSprite(
      material,
      CHARACTER_SCALE * (CHARACTER_FRAME_WIDTH / CHARACTER_FRAME_HEIGHT),
      CHARACTER_SCALE
    );
  }

  private createBillboardSprite(material: SpriteMaterial, width: number, height: number): Sprite {
    const sprite = new Sprite(material);
    sprite.center.set(0.5, 0);
    sprite.scale.set(width, height, 1);
    return sprite;
  }

  private createActorShadow(): Mesh {
    const shadow = new Mesh(this.shadowGeometry, this.actorShadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    return shadow;
  }

  private createActorLabelElement(displayName: string | null): HTMLDivElement {
    const label = document.createElement('div');
    label.className = 'actor-label';
    label.hidden = true;
    label.style.display = 'none';
    if (displayName) {
      label.textContent = displayName;
    }
    this.actorLabelLayer.appendChild(label);
    return label;
  }

  private setActorLabelVisible(label: HTMLDivElement, visible: boolean): void {
    label.hidden = !visible;
    label.style.display = visible ? '-webkit-box' : 'none';
  }

  private updateCrystalCounter(): void {
    this.crystalCounterValue.textContent = String(this.crystalCount);
  }

  private removeActorLabelElement(label: HTMLDivElement): void {
    label.remove();
  }

  private getNpcDisplayName(kind: NpcKind, randomSeed: number, x: number, y: number): string {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const namePool = kind === 'sturdy' ? STURDY_NPC_NAME_POOL : NPC_NAME_POOL;
    return pickName(namePool, randomSeed + 503, tileX, tileY);
  }

  private getFlowerDisplayName(randomSeed: number, x: number, y: number): string | null {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    if (hashUnit(randomSeed + 809, tileX, tileY) > 0.35) {
      return null;
    }

    return pickName(FLOWER_NAME_POOL, randomSeed + 811, tileX, tileY);
  }

  private hasWalkableNeighbor(tileX: number, tileY: number): boolean {
    const height = getHeight(this.map, tileX, tileY);

    return (
      getHeight(this.map, tileX + 1, tileY) === height ||
      getHeight(this.map, tileX - 1, tileY) === height ||
      getHeight(this.map, tileX, tileY + 1) === height ||
      getHeight(this.map, tileX, tileY - 1) === height
    );
  }

  private getTeleportAtTile(tileX: number, tileY: number): TeleportTile | null {
    return (
      this.map.teleports.find((teleport) => teleport.x === tileX && teleport.y === tileY) ?? null
    );
  }

  private isTeleportTile(tileX: number, tileY: number): boolean {
    return this.getTeleportAtTile(tileX, tileY) !== null;
  }

  private collectNpcSpawnCandidates(requireMobility: boolean): Vec2[] {
    const candidates: Vec2[] = [];

    for (let y = 1; y < this.map.height - 1; y += 1) {
      for (let x = 1; x < this.map.width - 1; x += 1) {
        if (this.isTeleportTile(x, y)) {
          continue;
        }

        const dx = x + 0.5 - this.player.x;
        const dy = y + 0.5 - this.player.y;
        if (dx * dx + dy * dy < NPC_SPAWN_EXCLUSION_RADIUS * NPC_SPAWN_EXCLUSION_RADIUS) {
          continue;
        }

        if (requireMobility && !this.hasWalkableNeighbor(x, y)) {
          continue;
        }

        candidates.push({ x: x + 0.5, y: y + 0.5 });
      }
    }

    return candidates;
  }

  private shuffleSpawnCandidates(candidates: Vec2[], seed: number): void {
    const random = createSeededRandom(seed);

    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }
  }

  private getMapSpawnSeedBase(): number {
    return this.map.id === 'overworld' ? this.currentOverworldSeed : MAP_GENERATION_SEED + 10000;
  }

  private spawnNpcs(): void {
    const spawnSeedBase = this.getMapSpawnSeedBase();
    const mobileCandidates = this.collectNpcSpawnCandidates(true);
    const stationaryCandidates = this.collectNpcSpawnCandidates(false);
    this.shuffleSpawnCandidates(mobileCandidates, spawnSeedBase + 601);
    this.shuffleSpawnCandidates(stationaryCandidates, spawnSeedBase + 907);

    const createNpc = (
      kind: NpcKind,
      x: number,
      y: number,
      tintHex: string,
      randomSeed: number,
      displayNameOverride: string | null | undefined = undefined,
      onHitInteraction: ActorHitInteraction | null = null,
      onPlainInteraction: ActorPlainInteraction | null = null
    ): NpcState => {
      const frameTexture = this.frameTextures[4][1];
      const spriteMaterial = this.createActorSpriteMaterial(frameTexture, tintHex, true);
      const sprite = this.createActorSprite(spriteMaterial);
      const depthProxy = this.createActorDepthProxy(this.npcDepthProxyGeometry);
      const shadow = this.createActorShadow();
      const displayName =
        displayNameOverride === undefined
          ? this.getNpcDisplayName(kind, randomSeed, x, y)
          : displayNameOverride;
      const labelElement = this.createActorLabelElement(displayName);
      sprite.visible = false;
      depthProxy.visible = false;
      shadow.visible = false;
      this.actorDepthGroup.add(depthProxy);
      this.actorGroup.add(sprite);
      this.actorGroup.add(shadow);

      return {
        id: `npc-${kind}-${Math.floor(x)}-${Math.floor(y)}-${randomSeed}`,
        kind,
        x,
        y,
        z: this.getSupportHeight(x, y),
        vx: 0,
        vy: 0,
        walkTime: 0,
        currentDirection: 4,
        active: false,
        speed: lerp(NPC_WALK_SPEED_MIN, NPC_WALK_SPEED_MAX, hashUnit(randomSeed, Math.floor(x), Math.floor(y))),
        moveAngle: hashUnit(randomSeed + 1, Math.floor(x), Math.floor(y)) * Math.PI * 2,
        moveTimer: 0,
        idleTimer: lerp(
          NPC_IDLE_MIN_TIME,
          NPC_IDLE_MAX_TIME,
          hashUnit(randomSeed + 2, Math.floor(x), Math.floor(y))
        ),
        knockbackVX: 0,
        knockbackVY: 0,
        touchFlashTimer: 0,
        attackFlashTimer: 0,
        playerTouching: false,
        knockbackable: kind !== 'sturdy',
        displayName,
        labelRangeFactor: kind === 'sturdy' ? 1.35 : 1,
        labelFontSizeFactor: kind === 'sturdy' ? 1.08 : 1,
        onHitInteraction,
        onPlainInteraction,
        labelElement,
        baseTint: new Color(tintHex),
        spriteMaterial,
        sprite,
        depthProxy,
        shadow
      };
    };

    const addNpcs = (
      kind: NpcKind,
      count: number,
      tintHex: string,
      candidates: Vec2[],
      seedOffset: number
    ): void => {
      if (count <= 0) {
        return;
      }

      let spawned = 0;

      for (const candidate of candidates) {
        const tileKey = `${Math.floor(candidate.x)}:${Math.floor(candidate.y)}`;
        if (this.occupiedActorTiles.has(tileKey)) {
          continue;
        }

        this.occupiedActorTiles.add(tileKey);
        this.npcs.push(
          createNpc(
            kind,
            candidate.x,
            candidate.y,
            tintHex,
            spawnSeedBase + seedOffset + this.npcs.length * 17
          )
        );
        spawned += 1;

        if (spawned >= count) {
          break;
        }
      }
    };

    const addFixedSturdyNpc = (config: FixedSturdyNpcSpawnConfig, index: number): void => {
      const tileX = Math.floor(config.x);
      const tileY = Math.floor(config.y);

      if (
        tileX < 0 ||
        tileY < 0 ||
        tileX >= this.map.width ||
        tileY >= this.map.height
      ) {
        return;
      }

      const tileKey = `${tileX}:${tileY}`;
      if (this.occupiedActorTiles.has(tileKey)) {
        return;
      }

      this.occupiedActorTiles.add(tileKey);
      this.npcs.push(
        createNpc(
          'sturdy',
          config.x,
          config.y,
          STURDY_NPC_TINT,
          spawnSeedBase + 2900 + index * 17,
          config.displayName,
          config.onHitInteraction ?? null,
          config.onPlainInteraction ?? null
        )
      );
    };

    addNpcs('mobile', this.map.spawns.mobileNpcCount, MOBILE_NPC_TINT, mobileCandidates, 1300);
    addNpcs(
      'stationary',
      this.map.spawns.stationaryNpcCount,
      STATIONARY_NPC_TINT,
      stationaryCandidates,
      2100
    );
    addNpcs('sturdy', this.map.spawns.sturdyNpcCount, STURDY_NPC_TINT, stationaryCandidates, 2500);
    this.map.spawns.fixedSturdyNpcs.forEach(addFixedSturdyNpc);
  }

  private spawnFlowers(): void {
    if (this.map.spawns.flowerCount <= 0) {
      return;
    }

    const spawnSeedBase = this.getMapSpawnSeedBase();
    const candidates = this.collectNpcSpawnCandidates(false);
    this.shuffleSpawnCandidates(candidates, spawnSeedBase + 3001);
    const random = createSeededRandom(spawnSeedBase + 4103);
    let spawned = 0;

    for (const candidate of candidates) {
      const tileKey = `${Math.floor(candidate.x)}:${Math.floor(candidate.y)}`;
      if (this.occupiedActorTiles.has(tileKey)) {
        continue;
      }

      const frameTexture =
        this.flowerFrameTextures[Math.floor(random() * this.flowerFrameTextures.length)];
      const spriteMaterial = this.createActorSpriteMaterial(frameTexture, '#ffffff', true);
      const sprite = this.createBillboardSprite(
        spriteMaterial,
        FLOWER_WORLD_WIDTH,
        FLOWER_WORLD_HEIGHT
      );
      const depthProxy = this.createActorDepthProxy(this.flowerDepthProxyGeometry);
      const shadow = this.createActorShadow();
      const displayName = this.getFlowerDisplayName(
        spawnSeedBase + 5303 + spawned * 19,
        candidate.x,
        candidate.y
      );
      const labelElement = this.createActorLabelElement(displayName);
      sprite.visible = false;
      depthProxy.visible = false;
      shadow.visible = false;
      this.actorDepthGroup.add(depthProxy);
      this.actorGroup.add(sprite);
      this.actorGroup.add(shadow);

      this.occupiedActorTiles.add(tileKey);
      this.flowers.push({
        id: `flower-${Math.floor(candidate.x)}-${Math.floor(candidate.y)}-${spawned}`,
        x: candidate.x,
        y: candidate.y,
        z: this.getSupportHeight(candidate.x, candidate.y),
        active: false,
        knockbackVX: 0,
        knockbackVY: 0,
        touchFlashTimer: 0,
        attackFlashTimer: 0,
        playerTouching: false,
        displayName,
        labelRangeFactor: 0.75,
        labelFontSizeFactor: 0.92,
        onHitInteraction: null,
        onPlainInteraction: null,
        labelElement,
        spriteMaterial,
        sprite,
        depthProxy,
        shadow,
        frameTexture
      });
      spawned += 1;

      if (spawned >= this.map.spawns.flowerCount) {
        break;
      }
    }
  }

  private spawnCrystals(): void {
    if (this.map.id !== 'overworld') {
      return;
    }

    const spawnSeedBase = this.getMapSpawnSeedBase();
    const addCrystal = (candidate: Vec2, id: string): boolean => {
      const tileX = Math.floor(candidate.x);
      const tileY = Math.floor(candidate.y);
      const tileKey = `${tileX}:${tileY}`;

      if (
        tileX < 0 ||
        tileY < 0 ||
        tileX >= this.map.width ||
        tileY >= this.map.height ||
        this.isTeleportTile(tileX, tileY) ||
        this.occupiedActorTiles.has(tileKey)
      ) {
        return false;
      }

      this.occupiedActorTiles.add(tileKey);

      if (this.collectedCrystalIds.has(id)) {
        return true;
      }

      const spriteMaterial = this.createActorSpriteMaterial(
        this.crystalFrameTexture,
        '#ffffff',
        true
      );
      const sprite = this.createBillboardSprite(
        spriteMaterial,
        CRYSTAL_WORLD_WIDTH,
        CRYSTAL_WORLD_HEIGHT
      );
      const depthProxy = this.createActorDepthProxy(this.crystalDepthProxyGeometry);
      const shadow = this.createActorShadow();
      const displayName = 'Crystal';
      const labelElement = this.createActorLabelElement(displayName);
      sprite.visible = false;
      depthProxy.visible = false;
      shadow.visible = false;
      this.actorDepthGroup.add(depthProxy);
      this.actorGroup.add(sprite);
      this.actorGroup.add(shadow);

      this.crystals.push({
        id,
        x: candidate.x,
        y: candidate.y,
        z: this.getSupportHeight(candidate.x, candidate.y),
        active: false,
        collected: false,
        displayName,
        labelRangeFactor: CRYSTAL_LABEL_RANGE_FACTOR,
        labelFontSizeFactor: CRYSTAL_LABEL_FONT_SIZE_FACTOR,
        labelElement,
        spriteMaterial,
        sprite,
        depthProxy,
        shadow
      });
      return true;
    };

    if (this.currentOverworldSeed === MAP_GENERATION_SEED) {
      addCrystal(
        { x: OVERWORLD_SPAWN.x + 2, y: OVERWORLD_SPAWN.y },
        `crystal-startup-${MAP_GENERATION_SEED}`
      );
    }

    const candidates = this.collectNpcSpawnCandidates(false);
    this.shuffleSpawnCandidates(candidates, spawnSeedBase + 7301);
    let placed = 0;

    for (const candidate of candidates) {
      const tileX = Math.floor(candidate.x);
      const tileY = Math.floor(candidate.y);
      const id = `crystal-${spawnSeedBase}-${tileX}-${tileY}`;

      if (addCrystal(candidate, id)) {
        placed += 1;
      }

      if (placed >= OVERWORLD_CRYSTAL_PICKUP_COUNT) {
        break;
      }
    }
  }

  private spawnTriggers(): void {
    this.map.spawns.fixedTriggers.forEach((config, index) => {
      const tileX = Math.floor(config.x);
      const tileY = Math.floor(config.y);

      if (
        tileX < 0 ||
        tileY < 0 ||
        tileX >= this.map.width ||
        tileY >= this.map.height
      ) {
        return;
      }

      const labelElement = this.createActorLabelElement(config.displayName);
      const debugMesh = new Mesh(this.triggerDebugGeometry, this.triggerDebugMaterial);
      debugMesh.visible = false;
      debugMesh.renderOrder = ACTOR_SPRITE_RENDER_ORDER + 3;
      debugMesh.castShadow = false;
      debugMesh.receiveShadow = false;
      this.actorGroup.add(debugMesh);

      this.triggers.push({
        id: `trigger-${this.map.id}-${tileX}-${tileY}-${index}`,
        x: config.x,
        y: config.y,
        z: this.getSupportHeight(config.x, config.y),
        width: config.width,
        depth: config.depth,
        height: config.height,
        active: false,
        touchFlashTimer: 0,
        attackFlashTimer: 0,
        playerTouching: false,
        displayName: config.displayName,
        labelRangeFactor: config.labelRangeFactor ?? 1,
        labelFontSizeFactor: config.labelFontSizeFactor ?? 1,
        onHitInteraction: null,
        onPlainInteraction: null,
        labelElement,
        debugMesh
      });
    });
  }

  private clearMapActors(): void {
    for (const npc of this.npcs) {
      this.actorDepthGroup.remove(npc.depthProxy);
      this.actorGroup.remove(npc.sprite);
      this.actorGroup.remove(npc.shadow);
      this.removeActorLabelElement(npc.labelElement);
      npc.spriteMaterial.dispose();
    }

    for (const flower of this.flowers) {
      this.actorDepthGroup.remove(flower.depthProxy);
      this.actorGroup.remove(flower.sprite);
      this.actorGroup.remove(flower.shadow);
      this.removeActorLabelElement(flower.labelElement);
      flower.spriteMaterial.dispose();
    }

    for (const crystal of this.crystals) {
      this.actorDepthGroup.remove(crystal.depthProxy);
      this.actorGroup.remove(crystal.sprite);
      this.actorGroup.remove(crystal.shadow);
      this.removeActorLabelElement(crystal.labelElement);
      crystal.spriteMaterial.dispose();
    }

    for (const trigger of this.triggers) {
      this.actorGroup.remove(trigger.debugMesh);
      this.removeActorLabelElement(trigger.labelElement);
    }

    this.npcs.length = 0;
    this.flowers.length = 0;
    this.crystals.length = 0;
    this.triggers.length = 0;
    this.occupiedActorTiles.clear();
  }

  private loadMap(mapId: MapId, targetX: number, targetY: number): void {
    this.map = this.maps[mapId];
    this.clearMapActors();
    this.activeAttack = null;
    this.activePlainInteraction = null;
    this.attackCooldownTimer = 0;
    this.player.x = clamp(
      targetX,
      MAP_EDGE_PADDING + PLAYER_COLLISION_RADIUS,
      this.map.width - MAP_EDGE_PADDING - PLAYER_COLLISION_RADIUS
    );
    this.player.y = clamp(
      targetY,
      MAP_EDGE_PADDING + PLAYER_COLLISION_RADIUS,
      this.map.height - MAP_EDGE_PADDING - PLAYER_COLLISION_RADIUS
    );
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.grounded = true;
    this.player.z = this.getSupportHeight(this.player.x, this.player.y);

    this.buildTerrain();
    this.spawnNpcs();
    this.spawnFlowers();
    this.spawnCrystals();
    this.spawnTriggers();
    this.refreshActorDepthProxyScales();
    this.updateNpcActivity();
    this.updateFlowerActivity();
    this.updateCrystalActivity();
    this.updateTriggerActivity();
    this.updateNpcVisuals();
    this.updateFlowerVisuals();
    this.updateCrystalVisuals();
    this.updateTriggerVisuals();
    this.updatePlayerVisuals();
    this.updateCamera(1 / 60, true);
    this.updateActorLabels();
    this.updateHud();
    this.teleportArmed = false;
  }

  private regenerateOverworld(): void {
    const nextSeed = this.createNextOverworldSeed();
    const nextTeleportTile = getRandomOverworldTeleportTile(nextSeed);

    this.currentOverworldSeed = nextSeed;
    this.currentOverworldTeleportTile = nextTeleportTile;
    this.maps.overworld = createOverworldMap(nextSeed, nextTeleportTile, true);
    this.updateHubWorldOverworldLink();
    this.updateHud();
  }

  private trySpendCrystalForWorldRegeneration(): boolean {
    if (this.crystalCount <= 0) {
      return false;
    }

    this.crystalCount -= 1;
    this.updateCrystalCounter();
    return true;
  }

  private createNextOverworldSeed(): number {
    let seed = Math.floor(Math.random() * 0x100000000) >>> 0;

    if (seed === this.currentOverworldSeed) {
      seed = (seed ^ Date.now()) >>> 0;
    }

    return seed;
  }

  private updateHubWorldOverworldLink(): void {
    const hubWorld = this.maps.hubWorld;
    const hubTeleport = hubWorld.teleports[0];

    if (hubTeleport) {
      hubTeleport.targetX = this.currentOverworldTeleportTile.x + 0.5;
      hubTeleport.targetY = this.currentOverworldTeleportTile.y + 0.5;
    }

    const seedLabel = getOverworldSeedLabel(this.currentOverworldSeed);
    const hubSeedTrigger = hubWorld.spawns.fixedTriggers[0];
    if (hubSeedTrigger) {
      hubSeedTrigger.displayName = seedLabel;
    }

    for (const trigger of this.triggers) {
      if (
        this.map.id === 'hubWorld' &&
        Math.floor(trigger.x) === HUB_WORLD_TELEPORT_TILE.x &&
        Math.floor(trigger.y) === HUB_WORLD_TELEPORT_TILE.y
      ) {
        trigger.displayName = seedLabel;
        trigger.labelElement.textContent = seedLabel;
      }
    }

    this.updateActorLabels();
  }

  private setPlayerOpacity(opacity: number): void {
    this.playerOpacity = clamp(opacity, 0, 1);
    this.spriteMaterial.opacity = this.playerOpacity;
    this.spriteMaterial.needsUpdate = true;

    const visible = this.playerOpacity > 0.01;
    this.playerSprite.visible = visible;
    this.playerDepthProxy.visible = visible;
    this.shadowMesh.visible = visible;
  }

  private playScreenFlash(color: string, duration: number, maxOpacity = 1, delay = 0): void {
    const clampedDuration = Math.max(duration, 0.01);

    this.screenFlash = {
      delay: Math.max(0, delay),
      duration: clampedDuration,
      elapsed: 0,
      maxOpacity: clamp(maxOpacity, 0, 1)
    };
    this.screenFlashLayer.style.background = color;
    this.screenFlashLayer.style.opacity = this.screenFlash.delay > 0
      ? '0'
      : this.screenFlash.maxOpacity.toFixed(3);
  }

  private playScreenShake(
    strength: number,
    duration: number,
    frequency = DEFAULT_SCREEN_SHAKE_FREQUENCY,
    envelope = screenShakeFalloffEnvelope
  ): void {
    const clampedStrength = Math.max(0, strength);
    const clampedDuration = Math.max(0, duration);

    if (clampedStrength === 0 || clampedDuration === 0) {
      this.screenShake = null;
      return;
    }

    this.screenShake = {
      duration: clampedDuration,
      elapsed: 0,
      strength: clampedStrength,
      frequency: Math.max(1, frequency),
      seed: Math.random() * Math.PI * 2,
      envelope
    };
  }

  private updateScreenEffects(dt: number): void {
    if (this.screenFlash) {
      this.screenFlash.elapsed = Math.min(
        this.screenFlash.delay + this.screenFlash.duration,
        this.screenFlash.elapsed + dt
      );
      const activeTime = Math.max(0, this.screenFlash.elapsed - this.screenFlash.delay);
      const progress = activeTime / this.screenFlash.duration;
      const easedProgress = 0.5 - Math.cos(progress * Math.PI) * 0.5;
      const opacity = this.screenFlash.maxOpacity * Math.sin(easedProgress * Math.PI);
      this.screenFlashLayer.style.opacity = opacity.toFixed(3);

      if (this.screenFlash.elapsed >= this.screenFlash.delay + this.screenFlash.duration) {
        this.screenFlash = null;
        this.screenFlashLayer.style.opacity = '0';
      }
    }

    if (this.screenShake) {
      this.screenShake.elapsed = Math.min(
        this.screenShake.duration,
        this.screenShake.elapsed + dt
      );

      if (this.screenShake.elapsed >= this.screenShake.duration) {
        this.screenShake = null;
      }
    }
  }

  private startTeleportTransition(teleport: TeleportTile): void {
    this.teleportArmed = false;
    this.playScreenFlash(
      '#ffffff',
      TELEPORT_FLASH_DURATION,
      TELEPORT_FLASH_OPACITY,
      TELEPORT_FLASH_DELAY
    );
    this.teleportTransition = {
      phase: 'fadeOut',
      timer: 0,
      targetMapId: teleport.targetMapId,
      targetX: teleport.targetX,
      targetY: teleport.targetY
    };
  }

  private updateTeleportTransition(dt: number): void {
    if (!this.teleportTransition) {
      return;
    }

    this.teleportTransition.timer = Math.min(
      TELEPORT_FADE_DURATION,
      this.teleportTransition.timer + dt
    );
    const progress = this.teleportTransition.timer / TELEPORT_FADE_DURATION;

    if (this.teleportTransition.phase === 'fadeOut') {
      this.setPlayerOpacity(1 - progress);

      if (progress >= 1) {
        const { targetMapId, targetX, targetY } = this.teleportTransition;
        this.loadMap(targetMapId, targetX, targetY);
        this.teleportTransition = {
          phase: 'fadeIn',
          timer: 0,
          targetMapId,
          targetX,
          targetY
        };
        this.setPlayerOpacity(0);
      }

      return;
    }

    this.setPlayerOpacity(progress);
    if (progress >= 1) {
      this.teleportTransition = null;
      this.setPlayerOpacity(1);
    }
  }

  private updateMapTeleport(): void {
    if (this.teleportTransition) {
      return;
    }

    const tileX = Math.floor(this.player.x);
    const tileY = Math.floor(this.player.y);
    const teleport = this.getTeleportAtTile(tileX, tileY);

    if (!teleport) {
      this.teleportArmed = true;
      return;
    }

    if (!this.teleportArmed || !this.player.grounded) {
      return;
    }

    this.startTeleportTransition(teleport);
  }

  private getTopBaseColor(materialKey: MaterialKey): Color {
    switch (materialKey) {
      case 'grass':
        return new Color('#92c65e');
      case 'moss':
        return new Color('#64884c');
      case 'sand':
        return new Color('#cfb070');
      case 'portal':
        return new Color('#58d7ff');
      case 'stone':
        return new Color('#b3b6c1');
    }
  }

  private getHeightTintColor(materialKey: MaterialKey): Color {
    switch (materialKey) {
      case 'sand':
        return new Color('#fff0c8');
      case 'stone':
        return new Color('#f3f7ff');
      case 'portal':
        return new Color('#e1fbff');
      default:
        return new Color('#f2ffd8');
    }
  }

  private applyTerrainScale(): void {
    this.terrainGroup.scale.set(1, this.blockHeightScale, 1);
    this.terrainGroup.updateMatrixWorld();
  }

  private appendTerrainTopEdgeBand(
    buffers: TerrainGeometryBuffers,
    colorSpans: TerrainOpaqueTopColorSpan[],
    material: MaterialKey,
    heightTintBaseOpacity: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    surfaceZ: number
  ): void {
    const quad = this.appendTerrainQuad(
      buffers,
      [
        [startX, surfaceZ + TERRAIN_TOP_EDGE_BAND_ELEVATION, startY],
        [startX, surfaceZ + TERRAIN_TOP_EDGE_BAND_ELEVATION, endY],
        [endX, surfaceZ + TERRAIN_TOP_EDGE_BAND_ELEVATION, endY],
        [endX, surfaceZ + TERRAIN_TOP_EDGE_BAND_ELEVATION, startY]
      ],
      [0, 1, 0],
      this.applyTopEdgeBandTone(this.getTerrainTopRenderColor(material, heightTintBaseOpacity))
    );

    colorSpans.push({
      material,
      heightTintBaseOpacity,
      isEdgeBand: true,
      brightness: 1,
      startVertex: quad.startVertex,
      vertexCount: quad.vertexCount
    });
  }

  private appendTerrainTopEdgeBands(
    buffers: TerrainGeometryBuffers,
    colorSpans: TerrainOpaqueTopColorSpan[],
    material: MaterialKey,
    heightTintBaseOpacity: number,
    worldX: number,
    worldY: number,
    width: number,
    height: number,
    topLevel: number
  ): void {
    const appendCorner = (startX: number, startY: number): void => {
      this.appendTerrainTopEdgeBand(
        buffers,
        colorSpans,
        material,
        heightTintBaseOpacity,
        startX,
        startY,
        startX + this.terrainTopEdgeBandWidth,
        startY + this.terrainTopEdgeBandWidth,
        topLevel
      );
    };

    for (let offsetY = 0; offsetY < height; offsetY += 1) {
      for (let offsetX = 0; offsetX < width; offsetX += 1) {
        const tileX = worldX + offsetX;
        const tileY = worldY + offsetY;

        if (getHeight(this.map, tileX, tileY) < topLevel) {
          continue;
        }

        if (getHeight(this.map, tileX, tileY - 1) < topLevel) {
          this.appendTerrainTopEdgeBand(
            buffers,
            colorSpans,
            material,
            heightTintBaseOpacity,
            tileX,
            tileY,
            tileX + 1,
            tileY + this.terrainTopEdgeBandWidth,
            topLevel
          );
        }

        if (getHeight(this.map, tileX, tileY + 1) < topLevel) {
          this.appendTerrainTopEdgeBand(
            buffers,
            colorSpans,
            material,
            heightTintBaseOpacity,
            tileX,
            tileY + 1 - this.terrainTopEdgeBandWidth,
            tileX + 1,
            tileY + 1,
            topLevel
          );
        }

        if (getHeight(this.map, tileX - 1, tileY) < topLevel) {
          this.appendTerrainTopEdgeBand(
            buffers,
            colorSpans,
            material,
            heightTintBaseOpacity,
            tileX,
            tileY,
            tileX + this.terrainTopEdgeBandWidth,
            tileY + 1,
            topLevel
          );
        }

        if (getHeight(this.map, tileX + 1, tileY) < topLevel) {
          this.appendTerrainTopEdgeBand(
            buffers,
            colorSpans,
            material,
            heightTintBaseOpacity,
            tileX + 1 - this.terrainTopEdgeBandWidth,
            tileY,
            tileX + 1,
            tileY + 1,
            topLevel
          );
        }

        const northFilled = getHeight(this.map, tileX, tileY - 1) >= topLevel;
        const southFilled = getHeight(this.map, tileX, tileY + 1) >= topLevel;
        const westFilled = getHeight(this.map, tileX - 1, tileY) >= topLevel;
        const eastFilled = getHeight(this.map, tileX + 1, tileY) >= topLevel;

        if (northFilled && westFilled && getHeight(this.map, tileX - 1, tileY - 1) < topLevel) {
          appendCorner(tileX, tileY);
        }
        if (northFilled && eastFilled && getHeight(this.map, tileX + 1, tileY - 1) < topLevel) {
          appendCorner(tileX + 1 - this.terrainTopEdgeBandWidth, tileY);
        }
        if (southFilled && westFilled && getHeight(this.map, tileX - 1, tileY + 1) < topLevel) {
          appendCorner(tileX, tileY + 1 - this.terrainTopEdgeBandWidth);
        }
        if (southFilled && eastFilled && getHeight(this.map, tileX + 1, tileY + 1) < topLevel) {
          appendCorner(
            tileX + 1 - this.terrainTopEdgeBandWidth,
            tileY + 1 - this.terrainTopEdgeBandWidth
          );
        }
      }
    }
  }

  private buildChunkOpaqueTopMesh(
    chunkBlocks: TerrainBlockBuildData[],
    chunkStartX: number,
    chunkStartY: number,
    chunkWidth: number,
    chunkHeight: number
  ): {
    mesh: Mesh | null;
    edgeMesh: Mesh | null;
    colorSpans: TerrainOpaqueTopColorSpan[];
    edgeColorSpans: TerrainOpaqueTopColorSpan[];
  } {
    const maxChunkHeight = chunkBlocks.reduce((highest, block) => Math.max(highest, block.z + 1), 0);
    const topPlanes = Array.from({ length: maxChunkHeight }, () =>
      Array.from({ length: chunkHeight }, () => Array<MaterialKey | null>(chunkWidth).fill(null))
    );

    for (const block of chunkBlocks) {
      if (!block.hasTop) {
        continue;
      }

      topPlanes[block.z][block.y - chunkStartY][block.x - chunkStartX] = block.material;
    }

    const buffers = this.createTerrainGeometryBuffers();
    const edgeBuffers = this.createTerrainGeometryBuffers();
    const colorSpans: TerrainOpaqueTopColorSpan[] = [];
    const edgeColorSpans: TerrainOpaqueTopColorSpan[] = [];

    for (let z = 0; z < topPlanes.length; z += 1) {
      const plane = topPlanes[z];
      const visited = Array.from({ length: chunkHeight }, () => Array<boolean>(chunkWidth).fill(false));

      for (let localY = 0; localY < chunkHeight; localY += 1) {
        for (let localX = 0; localX < chunkWidth; localX += 1) {
          const material = plane[localY][localX];
          if (!material || visited[localY][localX]) {
            continue;
          }

          let width = 1;
          while (
            localX + width < chunkWidth &&
            plane[localY][localX + width] === material &&
            !visited[localY][localX + width]
          ) {
            width += 1;
          }

          let height = 1;
          let canGrow = true;
          while (localY + height < chunkHeight && canGrow) {
            for (let offsetX = 0; offsetX < width; offsetX += 1) {
              if (
                plane[localY + height][localX + offsetX] !== material ||
                visited[localY + height][localX + offsetX]
              ) {
                canGrow = false;
                break;
              }
            }

            if (canGrow) {
              height += 1;
            }
          }

          for (let offsetY = 0; offsetY < height; offsetY += 1) {
            for (let offsetX = 0; offsetX < width; offsetX += 1) {
              visited[localY + offsetY][localX + offsetX] = true;
            }
          }

          const worldX = chunkStartX + localX;
          const worldY = chunkStartY + localY;
          const topColor = this.getTerrainTopRenderColor(
            material,
            z > 0 ? Math.min(0.7, z * 0.1) : 0
          );
          const quad = this.appendTerrainQuad(
            buffers,
            [
              [worldX, z + 1, worldY],
              [worldX, z + 1, worldY + height],
              [worldX + width, z + 1, worldY + height],
              [worldX + width, z + 1, worldY]
            ],
            [0, 1, 0],
            topColor
          );
          colorSpans.push({
            material,
            heightTintBaseOpacity: z > 0 ? Math.min(0.7, z * 0.1) : 0,
            isEdgeBand: false,
            brightness: 1,
            startVertex: quad.startVertex,
            vertexCount: quad.vertexCount
          });
          this.appendTerrainTopEdgeBands(
            edgeBuffers,
            edgeColorSpans,
            material,
            z > 0 ? Math.min(0.7, z * 0.1) : 0,
            worldX,
            worldY,
            width,
            height,
            z + 1
          );
        }
      }
    }

    const geometry = this.createTerrainBufferGeometry(buffers);
    const edgeGeometry = this.createTerrainBufferGeometry(edgeBuffers);
    return {
      mesh: geometry ? this.createTerrainStaticMesh(geometry, this.terrainOpaqueMaterial, 0) : null,
      edgeMesh: edgeGeometry
        ? this.createTerrainStaticMesh(edgeGeometry, this.terrainTopEdgeMaterial, 21)
        : null,
      colorSpans,
      edgeColorSpans
    };
  }

  private buildChunkOpaqueSideMesh(
    chunkBlocks: TerrainBlockBuildData[],
    chunkStartX: number,
    chunkStartY: number,
    chunkWidth: number,
    chunkHeight: number
  ): Mesh | null {
    const maxChunkHeight = chunkBlocks.reduce((highest, block) => Math.max(highest, block.z + 1), 0);
    const makePlanes = (planeCount: number, runLength: number): Array<Array<Array<MaterialKey | null>>> =>
      Array.from({ length: planeCount }, () =>
        Array.from({ length: maxChunkHeight }, () => Array<MaterialKey | null>(runLength).fill(null))
      );

    const northPlanes = makePlanes(chunkHeight + 1, chunkWidth);
    const southPlanes = makePlanes(chunkHeight + 1, chunkWidth);
    const westPlanes = makePlanes(chunkWidth + 1, chunkHeight);
    const eastPlanes = makePlanes(chunkWidth + 1, chunkHeight);

    for (const block of chunkBlocks) {
      const localX = block.x - chunkStartX;
      const localY = block.y - chunkStartY;

      for (const direction of block.sideDirections) {
        switch (direction) {
          case 'north':
            northPlanes[localY][block.z][localX] = block.material;
            break;
          case 'south':
            southPlanes[localY + 1][block.z][localX] = block.material;
            break;
          case 'west':
            westPlanes[localX][block.z][localY] = block.material;
            break;
          case 'east':
            eastPlanes[localX + 1][block.z][localY] = block.material;
            break;
        }
      }
    }

    const buffers = this.createTerrainGeometryBuffers();
    const appendGreedyPlanes = (
      planes: Array<Array<Array<MaterialKey | null>>>,
      direction: TerrainSideDirection,
      planeToWorld: (planeIndex: number) => number
    ): void => {
      const normalByDirection: Record<TerrainSideDirection, [number, number, number]> = {
        north: [0, 0, -1],
        south: [0, 0, 1],
        east: [1, 0, 0],
        west: [-1, 0, 0]
      };

      for (let planeIndex = 0; planeIndex < planes.length; planeIndex += 1) {
        const plane = planes[planeIndex];
        const heightLevels = plane.length;
        const runLength = plane[0]?.length ?? 0;
        const visited = Array.from({ length: heightLevels }, () => Array<boolean>(runLength).fill(false));

        for (let z = 0; z < heightLevels; z += 1) {
          for (let run = 0; run < runLength; run += 1) {
            const material = plane[z][run];
            if (!material || visited[z][run]) {
              continue;
            }

            let width = 1;
            while (
              run + width < runLength &&
              plane[z][run + width] === material &&
              !visited[z][run + width]
            ) {
              width += 1;
            }

            let height = 1;
            let canGrow = true;
            while (z + height < heightLevels && canGrow) {
              for (let offset = 0; offset < width; offset += 1) {
                if (
                  plane[z + height][run + offset] !== material ||
                  visited[z + height][run + offset]
                ) {
                  canGrow = false;
                  break;
                }
              }
              if (canGrow) {
                height += 1;
              }
            }

            for (let offsetZ = 0; offsetZ < height; offsetZ += 1) {
              for (let offsetRun = 0; offsetRun < width; offsetRun += 1) {
                visited[z + offsetZ][run + offsetRun] = true;
              }
            }

            const sideColor = this.getTerrainSideColor(material, direction);
            const planeWorld = planeToWorld(planeIndex);

            if (direction === 'north') {
              const worldX = chunkStartX + run;
              this.appendTerrainQuad(
                buffers,
                [
                  [worldX + width, z, planeWorld],
                  [worldX, z, planeWorld],
                  [worldX, z + height, planeWorld],
                  [worldX + width, z + height, planeWorld]
                ],
                normalByDirection[direction],
                sideColor
              );
            } else if (direction === 'south') {
              const worldX = chunkStartX + run;
              this.appendTerrainQuad(
                buffers,
                [
                  [worldX, z, planeWorld],
                  [worldX + width, z, planeWorld],
                  [worldX + width, z + height, planeWorld],
                  [worldX, z + height, planeWorld]
                ],
                normalByDirection[direction],
                sideColor
              );
            } else if (direction === 'west') {
              const worldY = chunkStartY + run;
              this.appendTerrainQuad(
                buffers,
                [
                  [planeWorld, z, worldY],
                  [planeWorld, z, worldY + width],
                  [planeWorld, z + height, worldY + width],
                  [planeWorld, z + height, worldY]
                ],
                normalByDirection[direction],
                sideColor
              );
            } else {
              const worldY = chunkStartY + run;
              this.appendTerrainQuad(
                buffers,
                [
                  [planeWorld, z, worldY + width],
                  [planeWorld, z, worldY],
                  [planeWorld, z + height, worldY],
                  [planeWorld, z + height, worldY + width]
                ],
                normalByDirection[direction],
                sideColor
              );
            }
          }
        }
      }
    };

    appendGreedyPlanes(northPlanes, 'north', (planeIndex) => chunkStartY + planeIndex);
    appendGreedyPlanes(southPlanes, 'south', (planeIndex) => chunkStartY + planeIndex);
    appendGreedyPlanes(westPlanes, 'west', (planeIndex) => chunkStartX + planeIndex);
    appendGreedyPlanes(eastPlanes, 'east', (planeIndex) => chunkStartX + planeIndex);

    const geometry = this.createTerrainBufferGeometry(buffers);
    return geometry ? this.createTerrainStaticMesh(geometry, this.terrainOpaqueMaterial, 0) : null;
  }

  private refreshLighting(): void {
    this.refreshTerrainShadowFlags();
    this.updateTerrainOcclusion();
  }

  private refreshTerrainShadowFlags(): void {
    const shadowsEnabled = this.sunLight.castShadow;

    for (const chunk of this.terrainChunks) {
      const meshes = [
        chunk.opaqueTopMesh,
        chunk.opaqueTopEdgeMesh,
        chunk.frontTopMesh,
        chunk.frontTopEdgeMesh,
        chunk.opaqueSideMesh,
        chunk.frontSideMesh
      ];

      for (const mesh of meshes) {
        if (!mesh) {
          continue;
        }

        mesh.castShadow = shadowsEnabled;
        mesh.receiveShadow = shadowsEnabled;
      }
    }
  }

  private refreshTerrainReadability(): void {
    for (const chunk of this.terrainChunks) {
      this.updateChunkOpaqueTopColors(chunk);
    }

    for (const block of this.terrainBlocks) {
      this.updateTerrainBlockColor(block);
    }

    for (const chunk of this.terrainChunks) {
      const frontMeshes = [chunk.frontTopMesh, chunk.frontSideMesh];
      if (chunk.frontTopEdgeMesh?.instanceColor) {
        chunk.frontTopEdgeMesh.instanceColor.needsUpdate = true;
      }
      for (const mesh of frontMeshes) {
        if (mesh?.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }
      }
    }
  }

  private isBlockExposed(x: number, y: number, z: number): boolean {
    const level = z + 1;

    return (
      getHeight(this.map, x, y) === level ||
      getHeight(this.map, x + 1, y) < level ||
      getHeight(this.map, x - 1, y) < level ||
      getHeight(this.map, x, y + 1) < level ||
      getHeight(this.map, x, y - 1) < level
    );
  }

  private buildTerrain(): void {
    this.terrainGroup.clear();
    this.terrainBlocks.length = 0;
    this.terrainBlockColumns.clear();
    this.terrainChunks.length = 0;
    const chunkBlockMap = new Map<string, TerrainChunkBuildData>();

    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        const cell = getCell(this.map, x, y);
        for (let z = 0; z < cell.height; z += 1) {
          if (!this.isBlockExposed(x, y, z)) {
            continue;
          }

          const chunkX = Math.floor(x / TERRAIN_CHUNK_SIZE);
          const chunkY = Math.floor(y / TERRAIN_CHUNK_SIZE);
          const chunkKey = `${chunkX}:${chunkY}`;
          const chunk = chunkBlockMap.get(chunkKey);
          const level = z + 1;
          const sideDirections: TerrainSideDirection[] = [];

          if (getHeight(this.map, x + 1, y) < level) {
            sideDirections.push('east');
          }
          if (getHeight(this.map, x - 1, y) < level) {
            sideDirections.push('west');
          }
          if (getHeight(this.map, x, y + 1) < level) {
            sideDirections.push('south');
          }
          if (getHeight(this.map, x, y - 1) < level) {
            sideDirections.push('north');
          }

          const blockData: TerrainBlockBuildData = {
            x,
            y,
            z,
            material: getBlockMaterial(this.map, x, y, z),
            hasTop: getHeight(this.map, x, y) === level,
            sideDirections
          };

          if (chunk) {
            chunk.blocks.push(blockData);
          } else {
            chunkBlockMap.set(chunkKey, {
              chunkX,
              chunkY,
              blocks: [blockData]
            });
          }
        }
      }
    }

    for (const chunkData of chunkBlockMap.values()) {
      const chunkBlocks = chunkData.blocks;
      const topFaceCount = chunkBlocks.reduce((sum, block) => sum + (block.hasTop ? 1 : 0), 0);
      const topEdgeFaceCount = chunkBlocks.reduce((sum, block) => {
        if (!block.hasTop) {
          return sum;
        }

        const topLevel = block.z + 1;
        const northFilled = getHeight(this.map, block.x, block.y - 1) >= topLevel;
        const southFilled = getHeight(this.map, block.x, block.y + 1) >= topLevel;
        const westFilled = getHeight(this.map, block.x - 1, block.y) >= topLevel;
        const eastFilled = getHeight(this.map, block.x + 1, block.y) >= topLevel;

        let innerCornerCount = 0;
        if (northFilled && westFilled && getHeight(this.map, block.x - 1, block.y - 1) < topLevel) {
          innerCornerCount += 1;
        }
        if (northFilled && eastFilled && getHeight(this.map, block.x + 1, block.y - 1) < topLevel) {
          innerCornerCount += 1;
        }
        if (southFilled && westFilled && getHeight(this.map, block.x - 1, block.y + 1) < topLevel) {
          innerCornerCount += 1;
        }
        if (southFilled && eastFilled && getHeight(this.map, block.x + 1, block.y + 1) < topLevel) {
          innerCornerCount += 1;
        }

        return sum + block.sideDirections.length + innerCornerCount;
      }, 0);
      const sideFaceCount = chunkBlocks.reduce((sum, block) => sum + block.sideDirections.length, 0);
      const chunkStartX = chunkData.chunkX * TERRAIN_CHUNK_SIZE;
      const chunkStartY = chunkData.chunkY * TERRAIN_CHUNK_SIZE;
      const chunkWidth = Math.min(TERRAIN_CHUNK_SIZE, this.map.width - chunkStartX);
      const chunkHeight = Math.min(TERRAIN_CHUNK_SIZE, this.map.height - chunkStartY);
      const opaqueTop = this.buildChunkOpaqueTopMesh(
        chunkBlocks,
        chunkStartX,
        chunkStartY,
        chunkWidth,
        chunkHeight
      );
      const opaqueSideMesh = this.buildChunkOpaqueSideMesh(
        chunkBlocks,
        chunkStartX,
        chunkStartY,
        chunkWidth,
        chunkHeight
      );
      const chunk: TerrainChunkRender = {
        opaqueTopMesh: opaqueTop.mesh,
        opaqueTopEdgeMesh: opaqueTop.edgeMesh,
        frontTopMesh:
          topFaceCount > 0
            ? this.createTerrainRenderMesh(this.terrainTopGeometry, this.terrainFrontMaterial, topFaceCount, 20)
            : null,
        frontTopEdgeMesh:
          topEdgeFaceCount > 0
            ? this.createTerrainRenderMesh(
                this.terrainTopGeometry,
                this.terrainFrontTopEdgeMaterial,
                topEdgeFaceCount,
                21
              )
            : null,
        opaqueSideMesh,
        frontSideMesh:
          sideFaceCount > 0
            ? this.createTerrainRenderMesh(this.terrainSideGeometry, this.terrainFrontMaterial, sideFaceCount, 20)
            : null,
        opaqueTopColorSpans: opaqueTop.colorSpans,
        opaqueTopEdgeColorSpans: opaqueTop.edgeColorSpans
      };
      chunk.opaqueTopMesh && this.terrainGroup.add(chunk.opaqueTopMesh);
      chunk.opaqueTopEdgeMesh && this.terrainGroup.add(chunk.opaqueTopEdgeMesh);
      chunk.frontTopMesh && this.terrainGroup.add(chunk.frontTopMesh);
      chunk.frontTopEdgeMesh && this.terrainGroup.add(chunk.frontTopEdgeMesh);
      chunk.opaqueSideMesh && this.terrainGroup.add(chunk.opaqueSideMesh);
      chunk.frontSideMesh && this.terrainGroup.add(chunk.frontSideMesh);
      this.terrainChunks.push(chunk);
      let nextTopFaceIndex = 0;
      let nextTopEdgeFaceIndex = 0;
      let nextSideFaceIndex = 0;

      chunkBlocks.forEach((blockData) => {
        const topFace =
          blockData.hasTop && chunk.frontTopMesh
            ? {
                type: 'top' as const,
                rotationY: 0,
                frontIndex: nextTopFaceIndex
              }
            : null;
        if (topFace) {
          chunk.frontTopMesh?.setMatrixAt(topFace.frontIndex, this.hiddenTerrainMatrix);
          nextTopFaceIndex += 1;
        }

        const topEdgeFaces =
          blockData.hasTop && chunk.frontTopEdgeMesh
            ? (() => {
                const faces: TerrainFaceBinding[] = [];
                const pushFace = (
                  offsetX: number,
                  offsetZ: number,
                  scaleX: number,
                  scaleZ: number
                ): void => {
                  const face: TerrainFaceBinding = {
                    type: 'top-edge',
                    rotationY: 0,
                    frontIndex: nextTopEdgeFaceIndex,
                    offsetX,
                    offsetZ,
                    scaleX,
                    scaleZ
                  };
                  chunk.frontTopEdgeMesh?.setMatrixAt(face.frontIndex, this.hiddenTerrainMatrix);
                  nextTopEdgeFaceIndex += 1;
                  faces.push(face);
                };

                for (const direction of blockData.sideDirections) {
                  pushFace(
                    direction === 'west'
                      ? -0.5 + this.terrainTopEdgeBandWidth * 0.5
                      : direction === 'east'
                        ? 0.5 - this.terrainTopEdgeBandWidth * 0.5
                        : 0,
                    direction === 'north'
                      ? -0.5 + this.terrainTopEdgeBandWidth * 0.5
                      : direction === 'south'
                        ? 0.5 - this.terrainTopEdgeBandWidth * 0.5
                        : 0,
                    direction === 'north' || direction === 'south'
                      ? 1
                      : this.terrainTopEdgeBandWidth,
                    direction === 'east' || direction === 'west'
                      ? 1
                      : this.terrainTopEdgeBandWidth
                  );
                }

                const sideSet = new Set(blockData.sideDirections);
                const topLevel = blockData.z + 1;
                const northFilled = getHeight(this.map, blockData.x, blockData.y - 1) >= topLevel;
                const southFilled = getHeight(this.map, blockData.x, blockData.y + 1) >= topLevel;
                const westFilled = getHeight(this.map, blockData.x - 1, blockData.y) >= topLevel;
                const eastFilled = getHeight(this.map, blockData.x + 1, blockData.y) >= topLevel;

                if (
                  northFilled &&
                  westFilled &&
                  getHeight(this.map, blockData.x - 1, blockData.y - 1) < topLevel
                ) {
                  pushFace(
                    -0.5 + this.terrainTopEdgeBandWidth * 0.5,
                    -0.5 + this.terrainTopEdgeBandWidth * 0.5,
                    this.terrainTopEdgeBandWidth,
                    this.terrainTopEdgeBandWidth
                  );
                }
                if (
                  northFilled &&
                  eastFilled &&
                  getHeight(this.map, blockData.x + 1, blockData.y - 1) < topLevel
                ) {
                  pushFace(
                    0.5 - this.terrainTopEdgeBandWidth * 0.5,
                    -0.5 + this.terrainTopEdgeBandWidth * 0.5,
                    this.terrainTopEdgeBandWidth,
                    this.terrainTopEdgeBandWidth
                  );
                }
                if (
                  southFilled &&
                  westFilled &&
                  getHeight(this.map, blockData.x - 1, blockData.y + 1) < topLevel
                ) {
                  pushFace(
                    -0.5 + this.terrainTopEdgeBandWidth * 0.5,
                    0.5 - this.terrainTopEdgeBandWidth * 0.5,
                    this.terrainTopEdgeBandWidth,
                    this.terrainTopEdgeBandWidth
                  );
                }
                if (
                  southFilled &&
                  eastFilled &&
                  getHeight(this.map, blockData.x + 1, blockData.y + 1) < topLevel
                ) {
                  pushFace(
                    0.5 - this.terrainTopEdgeBandWidth * 0.5,
                    0.5 - this.terrainTopEdgeBandWidth * 0.5,
                    this.terrainTopEdgeBandWidth,
                    this.terrainTopEdgeBandWidth
                  );
                }

                return faces;
              })()
            : [];

        const sideFaces = blockData.sideDirections.map((direction) => {
          const face: TerrainFaceBinding = {
            type: 'side',
            rotationY: getTerrainSideRotation(direction),
            frontIndex: nextSideFaceIndex
          };
          chunk.frontSideMesh?.setMatrixAt(face.frontIndex, this.hiddenTerrainMatrix);
          nextSideFaceIndex += 1;
          return face;
        });

        const block: TerrainBlockInstance = {
          x: blockData.x,
          y: blockData.y,
          z: blockData.z,
          material: blockData.material,
          heightTintBaseOpacity: blockData.z > 0 ? Math.min(0.7, blockData.z * 0.1) : 0,
          renderColor: new Color(),
          chunk,
          topFace,
          topEdgeFaces,
          sideFaces,
          currentFront: false
        };

        block.sideFaces.forEach((face, faceIndex) => {
          const direction = blockData.sideDirections[faceIndex];
          const sideColor = this.getTerrainSideColor(block.material, direction);
          chunk.frontSideMesh?.setColorAt(face.frontIndex, sideColor);
        });
        for (const face of block.topEdgeFaces) {
          chunk.frontTopEdgeMesh?.setColorAt(
            face.frontIndex,
            this
              .getTerrainTopRenderColor(block.material, block.heightTintBaseOpacity)
              .multiplyScalar(this.terrainTopEdgeBandBrightness)
          );
        }

        this.terrainBlocks.push(block);
        this.addTerrainBlockToColumn(block);
      });

      if (chunk.frontTopMesh) {
        chunk.frontTopMesh.instanceMatrix.needsUpdate = true;
      }
      if (chunk.frontTopEdgeMesh) {
        chunk.frontTopEdgeMesh.instanceMatrix.needsUpdate = true;
        if (chunk.frontTopEdgeMesh.instanceColor) {
          chunk.frontTopEdgeMesh.instanceColor.needsUpdate = true;
        }
      }
      if (chunk.frontSideMesh) {
        chunk.frontSideMesh.instanceMatrix.needsUpdate = true;
        if (chunk.frontSideMesh.instanceColor) {
          chunk.frontSideMesh.instanceColor.needsUpdate = true;
        }
      }
    }

    this.refreshTerrainTransforms();
    this.refreshTerrainReadability();
  }

  private refreshTerrainTransforms(): void {
    this.applyTerrainScale();

    for (const block of this.terrainBlocks) {
      const allFaces = [
        ...(block.topFace ? [block.topFace] : []),
        ...block.topEdgeFaces,
        ...block.sideFaces
      ];

      for (const face of allFaces) {
        const frontMesh = this.getFrontTerrainFaceMesh(block.chunk, face);

        if (!frontMesh) {
          continue;
        }

        if (block.currentFront) {
          this.writeTerrainFaceTransform(frontMesh, face.frontIndex, block, face);
        } else {
          frontMesh.setMatrixAt(face.frontIndex, this.hiddenTerrainMatrix);
        }
      }
    }

    for (const chunk of this.terrainChunks) {
      if (chunk.frontTopMesh) {
        chunk.frontTopMesh.instanceMatrix.needsUpdate = true;
      }
      if (chunk.frontSideMesh) {
        chunk.frontSideMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  private shouldTerrainBlockRenderInFrontOfActor(
    block: TerrainBlockInstance,
    actorFootX: number,
    actorFootY: number,
    actorFootZ: number,
    actorBodyHeight: number,
    basis: ScreenBasis
  ): boolean {
    const actorTopZ = actorFootZ + actorBodyHeight;
    const {
      lateralRange,
      frontMin,
      frontMax,
      minHeightAboveFeet,
      actorHeightPadding
    } = this.occlusionTuning;
    const centerDeltaX = block.x + 0.5 - actorFootX;
    const centerDeltaY = block.y + 0.5 - actorFootY;
    const centerLateral = centerDeltaX * basis.rightNorm.x + centerDeltaY * basis.rightNorm.y;
    const centerFrontness = -(centerDeltaX * basis.topNorm.x + centerDeltaY * basis.topNorm.y);

    if (
      centerLateral < -lateralRange - 2.5 ||
      centerLateral > lateralRange + 2.5 ||
      centerFrontness < frontMin - 2.5 ||
      centerFrontness > frontMax + 3.5
    ) {
      return false;
    }

    const footprintPoints = [
      { x: block.x, y: block.y },
      { x: block.x + 1, y: block.y },
      { x: block.x, y: block.y + 1 },
      { x: block.x + 1, y: block.y + 1 }
    ];
    let minLateral = Infinity;
    let maxLateral = -Infinity;
    let minFrontness = Infinity;
    let maxFrontness = -Infinity;

    for (const point of footprintPoints) {
      const deltaX = point.x - actorFootX;
      const deltaY = point.y - actorFootY;
      const lateral = deltaX * basis.rightNorm.x + deltaY * basis.rightNorm.y;
      const frontness = -(deltaX * basis.topNorm.x + deltaY * basis.topNorm.y);
      minLateral = Math.min(minLateral, lateral);
      maxLateral = Math.max(maxLateral, lateral);
      minFrontness = Math.min(minFrontness, frontness);
      maxFrontness = Math.max(maxFrontness, frontness);
    }

    const blockTop = block.z + 1;
    const blockBottom = block.z;
    const overlapsActorLane = maxLateral >= -lateralRange && minLateral <= lateralRange;
    const isFrontFacing = maxFrontness >= frontMin && minFrontness <= frontMax;
    const risesAboveFeet = blockTop > actorFootZ + minHeightAboveFeet + OCCLUSION_HEIGHT_EPSILON;
    const intersectsActorHeight = blockBottom < actorTopZ + actorHeightPadding;

    return overlapsActorLane && isFrontFacing && risesAboveFeet && intersectsActorHeight;
  }

  private canFrontTerrainAffectActor(
    block: TerrainBlockInstance,
    actor: TerrainOcclusionActor,
    basis: ScreenBasis
  ): boolean {
    const actorTopZ = actor.footZ + actor.bodyHeight;
    const {
      lateralRange,
      frontMin,
      frontMax,
      minHeightAboveFeet,
      actorHeightPadding
    } = this.occlusionTuning;
    const footprintPoints = [
      { x: block.x, y: block.y },
      { x: block.x + 1, y: block.y },
      { x: block.x, y: block.y + 1 },
      { x: block.x + 1, y: block.y + 1 }
    ];
    let minLateral = Infinity;
    let maxLateral = -Infinity;
    let minFrontness = Infinity;
    let maxFrontness = -Infinity;

    for (const point of footprintPoints) {
      const deltaX = point.x - actor.x;
      const deltaY = point.y - actor.y;
      const lateral = deltaX * basis.rightNorm.x + deltaY * basis.rightNorm.y;
      const frontness = -(deltaX * basis.topNorm.x + deltaY * basis.topNorm.y);
      minLateral = Math.min(minLateral, lateral);
      maxLateral = Math.max(maxLateral, lateral);
      minFrontness = Math.min(minFrontness, frontness);
      maxFrontness = Math.max(maxFrontness, frontness);
    }

    const blockTop = block.z + 1;
    const blockBottom = block.z;
    const overlapsActorLane = maxLateral >= -lateralRange && minLateral <= lateralRange;
    const isNearActorDepth =
      maxFrontness >= frontMin - 2.5 && minFrontness <= frontMax + 3.5;
    const risesAboveFeet = blockTop > actor.footZ + minHeightAboveFeet + OCCLUSION_HEIGHT_EPSILON;
    const intersectsActorHeight = blockBottom < actorTopZ + actorHeightPadding;

    return overlapsActorLane && isNearActorDepth && risesAboveFeet && intersectsActorHeight;
  }

  private getTerrainOcclusionSearchRadius(): number {
    const { lateralRange, frontMin, frontMax } = this.occlusionTuning;
    const lateralLimit = lateralRange + 2.5;
    const frontLimit = Math.max(Math.abs(frontMin - 2.5), Math.abs(frontMax + 3.5));
    return Math.ceil((lateralLimit + frontLimit) * Math.SQRT1_2 + 2);
  }

  private markTerrainOccludersForActor(
    actor: TerrainOcclusionActor,
    basis: ScreenBasis,
    frontBlocks: Set<TerrainBlockInstance>,
    canAddBlock: (block: TerrainBlockInstance) => boolean = () => true
  ): void {
    const searchRadius = this.getTerrainOcclusionSearchRadius();
    const minTileX = Math.max(0, Math.floor(actor.x) - searchRadius);
    const maxTileX = Math.min(this.map.width - 1, Math.floor(actor.x) + searchRadius);
    const minTileY = Math.max(0, Math.floor(actor.y) - searchRadius);
    const maxTileY = Math.min(this.map.height - 1, Math.floor(actor.y) + searchRadius);

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const column = this.terrainBlockColumns.get(this.getTerrainBlockColumnKey(tileX, tileY));

        if (!column) {
          continue;
        }

        for (const block of column) {
          if (
            this.shouldTerrainBlockRenderInFrontOfActor(
              block,
              actor.x,
              actor.y,
              actor.footZ,
              actor.bodyHeight,
              basis
            )
          ) {
            if (canAddBlock(block)) {
              frontBlocks.add(block);
            }
          }
        }
      }
    }
  }

  private updateTerrainOcclusion(): void {
    const basis = this.getPlaneBasis();
    const playerActor = {
      x: this.player.x,
      y: this.player.y,
      footZ: this.player.z / this.blockHeightScale,
      bodyHeight: PLAYER_BODY_HEIGHT / this.blockHeightScale
    };
    const playerFrontBlocks = new Set<TerrainBlockInstance>();
    const frontBlocks = new Set<TerrainBlockInstance>();

    this.markTerrainOccludersForActor(playerActor, basis, playerFrontBlocks);

    for (const block of playerFrontBlocks) {
      frontBlocks.add(block);
    }

    const canAddNonPlayerOccluder = (block: TerrainBlockInstance): boolean =>
      playerFrontBlocks.has(block) || !this.canFrontTerrainAffectActor(block, playerActor, basis);

    for (const npc of this.npcs) {
      if (!npc.active) {
        continue;
      }

      this.markTerrainOccludersForActor(
        {
          x: npc.x,
          y: npc.y,
          footZ: npc.z / this.blockHeightScale,
          bodyHeight: NPC_BODY_HEIGHT / this.blockHeightScale
        },
        basis,
        frontBlocks,
        canAddNonPlayerOccluder
      );
    }

    for (const flower of this.flowers) {
      if (!flower.active) {
        continue;
      }

      this.markTerrainOccludersForActor(
        {
          x: flower.x,
          y: flower.y,
          footZ: flower.z / this.blockHeightScale,
          bodyHeight: FLOWER_BODY_HEIGHT / this.blockHeightScale
        },
        basis,
        frontBlocks,
        canAddNonPlayerOccluder
      );
    }

    for (const block of this.terrainBlocks) {
      this.setTerrainBlockFrontState(block, frontBlocks.has(block));
    }
  }

  private getPlaneBasis(): ScreenBasis {
    const cardinalVectors: Vec2[] = [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 }
    ];

    const top = cardinalVectors[this.viewRotation % 4];
    const right = cardinalVectors[(this.viewRotation + 1) % 4];
    const inverseLength = 1 / Math.SQRT2;

    return {
      top,
      right,
      topNorm: {
        x: top.x * inverseLength,
        y: top.y * inverseLength
      },
      rightNorm: {
        x: right.x * inverseLength,
        y: right.y * inverseLength
      }
    };
  }

  private getJumpSpeed(): number {
    return BASE_JUMP_SPEED * this.blockHeightScale;
  }

  private getRiseGravity(): number {
    return BASE_RISE_GRAVITY * this.blockHeightScale;
  }

  private getLowJumpGravity(): number {
    return BASE_LOW_JUMP_GRAVITY * this.blockHeightScale;
  }

  private getFallGravity(): number {
    return BASE_FALL_GRAVITY * this.blockHeightScale;
  }

  private getStepHeight(): number {
    return BASE_STEP_HEIGHT * this.blockHeightScale;
  }

  private getGroundSnap(): number {
    return BASE_GROUND_SNAP * this.blockHeightScale;
  }

  private getSupportHeight(x: number, y: number, scale = this.blockHeightScale): number {
    return getHeight(this.map, Math.floor(x), Math.floor(y)) * scale;
  }

  private getColumnTopHeight(x: number, y: number): number {
    return getHeight(this.map, x, y) * this.blockHeightScale;
  }

  private getCollisionProbePoints(x: number, y: number, radius = PLAYER_COLLISION_RADIUS): Vec2[] {
    const r = radius;

    return [
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
  }

  private resolveGroundedPenetration(): void {
    const radius = PLAYER_COLLISION_RADIUS;
    const footZ = this.player.z;

    for (let iteration = 0; iteration < 4; iteration += 1) {
      let moved = false;
      const minTileX = Math.max(0, Math.floor(this.player.x - radius) - 1);
      const maxTileX = Math.min(this.map.width - 1, Math.floor(this.player.x + radius) + 1);
      const minTileY = Math.max(0, Math.floor(this.player.y - radius) - 1);
      const maxTileY = Math.min(this.map.height - 1, Math.floor(this.player.y + radius) + 1);

      for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
          if (this.getColumnTopHeight(tileX, tileY) <= footZ + 0.02) {
            continue;
          }

          const nearestX = clamp(this.player.x, tileX, tileX + 1);
          const nearestY = clamp(this.player.y, tileY, tileY + 1);
          let deltaX = this.player.x - nearestX;
          let deltaY = this.player.y - nearestY;
          let distance = Math.hypot(deltaX, deltaY);

          if (distance === 0) {
            const tileCenterX = tileX + 0.5;
            const tileCenterY = tileY + 0.5;
            deltaX = this.player.x - tileCenterX;
            deltaY = this.player.y - tileCenterY;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              deltaX = Math.sign(deltaX || 1);
              deltaY = 0;
            } else {
              deltaX = 0;
              deltaY = Math.sign(deltaY || 1);
            }
            distance = Math.hypot(deltaX, deltaY);
          }

          if (distance >= radius) {
            continue;
          }

          const push = (radius - distance) + 0.001;
          this.player.x = clamp(
            this.player.x + (deltaX / distance) * push,
            MAP_EDGE_PADDING + radius,
            this.map.width - MAP_EDGE_PADDING - radius
          );
          this.player.y = clamp(
            this.player.y + (deltaY / distance) * push,
            MAP_EDGE_PADDING + radius,
            this.map.height - MAP_EDGE_PADDING - radius
          );
          moved = true;
        }
      }

      if (!moved) {
        break;
      }
    }
  }

  private isColliding(
    x: number,
    y: number,
    footZ: number,
    radius = PLAYER_COLLISION_RADIUS
  ): boolean {
    for (const point of this.getCollisionProbePoints(x, y, radius)) {
      if (this.getSupportHeight(point.x, point.y) > footZ + 0.02) {
        return true;
      }
    }

    return false;
  }

  private tryMoveGroundActor(
    actor: { x: number; y: number; z: number },
    deltaX: number,
    deltaY: number,
    collisionRadius = NPC_COLLISION_RADIUS,
    allowDropOff = false
  ): boolean {
    const nextX = clamp(
      actor.x + deltaX,
      MAP_EDGE_PADDING + collisionRadius,
      this.map.width - MAP_EDGE_PADDING - collisionRadius
    );
    const nextY = clamp(
      actor.y + deltaY,
      MAP_EDGE_PADDING + collisionRadius,
      this.map.height - MAP_EDGE_PADDING - collisionRadius
    );
    const currentSupport = this.getSupportHeight(actor.x, actor.y);
    const nextSupport = this.getSupportHeight(nextX, nextY);

    if (nextSupport > currentSupport + 0.02) {
      return false;
    }

    if (!allowDropOff && currentSupport - nextSupport > 0.02) {
      return false;
    }

    if (this.isColliding(nextX, nextY, currentSupport, collisionRadius)) {
      return false;
    }

    actor.x = nextX;
    actor.y = nextY;
    actor.z = nextSupport;
    return true;
  }

  private updateGroundActorKnockback(
    actor: { x: number; y: number; z: number; knockbackVX: number; knockbackVY: number },
    dt: number,
    collisionRadius: number
  ): boolean {
    const speed = Math.hypot(actor.knockbackVX, actor.knockbackVY);

    if (speed <= KNOCKBACK_STOP_SPEED) {
      actor.knockbackVX = 0;
      actor.knockbackVY = 0;
      return false;
    }

    if (
      !this.tryMoveGroundActor(
        actor,
        actor.knockbackVX * dt,
        actor.knockbackVY * dt,
        collisionRadius,
        true
      )
    ) {
      actor.knockbackVX = 0;
      actor.knockbackVY = 0;
      return false;
    }

    const decay = Math.exp(-KNOCKBACK_DECAY * dt);
    actor.knockbackVX *= decay;
    actor.knockbackVY *= decay;

    if (Math.hypot(actor.knockbackVX, actor.knockbackVY) <= KNOCKBACK_STOP_SPEED) {
      actor.knockbackVX = 0;
      actor.knockbackVY = 0;
    }

    return true;
  }

  private updateActiveAttack(dt: number): void {
    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);

    if (!this.activeAttack) {
      this.updateAttackDebugVisual();
      return;
    }

    this.activeAttack.remaining = Math.max(0, this.activeAttack.remaining - dt);
    this.applyAttackHits(this.activeAttack);

    if (this.activeAttack.remaining === 0) {
      this.attackCooldownTimer = this.activeAttack.profile.cooldown;
      this.activeAttack = null;
    }

    this.updateAttackDebugVisual();
  }

  private updateActivePlainInteraction(dt: number): void {
    if (!this.activePlainInteraction) {
      this.updateInteractionDebugVisual();
      return;
    }

    this.activePlainInteraction.remaining = Math.max(
      0,
      this.activePlainInteraction.remaining - dt
    );
    this.applyPlainInteractionHits(this.activePlainInteraction);

    if (this.activePlainInteraction?.remaining === 0) {
      this.activePlainInteraction = null;
    }

    this.updateInteractionDebugVisual();
  }

  private applyAttackHits(attack: ActiveAttackState): void {
    if (attack.profile.affectsNpcs) {
      for (const npc of this.npcs) {
        if (!npc.active) {
          continue;
        }

        this.tryHitTargetWithAttack(
          attack,
          npc.id,
          npc.x,
          npc.y,
          npc.z,
          NPC_COLLISION_RADIUS,
          NPC_BODY_HEIGHT,
          () => {
            npc.attackFlashTimer = ATTACK_FLASH_TIME;
            if (npc.knockbackable) {
              npc.knockbackVX = attack.worldDirection.x * attack.profile.knockback;
              npc.knockbackVY = attack.worldDirection.y * attack.profile.knockback;
            }
            this.handleActorHitInteraction(npc.onHitInteraction);
          }
        );
      }
    }

    if (attack.profile.affectsFlowers) {
      for (const flower of this.flowers) {
        if (!flower.active) {
          continue;
        }

        this.tryHitTargetWithAttack(
          attack,
          flower.id,
          flower.x,
          flower.y,
          flower.z,
          FLOWER_COLLISION_RADIUS,
          FLOWER_BODY_HEIGHT,
          () => {
            flower.attackFlashTimer = ATTACK_FLASH_TIME;
            flower.knockbackVX = attack.worldDirection.x * attack.profile.knockback * 0.8;
            flower.knockbackVY = attack.worldDirection.y * attack.profile.knockback * 0.8;
            this.handleActorHitInteraction(flower.onHitInteraction);
          }
        );
      }
    }

    if (attack.profile.affectsTriggers) {
      for (const trigger of this.triggers) {
        if (!trigger.active) {
          continue;
        }

        this.tryHitTargetWithAttack(
          attack,
          trigger.id,
          trigger.x,
          trigger.y,
          trigger.z,
          Math.max(trigger.width, trigger.depth) * 0.5,
          trigger.height,
          () => {
            trigger.attackFlashTimer = ATTACK_FLASH_TIME;
            this.handleActorHitInteraction(trigger.onHitInteraction);
          }
        );
      }
    }
  }

  private applyPlainInteractionHits(interaction: ActivePlainInteractionState): void {
    if (interaction.hitTarget) {
      return;
    }

    let bestDistanceSq = Number.POSITIVE_INFINITY;
    const bestHit: { run: (() => void) | null } = { run: null };

    const considerTarget = (
      targetX: number,
      targetY: number,
      targetFootZ: number,
      targetRadius: number,
      targetHeight: number,
      onHit: () => void
    ): void => {
      if (
        !this.isPointInsideActionBox(
          interaction.profile,
          interaction.worldDirection,
          targetX,
          targetY,
          targetFootZ,
          targetRadius,
          targetHeight
        )
      ) {
        return;
      }

      const dx = targetX - this.player.x;
      const dy = targetY - this.player.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestHit.run = onHit;
      }
    };

    for (const npc of this.npcs) {
      if (!npc.active || !npc.onPlainInteraction) {
        continue;
      }

      considerTarget(
        npc.x,
        npc.y,
        npc.z,
        NPC_COLLISION_RADIUS,
        NPC_BODY_HEIGHT,
        () => {
          npc.touchFlashTimer = NPC_TOUCH_FLASH_TIME;
          this.handleActorPlainInteraction(npc.onPlainInteraction);
        }
      );
    }

    for (const flower of this.flowers) {
      if (!flower.active || !flower.onPlainInteraction) {
        continue;
      }

      considerTarget(
        flower.x,
        flower.y,
        flower.z,
        FLOWER_COLLISION_RADIUS,
        FLOWER_BODY_HEIGHT,
        () => {
          flower.touchFlashTimer = NPC_TOUCH_FLASH_TIME;
          this.handleActorPlainInteraction(flower.onPlainInteraction);
        }
      );
    }

    for (const trigger of this.triggers) {
      if (!trigger.active || !trigger.onPlainInteraction) {
        continue;
      }

      considerTarget(
        trigger.x,
        trigger.y,
        trigger.z,
        Math.max(trigger.width, trigger.depth) * 0.5,
        trigger.height,
        () => {
          trigger.touchFlashTimer = NPC_TOUCH_FLASH_TIME;
          this.handleActorPlainInteraction(trigger.onPlainInteraction);
        }
      );
    }

    if (!bestHit.run) {
      return;
    }

    interaction.hitTarget = true;
    bestHit.run();
    this.activePlainInteraction = null;
  }

  private handleActorHitInteraction(interaction: ActorHitInteraction | null): void {
    switch (interaction) {
      case 'regenerateOverworld':
        return;
      default:
        return;
    }
  }

  private handleActorPlainInteraction(interaction: ActorPlainInteraction | null): void {
    switch (interaction) {
      case 'regenerateOverworld':
        if (!this.trySpendCrystalForWorldRegeneration()) {
          return;
        }

        this.playScreenShake(
          WORLDSMITH_SHAKE_STRENGTH,
          WORLDSMITH_SHAKE_DURATION,
          DEFAULT_SCREEN_SHAKE_FREQUENCY,
          screenShakeEaseInOutEnvelope
        );
        this.regenerateOverworld();
        return;
      case 'inspect':
        return;
      default:
        return;
    }
  }

  private tryHitTargetWithAttack(
    attack: ActiveAttackState,
    targetId: string,
    targetX: number,
    targetY: number,
    targetFootZ: number,
    targetRadius: number,
    targetHeight: number,
    onHit: () => void
  ): void {
    if (attack.hitTargets.has(targetId)) {
      return;
    }

    if (
      !this.isPointInsideActionBox(
        attack.profile,
        attack.worldDirection,
        targetX,
        targetY,
        targetFootZ,
        targetRadius,
        targetHeight
      )
    ) {
      return;
    }

    attack.hitTargets.add(targetId);
    onHit();
  }

  private isPointInsideActionBox(
    profile: AttackProfile,
    worldDirection: Vec2,
    targetX: number,
    targetY: number,
    targetFootZ: number,
    targetRadius: number,
    targetHeight: number
  ): boolean {
    const centerOffset = PLAYER_COLLISION_RADIUS + profile.reach * 0.5;
    const centerX = this.player.x + worldDirection.x * centerOffset;
    const centerY = this.player.y + worldDirection.y * centerOffset;
    const sideAxis = {
      x: -worldDirection.y,
      y: worldDirection.x
    };
    const deltaX = targetX - centerX;
    const deltaY = targetY - centerY;
    const localForward = deltaX * worldDirection.x + deltaY * worldDirection.y;
    const localSide = deltaX * sideAxis.x + deltaY * sideAxis.y;
    const halfReach = profile.reach * 0.5 + targetRadius;
    const halfWidth = profile.width * 0.5 + targetRadius;

    if (Math.abs(localForward) > halfReach || Math.abs(localSide) > halfWidth) {
      return false;
    }

    const attackBottom = this.player.z;
    const attackTop = attackBottom + profile.height;
    const targetTop = targetFootZ + targetHeight;
    return targetFootZ <= attackTop && targetTop >= attackBottom;
  }
  private moveAxis(axis: 'x' | 'y', amount: number): void {
    if (amount === 0) {
      return;
    }

    const nextX =
      axis === 'x'
        ? clamp(
            this.player.x + amount,
            MAP_EDGE_PADDING + PLAYER_COLLISION_RADIUS,
            this.map.width - MAP_EDGE_PADDING - PLAYER_COLLISION_RADIUS
          )
        : this.player.x;
    const nextY =
      axis === 'y'
        ? clamp(
            this.player.y + amount,
            MAP_EDGE_PADDING + PLAYER_COLLISION_RADIUS,
            this.map.height - MAP_EDGE_PADDING - PLAYER_COLLISION_RADIUS
          )
        : this.player.y;

    const supportHeight = this.getSupportHeight(nextX, nextY);
    if (
      this.player.grounded &&
      supportHeight > this.player.z &&
      supportHeight - this.player.z > this.getStepHeight()
    ) {
      return;
    }

    const collisionFootZ =
      this.player.grounded &&
      supportHeight > this.player.z &&
      supportHeight - this.player.z <= this.getStepHeight()
        ? supportHeight
        : this.player.z;

    if (this.isColliding(nextX, nextY, collisionFootZ)) {
      return;
    }

    this.player.x = nextX;
    this.player.y = nextY;
  }

  private update(dt: number): void {
    const jumpPressed = this.input.consumeJump();
    const attackPressed = this.input.consumeAttack();
    const interactPressed = this.input.consumeInteract();
    const rotateDelta = this.input.consumeRotate();
    const freeCameraToggled = this.input.consumeFreeCameraToggle();

    if (freeCameraToggled) {
      this.freeCameraEnabled = !this.freeCameraEnabled;

      if (!this.freeCameraEnabled) {
        this.cameraYaw = Math.PI / 4 + (Math.PI / 2) * this.viewRotation;
        this.cameraPitch = 0.62;
        this.dragState = null;
        this.updateCamera(dt, true);
      }
    }

    if (rotateDelta !== 0) {
      this.viewRotation = (this.viewRotation + (rotateDelta % 4) + 4) % 4;
      this.cameraYaw = Math.PI / 4 + (Math.PI / 2) * this.viewRotation;
      this.updateCompass();
      this.updateCamera(dt, true);
    }

    const move = this.input.getScreenMoveVector();

    this.updatePlayerFacingFromInputIntent();

    if (attackPressed) {
      this.tryStartPlayerAttackInFacingDirection();
    }

    if (interactPressed) {
      this.tryStartPlayerInteractionInFacingDirection();
    }

    if (jumpPressed) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    if (this.player.grounded) {
      this.coyoteTimer = COYOTE_TIME;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    const basis = this.getPlaneBasis();
    const currentScreenX =
      this.player.vx * basis.rightNorm.x + this.player.vy * basis.rightNorm.y;
    const currentScreenY =
      this.player.vx * basis.topNorm.x + this.player.vy * basis.topNorm.y;
    this.screenVelocity.set(currentScreenX, currentScreenY);

    const speedRatio = clamp(this.screenVelocity.length() / MAX_RUN_SPEED, 0, 1);
    const curvedSpeedRatio = Math.pow(speedRatio, GROUND_ACCEL_CURVE);
    const groundedRunAccel = lerp(
      GROUND_ACCEL * GROUND_START_ACCEL_FACTOR,
      GROUND_ACCEL,
      curvedSpeedRatio
    );
    const groundedTurnAccel = lerp(
      GROUND_TURN_ACCEL * GROUND_START_ACCEL_FACTOR,
      GROUND_TURN_ACCEL,
      curvedSpeedRatio
    );

    const desiredScreenX = move.x * MAX_RUN_SPEED;
    const desiredScreenY = move.y * MAX_RUN_SPEED;

    const accelX =
      this.player.grounded &&
      desiredScreenX !== 0 &&
      Math.sign(desiredScreenX) !== Math.sign(this.screenVelocity.x)
        ? groundedTurnAccel
        : this.player.grounded
          ? groundedRunAccel
          : AIR_ACCEL;
    const accelY =
      this.player.grounded &&
      desiredScreenY !== 0 &&
      Math.sign(desiredScreenY) !== Math.sign(this.screenVelocity.y)
        ? groundedTurnAccel
        : this.player.grounded
          ? groundedRunAccel
          : AIR_ACCEL;

    this.screenVelocity.x = approach(this.screenVelocity.x, desiredScreenX, accelX * dt);
    this.screenVelocity.y = approach(this.screenVelocity.y, desiredScreenY, accelY * dt);

    if (desiredScreenX === 0) {
      this.screenVelocity.x = approach(
        this.screenVelocity.x,
        0,
        (this.player.grounded ? GROUND_FRICTION : AIR_FRICTION) * dt
      );
    }

    if (desiredScreenY === 0) {
      this.screenVelocity.y = approach(
        this.screenVelocity.y,
        0,
        (this.player.grounded ? GROUND_FRICTION : AIR_FRICTION) * dt
      );
    }

    this.player.vx =
      this.screenVelocity.x * basis.rightNorm.x + this.screenVelocity.y * basis.topNorm.x;
    this.player.vy =
      this.screenVelocity.x * basis.rightNorm.y + this.screenVelocity.y * basis.topNorm.y;

    this.moveAxis('x', this.player.vx * dt);
    this.moveAxis('y', this.player.vy * dt);

    const supportHeight = this.getSupportHeight(this.player.x, this.player.y);

    if (this.player.grounded) {
      if (supportHeight < this.player.z - this.getGroundSnap()) {
        this.player.grounded = false;
      } else {
        this.player.z = supportHeight;
        this.resolveGroundedPenetration();
        this.player.z = this.getSupportHeight(this.player.x, this.player.y);
      }
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.player.vz = this.getJumpSpeed();
      this.player.grounded = false;
      this.jumpHoldTimer = MAX_JUMP_HOLD_TIME;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    }

    if (!this.player.grounded) {
      let gravity = this.getFallGravity();
      if (this.player.vz > 0) {
        if (this.input.isJumpHeld() && this.jumpHoldTimer > 0) {
          gravity = this.getRiseGravity();
          this.jumpHoldTimer = Math.max(0, this.jumpHoldTimer - dt);
        } else {
          gravity = this.getLowJumpGravity();
          this.jumpHoldTimer = 0;
        }
      }

      this.player.vz -= gravity * dt;
      this.player.z += this.player.vz * dt;

      const landingHeight = this.getSupportHeight(this.player.x, this.player.y);
      if (this.player.vz <= 0 && this.player.z <= landingHeight) {
        this.player.z = landingHeight;
        this.player.vz = 0;
        this.player.grounded = true;
        this.jumpHoldTimer = 0;
        this.resolveGroundedPenetration();
        this.player.z = this.getSupportHeight(this.player.x, this.player.y);
      }
    }

    if (this.player.z < 0) {
      this.player.z = 0;
      this.player.vz = 0;
      this.player.grounded = true;
    }

    this.updateTeleportTransition(dt);
    if (!this.teleportTransition) {
      this.updateMapTeleport();
    }
    this.updateNpcActivity();
    this.updateNpcs(dt);
    this.updateNpcTouchFeedback();
    this.updateFlowerActivity();
    this.updateFlowers(dt);
    this.updateFlowerTouchFeedback();
    this.updateCrystalActivity();
    this.updateCrystalPickups();
    this.updateTriggerActivity();
    this.updateTriggers(dt);
    this.updateTriggerTouchFeedback();
    this.updateActiveAttack(dt);
    this.updateActivePlainInteraction(dt);
    this.updateScreenEffects(dt);
    this.updatePlayerAnimation(dt);
    this.updatePlayerVisuals();
    this.updateNpcVisuals();
    this.updateFlowerVisuals();
    this.updateCrystalVisuals();
    this.updateTriggerVisuals();
    this.updateCamera(dt, false);
    this.updateActorLabels();

    this.hudUpdateTimer = Math.max(0, this.hudUpdateTimer - dt);
    if (this.hudUpdateTimer === 0) {
      this.updateHud();
      this.hudUpdateTimer = HUD_UPDATE_INTERVAL;
    }
  }

  private updatePlayerAnimation(dt: number): void {
    const planarSpeed = length(this.player.vx, this.player.vy);

    if (this.activeAttack) {
      this.currentDirection = this.activeAttack.facingDirectionIndex;
    } else if (this.activePlainInteraction) {
      this.currentDirection = this.activePlainInteraction.facingDirectionIndex;
    } else {
      this.updatePlayerFacingFromInputIntent();
    }

    const walking = planarSpeed > 0.15 && this.player.grounded;
    if (walking) {
      this.walkTime += dt;
    } else {
      this.walkTime = 0;
    }

    const frameIndex = this.player.grounded
      ? walking
        ? Math.floor(this.walkTime / WALK_FRAME_TIME) % 3
        : 1
      : AIRBORNE_FRAME_INDEX;
    this.spriteMaterial.map = this.frameTextures[this.currentDirection][frameIndex];
    this.spriteMaterial.needsUpdate = true;
  }

  private getActorFacingDirection(vx: number, vy: number): number {
    const basis = this.getPlaneBasis();
    const screenVX = vx * basis.rightNorm.x + vy * basis.rightNorm.y;
    const screenVY = -(vx * basis.topNorm.x + vy * basis.topNorm.y);
    const angle = Math.atan2(screenVY, screenVX);
    const rawDirection = Math.round((angle + Math.PI / 2) / (Math.PI / 4));
    return (rawDirection % 8 + 8) % 8;
  }

  private updateNpcActivity(): void {
    const aliveRadiusSq = ACTOR_ALIVE_RADIUS * ACTOR_ALIVE_RADIUS;

    for (const npc of this.npcs) {
      const dx = npc.x - this.player.x;
      const dy = npc.y - this.player.y;
      npc.active = dx * dx + dy * dy <= aliveRadiusSq;
      if (npc.active) {
        npc.z = this.getSupportHeight(npc.x, npc.y);
      }
    }
  }

  private updateFlowerActivity(): void {
    const aliveRadiusSq = ACTOR_ALIVE_RADIUS * ACTOR_ALIVE_RADIUS;

    for (const flower of this.flowers) {
      const dx = flower.x - this.player.x;
      const dy = flower.y - this.player.y;
      flower.active = dx * dx + dy * dy <= aliveRadiusSq;
      if (flower.active) {
        flower.z = this.getSupportHeight(flower.x, flower.y);
      }
    }
  }

  private updateCrystalActivity(): void {
    const aliveRadiusSq = ACTOR_ALIVE_RADIUS * ACTOR_ALIVE_RADIUS;

    for (const crystal of this.crystals) {
      if (crystal.collected) {
        crystal.active = false;
        continue;
      }

      const dx = crystal.x - this.player.x;
      const dy = crystal.y - this.player.y;
      crystal.active = dx * dx + dy * dy <= aliveRadiusSq;
      if (crystal.active) {
        crystal.z = this.getSupportHeight(crystal.x, crystal.y);
      }
    }
  }

  private updateTriggerActivity(): void {
    const aliveRadiusSq = ACTOR_ALIVE_RADIUS * ACTOR_ALIVE_RADIUS;

    for (const trigger of this.triggers) {
      const dx = trigger.x - this.player.x;
      const dy = trigger.y - this.player.y;
      trigger.active = dx * dx + dy * dy <= aliveRadiusSq;
      if (trigger.active) {
        trigger.z = this.getSupportHeight(trigger.x, trigger.y);
      }
    }
  }

  private updateNpcs(dt: number): void {
    for (const npc of this.npcs) {
      npc.touchFlashTimer = Math.max(0, npc.touchFlashTimer - dt);
      npc.attackFlashTimer = Math.max(0, npc.attackFlashTimer - dt);

      if (!npc.active) {
        npc.vx = 0;
        npc.vy = 0;
        npc.walkTime = 0;
        npc.knockbackVX = 0;
        npc.knockbackVY = 0;
        npc.playerTouching = false;
        continue;
      }

      const applyingKnockback = this.updateGroundActorKnockback(npc, dt, NPC_COLLISION_RADIUS);

      if (applyingKnockback) {
        npc.vx = npc.knockbackVX;
        npc.vy = npc.knockbackVY;
        npc.currentDirection = this.getActorFacingDirection(npc.vx, npc.vy);
        npc.walkTime = 0;
        continue;
      }

      if (npc.kind !== 'mobile') {
        npc.vx = 0;
        npc.vy = 0;
        npc.walkTime = 0;
        continue;
      }

      if (npc.idleTimer > 0) {
        npc.idleTimer = Math.max(0, npc.idleTimer - dt);
        npc.vx = 0;
        npc.vy = 0;
        npc.walkTime = 0;
        continue;
      }

      if (npc.moveTimer <= 0) {
        npc.moveAngle = Math.random() * Math.PI * 2;
        npc.moveTimer = lerp(NPC_MOVE_MIN_TIME, NPC_MOVE_MAX_TIME, Math.random());
      }

      npc.moveTimer = Math.max(0, npc.moveTimer - dt);
      npc.vx = Math.cos(npc.moveAngle) * npc.speed;
      npc.vy = Math.sin(npc.moveAngle) * npc.speed;

      if (!this.tryMoveGroundActor(npc, npc.vx * dt, npc.vy * dt)) {
        npc.moveTimer = 0;
        npc.idleTimer = lerp(NPC_IDLE_MIN_TIME, NPC_IDLE_MAX_TIME, Math.random());
        npc.vx = 0;
        npc.vy = 0;
        npc.walkTime = 0;
        continue;
      }

      if (length(npc.vx, npc.vy) > 0.05) {
        npc.currentDirection = this.getActorFacingDirection(npc.vx, npc.vy);
        npc.walkTime += dt;
      } else {
        npc.walkTime = 0;
      }

      if (npc.moveTimer === 0) {
        npc.idleTimer = lerp(NPC_IDLE_MIN_TIME, NPC_IDLE_MAX_TIME, Math.random());
      }
    }
  }

  private updateFlowers(dt: number): void {
    for (const flower of this.flowers) {
      flower.touchFlashTimer = Math.max(0, flower.touchFlashTimer - dt);
      flower.attackFlashTimer = Math.max(0, flower.attackFlashTimer - dt);

      if (!flower.active) {
        flower.knockbackVX = 0;
        flower.knockbackVY = 0;
        flower.playerTouching = false;
        continue;
      }

      this.updateGroundActorKnockback(flower, dt, FLOWER_COLLISION_RADIUS);
    }
  }

  private updateTriggers(dt: number): void {
    for (const trigger of this.triggers) {
      trigger.touchFlashTimer = Math.max(0, trigger.touchFlashTimer - dt);
      trigger.attackFlashTimer = Math.max(0, trigger.attackFlashTimer - dt);

      if (!trigger.active) {
        trigger.playerTouching = false;
      }
    }
  }

  private updateNpcTouchFeedback(): void {
    const touchRadius = PLAYER_COLLISION_RADIUS + NPC_COLLISION_RADIUS;
    const touchRadiusSq = touchRadius * touchRadius;

    for (const npc of this.npcs) {
      if (!npc.active) {
        npc.playerTouching = false;
        continue;
      }

      const dx = npc.x - this.player.x;
      const dy = npc.y - this.player.y;
      const touching = dx * dx + dy * dy <= touchRadiusSq;

      if (touching && !npc.playerTouching) {
        npc.touchFlashTimer = NPC_TOUCH_FLASH_TIME;
      }

      npc.playerTouching = touching;
    }
  }

  private updateFlowerTouchFeedback(): void {
    const touchRadius = PLAYER_COLLISION_RADIUS + FLOWER_COLLISION_RADIUS;
    const touchRadiusSq = touchRadius * touchRadius;

    for (const flower of this.flowers) {
      if (!flower.active) {
        flower.playerTouching = false;
        continue;
      }

      const dx = flower.x - this.player.x;
      const dy = flower.y - this.player.y;
      const touching = dx * dx + dy * dy <= touchRadiusSq;

      if (touching && !flower.playerTouching) {
        flower.touchFlashTimer = NPC_TOUCH_FLASH_TIME;
      }

      flower.playerTouching = touching;
    }
  }

  private updateCrystalPickups(): void {
    const touchRadius = PLAYER_COLLISION_RADIUS + CRYSTAL_COLLISION_RADIUS;
    const touchRadiusSq = touchRadius * touchRadius;

    for (const crystal of this.crystals) {
      if (!crystal.active || crystal.collected) {
        continue;
      }

      const dx = crystal.x - this.player.x;
      const dy = crystal.y - this.player.y;

      if (dx * dx + dy * dy > touchRadiusSq) {
        continue;
      }

      crystal.collected = true;
      crystal.active = false;
      this.collectedCrystalIds.add(crystal.id);
      this.crystalCount += 1;
      this.updateCrystalCounter();
    }
  }

  private updateTriggerTouchFeedback(): void {
    for (const trigger of this.triggers) {
      if (!trigger.active) {
        trigger.playerTouching = false;
        continue;
      }

      const closestX = clamp(
        this.player.x,
        trigger.x - trigger.width * 0.5,
        trigger.x + trigger.width * 0.5
      );
      const closestY = clamp(
        this.player.y,
        trigger.y - trigger.depth * 0.5,
        trigger.y + trigger.depth * 0.5
      );
      const dx = this.player.x - closestX;
      const dy = this.player.y - closestY;
      const overlapsHeight =
        this.player.z <= trigger.z + trigger.height &&
        this.player.z + PLAYER_BODY_HEIGHT >= trigger.z;
      const touching =
        overlapsHeight && dx * dx + dy * dy <= PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS;

      if (touching && !trigger.playerTouching) {
        trigger.touchFlashTimer = NPC_TOUCH_FLASH_TIME;
      }

      trigger.playerTouching = touching;
    }
  }

  private updatePlayerVisuals(): void {
    const groundHeight = this.getSupportHeight(this.player.x, this.player.y);
    const airHeight = Math.max(0, this.player.z - groundHeight);
    const shadowScale = 1 + Math.min(airHeight * 0.12, 0.35);
    const proxyHeight = this.getActorProxyDimensions(
      PLAYER_DEPTH_PROXY_WIDTH,
      PLAYER_DEPTH_PROXY_HEIGHT
    ).height;

    this.setActorDepthProxyPosition(
      this.playerDepthProxy,
      this.player.x,
      this.player.z,
      this.player.y,
      proxyHeight
    );
    this.setActorSpritePosition(
      this.playerSprite,
      this.player.x,
      this.player.z,
      this.player.y,
      DEPTH_TESTED_SPRITE_CAMERA_BIAS_MULTIPLIER
    );
    const playerRenderOrder = this.getActorRenderOrder(
      this.player.x,
      this.player.y,
      this.player.z,
      1
    );
    this.playerSprite.renderOrder = playerRenderOrder;

    this.shadowMesh.position.set(this.player.x, groundHeight + 0.01, this.player.y);
    this.shadowMesh.scale.setScalar(shadowScale);
    this.shadowMesh.renderOrder = playerRenderOrder - 1;
    this.updateAttackDebugVisual();
    this.updateInteractionDebugVisual();

    this.updateTerrainOcclusion();
  }

  private updateNpcVisuals(): void {
    const proxyHeight = this.getActorProxyDimensions(
      NPC_DEPTH_PROXY_WIDTH,
      NPC_DEPTH_PROXY_HEIGHT
    ).height;

    for (const npc of this.npcs) {
      npc.depthProxy.visible = npc.active;
      npc.sprite.visible = npc.active;
      npc.shadow.visible = npc.active;

      if (!npc.active) {
        continue;
      }

      const frameIndex =
        npc.kind === 'mobile' && length(npc.vx, npc.vy) > 0.05
          ? Math.floor(npc.walkTime / WALK_FRAME_TIME) % 3
          : 1;
      npc.spriteMaterial.map = this.frameTextures[npc.currentDirection][frameIndex];
      npc.spriteMaterial.color.copy(
        npc.attackFlashTimer > 0
          ? ATTACK_FLASH_COLOR
          : npc.touchFlashTimer > 0
            ? NPC_TOUCH_FLASH_COLOR
            : npc.baseTint
      );
      npc.spriteMaterial.needsUpdate = true;

      this.setActorDepthProxyPosition(
        npc.depthProxy,
        npc.x,
        npc.z,
        npc.y,
        proxyHeight
      );
      this.setActorSpritePosition(
        npc.sprite,
        npc.x,
        npc.z,
        npc.y,
        DEPTH_TESTED_SPRITE_CAMERA_BIAS_MULTIPLIER
      );
      const npcRenderOrder = this.getActorRenderOrder(npc.x, npc.y, npc.z, 1);
      npc.sprite.renderOrder = npcRenderOrder;
      npc.shadow.position.set(npc.x, npc.z + 0.01, npc.y);
      npc.shadow.scale.setScalar(1);
      npc.shadow.renderOrder = npcRenderOrder - 1;
    }
  }

  private updateFlowerVisuals(): void {
    const proxyHeight = this.getActorProxyDimensions(
      FLOWER_DEPTH_PROXY_WIDTH,
      FLOWER_DEPTH_PROXY_HEIGHT
    ).height;

    for (const flower of this.flowers) {
      flower.depthProxy.visible = flower.active;
      flower.sprite.visible = flower.active;
      flower.shadow.visible = flower.active;

      if (!flower.active) {
        continue;
      }

      flower.spriteMaterial.map = flower.frameTexture;
      flower.spriteMaterial.color.copy(
        flower.attackFlashTimer > 0
          ? ATTACK_FLASH_COLOR
          : flower.touchFlashTimer > 0
            ? NPC_TOUCH_FLASH_COLOR
            : FLOWER_BASE_COLOR
      );
      flower.spriteMaterial.needsUpdate = true;

      this.setActorDepthProxyPosition(
        flower.depthProxy,
        flower.x,
        flower.z,
        flower.y,
        proxyHeight
      );
      this.setActorSpritePosition(
        flower.sprite,
        flower.x,
        flower.z,
        flower.y,
        DEPTH_TESTED_SPRITE_CAMERA_BIAS_MULTIPLIER
      );
      const flowerRenderOrder = this.getActorRenderOrder(flower.x, flower.y, flower.z, 1);
      flower.sprite.renderOrder = flowerRenderOrder;
      flower.shadow.position.set(flower.x, flower.z + 0.01, flower.y);
      flower.shadow.scale.setScalar(FLOWER_SHADOW_SCALE);
      flower.shadow.renderOrder = flowerRenderOrder - 1;
    }
  }

  private updateCrystalVisuals(): void {
    const proxyHeight = this.getActorProxyDimensions(
      CRYSTAL_WORLD_WIDTH * 0.45,
      CRYSTAL_WORLD_HEIGHT * 0.8
    ).height;

    for (const crystal of this.crystals) {
      crystal.depthProxy.visible = crystal.active;
      crystal.sprite.visible = crystal.active;
      crystal.shadow.visible = crystal.active;

      if (!crystal.active) {
        continue;
      }

      crystal.spriteMaterial.map = this.crystalFrameTexture;
      crystal.spriteMaterial.needsUpdate = true;

      this.setActorDepthProxyPosition(
        crystal.depthProxy,
        crystal.x,
        crystal.z,
        crystal.y,
        proxyHeight
      );
      this.setActorSpritePosition(
        crystal.sprite,
        crystal.x,
        crystal.z,
        crystal.y,
        DEPTH_TESTED_SPRITE_CAMERA_BIAS_MULTIPLIER
      );
      const crystalRenderOrder = this.getActorRenderOrder(crystal.x, crystal.y, crystal.z, 1);
      crystal.sprite.renderOrder = crystalRenderOrder;
      crystal.shadow.position.set(crystal.x, crystal.z + 0.01, crystal.y);
      crystal.shadow.scale.setScalar(CRYSTAL_SHADOW_SCALE);
      crystal.shadow.renderOrder = crystalRenderOrder - 1;
    }
  }

  private updateTriggerVisuals(): void {
    for (const trigger of this.triggers) {
      trigger.debugMesh.visible = this.showTriggerHitboxes;

      if (!trigger.debugMesh.visible) {
        continue;
      }

      trigger.z = this.getSupportHeight(trigger.x, trigger.y);

      trigger.debugMesh.position.set(
        trigger.x,
        trigger.z + trigger.height * 0.5,
        trigger.y
      );
      trigger.debugMesh.scale.set(trigger.width, trigger.height, trigger.depth);
      trigger.debugMesh.material = this.triggerDebugMaterial;
    }
  }

  private updateActorLabels(): void {
    for (const npc of this.npcs) {
      this.updateActorLabel(
        npc.labelElement,
        npc.displayName,
        npc.active,
        npc.x,
        npc.y,
        npc.z + NPC_BODY_HEIGHT + 0.18,
        npc.labelRangeFactor,
        npc.labelFontSizeFactor
      );
    }

    for (const flower of this.flowers) {
      this.updateActorLabel(
        flower.labelElement,
        flower.displayName,
        flower.active,
        flower.x,
        flower.y,
        flower.z + FLOWER_WORLD_HEIGHT + 0.12,
        flower.labelRangeFactor,
        flower.labelFontSizeFactor
      );
    }

    for (const crystal of this.crystals) {
      this.updateActorLabel(
        crystal.labelElement,
        crystal.displayName,
        crystal.active && !crystal.collected,
        crystal.x,
        crystal.y,
        crystal.z + CRYSTAL_WORLD_HEIGHT + 0.08,
        crystal.labelRangeFactor,
        crystal.labelFontSizeFactor
      );
    }

    for (const trigger of this.triggers) {
      this.updateActorLabel(
        trigger.labelElement,
        trigger.displayName,
        trigger.active,
        trigger.x,
        trigger.y,
        trigger.z + trigger.height + 0.14,
        trigger.labelRangeFactor,
        trigger.labelFontSizeFactor
      );
    }
  }

  private updateActorLabel(
    label: HTMLDivElement,
    displayName: string | null,
    active: boolean,
    x: number,
    y: number,
    labelZ: number,
    rangeFactor: number,
    fontSizeFactor: number
  ): void {
    if (!displayName || !active || this.actorLabelRadius <= 0) {
      this.setActorLabelVisible(label, false);
      return;
    }

    const dx = x - this.player.x;
    const dy = y - this.player.y;
    const labelRadius = this.actorLabelRadius * rangeFactor;

    if (dx * dx + dy * dy > labelRadius * labelRadius) {
      this.setActorLabelVisible(label, false);
      return;
    }

    const screenPosition = this.getWorldScreenPosition(x, labelZ, y);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    const localX = screenPosition.x - rootRect.left;
    const localY = screenPosition.y - rootRect.top;
    const margin = 48;

    if (
      screenPosition.x < rect.left - margin ||
      screenPosition.x > rect.right + margin ||
      screenPosition.y < rect.top - margin ||
      screenPosition.y > rect.bottom + margin
    ) {
      this.setActorLabelVisible(label, false);
      return;
    }

    this.setActorLabelVisible(label, true);
    label.style.transform = `translate3d(${localX.toFixed(1)}px, ${localY.toFixed(1)}px, 0) translate(-50%, -100%)`;
    label.style.fontSize = `${(this.actorLabelFontSize * fontSizeFactor).toFixed(1)}px`;
  }

  private getScreenShakeOffset(): Vector3 {
    this.cameraShakeOffset.set(0, 0, 0);

    if (!this.screenShake) {
      return this.cameraShakeOffset;
    }

    const progress = this.screenShake.elapsed / this.screenShake.duration;
    const envelope = clamp(this.screenShake.envelope(progress), 0, 1);
    const pulse = this.screenShake.elapsed * this.screenShake.frequency * Math.PI * 2;
    const x =
      (Math.sin(pulse + this.screenShake.seed) +
        Math.sin(pulse * 1.73 + this.screenShake.seed * 0.61) * 0.45) /
      1.45;
    const y =
      (Math.cos(pulse * 1.27 + this.screenShake.seed * 1.31) +
        Math.sin(pulse * 2.11 + this.screenShake.seed * 1.9) * 0.35) /
      1.35;
    const magnitude = this.screenShake.strength * envelope;

    this.cameraShakeWorldRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.cameraShakeWorldUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.cameraShakeOffset
      .copy(this.cameraShakeWorldRight)
      .multiplyScalar(x * magnitude)
      .addScaledVector(this.cameraShakeWorldUp, y * magnitude);

    return this.cameraShakeOffset;
  }

  private applyScreenShakeToCamera(): void {
    const shakeOffset = this.getScreenShakeOffset();

    if (shakeOffset.lengthSq() === 0) {
      return;
    }

    this.camera.position.add(shakeOffset);
    this.cameraShakeFocus.copy(this.cameraFocus).add(shakeOffset);
    this.camera.lookAt(this.cameraShakeFocus);
  }

  private updateCamera(dt: number, snap: boolean): void {
    this.cameraDesiredFocus.set(
      this.player.x,
      this.player.z + 0.6 * this.blockHeightScale,
      this.player.y
    );

    if (snap) {
      this.cameraFocus.copy(this.cameraDesiredFocus);
    } else {
      const smoothing = 1 - Math.exp(-dt * 8);
      this.cameraFocus.lerp(this.cameraDesiredFocus, smoothing);
    }

    const distance = this.cameraDistance;
    const height = this.cameraHeight;
    const horizontalDistance = distance * Math.cos(this.cameraPitch);
    const offset = new Vector3(
      Math.cos(this.cameraYaw) * horizontalDistance,
      height * Math.sin(this.cameraPitch),
      Math.sin(this.cameraYaw) * horizontalDistance
    );

    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this.cameraFocus).add(offset);
    this.camera.lookAt(this.cameraFocus);
    this.applyScreenShakeToCamera();
    this.camera.updateProjectionMatrix();
    this.updateShadowRig();
  }

  private updateShadowRig(): void {
    const lightDistance = 26;
    const horizontalDistance = Math.cos(this.sunElevation) * lightDistance;
    const verticalDistance = Math.sin(this.sunElevation) * lightDistance;
    const lightOffset = new Vector3(
      Math.cos(this.sunAzimuth) * horizontalDistance,
      verticalDistance,
      Math.sin(this.sunAzimuth) * horizontalDistance
    );
    this.sunLight.position.copy(this.cameraFocus).add(lightOffset);
    this.sunLight.target.position.copy(this.cameraFocus);
    this.sunLight.target.updateMatrixWorld();

    const shadowCamera = this.sunLight.shadow.camera as OrthographicCamera;
    shadowCamera.left = -SHADOW_CAMERA_RADIUS;
    shadowCamera.right = SHADOW_CAMERA_RADIUS;
    shadowCamera.top = SHADOW_CAMERA_RADIUS;
    shadowCamera.bottom = -SHADOW_CAMERA_RADIUS;
    shadowCamera.near = 1;
    shadowCamera.far = 80;
    shadowCamera.updateProjectionMatrix();
  }

  private updateCompass(): void {
    const rotation = this.viewRotation % 4;
    this.compassLabels.top.textContent = VIEW_NAMES[rotation];
    this.compassLabels.right.textContent = VIEW_NAMES[(rotation + 1) % 4];
    this.compassLabels.bottom.textContent = VIEW_NAMES[(rotation + 2) % 4];
    this.compassLabels.left.textContent = VIEW_NAMES[(rotation + 3) % 4];
  }

  private updateHud(): void {
    const ground = this.getSupportHeight(this.player.x, this.player.y);
    const viewName = VIEW_NAMES[this.viewRotation % VIEW_NAMES.length];
    const basis = this.getPlaneBasis();
    const axisSummary =
      `Axes: +X=${getCompassDirection(basis.right.x + basis.top.x, basis.right.y + basis.top.y)} ` +
      `-X=${getCompassDirection(-(basis.right.x + basis.top.x), -(basis.right.y + basis.top.y))} ` +
      `+Y=${getCompassDirection(-basis.right.x + basis.top.x, -basis.right.y + basis.top.y)} ` +
      `-Y=${getCompassDirection(basis.right.x - basis.top.x, basis.right.y - basis.top.y)}`;

    this.hudStatus.textContent =
      `Map: ${this.map.id}\n` +
      `${getOverworldSeedLabel(this.currentOverworldSeed)}\n` +
      `${getWorldGenerationFactorLabel(this.maps.overworld.generationFactors)}\n` +
      `Position: ${this.player.x.toFixed(2)}, ${this.player.y.toFixed(2)}, ${this.player.z.toFixed(2)}\n` +
      `Ground: ${ground.toFixed(2)}  |  Vertical speed: ${this.player.vz.toFixed(2)}\n` +
      `State: ${this.player.grounded ? 'grounded' : 'airborne'}  |  View: ${viewName}-up (${this.viewRotation * 90} deg)\n` +
      `Debug free camera: ${this.freeCameraEnabled ? 'on' : 'off'} (toggle: \`)\n` +
      `${axisSummary}\n` +
      `Renderer: Three.js terrain pass in progress. Exposed cube tiles are shaded in 3D; actor is a billboard sprite.`;
  }
}
