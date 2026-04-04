import {
  AmbientLight,
  CanvasTexture,
  Color,
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

type MaterialKey = 'grass' | 'stone' | 'sand' | 'moss';

interface Cell {
  height: number;
  materials: MaterialKey[];
}

interface MapData {
  width: number;
  height: number;
  cells: Cell[];
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

interface NpcState {
  kind: 'mobile' | 'stationary';
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
  flashTimer: number;
  playerTouching: boolean;
  baseTint: Color;
  spriteMaterial: SpriteMaterial;
  sprite: Sprite;
  shadow: Mesh;
}

interface TerrainChunkRender {
  opaqueTopMesh: InstancedMesh | null;
  frontTopMesh: InstancedMesh | null;
  opaqueSideMesh: InstancedMesh | null;
  frontSideMesh: InstancedMesh | null;
}

interface TerrainFaceBinding {
  type: 'top' | 'side';
  rotationY: number;
  opaqueIndex: number;
  frontIndex: number;
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
  sideFaces: TerrainFaceBinding[];
  currentFront: boolean;
}

interface OcclusionTuning {
  lateralRange: number;
  frontMin: number;
  frontMax: number;
  minHeightAboveFeet: number;
  actorHeightPadding: number;
}

interface DragState {
  pointerId: number;
  lastX: number;
  lastY: number;
}

interface LightingDebugState {
  ambientIntensity: number;
  sunIntensity: number;
  shadowsEnabled: boolean;
  shadowQuality: number;
  sunAngleDegrees: number;
  sunElevationDegrees: number;
  heightTintStrength: number;
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
const PLAYER_BODY_HEIGHT = 1.2;
const VIEW_NAMES = ['N', 'E', 'S', 'W'] as const;
const SCREEN_DIRECTION_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 24;
const CHARACTER_SCALE = 1.35;
const FRUSTUM_HEIGHT = 18;
const MAP_WIDTH = 168;
const MAP_HEIGHT = 144;
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
const MOBILE_NPC_COUNT = 8;
const STATIONARY_NPC_COUNT = MOBILE_NPC_COUNT * 4;
const MOBILE_NPC_TINT = '#74a9ff';
const STATIONARY_NPC_TINT = '#ff7979';
const NPC_TOUCH_FLASH_TINT = '#ffe66d';
const NPC_TOUCH_FLASH_TIME = 0.18;
const NPC_TOUCH_FLASH_COLOR = new Color(NPC_TOUCH_FLASH_TINT);
const ACTOR_ALIVE_RADIUS = 28;
const NPC_SPAWN_EXCLUSION_RADIUS = 9;
const NPC_IDLE_MIN_TIME = 0.9;
const NPC_IDLE_MAX_TIME = 2.8;
const NPC_MOVE_MIN_TIME = 1.4;
const NPC_MOVE_MAX_TIME = 3.4;
const NPC_WALK_SPEED_MIN = 0.38;
const NPC_WALK_SPEED_MAX = 0.72;
const TERRAIN_CHUNK_SIZE = 16;
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

const getCompassDirection = (x: number, y: number): string => {
  const angle = Math.atan2(y, x);
  const octant = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return SCREEN_DIRECTION_NAMES[octant];
};

class InputController {
  private readonly keys = new Set<string>();
  private jumpQueued = false;
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

      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.jumpQueued = false;
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

  public consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
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
  x: number,
  y: number,
  z: number,
  weights: Record<MaterialKey, number>
): MaterialKey {
  const entries = Object.entries(weights) as [MaterialKey, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + Math.max(weight, 0), 0);
  let pick = hashUnit(MAP_GENERATION_SEED + 401, x, y, z) * totalWeight;

  for (const [material, weight] of entries) {
    pick -= Math.max(weight, 0);
    if (pick <= 0) {
      return material;
    }
  }

  return entries[entries.length - 1]?.[0] ?? 'stone';
}

function buildColumnMaterials(
  x: number,
  y: number,
  height: number,
  elevation: number,
  moisture: number,
  roughness: number
): MaterialKey[] {
  const materials: MaterialKey[] = [];
  const isDryLowland = elevation < 0.42 && moisture < 0.48;
  const topMaterial = chooseWeightedMaterial(x, y, height, {
    sand: isDryLowland ? 3.6 : 0.5 + Math.max(0, 0.45 - moisture) * 1.7,
    grass: 1.8 + moisture * 1.2 + Math.max(0, elevation - 0.4),
    moss: 0.9 + moisture * 1.8 + roughness * 0.7,
    stone: 0.45 + Math.max(0, elevation - 0.7) * 1.8 + roughness * 0.5
  });

  for (let z = 0; z < height; z += 1) {
    const depthFromTop = height - z - 1;

    if (depthFromTop === 0) {
      materials.push(topMaterial);
      continue;
    }

    if (depthFromTop === 1) {
      materials.push(
        chooseWeightedMaterial(x, y, z, {
          sand: topMaterial === 'sand' ? 1.8 : 0.35,
          grass: topMaterial === 'grass' ? 1.4 : 0.3,
          moss: topMaterial === 'moss' ? 1.5 : 0.7 + moisture * 0.8,
          stone: 1.8 + roughness * 0.9 + Math.max(0, elevation - 0.55)
        })
      );
      continue;
    }

    materials.push(
      chooseWeightedMaterial(x, y, z, {
        sand: isDryLowland ? 0.7 : 0.15,
        grass: 0.1,
        moss: 1 + moisture * 0.6,
        stone: 3 + roughness * 1.4 + elevation
      })
    );
  }

  return materials;
}

function createExampleMap(): MapData {
  const map: MapData = {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    cells: Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => ({
      height: 0,
      materials: []
    }))
  };

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const elevation = octavePerlin2D(MAP_GENERATION_SEED, x * 0.05, y * 0.05, 5, 0.5, 2.2);
      const detail = octavePerlin2D(
        MAP_GENERATION_SEED + 31,
        (x + 140) * 0.16,
        (y - 80) * 0.16,
        4,
        0.45,
        2.3
      );
      const moisture = octavePerlin2D(
        MAP_GENERATION_SEED + 67,
        (x - 60) * 0.026,
        (y + 110) * 0.026,
        3,
        0.5,
        2
      );
      const roughness = octavePerlin2D(
        MAP_GENERATION_SEED + 103,
        (x + 15) * 0.065,
        (y + 25) * 0.065,
        2,
        0.45,
        2.3
      );
      const ridgeField = ridgedNoise2D(
        MAP_GENERATION_SEED + 149,
        (x - 30) * 0.028,
        (y + 45) * 0.028,
        4,
        0.52,
        2.05
      );
      const ridgeMask = Math.pow(
        octavePerlin2D(
          MAP_GENERATION_SEED + 211,
          (x + 80) * 0.012,
          (y - 120) * 0.012,
          3,
          0.55,
          2
        ),
        1.1
      );
      const baseHeightField = Math.pow(clamp(elevation * 0.5 + detail * 0.27 - 0.22, 0, 1), 1.6);
      const ridgeSignal = Math.pow(clamp((ridgeField - 0.4) / 0.6, 0, 1), 2.2);
      const ridgeRegion = Math.pow(clamp((ridgeMask - 0.32) / 0.68, 0, 1), 1.1);
      const ridgeBoost = ridgeSignal * ridgeRegion;
      const normalizedHeightField = clamp(
        baseHeightField * 0.76 + ridgeBoost * 2.2 + roughness * 0.025,
        0,
        1
      );
      const shapedHeightField = normalizedHeightField;
      const terracedHeight = clamp(1 + Math.round(shapedHeightField * 5), 1, 6);
      const materials = buildColumnMaterials(
        x,
        y,
        terracedHeight,
        shapedHeightField,
        moisture,
        roughness
      );
      const cell = getCell(map, x, y);
      cell.height = terracedHeight;
      cell.materials = materials;
    }
  }

  const spawnHeight = 2;
  for (let y = 10; y <= 14; y += 1) {
    for (let x = 10; x <= 14; x += 1) {
      const cell = getCell(map, x, y);
      cell.height = spawnHeight;
      cell.materials = buildColumnMaterials(x, y, spawnHeight, 0.5, 0.58, 0.32);
    }
  }

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

function loadFrameTexture(
  image: HTMLImageElement,
  column: number,
  row: number
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CHARACTER_FRAME_WIDTH;
  canvas.height = CHARACTER_FRAME_HEIGHT;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create 2D context for character frame extraction.');
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    column * CHARACTER_FRAME_WIDTH,
    row * CHARACTER_FRAME_HEIGHT,
    CHARACTER_FRAME_WIDTH,
    CHARACTER_FRAME_HEIGHT,
    0,
    0,
    CHARACTER_FRAME_WIDTH,
    CHARACTER_FRAME_HEIGHT
  );

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
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
  private readonly actorGroup = new Group();
  private readonly input = new InputController();
  private readonly map = createExampleMap();
  private readonly terrainBlocks: TerrainBlockInstance[] = [];
  private readonly terrainChunks: TerrainChunkRender[] = [];
  private readonly frameTextures: CanvasTexture[][];
  private readonly spriteMaterial: SpriteMaterial;
  private readonly playerSprite: Sprite;
  private readonly shadowMesh: Mesh;
  private readonly npcs: NpcState[] = [];
  private readonly terrainTopGeometry = createTerrainTopGeometry();
  private readonly terrainSideGeometry = createTerrainSideGeometry();
  private readonly shadowGeometry = new CircleGeometry(0.26, 24);
  private readonly actorShadowMaterial = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: DoubleSide
  });
  private readonly terrainOpaqueMaterial = new MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true
  });
  private readonly terrainFrontMaterial = new MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: true
  });
  private readonly reusableTerrainMatrix = new Matrix4();
  private readonly hiddenTerrainMatrix = new Matrix4();
  private readonly reusableTerrainPosition = new Vector3();
  private readonly reusableTerrainScale = new Vector3();
  private readonly reusableTerrainQuaternion = new Quaternion();
  private readonly reusableTerrainAxisY = new Vector3(0, 1, 0);
  private readonly cameraFocus = new Vector3();
  private readonly cameraDesiredFocus = new Vector3();
  private readonly screenVelocity = new Vector2();
  private readonly occlusionTuning: OcclusionTuning = { ...DEFAULT_OCCLUSION_TUNING };
  private readonly ambientLight = new AmbientLight(0xffffff, DEFAULT_AMBIENT_INTENSITY);
  private readonly sunLight = new DirectionalLight(0xfff1d6, DEFAULT_SUN_INTENSITY);
  private shadowQuality = DEFAULT_SHADOW_QUALITY;
  private heightTintStrength = DEFAULT_HEIGHT_TINT_STRENGTH;
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

  private readonly player: PlayerState = {
    x: 12.5,
    y: 12.5,
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
    characterImage: HTMLImageElement
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

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = BasicShadowMap;
    this.root.prepend(this.renderer.domElement);

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
    this.scene.add(this.actorGroup);

    this.buildTerrain();

    this.spriteMaterial = this.createActorSpriteMaterial(this.frameTextures[this.currentDirection][1]);
    this.playerSprite = this.createActorSprite(this.spriteMaterial);
    this.actorGroup.add(this.playerSprite);

    this.shadowMesh = this.createActorShadow();
    this.actorGroup.add(this.shadowMesh);
    this.spawnNpcs();

    this.updateCompass();
    this.refreshLighting();
    this.updateNpcActivity();
    this.updateNpcVisuals();
    this.updatePlayerVisuals();
    this.updateCamera(1 / 60, true);
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
      heightTintStrength: this.heightTintStrength
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
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.freeCameraEnabled) {
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
    this.renderer.render(this.scene, this.camera);
  };

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

  private writeTerrainFaceTransform(
    mesh: InstancedMesh,
    index: number,
    block: TerrainBlockInstance,
    face: TerrainFaceBinding
  ): void {
    this.reusableTerrainPosition.set(
      block.x + 0.5,
      block.z * this.blockHeightScale + this.blockHeightScale / 2,
      block.y + 0.5
    );
    this.reusableTerrainScale.set(1, this.blockHeightScale, 1);
    this.reusableTerrainQuaternion.setFromAxisAngle(this.reusableTerrainAxisY, face.rotationY);
    this.reusableTerrainMatrix.compose(
      this.reusableTerrainPosition,
      this.reusableTerrainQuaternion,
      this.reusableTerrainScale
    );
    mesh.setMatrixAt(index, this.reusableTerrainMatrix);
  }

  private getTerrainFaceMesh(chunk: TerrainChunkRender, face: TerrainFaceBinding, renderInFront: boolean): InstancedMesh | null {
    if (face.type === 'top') {
      return renderInFront ? chunk.frontTopMesh : chunk.opaqueTopMesh;
    }

    return renderInFront ? chunk.frontSideMesh : chunk.opaqueSideMesh;
  }

  private setTerrainBlockFrontState(block: TerrainBlockInstance, renderInFront: boolean): void {
    if (block.currentFront === renderInFront) {
      return;
    }

    block.currentFront = renderInFront;
    const allFaces = block.topFace ? [block.topFace, ...block.sideFaces] : block.sideFaces;

    for (const face of allFaces) {
      const opaqueMesh = this.getTerrainFaceMesh(block.chunk, face, false);
      const frontMesh = this.getTerrainFaceMesh(block.chunk, face, true);

      if (renderInFront) {
        opaqueMesh?.setMatrixAt(face.opaqueIndex, this.hiddenTerrainMatrix);
        if (frontMesh) {
          this.writeTerrainFaceTransform(frontMesh, face.frontIndex, block, face);
        }
      } else {
        if (opaqueMesh) {
          this.writeTerrainFaceTransform(opaqueMesh, face.opaqueIndex, block, face);
        }
        frontMesh?.setMatrixAt(face.frontIndex, this.hiddenTerrainMatrix);
      }
    }

    if (block.chunk.opaqueTopMesh) {
      block.chunk.opaqueTopMesh.instanceMatrix.needsUpdate = true;
    }
    if (block.chunk.frontTopMesh) {
      block.chunk.frontTopMesh.instanceMatrix.needsUpdate = true;
    }
    if (block.chunk.opaqueSideMesh) {
      block.chunk.opaqueSideMesh.instanceMatrix.needsUpdate = true;
    }
    if (block.chunk.frontSideMesh) {
      block.chunk.frontSideMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateTerrainBlockColor(block: TerrainBlockInstance): void {
    const baseColor = this.getTopBaseColor(block.material);
    const tintColor = this.getHeightTintColor(block.material);
    const tintMix = block.heightTintBaseOpacity * this.heightTintStrength;
    block.renderColor.copy(baseColor).lerp(tintColor, tintMix);

    if (block.topFace) {
      block.chunk.opaqueTopMesh?.setColorAt(block.topFace.opaqueIndex, block.renderColor);
      block.chunk.frontTopMesh?.setColorAt(block.topFace.frontIndex, block.renderColor);
    }
  }

  private createActorSpriteMaterial(
    frameTexture: CanvasTexture,
    tintHex = '#ffffff'
  ): SpriteMaterial {
    return new SpriteMaterial({
      map: frameTexture,
      color: new Color(tintHex),
      transparent: true,
      alphaTest: 0.25,
      depthWrite: false,
      depthTest: false
    });
  }

  private createActorSprite(material: SpriteMaterial): Sprite {
    const sprite = new Sprite(material);
    sprite.center.set(0.5, 0);
    sprite.scale.set(
      CHARACTER_SCALE * (CHARACTER_FRAME_WIDTH / CHARACTER_FRAME_HEIGHT),
      CHARACTER_SCALE,
      1
    );
    return sprite;
  }

  private createActorShadow(): Mesh {
    const shadow = new Mesh(this.shadowGeometry, this.actorShadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    return shadow;
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

  private collectNpcSpawnCandidates(requireMobility: boolean): Vec2[] {
    const candidates: Vec2[] = [];

    for (let y = 1; y < this.map.height - 1; y += 1) {
      for (let x = 1; x < this.map.width - 1; x += 1) {
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

  private spawnNpcs(): void {
    const occupiedTiles = new Set<string>();
    const mobileCandidates = this.collectNpcSpawnCandidates(true);
    const stationaryCandidates = this.collectNpcSpawnCandidates(false);
    this.shuffleSpawnCandidates(mobileCandidates, MAP_GENERATION_SEED + 601);
    this.shuffleSpawnCandidates(stationaryCandidates, MAP_GENERATION_SEED + 907);

    const createNpc = (
      kind: NpcState['kind'],
      x: number,
      y: number,
      tintHex: string,
      randomSeed: number
    ): NpcState => {
      const frameTexture = this.frameTextures[4][1];
      const spriteMaterial = this.createActorSpriteMaterial(frameTexture, tintHex);
      const sprite = this.createActorSprite(spriteMaterial);
      const shadow = this.createActorShadow();
      sprite.visible = false;
      shadow.visible = false;
      this.actorGroup.add(sprite);
      this.actorGroup.add(shadow);

      return {
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
        flashTimer: 0,
        playerTouching: false,
        baseTint: new Color(tintHex),
        spriteMaterial,
        sprite,
        shadow
      };
    };

    const addNpcs = (
      kind: NpcState['kind'],
      count: number,
      tintHex: string,
      candidates: Vec2[],
      seedOffset: number
    ): void => {
      let spawned = 0;

      for (const candidate of candidates) {
        const tileKey = `${Math.floor(candidate.x)}:${Math.floor(candidate.y)}`;
        if (occupiedTiles.has(tileKey)) {
          continue;
        }

        occupiedTiles.add(tileKey);
        this.npcs.push(
          createNpc(kind, candidate.x, candidate.y, tintHex, MAP_GENERATION_SEED + seedOffset + this.npcs.length * 17)
        );
        spawned += 1;

        if (spawned >= count) {
          break;
        }
      }
    };

    addNpcs('mobile', MOBILE_NPC_COUNT, MOBILE_NPC_TINT, mobileCandidates, 1300);
    addNpcs('stationary', STATIONARY_NPC_COUNT, STATIONARY_NPC_TINT, stationaryCandidates, 2100);
  }

  private getTopBaseColor(materialKey: MaterialKey): Color {
    switch (materialKey) {
      case 'grass':
        return new Color('#92c65e');
      case 'moss':
        return new Color('#64884c');
      case 'sand':
        return new Color('#cfb070');
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
      default:
        return new Color('#f2ffd8');
    }
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
        chunk.frontTopMesh,
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
    for (const block of this.terrainBlocks) {
      this.updateTerrainBlockColor(block);
    }

    for (const chunk of this.terrainChunks) {
      const topMeshes = [chunk.opaqueTopMesh, chunk.frontTopMesh, chunk.opaqueSideMesh, chunk.frontSideMesh];
      for (const mesh of topMeshes) {
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
    this.terrainChunks.length = 0;
    const chunkBlockMap = new Map<
      string,
      Array<{
        x: number;
        y: number;
        z: number;
        material: MaterialKey;
        hasTop: boolean;
        sideRotations: number[];
      }>
    >();

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
          const blocks = chunkBlockMap.get(chunkKey);
          const level = z + 1;
          const sideRotations: number[] = [];

          if (getHeight(this.map, x + 1, y) < level) {
            sideRotations.push(Math.PI / 2);
          }
          if (getHeight(this.map, x - 1, y) < level) {
            sideRotations.push(-Math.PI / 2);
          }
          if (getHeight(this.map, x, y + 1) < level) {
            sideRotations.push(0);
          }
          if (getHeight(this.map, x, y - 1) < level) {
            sideRotations.push(Math.PI);
          }

          const blockData = {
            x,
            y,
            z,
            material: getBlockMaterial(this.map, x, y, z),
            hasTop: getHeight(this.map, x, y) === level,
            sideRotations
          };

          if (blocks) {
            blocks.push(blockData);
          } else {
            chunkBlockMap.set(chunkKey, [blockData]);
          }
        }
      }
    }

    for (const chunkBlocks of chunkBlockMap.values()) {
      const topFaceCount = chunkBlocks.reduce((sum, block) => sum + (block.hasTop ? 1 : 0), 0);
      const sideFaceCount = chunkBlocks.reduce((sum, block) => sum + block.sideRotations.length, 0);
      const chunk: TerrainChunkRender = {
        opaqueTopMesh:
          topFaceCount > 0
            ? this.createTerrainRenderMesh(this.terrainTopGeometry, this.terrainOpaqueMaterial, topFaceCount, 0)
            : null,
        frontTopMesh:
          topFaceCount > 0
            ? this.createTerrainRenderMesh(this.terrainTopGeometry, this.terrainFrontMaterial, topFaceCount, 20)
            : null,
        opaqueSideMesh:
          sideFaceCount > 0
            ? this.createTerrainRenderMesh(this.terrainSideGeometry, this.terrainOpaqueMaterial, sideFaceCount, 0)
            : null,
        frontSideMesh:
          sideFaceCount > 0
            ? this.createTerrainRenderMesh(this.terrainSideGeometry, this.terrainFrontMaterial, sideFaceCount, 20)
            : null
      };
      chunk.opaqueTopMesh && this.terrainGroup.add(chunk.opaqueTopMesh);
      chunk.frontTopMesh && this.terrainGroup.add(chunk.frontTopMesh);
      chunk.opaqueSideMesh && this.terrainGroup.add(chunk.opaqueSideMesh);
      chunk.frontSideMesh && this.terrainGroup.add(chunk.frontSideMesh);
      this.terrainChunks.push(chunk);
      let nextTopFaceIndex = 0;
      let nextSideFaceIndex = 0;

      chunkBlocks.forEach((blockData) => {
        const topFace =
          blockData.hasTop && chunk.opaqueTopMesh && chunk.frontTopMesh
            ? {
                type: 'top' as const,
                rotationY: 0,
                opaqueIndex: nextTopFaceIndex,
                frontIndex: nextTopFaceIndex
              }
            : null;
        if (topFace) {
          chunk.frontTopMesh?.setMatrixAt(topFace.frontIndex, this.hiddenTerrainMatrix);
          nextTopFaceIndex += 1;
        }

        const sideFaces = blockData.sideRotations.map((rotationY) => {
          const face: TerrainFaceBinding = {
            type: 'side',
            rotationY,
            opaqueIndex: nextSideFaceIndex,
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
          sideFaces,
          currentFront: false
        };

        if (block.topFace && chunk.opaqueTopMesh) {
          this.writeTerrainFaceTransform(chunk.opaqueTopMesh, block.topFace.opaqueIndex, block, block.topFace);
        }

        for (const face of block.sideFaces) {
          if (chunk.opaqueSideMesh) {
            this.writeTerrainFaceTransform(chunk.opaqueSideMesh, face.opaqueIndex, block, face);
            const sideColor = this.getTopBaseColor(block.material).multiplyScalar(
              Math.abs(Math.sin(face.rotationY)) > 0.5 ? 0.7 : 0.58
            );
            chunk.opaqueSideMesh.setColorAt(face.opaqueIndex, sideColor);
            chunk.frontSideMesh?.setColorAt(face.frontIndex, sideColor);
          }
        }

        this.terrainBlocks.push(block);
      });

      if (chunk.opaqueTopMesh) {
        chunk.opaqueTopMesh.instanceMatrix.needsUpdate = true;
      }
      if (chunk.frontTopMesh) {
        chunk.frontTopMesh.instanceMatrix.needsUpdate = true;
      }
      if (chunk.opaqueSideMesh) {
        chunk.opaqueSideMesh.instanceMatrix.needsUpdate = true;
        if (chunk.opaqueSideMesh.instanceColor) {
          chunk.opaqueSideMesh.instanceColor.needsUpdate = true;
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
    for (const block of this.terrainBlocks) {
      const allFaces = block.topFace ? [block.topFace, ...block.sideFaces] : block.sideFaces;

      for (const face of allFaces) {
        const visibleMesh = this.getTerrainFaceMesh(block.chunk, face, block.currentFront);
        const hiddenMesh = this.getTerrainFaceMesh(block.chunk, face, !block.currentFront);

        if (visibleMesh) {
          this.writeTerrainFaceTransform(
            visibleMesh,
            block.currentFront ? face.frontIndex : face.opaqueIndex,
            block,
            face
          );
        }
        hiddenMesh?.setMatrixAt(block.currentFront ? face.opaqueIndex : face.frontIndex, this.hiddenTerrainMatrix);
      }
    }

    for (const chunk of this.terrainChunks) {
      if (chunk.opaqueTopMesh) {
        chunk.opaqueTopMesh.instanceMatrix.needsUpdate = true;
      }
      if (chunk.frontTopMesh) {
        chunk.frontTopMesh.instanceMatrix.needsUpdate = true;
      }
      if (chunk.opaqueSideMesh) {
        chunk.opaqueSideMesh.instanceMatrix.needsUpdate = true;
      }
      if (chunk.frontSideMesh) {
        chunk.frontSideMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  private updateTerrainOcclusion(): void {
    const basis = this.getPlaneBasis();
    const actorFootX = this.player.x;
    const actorFootY = this.player.y;
    const actorFootZ = this.player.z;
    const actorTopZ = this.player.z + PLAYER_BODY_HEIGHT;
    const {
      lateralRange,
      frontMin,
      frontMax,
      minHeightAboveFeet,
      actorHeightPadding
    } = this.occlusionTuning;

    for (const block of this.terrainBlocks) {
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
        this.setTerrainBlockFrontState(block, false);
        continue;
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

      const blockTop = (block.z + 1) * this.blockHeightScale;
      const blockBottom = block.z * this.blockHeightScale;
      const overlapsActorLane = maxLateral >= -lateralRange && minLateral <= lateralRange;
      const isFrontFacing = maxFrontness >= frontMin && minFrontness <= frontMax;
      const risesAboveFeet = blockTop > actorFootZ + minHeightAboveFeet;
      const intersectsActorHeight = blockBottom < actorTopZ + actorHeightPadding;
      const shouldRenderInFront =
        overlapsActorLane && isFrontFacing && risesAboveFeet && intersectsActorHeight;
      this.setTerrainBlockFrontState(block, shouldRenderInFront);
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

  private tryMoveGroundActor(npc: NpcState, deltaX: number, deltaY: number): boolean {
    const nextX = clamp(
      npc.x + deltaX,
      MAP_EDGE_PADDING + NPC_COLLISION_RADIUS,
      this.map.width - MAP_EDGE_PADDING - NPC_COLLISION_RADIUS
    );
    const nextY = clamp(
      npc.y + deltaY,
      MAP_EDGE_PADDING + NPC_COLLISION_RADIUS,
      this.map.height - MAP_EDGE_PADDING - NPC_COLLISION_RADIUS
    );
    const currentSupport = this.getSupportHeight(npc.x, npc.y);
    const nextSupport = this.getSupportHeight(nextX, nextY);

    if (Math.abs(nextSupport - currentSupport) > 0.02) {
      return false;
    }

    if (this.isColliding(nextX, nextY, currentSupport, NPC_COLLISION_RADIUS)) {
      return false;
    }

    npc.x = nextX;
    npc.y = nextY;
    npc.z = nextSupport;
    return true;
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

    this.updateNpcActivity();
    this.updateNpcs(dt);
    this.updateNpcTouchFeedback();
    this.updatePlayerAnimation(dt);
    this.updatePlayerVisuals();
    this.updateNpcVisuals();
    this.updateCamera(dt, false);

    this.hudUpdateTimer = Math.max(0, this.hudUpdateTimer - dt);
    if (this.hudUpdateTimer === 0) {
      this.updateHud();
      this.hudUpdateTimer = HUD_UPDATE_INTERVAL;
    }
  }

  private updatePlayerAnimation(dt: number): void {
    const planarSpeed = length(this.player.vx, this.player.vy);

    if (planarSpeed > 0.05) {
      this.currentDirection = this.getActorFacingDirection(this.player.vx, this.player.vy);
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

  private updateNpcs(dt: number): void {
    for (const npc of this.npcs) {
      npc.flashTimer = Math.max(0, npc.flashTimer - dt);

      if (!npc.active) {
        npc.vx = 0;
        npc.vy = 0;
        npc.walkTime = 0;
        npc.playerTouching = false;
        continue;
      }

      if (npc.kind === 'stationary') {
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
        npc.flashTimer = NPC_TOUCH_FLASH_TIME;
      }

      npc.playerTouching = touching;
    }
  }

  private updatePlayerVisuals(): void {
    const groundHeight = this.getSupportHeight(this.player.x, this.player.y);
    const airHeight = Math.max(0, this.player.z - groundHeight);
    const shadowScale = 1 + Math.min(airHeight * 0.12, 0.35);

    this.playerSprite.position.set(this.player.x, this.player.z, this.player.y);
    this.playerSprite.renderOrder = 10;

    this.shadowMesh.position.set(this.player.x, groundHeight + 0.01, this.player.y);
    this.shadowMesh.scale.setScalar(shadowScale);
    this.shadowMesh.renderOrder = 1;

    this.updateTerrainOcclusion();
  }

  private updateNpcVisuals(): void {
    for (const npc of this.npcs) {
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
      npc.spriteMaterial.color.copy(npc.flashTimer > 0 ? NPC_TOUCH_FLASH_COLOR : npc.baseTint);
      npc.spriteMaterial.needsUpdate = true;

      npc.sprite.position.set(npc.x, npc.z, npc.y);
      npc.sprite.renderOrder = 10;
      npc.shadow.position.set(npc.x, npc.z + 0.01, npc.y);
      npc.shadow.scale.setScalar(1);
      npc.shadow.renderOrder = 1;
    }
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

    this.camera.position.copy(this.cameraFocus).add(offset);
    this.camera.lookAt(this.cameraFocus);
    this.camera.up.set(0, 1, 0);
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
      `Position: ${this.player.x.toFixed(2)}, ${this.player.y.toFixed(2)}, ${this.player.z.toFixed(2)}\n` +
      `Ground: ${ground.toFixed(2)}  |  Vertical speed: ${this.player.vz.toFixed(2)}\n` +
      `State: ${this.player.grounded ? 'grounded' : 'airborne'}  |  View: ${viewName}-up (${this.viewRotation * 90} deg)\n` +
      `Debug free camera: ${this.freeCameraEnabled ? 'on' : 'off'} (toggle: \`)\n` +
      `${axisSummary}\n` +
      `Renderer: Three.js terrain pass in progress. Exposed cube tiles are shaded in 3D; actor is a billboard sprite.`;
  }
}
