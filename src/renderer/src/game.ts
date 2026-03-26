import {
  Application,
  BaseTexture,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture
} from 'pixi.js';

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

interface TerrainBlock {
  x: number;
  y: number;
  z: number;
  material: MaterialKey;
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

type TerrainTiles = Record<MaterialKey, Texture>;

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const BLOCK_HEIGHT = 16;
const BASE_APPARENT_MOVE_SPEED = (TILE_HEIGHT / 2) * Math.SQRT2;
const TERRAIN_ATLAS_TILE_SIZE = 32;
const TERRAIN_ATLAS_COLUMN_PITCH = 34;
const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 24;
const CHARACTER_SCALE = 2;
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
const PLAYER_BODY_HEIGHT = 1.2;
const MAP_EDGE_PADDING = 0.02;
const STEP_HEIGHT = 0.2;
const GROUND_SNAP = 0.08;
const WALK_FRAME_TIME = 0.12;
const VIEW_NAMES = ['N', 'E', 'S', 'W'] as const;
const SCREEN_DIRECTION_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
const SCREEN_MAX_RUN_SPEED = BASE_APPARENT_MOVE_SPEED * MAX_RUN_SPEED;
const SCREEN_GROUND_ACCEL = BASE_APPARENT_MOVE_SPEED * GROUND_ACCEL;
const SCREEN_GROUND_TURN_ACCEL = BASE_APPARENT_MOVE_SPEED * GROUND_TURN_ACCEL;
const SCREEN_AIR_ACCEL = BASE_APPARENT_MOVE_SPEED * AIR_ACCEL;
const SCREEN_GROUND_FRICTION = BASE_APPARENT_MOVE_SPEED * GROUND_FRICTION;
const SCREEN_AIR_FRICTION = BASE_APPARENT_MOVE_SPEED * AIR_FRICTION;

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

  public getMoveVector(): Vec2 {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      y -= 1;
    }

    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      y += 1;
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

export class IsoGame {
  private readonly app: Application;
  private readonly hudStatus: HTMLDivElement;
  private readonly compassLabels: Record<'top' | 'right' | 'bottom' | 'left', HTMLSpanElement>;
  private readonly terrainOffsetStatus: HTMLDivElement;
  private readonly input = new InputController();
  private readonly world = new Container();
  private readonly terrainLayer = new Container();
  private readonly actorLayer = new Container();
  private readonly shadowGraphic = new Graphics();
  private readonly playerSprite = new Sprite();
  private readonly map = createExampleMap();
  private readonly terrainTiles: TerrainTiles;
  private readonly characterFrames: Texture[][];
  private readonly camera = { x: 0, y: 0 };
  private readonly terrainScreenOffset: Vec2 = { x: 0, y: TILE_HEIGHT / 2 };
  private walkTime = 0;
  private currentDirection = 4;
  private viewRotation = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpHoldTimer = 0;

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
    app: Application,
    hudStatus: HTMLDivElement,
    compass: HTMLDivElement,
    terrainOffsetStatus: HTMLDivElement,
    terrainBaseTexture: BaseTexture,
    charactersBaseTexture: BaseTexture
  ) {
    this.app = app;
    this.hudStatus = hudStatus;
    this.terrainOffsetStatus = terrainOffsetStatus;
    this.compassLabels = {
      top: this.getCompassLabel(compass, 'top'),
      right: this.getCompassLabel(compass, 'right'),
      bottom: this.getCompassLabel(compass, 'bottom'),
      left: this.getCompassLabel(compass, 'left')
    };
    this.terrainTiles = this.createTerrainTiles(terrainBaseTexture);
    this.characterFrames = this.createCharacterFrames(charactersBaseTexture);

    this.playerSprite.anchor.set(0.5, 1);
    this.playerSprite.scale.set(CHARACTER_SCALE);
    this.actorLayer.addChild(this.shadowGraphic);
    this.actorLayer.addChild(this.playerSprite);

    this.world.addChild(this.terrainLayer);
    this.world.addChild(this.actorLayer);
    this.app.stage.addChild(this.world);

    this.rebuildTerrain();
    this.updateCompass();
    this.updateTerrainOffsetStatus();
    this.updatePlayerVisuals();
    this.app.ticker.add(() => {
      const dt = Math.min(this.app.ticker.deltaMS / 1000, 1 / 30);
      this.update(dt);
    });
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

  private sliceTerrainTexture(baseTexture: BaseTexture, column: number, row: number): Texture {
    return new Texture(
      baseTexture,
      new Rectangle(
        column * TERRAIN_ATLAS_COLUMN_PITCH,
        row * TERRAIN_ATLAS_TILE_SIZE,
        TERRAIN_ATLAS_TILE_SIZE,
        TERRAIN_ATLAS_TILE_SIZE
      )
    );
  }

  private createTerrainTiles(baseTexture: BaseTexture): TerrainTiles {
    return {
      grass: this.sliceTerrainTexture(baseTexture, 1, 0),
      moss: this.sliceTerrainTexture(baseTexture, 1, 1),
      sand: this.sliceTerrainTexture(baseTexture, 2, 0),
      stone: this.sliceTerrainTexture(baseTexture, 3, 0)
    };
  }

  private createCharacterFrames(baseTexture: BaseTexture): Texture[][] {
    const frame = (column: number, row: number): Texture =>
      new Texture(
        baseTexture,
        new Rectangle(
          column * CHARACTER_FRAME_WIDTH,
          row * CHARACTER_FRAME_HEIGHT,
          CHARACTER_FRAME_WIDTH,
          CHARACTER_FRAME_HEIGHT
        )
      );

    return Array.from({ length: 8 }, (_, direction) => [
      frame(direction, 1),
      frame(direction, 2),
      frame(direction, 3)
    ]);
  }

  private rebuildTerrain(): void {
    this.terrainLayer.removeChildren();
    const blocks: TerrainBlock[] = [];

    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        const cell = getCell(this.map, x, y);

        for (let z = 0; z < cell.height; z += 1) {
          if (!this.isBlockExposed(x, y, z + 1)) {
            continue;
          }

          blocks.push({ x, y, z, material: cell.material });
        }
      }
    }

    blocks.sort((a, b) => {
      const aView = this.rotateViewPoint(a.x, a.y);
      const bView = this.rotateViewPoint(b.x, b.y);
      const aDepth = aView.x + aView.y + a.z;
      const bDepth = bView.x + bView.y + b.z;

      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }

      if (aView.y !== bView.y) {
        return aView.y - bView.y;
      }

      if (aView.x !== bView.x) {
        return aView.x - bView.x;
      }

      return a.z - b.z;
    });

    for (const block of blocks) {
      const sprite = this.createTerrainBlock(block.x, block.y, block.z, block.material);
      this.terrainLayer.addChild(sprite);
    }
  }

  private isBlockExposed(x: number, y: number, level: number): boolean {
    return (
      getHeight(this.map, x, y) === level ||
      getHeight(this.map, x + 1, y) < level ||
      getHeight(this.map, x, y + 1) < level
    );
  }

  private createTerrainBlock(x: number, y: number, z: number, material: MaterialKey): Sprite {
    const sprite = new Sprite(this.terrainTiles[material]);
    const screen = this.projectWorld(x + 0.5, y + 0.5, z + 1);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(2);
    sprite.position.set(screen.x + this.terrainScreenOffset.x, screen.y + this.terrainScreenOffset.y);
    return sprite;
  }

  public nudgeTerrainOffset(direction: string): void {
    const halfWidth = TILE_WIDTH / 2;
    const halfHeight = TILE_HEIGHT / 2;

    switch (direction) {
      case 'N':
        this.terrainScreenOffset.y -= halfHeight;
        break;
      case 'S':
        this.terrainScreenOffset.y += halfHeight;
        break;
      case 'E':
        this.terrainScreenOffset.x += halfWidth;
        break;
      case 'W':
        this.terrainScreenOffset.x -= halfWidth;
        break;
      case 'NE':
        this.terrainScreenOffset.x += halfWidth / 2;
        this.terrainScreenOffset.y -= halfHeight / 2;
        break;
      case 'NW':
        this.terrainScreenOffset.x -= halfWidth / 2;
        this.terrainScreenOffset.y -= halfHeight / 2;
        break;
      case 'SE':
        this.terrainScreenOffset.x += halfWidth / 2;
        this.terrainScreenOffset.y += halfHeight / 2;
        break;
      case 'SW':
        this.terrainScreenOffset.x -= halfWidth / 2;
        this.terrainScreenOffset.y += halfHeight / 2;
        break;
      case 'RESET':
        this.terrainScreenOffset.x = 0;
        this.terrainScreenOffset.y = 0;
        break;
      default:
        return;
    }

    this.rebuildTerrain();
    this.updateTerrainOffsetStatus();
  }

  private rotateViewPoint(x: number, y: number): Vec2 {
    const centerX = this.map.width * 0.5;
    const centerY = this.map.height * 0.5;
    const localX = x - centerX;
    const localY = y - centerY;

    switch (this.viewRotation % 4) {
      case 1:
        return { x: localY, y: -localX };
      case 2:
        return { x: -localX, y: -localY };
      case 3:
        return { x: -localY, y: localX };
      default:
        return { x: localX, y: localY };
    }
  }

  private projectWorld(x: number, y: number, z: number): Vec2 {
    const rotated = this.rotateViewPoint(x, y);
    return {
      x: (rotated.x - rotated.y) * (TILE_WIDTH / 2),
      y: (rotated.x + rotated.y) * (TILE_HEIGHT / 2) - z * BLOCK_HEIGHT
    };
  }

  private projectVelocity(x: number, y: number): Vec2 {
    const rotated =
      this.viewRotation % 4 === 1
        ? { x: y, y: -x }
        : this.viewRotation % 4 === 2
          ? { x: -x, y: -y }
          : this.viewRotation % 4 === 3
            ? { x: -y, y: x }
            : { x, y };

    return {
      x: (rotated.x - rotated.y) * (TILE_WIDTH / 2),
      y: (rotated.x + rotated.y) * (TILE_HEIGHT / 2)
    };
  }

  private screenVelocityToWorld(x: number, y: number): Vec2 {
    const rotatedX = x / TILE_WIDTH + y / TILE_HEIGHT;
    const rotatedY = y / TILE_HEIGHT - x / TILE_WIDTH;

    switch (this.viewRotation % 4) {
      case 1:
        return { x: -rotatedY, y: rotatedX };
      case 2:
        return { x: -rotatedX, y: -rotatedY };
      case 3:
        return { x: rotatedY, y: -rotatedX };
      default:
        return { x: rotatedX, y: rotatedY };
    }
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
      this.viewRotation = (this.viewRotation + rotateDelta % 4 + 4) % 4;
      this.rebuildTerrain();
      this.updateCompass();
      const focus = this.projectWorld(this.player.x, this.player.y, this.player.z + 0.4);
      this.camera.x = focus.x;
      this.camera.y = focus.y;
    }

    const move = this.input.getMoveVector();
    const desiredScreenX = move.x * SCREEN_MAX_RUN_SPEED;
    const desiredScreenY = move.y * SCREEN_MAX_RUN_SPEED;

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

    let screenVelocity = this.projectVelocity(this.player.vx, this.player.vy);
    const speedRatio = clamp(
      Math.hypot(screenVelocity.x, screenVelocity.y) / SCREEN_MAX_RUN_SPEED,
      0,
      1
    );
    const curvedSpeedRatio = Math.pow(speedRatio, GROUND_ACCEL_CURVE);
    const groundedRunAccel = lerp(
      SCREEN_GROUND_ACCEL * GROUND_START_ACCEL_FACTOR,
      SCREEN_GROUND_ACCEL,
      curvedSpeedRatio
    );
    const groundedTurnAccel = lerp(
      SCREEN_GROUND_TURN_ACCEL * GROUND_START_ACCEL_FACTOR,
      SCREEN_GROUND_TURN_ACCEL,
      curvedSpeedRatio
    );

    const accelX =
      this.player.grounded &&
      desiredScreenX !== 0 &&
      Math.sign(desiredScreenX) !== Math.sign(screenVelocity.x)
        ? groundedTurnAccel
        : this.player.grounded
          ? groundedRunAccel
          : SCREEN_AIR_ACCEL;
    const accelY =
      this.player.grounded &&
      desiredScreenY !== 0 &&
      Math.sign(desiredScreenY) !== Math.sign(screenVelocity.y)
        ? groundedTurnAccel
        : this.player.grounded
          ? groundedRunAccel
          : SCREEN_AIR_ACCEL;

    screenVelocity.x = approach(screenVelocity.x, desiredScreenX, accelX * dt);
    screenVelocity.y = approach(screenVelocity.y, desiredScreenY, accelY * dt);

    if (move.x === 0) {
      screenVelocity.x = approach(
        screenVelocity.x,
        0,
        (this.player.grounded ? SCREEN_GROUND_FRICTION : SCREEN_AIR_FRICTION) * dt
      );
    }

    if (move.y === 0) {
      screenVelocity.y = approach(
        screenVelocity.y,
        0,
        (this.player.grounded ? SCREEN_GROUND_FRICTION : SCREEN_AIR_FRICTION) * dt
      );
    }

    const worldVelocity = this.screenVelocityToWorld(screenVelocity.x, screenVelocity.y);
    this.player.vx = worldVelocity.x;
    this.player.vy = worldVelocity.y;

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
    this.updateCamera(dt);
    this.updateHud();
  }

  private updatePlayerAnimation(dt: number): void {
    const projectedOrigin = this.projectWorld(0, 0, 0);
    const projectedVelocity = this.projectWorld(this.player.vx, this.player.vy, 0);
    const screenVX = projectedVelocity.x - projectedOrigin.x;
    const screenVY = projectedVelocity.y - projectedOrigin.y;
    const speed = Math.hypot(this.player.vx, this.player.vy);

    if (speed > 0.05) {
      const angle = Math.atan2(screenVY, screenVX);
      const rawDirection = Math.round((angle + Math.PI / 2) / (Math.PI / 4));
      this.currentDirection = (rawDirection % 8 + 8) % 8;
    }

    const walking = speed > 0.15 && this.player.grounded;
    if (walking) {
      this.walkTime += dt;
    } else {
      this.walkTime = 0;
    }

    const frames = this.characterFrames[this.currentDirection];
    const frameIndex = walking ? Math.floor(this.walkTime / WALK_FRAME_TIME) % 3 : 1;
    this.playerSprite.texture = frames[frameIndex];
  }

  private updatePlayerVisuals(): void {
    const groundHeight = this.getSupportHeight(this.player.x, this.player.y);
    const shadowPoint = this.projectWorld(this.player.x, this.player.y, groundHeight);
    const bodyPoint = this.projectWorld(this.player.x, this.player.y, this.player.z);
    const airHeight = Math.max(0, this.player.z - groundHeight);
    const shadowScale = 1 + Math.min(airHeight * 0.12, 0.35);
    const shadowAlpha = this.player.grounded ? 0.28 : 0.22;

    this.shadowGraphic.clear();
    this.shadowGraphic.beginFill(0x000000, shadowAlpha);
    this.shadowGraphic.drawEllipse(
      shadowPoint.x,
      shadowPoint.y + TILE_HEIGHT / 2,
      12 * shadowScale,
      6 * shadowScale
    );
    this.shadowGraphic.endFill();

    this.playerSprite.position.set(bodyPoint.x, bodyPoint.y + TILE_HEIGHT / 2);
  }

  private updateCompass(): void {
    const rotation = this.viewRotation % 4;
    const top = VIEW_NAMES[rotation];
    const right = VIEW_NAMES[(rotation + 1) % 4];
    const bottom = VIEW_NAMES[(rotation + 2) % 4];
    const left = VIEW_NAMES[(rotation + 3) % 4];

    this.compassLabels.top.textContent = top;
    this.compassLabels.right.textContent = right;
    this.compassLabels.bottom.textContent = bottom;
    this.compassLabels.left.textContent = left;
  }

  private updateTerrainOffsetStatus(): void {
    const xSteps = this.terrainScreenOffset.x / (TILE_WIDTH / 2);
    const ySteps = this.terrainScreenOffset.y / (TILE_HEIGHT / 2);
    this.terrainOffsetStatus.textContent =
      `Terrain offset\nx=${this.terrainScreenOffset.x}px (${xSteps.toFixed(2)} x-half)\n` +
      `y=${this.terrainScreenOffset.y}px (${ySteps.toFixed(2)} y-half)`;
  }

  private updateCamera(dt: number): void {
    const focus = this.projectWorld(this.player.x, this.player.y, this.player.z + 0.4);
    const smoothing = 1 - Math.exp(-dt * 8);

    this.camera.x += (focus.x - this.camera.x) * smoothing;
    this.camera.y += (focus.y - this.camera.y) * smoothing;

    const worldX = this.app.screen.width * 0.5 - this.camera.x;
    const worldY = this.app.screen.height * 0.38 - this.camera.y;

    this.world.position.set(
      Math.round(worldX),
      Math.round(worldY)
    );
  }

  private updateHud(): void {
    const ground = this.getSupportHeight(this.player.x, this.player.y);
    const viewName = VIEW_NAMES[this.viewRotation % VIEW_NAMES.length];
    const origin = this.projectWorld(0, 0, 0);
    const positiveX = this.projectWorld(1, 0, 0);
    const negativeX = this.projectWorld(-1, 0, 0);
    const positiveY = this.projectWorld(0, 1, 0);
    const negativeY = this.projectWorld(0, -1, 0);

    const axisSummary =
      `Axes: +X=${getCompassDirection(positiveX.x - origin.x, positiveX.y - origin.y)} ` +
      `-X=${getCompassDirection(negativeX.x - origin.x, negativeX.y - origin.y)} ` +
      `+Y=${getCompassDirection(positiveY.x - origin.x, positiveY.y - origin.y)} ` +
      `-Y=${getCompassDirection(negativeY.x - origin.x, negativeY.y - origin.y)}`;

    this.hudStatus.textContent =
      `Position: ${this.player.x.toFixed(2)}, ${this.player.y.toFixed(2)}, ${this.player.z.toFixed(2)}\n` +
      `Ground: ${ground.toFixed(2)}  |  Vertical speed: ${this.player.vz.toFixed(2)}\n` +
      `State: ${this.player.grounded ? 'grounded' : 'airborne'}  |  View: ${viewName}-up (${this.viewRotation * 90} deg)\n` +
      `${axisSummary}\n` +
      `Map notes: terrain rendering was reset to a clean painter-style tileset pass. Next step is refining atlas mapping and then reintroducing terrain-aware actor occlusion.`;
  }
}
