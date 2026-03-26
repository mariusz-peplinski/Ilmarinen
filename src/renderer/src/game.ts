import {
  Application,
  BaseTexture,
  Container,
  DisplayObject,
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

interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
}

interface Renderable {
  graphic: DisplayObject;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  tieBreaker: number;
}

interface TerrainTileSet {
  top: Texture[];
  block: Texture[];
}

type TerrainTiles = Record<MaterialKey, TerrainTileSet>;

const TILE_WIDTH = 64;
const TILE_HEIGHT = 16;
const BLOCK_HEIGHT = 16;
const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 24;
const CHARACTER_SCALE = 2;
const MAX_RUN_SPEED = 4.8;
const GROUND_ACCEL = 18;
const GROUND_TURN_ACCEL = 26;
const AIR_ACCEL = 8;
const GROUND_FRICTION = 10;
const AIR_FRICTION = 1.5;
const JUMP_SPEED = 6.4;
const RISE_GRAVITY = 16;
const LOW_JUMP_GRAVITY = 28;
const FALL_GRAVITY = 36;
const MAX_JUMP_HOLD_TIME = 0.16;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER_TIME = 0.12;
const PLAYER_BODY_HEIGHT = 1.2;
const MAP_EDGE_PADDING = 0.02;
const STEP_HEIGHT = 0.2;
const GROUND_SNAP = 0.08;
const WALK_FRAME_TIME = 0.12;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const approach = (value: number, target: number, delta: number): number => {
  if (value < target) {
    return Math.min(value + delta, target);
  }

  return Math.max(value - delta, target);
};

const length = (x: number, y: number): number => Math.hypot(x, y);

const isoProject = (x: number, y: number, z: number): Vec2 => ({
  x: (x - y) * (TILE_WIDTH / 2),
  y: (x + y) * (TILE_HEIGHT / 2) - z * BLOCK_HEIGHT
});

const compareRenderables = (a: Renderable, b: Renderable): number => {
  const epsilon = 0.0001;
  const aBehindB =
    a.maxX <= b.minX + epsilon ||
    a.maxY <= b.minY + epsilon ||
    a.maxZ <= b.minZ + epsilon;
  const bBehindA =
    b.maxX <= a.minX + epsilon ||
    b.maxY <= a.minY + epsilon ||
    b.maxZ <= a.minZ + epsilon;

  if (aBehindB && !bBehindA) {
    return -1;
  }

  if (bBehindA && !aBehindB) {
    return 1;
  }

  const aPoint = isoProject(a.anchorX, a.anchorY, a.anchorZ);
  const bPoint = isoProject(b.anchorX, b.anchorY, b.anchorZ);

  if (aPoint.y !== bPoint.y) {
    return aPoint.y - bPoint.y;
  }

  if (aPoint.x !== bPoint.x) {
    return aPoint.x - bPoint.x;
  }

  return a.tieBreaker - b.tieBreaker;
};

class InputController {
  private readonly keys = new Set<string>();
  private jumpQueued = false;

  constructor() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) {
          this.jumpQueued = true;
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
    });
  }

  public getMoveVector(): Vec2 {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      x -= 1;
      y -= 1;
    }

    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      x += 1;
      y += 1;
    }

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      x -= 1;
      y += 1;
    }

    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      x += 1;
      y -= 1;
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

  return map;
}

export class IsoGame {
  private readonly app: Application;
  private readonly hudStatus: HTMLDivElement;
  private readonly input = new InputController();
  private readonly world = new Container();
  private readonly shadowGraphic = new Graphics();
  private readonly playerSprite = new Sprite();
  private readonly map = createExampleMap();
  private readonly camera = { x: 0, y: 0 };
  private readonly renderables: Renderable[] = [];
  private readonly terrainTiles: TerrainTiles;
  private readonly characterFrames: Texture[][];
  private readonly shadowRenderable: Renderable;
  private readonly playerRenderable: Renderable;
  private walkTime = 0;
  private currentDirection = 4;
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
    baseTexture: BaseTexture,
    charactersBaseTexture: BaseTexture
  ) {
    this.app = app;
    this.hudStatus = hudStatus;
    this.terrainTiles = this.createTerrainTiles(baseTexture);
    this.characterFrames = this.createCharacterFrames(charactersBaseTexture);
    this.shadowRenderable = this.createRenderable(this.shadowGraphic, -4);
    this.playerRenderable = this.createRenderable(this.playerSprite, -1);

    this.world.sortableChildren = false;
    this.world.addChild(this.shadowGraphic);
    this.playerSprite.anchor.set(0.5, 1);
    this.playerSprite.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);
    this.world.addChild(this.playerSprite);
    this.app.stage.addChild(this.world);

    this.buildTerrain();
    this.drawPlayer();
    this.sortWorld();
    this.app.ticker.add(() => {
      const dt = Math.min(this.app.ticker.deltaMS / 1000, 1 / 30);
      this.update(dt);
    });
  }

  private createRenderable(graphic: DisplayObject, tieBreaker: number): Renderable {
    const renderable: Renderable = {
      graphic,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      minZ: 0,
      maxZ: 0,
      anchorX: 0,
      anchorY: 0,
      anchorZ: 0,
      tieBreaker
    };
    this.renderables.push(renderable);
    return renderable;
  }

  private sliceTexture(baseTexture: BaseTexture, cellX: number, cellY: number): Texture {
    return new Texture(baseTexture, new Rectangle(cellX * 32, cellY * 16, 32, 16));
  }

  private createTerrainTiles(baseTexture: BaseTexture): TerrainTiles {
    return {
      grass: {
        top: [
          this.sliceTexture(baseTexture, 2, 2),
          this.sliceTexture(baseTexture, 2, 4)
        ],
        block: [
          this.sliceTexture(baseTexture, 2, 3),
          this.sliceTexture(baseTexture, 2, 5)
        ]
      },
      moss: {
        top: [
          this.sliceTexture(baseTexture, 2, 4),
          this.sliceTexture(baseTexture, 2, 2)
        ],
        block: [
          this.sliceTexture(baseTexture, 2, 5),
          this.sliceTexture(baseTexture, 2, 3)
        ]
      },
      sand: {
        top: [
          this.sliceTexture(baseTexture, 3, 2),
          this.sliceTexture(baseTexture, 3, 4),
          this.sliceTexture(baseTexture, 3, 6)
        ],
        block: [
          this.sliceTexture(baseTexture, 3, 3),
          this.sliceTexture(baseTexture, 3, 5),
          this.sliceTexture(baseTexture, 3, 7)
        ]
      },
      stone: {
        top: [
          this.sliceTexture(baseTexture, 4, 2),
          this.sliceTexture(baseTexture, 4, 4),
          this.sliceTexture(baseTexture, 4, 6)
        ],
        block: [
          this.sliceTexture(baseTexture, 4, 3),
          this.sliceTexture(baseTexture, 4, 5),
          this.sliceTexture(baseTexture, 4, 7)
        ]
      }
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

  private buildTerrain(): void {
    for (let y = 0; y < this.map.height; y += 1) {
      for (let x = 0; x < this.map.width; x += 1) {
        const cell = getCell(this.map, x, y);

        for (let z = 0; z < cell.height; z += 1) {
          const drawTop = z === cell.height - 1;
          const drawRight = getHeight(this.map, x + 1, y) < z + 1;
          const drawLeft = getHeight(this.map, x, y + 1) < z + 1;

          if (!drawTop && !drawRight && !drawLeft) {
            continue;
          }

          const sprite =
            drawTop && !drawRight && !drawLeft
              ? this.createTopSprite(x, y, z, cell.material)
              : this.createBlockSprite(x, y, z, cell.material);
          this.world.addChild(sprite);
          this.createTerrainRenderable(sprite, x, y, z);
        }
      }
    }
  }

  private createBlockSprite(x: number, y: number, z: number, material: MaterialKey): Sprite {
    const variants = this.terrainTiles[material].block;
    const texture = variants[Math.abs(x * 17 + y * 31 + z * 13) % variants.length];
    const sprite = new Sprite(texture);
    const bottom = isoProject(x + 1, y + 1, z);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(2);
    sprite.position.set(bottom.x, bottom.y);
    return sprite;
  }

  private createTopSprite(x: number, y: number, z: number, material: MaterialKey): Sprite {
    const variants = this.terrainTiles[material].top;
    const texture = variants[Math.abs(x * 17 + y * 31 + z * 13) % variants.length];
    const sprite = new Sprite(texture);
    const bottom = isoProject(x + 1, y + 1, z + 1);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(2);
    sprite.position.set(bottom.x, bottom.y);
    return sprite;
  }

  private createTerrainRenderable(graphic: DisplayObject, x: number, y: number, z: number): void {
    this.renderables.push({
      graphic,
      minX: x,
      maxX: x + 1,
      minY: y,
      maxY: y + 1,
      minZ: z,
      maxZ: z + 1,
      anchorX: x + 0.5,
      anchorY: y + 0.5,
      anchorZ: z + 0.5,
      tieBreaker: 0
    });
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
    const move = this.input.getMoveVector();
    const desiredX = move.x * MAX_RUN_SPEED;
    const desiredY = move.y * MAX_RUN_SPEED;
    const jumpPressed = this.input.consumeJump();

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

    const accelX =
      this.player.grounded && desiredX !== 0 && Math.sign(desiredX) !== Math.sign(this.player.vx)
        ? GROUND_TURN_ACCEL
        : this.player.grounded
          ? GROUND_ACCEL
          : AIR_ACCEL;
    const accelY =
      this.player.grounded && desiredY !== 0 && Math.sign(desiredY) !== Math.sign(this.player.vy)
        ? GROUND_TURN_ACCEL
        : this.player.grounded
          ? GROUND_ACCEL
          : AIR_ACCEL;

    this.player.vx = approach(this.player.vx, desiredX, accelX * dt);
    this.player.vy = approach(this.player.vy, desiredY, accelY * dt);

    if (move.x === 0) {
      this.player.vx = approach(this.player.vx, 0, (this.player.grounded ? GROUND_FRICTION : AIR_FRICTION) * dt);
    }

    if (move.y === 0) {
      this.player.vy = approach(this.player.vy, 0, (this.player.grounded ? GROUND_FRICTION : AIR_FRICTION) * dt);
    }

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
    this.drawPlayer();
    this.sortWorld();
    this.updateCamera(dt);
    this.updateHud();
  }

  private updatePlayerAnimation(dt: number): void {
    const screenVX = this.player.vx - this.player.vy;
    const screenVY = this.player.vx + this.player.vy;
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
    this.playerSprite.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);
  }

  private sortWorld(): void {
    this.renderables.sort(compareRenderables);
    for (let index = 0; index < this.renderables.length; index += 1) {
      this.world.setChildIndex(this.renderables[index].graphic, index);
    }
  }

  private updateCamera(dt: number): void {
    const focus = isoProject(this.player.x, this.player.y, this.player.z + 0.4);
    const smoothing = 1 - Math.exp(-dt * 8);

    this.camera.x += (focus.x - this.camera.x) * smoothing;
    this.camera.y += (focus.y - this.camera.y) * smoothing;

    this.world.position.set(
      this.app.screen.width * 0.5 - this.camera.x,
      this.app.screen.height * 0.38 - this.camera.y
    );
  }

  private drawPlayer(): void {
    const groundHeight = this.getSupportHeight(this.player.x, this.player.y);
    const shadowPoint = isoProject(this.player.x, this.player.y, groundHeight);
    const bodyPoint = isoProject(this.player.x, this.player.y, this.player.z);
    const airHeight = Math.max(0, this.player.z - groundHeight);
    const shadowScale = 1 + Math.min(airHeight * 0.12, 0.35);
    const shadowAlpha = this.player.grounded ? 0.28 : 0.22;
    const footY = bodyPoint.y;

    this.shadowGraphic.clear();
    this.shadowGraphic.beginFill(0x000000, shadowAlpha);
    this.shadowGraphic.drawEllipse(
      shadowPoint.x,
      shadowPoint.y + 6,
      12 * shadowScale,
      6 * shadowScale
    );
    this.shadowGraphic.endFill();

    this.playerSprite.position.set(bodyPoint.x, footY + 8);

    this.shadowRenderable.minX = this.player.x - 0.22;
    this.shadowRenderable.maxX = this.player.x + 0.22;
    this.shadowRenderable.minY = this.player.y - 0.22;
    this.shadowRenderable.maxY = this.player.y + 0.22;
    this.shadowRenderable.minZ = groundHeight - 0.02;
    this.shadowRenderable.maxZ = groundHeight;
    this.shadowRenderable.anchorX = this.player.x;
    this.shadowRenderable.anchorY = this.player.y;
    this.shadowRenderable.anchorZ = groundHeight - 0.01;

    this.playerRenderable.minX = this.player.x - 0.18;
    this.playerRenderable.maxX = this.player.x + 0.18;
    this.playerRenderable.minY = this.player.y - 0.18;
    this.playerRenderable.maxY = this.player.y + 0.18;
    this.playerRenderable.minZ = this.player.z;
    this.playerRenderable.maxZ = this.player.z + PLAYER_BODY_HEIGHT;
    this.playerRenderable.anchorX = this.player.x;
    this.playerRenderable.anchorY = this.player.y;
    this.playerRenderable.anchorZ = this.player.z + 0.7;
  }

  private updateHud(): void {
    const ground = this.getSupportHeight(this.player.x, this.player.y);
    this.hudStatus.textContent =
      `Position: ${this.player.x.toFixed(2)}, ${this.player.y.toFixed(2)}, ${this.player.z.toFixed(2)}\n` +
      `Ground: ${ground.toFixed(2)}  |  Vertical speed: ${this.player.vz.toFixed(2)}\n` +
      `State: ${this.player.grounded ? 'grounded' : 'airborne'}\n` +
      `Map notes: tileset renderer pass is active now; please sanity-check terrain ordering around ledges, walls, and map borders.`;
  }
}
