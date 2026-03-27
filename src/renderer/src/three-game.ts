import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  OrthographicCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  CircleGeometry,
  MeshBasicMaterial,
  DoubleSide,
  DirectionalLight
} from 'three';

type MaterialKey = 'grass' | 'stone' | 'sand' | 'moss';

interface Cell {
  height: number;
  material: MaterialKey;
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

const MAX_RUN_SPEED = 5.4;
const GROUND_ACCEL = 18;
const GROUND_TURN_ACCEL = 34;
const GROUND_START_ACCEL_FACTOR = 0.35;
const GROUND_ACCEL_CURVE = 1.5;
const AIR_ACCEL = 8;
const GROUND_FRICTION = 8;
const AIR_FRICTION = 1.5;
const JUMP_SPEED = 9.8;
const RISE_GRAVITY = 16;
const LOW_JUMP_GRAVITY = 60;
const FALL_GRAVITY = 42;
const MAX_JUMP_HOLD_TIME = 0.3;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER_TIME = 0.12;
const STEP_HEIGHT = 0.2;
const GROUND_SNAP = 0.08;
const MAP_EDGE_PADDING = 0.02;
const WALK_FRAME_TIME = 0.12;
const PLAYER_BODY_HEIGHT = 1.2;
const VIEW_NAMES = ['N', 'E', 'S', 'W'] as const;
const SCREEN_DIRECTION_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 24;
const CHARACTER_SCALE = 1.35;
const FRUSTUM_HEIGHT = 18;

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

      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.jumpQueued = false;
      this.rotateQueued = 0;
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

function setHeight(
  map: MapData,
  x: number,
  y: number,
  height: number,
  material?: MaterialKey
): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return;
  }

  const cell = getCell(map, x, y);
  cell.height = Math.max(0, height);
  if (material) {
    cell.material = material;
  }
}

function paintRect(
  map: MapData,
  startX: number,
  startY: number,
  width: number,
  height: number,
  tileHeight: number,
  material: MaterialKey
): void {
  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      setHeight(map, x, y, tileHeight, material);
    }
  }
}

function carveRect(
  map: MapData,
  startX: number,
  startY: number,
  width: number,
  height: number
): void {
  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      setHeight(map, x, y, 0, 'sand');
    }
  }
}

function raiseRect(
  map: MapData,
  startX: number,
  startY: number,
  width: number,
  height: number,
  amount: number,
  material?: MaterialKey
): void {
  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) {
      const cell = getCell(map, x, y);
      setHeight(map, x, y, cell.height + amount, material ?? cell.material);
    }
  }
}

function createExampleMap(): MapData {
  const width = 28;
  const height = 24;
  const map: MapData = {
    width,
    height,
    cells: Array.from({ length: width * height }, () => ({
      height: 0,
      material: 'sand' as MaterialKey
    }))
  };

  paintRect(map, 2, 2, 23, 18, 1, 'grass');
  carveRect(map, 17, 4, 4, 4);
  carveRect(map, 5, 15, 3, 3);
  carveRect(map, 11, 3, 2, 4);
  carveRect(map, 21, 13, 3, 4);

  paintRect(map, 7, 6, 7, 6, 2, 'moss');
  paintRect(map, 10, 8, 3, 3, 3, 'stone');
  paintRect(map, 16, 9, 6, 5, 2, 'stone');
  paintRect(map, 19, 10, 2, 2, 3, 'stone');
  paintRect(map, 4, 8, 2, 5, 2, 'grass');

  raiseRect(map, 3, 18, 4, 2, 1, 'sand');
  raiseRect(map, 8, 14, 4, 2, 1, 'grass');
  raiseRect(map, 13, 15, 3, 2, 1, 'moss');
  raiseRect(map, 23, 6, 2, 5, 1, 'sand');

  for (let x = 8; x <= 14; x += 1) {
    setHeight(map, x, 13, 2, 'stone');
  }

  for (let y = 5; y <= 13; y += 2) {
    setHeight(map, 15, y, 2, 'stone');
  }

  setHeight(map, 6, 5, 2, 'sand');
  setHeight(map, 7, 5, 3, 'stone');
  setHeight(map, 8, 5, 2, 'sand');

  setHeight(map, 21, 5, 2, 'sand');
  setHeight(map, 22, 4, 2, 'sand');
  setHeight(map, 22, 5, 3, 'stone');
  setHeight(map, 22, 6, 2, 'sand');

  for (let x = 2; x < width; x += 1) {
    setHeight(map, x, 2, getHeight(map, x, 2), 'sand');
    setHeight(map, x, 19, getHeight(map, x, 19), 'sand');
  }

  for (let y = 2; y < 20; y += 1) {
    setHeight(map, 2, y, getHeight(map, 2, y), 'sand');
    setHeight(map, 24, y, getHeight(map, 24, y), 'sand');
  }

  setHeight(map, 25, 20, 1, 'stone');

  return map;
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
  private readonly camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  private readonly terrainGroup = new Group();
  private readonly actorGroup = new Group();
  private readonly input = new InputController();
  private readonly map = createExampleMap();
  private readonly frameTextures: CanvasTexture[][];
  private readonly spriteMaterial: SpriteMaterial;
  private readonly playerSprite: Sprite;
  private readonly shadowMesh: Mesh;
  private readonly materialPalette = {
    grass: new MeshLambertMaterial({ color: new Color('#92c65e') }),
    moss: new MeshLambertMaterial({ color: new Color('#64884c') }),
    sand: new MeshLambertMaterial({ color: new Color('#cfb070') }),
    stone: new MeshLambertMaterial({ color: new Color('#b3b6c1') })
  } as const;
  private readonly blockGeometry = new BoxGeometry(1, 1, 1);
  private readonly cameraFocus = new Vector3();
  private readonly cameraDesiredFocus = new Vector3();
  private readonly screenVelocity = new Vector2();
  private walkTime = 0;
  private currentDirection = 4;
  private viewRotation = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpHoldTimer = 0;
  private lastFrameTime = performance.now();

  private readonly player: PlayerState = {
    x: 4.5,
    y: 4.5,
    z: 1,
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
    this.root.prepend(this.renderer.domElement);

    this.scene.background = new Color('#111821');

    const ambient = new AmbientLight(0xffffff, 1.55);
    const sun = new DirectionalLight(0xfff1d6, 1.35);
    sun.position.set(10, 18, 8);
    this.scene.add(ambient);
    this.scene.add(sun);

    this.scene.add(this.terrainGroup);
    this.scene.add(this.actorGroup);

    this.buildTerrain();

    this.spriteMaterial = new SpriteMaterial({
      map: this.frameTextures[this.currentDirection][1],
      transparent: true,
      alphaTest: 0.25
    });
    this.playerSprite = new Sprite(this.spriteMaterial);
    this.playerSprite.center.set(0.5, 0);
    this.playerSprite.scale.set(
      CHARACTER_SCALE * (CHARACTER_FRAME_WIDTH / CHARACTER_FRAME_HEIGHT),
      CHARACTER_SCALE,
      1
    );
    this.actorGroup.add(this.playerSprite);

    const shadowMaterial = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: DoubleSide
    });
    this.shadowMesh = new Mesh(new CircleGeometry(0.26, 24), shadowMaterial);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.actorGroup.add(this.shadowMesh);

    this.updateCompass();
    this.updatePlayerVisuals();
    this.updateCamera(1 / 60, true);
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    this.renderer.setAnimationLoop(this.animate);
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

  private buildTerrain(): void {
    this.terrainGroup.clear();

    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        const cell = getCell(this.map, x, y);
        for (let z = 0; z < cell.height; z += 1) {
          const block = new Mesh(this.blockGeometry, this.materialPalette[cell.material]);
          block.position.set(x + 0.5, z + 0.5, y + 0.5);
          block.receiveShadow = false;
          block.castShadow = false;
          this.terrainGroup.add(block);
        }
      }
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

  private getSupportHeight(x: number, y: number): number {
    return getHeight(this.map, Math.floor(x), Math.floor(y));
  }

  private isColliding(x: number, y: number, footZ: number): boolean {
    return this.getSupportHeight(x, y) > footZ + 0.02;
  }

  private moveAxis(axis: 'x' | 'y', amount: number): void {
    if (amount === 0) {
      return;
    }

    const nextX =
      axis === 'x'
        ? clamp(this.player.x + amount, MAP_EDGE_PADDING, this.map.width - MAP_EDGE_PADDING)
        : this.player.x;
    const nextY =
      axis === 'y'
        ? clamp(this.player.y + amount, MAP_EDGE_PADDING, this.map.height - MAP_EDGE_PADDING)
        : this.player.y;

    const supportHeight = this.getSupportHeight(nextX, nextY);
    if (
      this.player.grounded &&
      supportHeight > this.player.z &&
      supportHeight - this.player.z > STEP_HEIGHT
    ) {
      return;
    }

    const collisionFootZ =
      this.player.grounded &&
      supportHeight > this.player.z &&
      supportHeight - this.player.z <= STEP_HEIGHT
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

    if (rotateDelta !== 0) {
      this.viewRotation = (this.viewRotation + (rotateDelta % 4) + 4) % 4;
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
      if (supportHeight < this.player.z - GROUND_SNAP) {
        this.player.grounded = false;
      } else {
        this.player.z = supportHeight;
      }
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.player.vz = JUMP_SPEED;
      this.player.grounded = false;
      this.jumpHoldTimer = MAX_JUMP_HOLD_TIME;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    }

    if (!this.player.grounded) {
      let gravity = FALL_GRAVITY;
      if (this.player.vz > 0) {
        if (this.input.isJumpHeld() && this.jumpHoldTimer > 0) {
          gravity = RISE_GRAVITY;
          this.jumpHoldTimer = Math.max(0, this.jumpHoldTimer - dt);
        } else {
          gravity = LOW_JUMP_GRAVITY;
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
      }
    }

    if (this.player.z < 0) {
      this.player.z = 0;
      this.player.vz = 0;
      this.player.grounded = true;
    }

    this.updatePlayerAnimation(dt);
    this.updatePlayerVisuals();
    this.updateCamera(dt, false);
    this.updateHud();
  }

  private updatePlayerAnimation(dt: number): void {
    const screenVX = this.screenVelocity.x;
    const screenVY = -this.screenVelocity.y;
    const planarSpeed = length(this.player.vx, this.player.vy);

    if (planarSpeed > 0.05) {
      const angle = Math.atan2(screenVY, screenVX);
      const rawDirection = Math.round((angle + Math.PI / 2) / (Math.PI / 4));
      this.currentDirection = (rawDirection % 8 + 8) % 8;
    }

    const walking = planarSpeed > 0.15 && this.player.grounded;
    if (walking) {
      this.walkTime += dt;
    } else {
      this.walkTime = 0;
    }

    const frameIndex = walking ? Math.floor(this.walkTime / WALK_FRAME_TIME) % 3 : 1;
    this.spriteMaterial.map = this.frameTextures[this.currentDirection][frameIndex];
    this.spriteMaterial.needsUpdate = true;
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
  }

  private updateCamera(dt: number, snap: boolean): void {
    this.cameraDesiredFocus.set(this.player.x, this.player.z + 0.6, this.player.y);

    if (snap) {
      this.cameraFocus.copy(this.cameraDesiredFocus);
    } else {
      const smoothing = 1 - Math.exp(-dt * 8);
      this.cameraFocus.lerp(this.cameraDesiredFocus, smoothing);
    }

    const distance = 11.5;
    const height = 11.5;
    const offsets = [
      new Vector3(distance, height, distance),
      new Vector3(-distance, height, distance),
      new Vector3(-distance, height, -distance),
      new Vector3(distance, height, -distance)
    ];
    const offset = offsets[this.viewRotation % offsets.length];

    this.camera.position.copy(this.cameraFocus).add(offset);
    this.camera.lookAt(this.cameraFocus);
    this.camera.up.set(0, 1, 0);
    this.camera.updateProjectionMatrix();
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
      `${axisSummary}\n` +
      `Renderer: Three.js phase 1 preview. Terrain is now real 3D block geometry; actor is a billboard sprite.`;
  }
}
