import './editor.css';
import charactersUrl from '../../../characters.png?url';
import flowersUrl from '../../../Flowers/Flowers_With_Outline_Spritesheet.png?url';
import type { MapId, NetworkActorKind, NetworkActorState } from '../../shared/network-protocol';
import {
  MAP_GENERATION_SEED,
  OVERWORLD_TELEPORT_TILE,
  createNetworkWorldActors,
  createNetworkWorldMaps,
  getRandomOverworldTeleportTile,
  type GeneratedMap
} from '../../shared/world-generation';

type MaterialKey = 'grass' | 'stone' | 'sand' | 'moss' | 'portal';
type EditorTool = 'tile' | 'height' | 'teleport' | 'object' | 'erase';
type PlacedObjectType = NetworkActorKind;

interface EditorCell {
  height: number;
  materials: MaterialKey[];
}

interface EditorObject {
  id: string;
  type: PlacedObjectType;
  x: number;
  y: number;
  variant: number;
  direction: number;
  displayName: string | null;
}

interface EditorTeleport {
  x: number;
  y: number;
  targetMapId: MapId;
  targetX: number;
  targetY: number;
}

interface EditorMapDocument {
  version: 2;
  id: MapId;
  width: number;
  height: number;
  cells: EditorCell[];
  teleports: EditorTeleport[];
  objects: EditorObject[];
}

interface Vec2 {
  x: number;
  y: number;
}

interface TileHit {
  x: number;
  y: number;
  points: Vec2[];
}

const root = document.querySelector<HTMLDivElement>('#editor-app');

if (!root) {
  throw new Error('Expected #editor-app root element.');
}

const materialColors: Record<MaterialKey, string> = {
  grass: '#92c65e',
  moss: '#64884c',
  sand: '#cfb070',
  stone: '#b3b6c1',
  portal: '#58d7ff'
};

const materialLabels: Record<MaterialKey, string> = {
  grass: 'Grass',
  moss: 'Moss',
  sand: 'Sand',
  stone: 'Stone',
  portal: 'Portal'
};

const objectLabels: Record<PlacedObjectType, string> = {
  'npc-mobile': 'NPC Mobile',
  'npc-stationary': 'NPC Stationary',
  'npc-sturdy': 'NPC Sturdy',
  flower: 'Flower',
  crystal: 'Crystal',
  trigger: 'Trigger'
};

const viewNames = ['N', 'E', 'S', 'W'] as const;
const tileWidth = 52;
const tileHeight = 26;
const heightStep = 12;
const storageKey = 'isogame-map-editor-document';
const HUB_WORLD_SPAWN: Vec2 = { x: 15.5, y: 18.5 };
const materials = Object.keys(materialColors) as MaterialKey[];
const objectTypes = Object.keys(objectLabels) as PlacedObjectType[];

let selectedTool: EditorTool = 'tile';
let selectedMaterial: MaterialKey = 'grass';
let selectedObjectType: PlacedObjectType = 'npc-mobile';
let selectedHeight = 2;
let selectedVariant = 0;
let selectedDirection = 4;
let selectedDisplayName = '';
let viewRotation = 0;
let zoom = 1;
let pan: Vec2 = { x: 0, y: 0 };
let pointerTile: Vec2 | null = null;
let painting = false;
let panning = false;
let lastPointer: Vec2 = { x: 0, y: 0 };
let tileHits: TileHit[] = [];

const loadImage = async (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

const isMapId = (value: string): value is MapId => value === 'overworld' || value === 'hubWorld';

const createMapDocument = (id: MapId, width: number, height: number): EditorMapDocument => ({
  version: 2,
  id,
  width,
  height,
  cells: Array.from({ length: width * height }, () => ({
    height: 2,
    materials: ['stone', 'grass']
  })),
  teleports: [],
  objects: []
});

const getDefaultMaterials = (mapId: MapId, height: number): MaterialKey[] => {
  const topMaterial: MaterialKey = mapId === 'hubWorld' ? 'moss' : 'grass';
  if (height <= 1) {
    return [topMaterial];
  }
  return [...Array.from({ length: height - 1 }, () => 'stone' as MaterialKey), topMaterial];
};

const getCellSafe = (x: number, y: number): EditorCell | null => {
  if (x < 0 || y < 0 || x >= documentModel.width || y >= documentModel.height) {
    return null;
  }
  return documentModel.cells[y * documentModel.width + x] ?? null;
};

const getRuntimeTeleportTarget = (mapId: MapId): Pick<EditorTeleport, 'targetMapId' | 'targetX' | 'targetY'> => {
  if (mapId === 'overworld') {
    return {
      targetMapId: 'hubWorld',
      targetX: HUB_WORLD_SPAWN.x,
      targetY: HUB_WORLD_SPAWN.y
    };
  }

  return {
    targetMapId: 'overworld',
    targetX: OVERWORLD_TELEPORT_TILE.x + 0.5,
    targetY: OVERWORLD_TELEPORT_TILE.y + 0.5
  };
};

const createEditorObjectFromActor = (actor: NetworkActorState): EditorObject => ({
  id: actor.id,
  type: actor.kind,
  x: actor.x,
  y: actor.y,
  variant: actor.variant ?? 0,
  direction: actor.facing ?? 4,
  displayName: actor.displayName
});

const createDocumentFromGeneratedMap = (
  map: GeneratedMap,
  actors: readonly NetworkActorState[]
): EditorMapDocument => {
  const cells = map.heights.map((height) => ({
    height,
    materials: getDefaultMaterials(map.id, height)
  }));

  const teleports = map.teleports.map((teleportTile) => {
    const target = getRuntimeTeleportTarget(map.id);
    const cell = cells[teleportTile.y * map.width + teleportTile.x];
    if (cell) {
      cell.materials[cell.materials.length - 1] = 'portal';
    }
    return {
      x: teleportTile.x,
      y: teleportTile.y,
      ...target
    };
  });

  return {
    version: 2,
    id: map.id,
    width: map.width,
    height: map.height,
    cells,
    teleports,
    objects: actors.filter((actor) => actor.mapId === map.id).map(createEditorObjectFromActor)
  };
};

const createRuntimeDocument = (mapId: MapId, seed = MAP_GENERATION_SEED): EditorMapDocument => {
  const teleportTile = seed === MAP_GENERATION_SEED
    ? OVERWORLD_TELEPORT_TILE
    : getRandomOverworldTeleportTile(seed);
  const maps = createNetworkWorldMaps(seed, teleportTile);
  const actors = createNetworkWorldActors(seed, teleportTile, new Set());
  return createDocumentFromGeneratedMap(maps[mapId], actors);
};

let documentModel = createRuntimeDocument('hubWorld');

const getIndex = (x: number, y: number): number => y * documentModel.width + x;

const getCell = (x: number, y: number): EditorCell => documentModel.cells[getIndex(x, y)];

const normalizeCell = (cell: EditorCell): void => {
  const fallback = cell.materials[cell.materials.length - 1] ?? 'grass';
  cell.height = Math.max(1, Math.round(cell.height));
  cell.materials = Array.from({ length: cell.height }, (_, index) =>
    cell.materials[index] ?? fallback
  );
};

const cloneDocument = (doc: EditorMapDocument): EditorMapDocument => ({
  version: 2,
  id: doc.id,
  width: Math.max(1, Math.round(doc.width)),
  height: Math.max(1, Math.round(doc.height)),
  cells: doc.cells.map((cell) => ({
    height: Math.max(1, Math.round(cell.height)),
    materials: [...cell.materials]
  })),
  teleports: doc.teleports.map((teleport) => ({ ...teleport })),
  objects: doc.objects.map((object) => ({ ...object }))
});

const repairDocument = (doc: EditorMapDocument): EditorMapDocument => {
  if (doc.version !== 2 || !isMapId(doc.id)) {
    throw new Error('Editor document must be version 2 and use map id overworld or hubWorld.');
  }

  const repaired = cloneDocument(doc);
  const requiredCells = repaired.width * repaired.height;

  while (repaired.cells.length < requiredCells) {
    repaired.cells.push({ height: 2, materials: ['stone', 'grass'] });
  }
  repaired.cells.length = requiredCells;

  for (const cell of repaired.cells) {
    normalizeCell(cell);
  }

  repaired.teleports = repaired.teleports.filter(
    (teleport) =>
      teleport.x >= 0 &&
      teleport.y >= 0 &&
      teleport.x < repaired.width &&
      teleport.y < repaired.height &&
      isMapId(teleport.targetMapId)
  );
  repaired.objects = repaired.objects.filter(
    (object) =>
      object.x >= 0 &&
      object.y >= 0 &&
      object.x < repaired.width &&
      object.y < repaired.height &&
      object.type in objectLabels
  );

  return repaired;
};

const savedDocument = window.localStorage.getItem(storageKey);
if (savedDocument) {
  try {
    documentModel = repairDocument(JSON.parse(savedDocument) as EditorMapDocument);
  } catch {
    window.localStorage.removeItem(storageKey);
  }
}

root.innerHTML = `
  <div class="editor-shell">
    <header class="editor-topbar">
      <div class="editor-brand">
        <strong>IsoGame Map Editor</strong>
        <span id="editor-summary"></span>
      </div>
      <div class="editor-actions">
        <button class="button" id="rotate-left-button" title="Rotate view left">Rot L</button>
        <button class="button" id="rotate-right-button" title="Rotate view right">Rot R</button>
        <button class="button" id="zoom-out-button" title="Zoom out">-</button>
        <button class="button" id="zoom-in-button" title="Zoom in">+</button>
        <button class="button primary" id="save-local-button">Save Local</button>
        <button class="button" id="export-button">Export JSON</button>
        <button class="button" id="import-button">Import JSON</button>
        <button class="button" id="import-file-button">Import File</button>
        <input class="file-input" id="import-file-input" type="file" accept="application/json,.json" />
      </div>
    </header>

    <aside class="editor-panel">
      <section class="panel-section">
        <h2>Map</h2>
        <label class="field">
          <span>Map Id</span>
          <input id="map-id-input" type="text" />
        </label>
        <div class="field-row">
          <label class="field">
            <span>Width</span>
            <input id="map-width-input" type="number" min="1" max="256" />
          </label>
          <label class="field">
            <span>Height</span>
            <input id="map-height-input" type="number" min="1" max="256" />
          </label>
        </div>
        <button class="button warn" id="new-map-button">New / Resize</button>
        <div class="preset-row">
          <button class="button" id="runtime-overworld-button">Startup Overworld</button>
          <button class="button" id="runtime-hub-button">Hub World</button>
        </div>
      </section>

      <section class="panel-section">
        <h2>Tools</h2>
        <div class="tool-grid" id="tool-grid"></div>
      </section>

      <section class="panel-section">
        <h2>Tile Brush</h2>
        <label class="field">
          <span>Height</span>
          <input id="height-input" type="number" min="1" max="12" />
        </label>
        <div class="material-grid" id="material-grid"></div>
      </section>

      <section class="panel-section">
        <h2>Objects</h2>
        <div class="object-grid" id="object-grid"></div>
        <div class="field-row" style="margin-top: 10px">
          <label class="field">
            <span>Variant</span>
            <input id="variant-input" type="number" min="0" max="99" />
          </label>
          <label class="field">
            <span>Direction</span>
            <input id="direction-input" type="number" min="0" max="7" />
          </label>
        </div>
        <label class="field">
          <span>Name / Label</span>
          <input id="object-label-input" type="text" placeholder="Optional actor label" />
        </label>
      </section>

      <section class="panel-section">
        <h2>Teleport Brush</h2>
        <label class="field">
          <span>Target Map</span>
          <input id="target-map-input" type="text" value="overworld" />
        </label>
        <div class="field-row">
          <label class="field">
            <span>Target X</span>
            <input id="target-x-input" type="number" step="0.5" value="12.5" />
          </label>
          <label class="field">
            <span>Target Y</span>
            <input id="target-y-input" type="number" step="0.5" value="12.5" />
          </label>
        </div>
      </section>
    </aside>

    <main class="viewport-wrap">
      <canvas class="editor-canvas" id="editor-canvas"></canvas>
      <div class="viewport-hud">
        <span class="viewport-pill" id="tile-readout">Tile --</span>
        <span class="viewport-pill" id="view-readout">View N-up</span>
        <span class="viewport-pill">Middle drag pans</span>
      </div>
    </main>

    <aside class="editor-panel right">
      <section class="panel-section">
        <h2>Objects On Map</h2>
        <ul class="object-list" id="object-list"></ul>
      </section>
      <section class="panel-section">
        <h2>Document JSON</h2>
        <label class="field">
          <span>Export / Import Buffer</span>
          <textarea id="json-buffer"></textarea>
        </label>
      </section>
    </aside>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#editor-canvas');
const summary = document.querySelector<HTMLSpanElement>('#editor-summary');
const toolGrid = document.querySelector<HTMLDivElement>('#tool-grid');
const materialGrid = document.querySelector<HTMLDivElement>('#material-grid');
const objectGrid = document.querySelector<HTMLDivElement>('#object-grid');
const objectList = document.querySelector<HTMLUListElement>('#object-list');
const tileReadout = document.querySelector<HTMLSpanElement>('#tile-readout');
const viewReadout = document.querySelector<HTMLSpanElement>('#view-readout');
const jsonBuffer = document.querySelector<HTMLTextAreaElement>('#json-buffer');
const mapIdInput = document.querySelector<HTMLInputElement>('#map-id-input');
const mapWidthInput = document.querySelector<HTMLInputElement>('#map-width-input');
const mapHeightInput = document.querySelector<HTMLInputElement>('#map-height-input');
const heightInput = document.querySelector<HTMLInputElement>('#height-input');
const variantInput = document.querySelector<HTMLInputElement>('#variant-input');
const directionInput = document.querySelector<HTMLInputElement>('#direction-input');
const objectLabelInput = document.querySelector<HTMLInputElement>('#object-label-input');
const targetMapInput = document.querySelector<HTMLInputElement>('#target-map-input');
const targetXInput = document.querySelector<HTMLInputElement>('#target-x-input');
const targetYInput = document.querySelector<HTMLInputElement>('#target-y-input');
const importFileInput = document.querySelector<HTMLInputElement>('#import-file-input');

if (
  !canvas ||
  !summary ||
  !toolGrid ||
  !materialGrid ||
  !objectGrid ||
  !objectList ||
  !tileReadout ||
  !viewReadout ||
  !jsonBuffer ||
  !mapIdInput ||
  !mapWidthInput ||
  !mapHeightInput ||
  !heightInput ||
  !variantInput ||
  !directionInput ||
  !objectLabelInput ||
  !targetMapInput ||
  !targetXInput ||
  !targetYInput ||
  !importFileInput
) {
  throw new Error('Expected editor controls.');
}

const context = canvas.getContext('2d');

if (!context) {
  throw new Error('Expected 2D canvas context.');
}

const [charactersImage, flowersImage] = await Promise.all([
  loadImage(charactersUrl),
  loadImage(flowersUrl)
]);

const getBasis = (): { top: Vec2; right: Vec2 } => {
  const cardinalVectors: Vec2[] = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 }
  ];

  return {
    top: cardinalVectors[viewRotation % 4],
    right: cardinalVectors[(viewRotation + 1) % 4]
  };
};

const mapToScreen = (x: number, y: number, z = 0): Vec2 => {
  const basis = getBasis();
  const lateral = x * basis.right.x + y * basis.right.y;
  const depth = x * basis.top.x + y * basis.top.y;

  return {
    x: canvas.width * 0.5 + pan.x + lateral * tileWidth * 0.5 * zoom,
    y: canvas.height * 0.5 + pan.y + depth * tileHeight * 0.5 * zoom - z * heightStep * zoom
  };
};

const pointInPolygon = (point: Vec2, polygon: Vec2[]): boolean => {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
};

const getTileAtPoint = (point: Vec2): Vec2 | null => {
  for (let index = tileHits.length - 1; index >= 0; index -= 1) {
    const hit = tileHits[index];
    if (pointInPolygon(point, hit.points)) {
      return { x: hit.x, y: hit.y };
    }
  }

  return null;
};

const shadeColor = (hex: string, amount: number): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((value >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
};

const drawPolygon = (points: Vec2[], fill: string, stroke = '#1a211f'): void => {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = Math.max(1, zoom);
  context.stroke();
};

const drawCell = (x: number, y: number): void => {
  const cell = getCell(x, y);
  const topMaterial = cell.materials[cell.materials.length - 1] ?? 'grass';
  const color = materialColors[topMaterial];
  const corners = [
    mapToScreen(x, y, cell.height),
    mapToScreen(x + 1, y, cell.height),
    mapToScreen(x + 1, y + 1, cell.height),
    mapToScreen(x, y + 1, cell.height)
  ];
  const lowerCorners = [
    mapToScreen(x, y, 0),
    mapToScreen(x + 1, y, 0),
    mapToScreen(x + 1, y + 1, 0),
    mapToScreen(x, y + 1, 0)
  ];

  const sideA = [corners[1], lowerCorners[1], lowerCorners[2], corners[2]];
  const sideB = [corners[2], lowerCorners[2], lowerCorners[3], corners[3]];

  drawPolygon(sideA, shadeColor(color, -46), '#202826');
  drawPolygon(sideB, shadeColor(color, -62), '#202826');
  drawPolygon(corners, color, topMaterial === 'portal' ? '#e1fbff' : '#29312e');

  if (pointerTile?.x === x && pointerTile.y === y) {
    drawPolygon(corners, 'rgba(255, 255, 255, 0.16)', '#f3f7f0');
  }

  tileHits.push({ x, y, points: corners });
};

const drawCharacterObject = (object: EditorObject, screen: Vec2): void => {
  const frameWidth = 16;
  const frameHeight = 24;
  const direction = Math.max(0, Math.min(7, object.direction));
  context.drawImage(
    charactersImage,
    direction * frameWidth,
    frameHeight,
    frameWidth,
    frameHeight,
    screen.x - 11 * zoom,
    screen.y - 31 * zoom,
    22 * zoom,
    32 * zoom
  );
};

const drawFlowerObject = (object: EditorObject, screen: Vec2): void => {
  const columns = 6;
  const rows = 2;
  const frameWidth = Math.floor(flowersImage.width / columns);
  const frameHeight = Math.floor(flowersImage.height / rows);
  const variant = ((object.variant % (columns * rows)) + columns * rows) % (columns * rows);

  context.drawImage(
    flowersImage,
    (variant % columns) * frameWidth,
    Math.floor(variant / columns) * frameHeight,
    frameWidth,
    frameHeight,
    screen.x - 14 * zoom,
    screen.y - 28 * zoom,
    28 * zoom,
    28 * zoom
  );
};

const drawCrystalObject = (screen: Vec2): void => {
  context.beginPath();
  context.moveTo(screen.x, screen.y - 28 * zoom);
  context.lineTo(screen.x + 9 * zoom, screen.y - 15 * zoom);
  context.lineTo(screen.x, screen.y - 2 * zoom);
  context.lineTo(screen.x - 9 * zoom, screen.y - 15 * zoom);
  context.closePath();
  context.fillStyle = '#77e6ff';
  context.fill();
  context.strokeStyle = '#163c52';
  context.lineWidth = Math.max(1, zoom);
  context.stroke();
};

const drawTriggerObject = (screen: Vec2): void => {
  context.save();
  context.strokeStyle = '#ffd166';
  context.fillStyle = 'rgba(255, 209, 102, 0.18)';
  context.lineWidth = Math.max(2, 2 * zoom);
  context.beginPath();
  context.ellipse(screen.x, screen.y - 8 * zoom, 17 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
};

const drawObjectLabel = (object: EditorObject, screen: Vec2): void => {
  if (!object.displayName) {
    return;
  }

  context.font = `${Math.max(10, 11 * zoom)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.lineWidth = Math.max(2, 3 * zoom);
  context.strokeStyle = 'rgba(4, 9, 8, 0.9)';
  context.fillStyle = '#f4f8f2';
  context.strokeText(object.displayName, screen.x, screen.y - 36 * zoom);
  context.fillText(object.displayName, screen.x, screen.y - 36 * zoom);
};

const drawPlacedObject = (object: EditorObject): void => {
  const tileX = Math.floor(object.x);
  const tileY = Math.floor(object.y);
  const cell = getCellSafe(tileX, tileY);
  if (!cell) {
    return;
  }

  const screen = mapToScreen(object.x, object.y, cell.height);

  if (
    object.type === 'npc-mobile' ||
    object.type === 'npc-stationary' ||
    object.type === 'npc-sturdy'
  ) {
    drawCharacterObject(object, screen);
  } else if (object.type === 'flower') {
    drawFlowerObject(object, screen);
  } else if (object.type === 'crystal') {
    drawCrystalObject(screen);
  } else if (object.type === 'trigger') {
    drawTriggerObject(screen);
  } else {
    return;
  }

  drawObjectLabel(object, screen);

  context.fillStyle = object.type === 'npc-stationary'
    ? '#ff7979'
    : object.type === 'npc-sturdy'
      ? '#c7a6ff'
      : object.type === 'trigger'
        ? '#ffd166'
        : object.type === 'crystal'
          ? '#77e6ff'
          : '#74a9ff';
  context.fillRect(screen.x - 3 * zoom, screen.y - 3 * zoom, 6 * zoom, 6 * zoom);
};

const drawTeleportLabels = (): void => {
  for (const teleport of documentModel.teleports) {
    const cell = getCell(teleport.x, teleport.y);
    const screen = mapToScreen(teleport.x + 0.5, teleport.y + 0.5, cell.height);
    context.fillStyle = '#07100f';
    context.strokeStyle = '#e1fbff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(screen.x, screen.y - 7 * zoom, 10 * zoom, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#e1fbff';
    context.font = `${Math.max(10, 11 * zoom)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('T', screen.x, screen.y - 7 * zoom);
  }
};

const render = (): void => {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(bounds.width * ratio));
  const height = Math.max(1, Math.floor(bounds.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  tileHits = [];

  const cells = [];
  const basis = getBasis();
  for (let y = 0; y < documentModel.height; y += 1) {
    for (let x = 0; x < documentModel.width; x += 1) {
      cells.push({ x, y, depth: (x + 0.5) * basis.top.x + (y + 0.5) * basis.top.y });
    }
  }
  cells.sort((a, b) => a.depth - b.depth);

  for (const cell of cells) {
    drawCell(cell.x, cell.y);
  }

  const objects = [...documentModel.objects].sort(
    (a, b) => (a.x + 0.5) * basis.top.x + (a.y + 0.5) * basis.top.y - ((b.x + 0.5) * basis.top.x + (b.y + 0.5) * basis.top.y)
  );
  for (const object of objects) {
    drawPlacedObject(object);
  }
  drawTeleportLabels();
  context.restore();

  if (summary) {
    summary.textContent = `${documentModel.id} - ${documentModel.width}x${documentModel.height} - ${documentModel.objects.length} objects`;
  }
  viewReadout.textContent = `View ${viewNames[viewRotation]}-up`;
  tileReadout.textContent = pointerTile ? `Tile ${pointerTile.x}, ${pointerTile.y}` : 'Tile --';
};

const updateJsonBuffer = (): void => {
  jsonBuffer.value = JSON.stringify(documentModel, null, 2);
};

const saveLocal = (): void => {
  window.localStorage.setItem(storageKey, JSON.stringify(documentModel));
};

const refreshObjectList = (): void => {
  objectList.innerHTML = '';

  for (const object of documentModel.objects) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const name = object.displayName ? ` - ${object.displayName}` : '';
    label.textContent = `${objectLabels[object.type]} ${object.x.toFixed(1)},${object.y.toFixed(1)}${name}`;
    const removeButton = document.createElement('button');
    removeButton.textContent = 'x';
    removeButton.title = 'Remove object';
    removeButton.addEventListener('click', () => {
      documentModel.objects = documentModel.objects.filter((candidate) => candidate.id !== object.id);
      updateJsonBuffer();
      refreshObjectList();
      render();
    });
    item.append(label, removeButton);
    objectList.appendChild(item);
  }
};

const syncControls = (): void => {
  mapIdInput.value = documentModel.id;
  mapWidthInput.value = String(documentModel.width);
  mapHeightInput.value = String(documentModel.height);
  heightInput.value = String(selectedHeight);
  variantInput.value = String(selectedVariant);
  directionInput.value = String(selectedDirection);
  objectLabelInput.value = selectedDisplayName;
  updateJsonBuffer();
  refreshObjectList();
  render();
};

const setDocument = (doc: EditorMapDocument): void => {
  documentModel = repairDocument(doc);
  pan = { x: 0, y: 0 };
  pointerTile = null;
  syncControls();
};

const applyTileEdit = (tile: Vec2): void => {
  const cell = getCell(tile.x, tile.y);

  if (selectedTool === 'tile') {
    normalizeCell(cell);
    cell.materials[cell.materials.length - 1] = selectedMaterial;
  } else if (selectedTool === 'height') {
    cell.height = selectedHeight;
    normalizeCell(cell);
  } else if (selectedTool === 'teleport') {
    cell.height = Math.max(1, cell.height);
    normalizeCell(cell);
    cell.materials[cell.materials.length - 1] = 'portal';
    const existing = documentModel.teleports.find(
      (teleport) => teleport.x === tile.x && teleport.y === tile.y
    );
    const targetMapIdInput = targetMapInput.value.trim();
    const nextTeleport = {
      x: tile.x,
      y: tile.y,
      targetMapId: isMapId(targetMapIdInput) ? targetMapIdInput : 'overworld',
      targetX: Number(targetXInput.value) || 0,
      targetY: Number(targetYInput.value) || 0
    } satisfies EditorTeleport;

    if (existing) {
      Object.assign(existing, nextTeleport);
    } else {
      documentModel.teleports.push(nextTeleport);
    }
  } else if (selectedTool === 'object') {
    const objectX = tile.x + 0.5;
    const objectY = tile.y + 0.5;
    const objectLabel = selectedDisplayName.trim() || null;
    documentModel.objects = documentModel.objects.filter(
      (object) =>
        !(
          Math.floor(object.x) === tile.x &&
          Math.floor(object.y) === tile.y &&
          object.type === selectedObjectType
        )
    );
    documentModel.objects.push({
      id: `${selectedObjectType}-${tile.x}-${tile.y}-${Date.now()}`,
      type: selectedObjectType,
      x: objectX,
      y: objectY,
      variant: selectedVariant,
      direction: selectedDirection,
      displayName: objectLabel
    });
  } else if (selectedTool === 'erase') {
    documentModel.objects = documentModel.objects.filter(
      (object) => Math.floor(object.x) !== tile.x || Math.floor(object.y) !== tile.y
    );
    documentModel.teleports = documentModel.teleports.filter(
      (teleport) => teleport.x !== tile.x || teleport.y !== tile.y
    );
    if ((cell.materials[cell.materials.length - 1] ?? 'grass') === 'portal') {
      cell.materials[cell.materials.length - 1] = 'grass';
    }
  }

  saveLocal();
  updateJsonBuffer();
  refreshObjectList();
  render();
};

const makeButton = (label: string, className: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const refreshToolButtons = (): void => {
  toolGrid.innerHTML = '';
  const tools: Array<[EditorTool, string]> = [
    ['tile', 'Tile'],
    ['height', 'Height'],
    ['teleport', 'Teleport'],
    ['object', 'Object'],
    ['erase', 'Erase']
  ];

  for (const [tool, label] of tools) {
    const button = makeButton(label, `tool-button ${selectedTool === tool ? 'active' : ''}`, () => {
      selectedTool = tool;
      refreshToolButtons();
    });
    toolGrid.appendChild(button);
  }
};

const refreshMaterialButtons = (): void => {
  materialGrid.innerHTML = '';

  for (const material of materials) {
    const button = makeButton('', `material-button ${selectedMaterial === material ? 'active' : ''}`, () => {
      selectedMaterial = material;
      selectedTool = 'tile';
      refreshToolButtons();
      refreshMaterialButtons();
    });
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = materialColors[material];
    const label = document.createElement('span');
    label.textContent = materialLabels[material];
    button.append(swatch, label);
    materialGrid.appendChild(button);
  }
};

const refreshObjectButtons = (): void => {
  objectGrid.innerHTML = '';

  for (const objectType of objectTypes) {
    const button = makeButton(
      objectLabels[objectType],
      `object-button ${selectedObjectType === objectType ? 'active' : ''}`,
      () => {
        selectedObjectType = objectType;
        selectedTool = 'object';
        refreshToolButtons();
        refreshObjectButtons();
      }
    );
    objectGrid.appendChild(button);
  }
};

const getCanvasPoint = (event: PointerEvent): Vec2 => {
  const rect = canvas.getBoundingClientRect();
  const ratioX = canvas.width / Math.max(rect.width, 1);
  const ratioY = canvas.height / Math.max(rect.height, 1);

  return {
    x: (event.clientX - rect.left) * ratioX,
    y: (event.clientY - rect.top) * ratioY
  };
};

canvas.addEventListener('pointerdown', (event) => {
  const point = getCanvasPoint(event);
  lastPointer = point;

  if (event.button === 1 || event.button === 2 || event.altKey) {
    panning = true;
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  const tile = getTileAtPoint(point);
  if (!tile) {
    return;
  }

  painting = true;
  pointerTile = tile;
  canvas.setPointerCapture(event.pointerId);
  applyTileEdit(tile);
});

canvas.addEventListener('pointermove', (event) => {
  const point = getCanvasPoint(event);

  if (panning) {
    pan.x += point.x - lastPointer.x;
    pan.y += point.y - lastPointer.y;
    lastPointer = point;
    render();
    return;
  }

  const tile = getTileAtPoint(point);
  pointerTile = tile;

  if (painting && tile && selectedTool !== 'object' && selectedTool !== 'teleport') {
    applyTileEdit(tile);
  } else {
    render();
  }
});

canvas.addEventListener('pointerup', (event) => {
  painting = false;
  panning = false;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener('pointercancel', (event) => {
  painting = false;
  panning = false;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

heightInput.addEventListener('input', () => {
  selectedHeight = Math.max(1, Math.min(12, Math.round(Number(heightInput.value) || 1)));
});

variantInput.addEventListener('input', () => {
  selectedVariant = Math.max(0, Math.round(Number(variantInput.value) || 0));
});

directionInput.addEventListener('input', () => {
  selectedDirection = Math.max(0, Math.min(7, Math.round(Number(directionInput.value) || 0)));
});

objectLabelInput.addEventListener('input', () => {
  selectedDisplayName = objectLabelInput.value;
});

mapIdInput.addEventListener('change', () => {
  const nextMapId = mapIdInput.value.trim();
  if (isMapId(nextMapId)) {
    documentModel.id = nextMapId;
  } else {
    mapIdInput.value = documentModel.id;
  }
  saveLocal();
  syncControls();
});

document.querySelector<HTMLButtonElement>('#new-map-button')?.addEventListener('click', () => {
  const width = Math.max(1, Math.min(256, Math.round(Number(mapWidthInput.value) || 30)));
  const height = Math.max(1, Math.min(256, Math.round(Number(mapHeightInput.value) || 30)));
  const mapIdValue = mapIdInput.value.trim();
  const nextMapId = isMapId(mapIdValue) ? mapIdValue : documentModel.id;
  setDocument(createMapDocument(nextMapId, width, height));
  saveLocal();
});

document.querySelector<HTMLButtonElement>('#runtime-overworld-button')?.addEventListener('click', () => {
  setDocument(createRuntimeDocument('overworld'));
  saveLocal();
});

document.querySelector<HTMLButtonElement>('#runtime-hub-button')?.addEventListener('click', () => {
  setDocument(createRuntimeDocument('hubWorld'));
  saveLocal();
});

document.querySelector<HTMLButtonElement>('#rotate-left-button')?.addEventListener('click', () => {
  viewRotation = (viewRotation + 3) % 4;
  render();
});

document.querySelector<HTMLButtonElement>('#rotate-right-button')?.addEventListener('click', () => {
  viewRotation = (viewRotation + 1) % 4;
  render();
});

document.querySelector<HTMLButtonElement>('#zoom-in-button')?.addEventListener('click', () => {
  zoom = Math.min(2.2, zoom + 0.15);
  render();
});

document.querySelector<HTMLButtonElement>('#zoom-out-button')?.addEventListener('click', () => {
  zoom = Math.max(0.45, zoom - 0.15);
  render();
});

document.querySelector<HTMLButtonElement>('#save-local-button')?.addEventListener('click', () => {
  saveLocal();
  updateJsonBuffer();
});

document.querySelector<HTMLButtonElement>('#export-button')?.addEventListener('click', async () => {
  updateJsonBuffer();
  await navigator.clipboard?.writeText(jsonBuffer.value).catch(() => undefined);
});

document.querySelector<HTMLButtonElement>('#import-button')?.addEventListener('click', () => {
  try {
    const parsed = JSON.parse(jsonBuffer.value) as EditorMapDocument;
    setDocument(parsed);
    saveLocal();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Failed to import JSON.');
  }
});

document.querySelector<HTMLButtonElement>('#import-file-button')?.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as EditorMapDocument;
    setDocument(parsed);
    saveLocal();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Failed to import file.');
  } finally {
    importFileInput.value = '';
  }
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Tab') {
    event.preventDefault();
    viewRotation = (viewRotation + (event.shiftKey ? 3 : 1)) % 4;
    render();
  }
});

refreshToolButtons();
refreshMaterialButtons();
refreshObjectButtons();
syncControls();
window.addEventListener('resize', render);
