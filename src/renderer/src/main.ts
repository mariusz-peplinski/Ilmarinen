import './style.css';
import { ThreeIsoGame } from './three-game';
import charactersUrl from '../../../characters.png?url';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Expected #app root element.');
}

const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
  <h1>Iso Prototype</h1>
  <p>
    <strong>Move:</strong> WASD or arrows<br />
    <strong>Jump:</strong> Space<br />
    <strong>Rotate View:</strong> Tab / Shift+Tab<br />
    We are now in the Three.js migration pass: real 3D terrain, an orthographic camera, and billboard actor sprites.
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

const loadImage = async (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

const charactersImage = await loadImage(charactersUrl);

new ThreeIsoGame(root, hudStatus, compass, charactersImage);
