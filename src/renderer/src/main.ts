import './style.css';
import { Application, Assets, SCALE_MODES, Texture } from 'pixi.js';
import { IsoGame } from './game';
import tilesetUrl from '../../../new-tileset.png?url';
import charactersUrl from '../../../characters.png?url';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Expected #app root element.');
}

const app = new Application({
  resizeTo: window,
  antialias: false,
  backgroundAlpha: 0
});

root.appendChild(app.view as HTMLCanvasElement);

const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
  <h1>Iso Prototype</h1>
  <p>
    <strong>Move:</strong> WASD or arrows<br />
    <strong>Jump:</strong> Space<br />
    Free movement, terrain collision, steerable jumps, z-aware occlusion, and a follow camera are all active in this build.
  </p>
  <div class="hud-status" id="hud-status"></div>
`;
root.appendChild(hud);

const hudStatus = hud.querySelector<HTMLDivElement>('#hud-status');

if (!hudStatus) {
  throw new Error('Expected HUD status element.');
}

const compass = document.createElement('div');
compass.className = 'compass';
compass.innerHTML = `
  <span class="compass-label compass-top" data-slot="top">N</span>
  <span class="compass-label compass-right" data-slot="right">E</span>
  <span class="compass-label compass-bottom" data-slot="bottom">S</span>
  <span class="compass-label compass-left" data-slot="left">W</span>
`;
root.appendChild(compass);

const offsetPanel = document.createElement('div');
offsetPanel.className = 'offset-panel';
offsetPanel.innerHTML = `
  <h2>Terrain Offset</h2>
  <div class="offset-status" id="terrain-offset-status"></div>
  <div class="offset-grid">
    <button type="button" data-offset="NW">NW</button>
    <button type="button" data-offset="N">N</button>
    <button type="button" data-offset="NE">NE</button>
    <button type="button" data-offset="W">W</button>
    <button type="button" data-offset="RESET">Reset</button>
    <button type="button" data-offset="E">E</button>
    <button type="button" data-offset="SW">SW</button>
    <button type="button" data-offset="S">S</button>
    <button type="button" data-offset="SE">SE</button>
  </div>
`;
root.appendChild(offsetPanel);

const terrainOffsetStatus = offsetPanel.querySelector<HTMLDivElement>('#terrain-offset-status');

if (!terrainOffsetStatus) {
  throw new Error('Expected terrain offset status element.');
}

const tilesetTexture = await Assets.load<Texture>(tilesetUrl);
tilesetTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
const charactersTexture = await Assets.load<Texture>(charactersUrl);
charactersTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

const game = new IsoGame(
  app,
  hudStatus,
  compass,
  terrainOffsetStatus,
  tilesetTexture.baseTexture,
  charactersTexture.baseTexture
);

for (const button of offsetPanel.querySelectorAll<HTMLButtonElement>('[data-offset]')) {
  button.addEventListener('click', () => {
    const direction = button.dataset.offset;
    if (direction) {
      game.nudgeTerrainOffset(direction);
    }
  });
}
