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
  antialias: true,
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

const tilesetTexture = await Assets.load<Texture>(tilesetUrl);
tilesetTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
const charactersTexture = await Assets.load<Texture>(charactersUrl);
charactersTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

new IsoGame(app, hudStatus, tilesetTexture.baseTexture, charactersTexture.baseTexture);
