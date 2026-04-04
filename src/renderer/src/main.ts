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
    <strong>Debug Free Camera:</strong> \` (toggle), then drag with left mouse<br />
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

const fpsCounter = document.createElement('div');
fpsCounter.className = 'fps-counter';
fpsCounter.textContent = 'FPS --';
root.appendChild(fpsCounter);

const lightingPanel = document.createElement('div');
lightingPanel.className = 'lighting-panel';
lightingPanel.innerHTML = `
  <h2>Lighting Debug</h2>
  <label class="debug-control">
    <span>Ambient <output id="ambient-value"></output></span>
    <input id="ambient-slider" type="range" min="0" max="3" step="0.05" />
  </label>
  <label class="debug-control">
    <span>Sun <output id="sun-value"></output></span>
    <input id="sun-slider" type="range" min="0" max="3" step="0.05" />
  </label>
  <label class="debug-control">
    <span>Sun Angle <output id="sun-angle-value"></output></span>
    <input id="sun-angle-slider" type="range" min="0" max="360" step="1" />
  </label>
  <label class="debug-control">
    <span>Sun Elevation <output id="sun-elevation-value"></output></span>
    <input id="sun-elevation-slider" type="range" min="15" max="85" step="1" />
  </label>
  <label class="debug-control">
    <span>Height Tint <output id="height-tint-value"></output></span>
    <input id="height-tint-slider" type="range" min="0" max="1" step="0.02" />
  </label>
  <label class="debug-toggle">
    <input id="shadow-toggle" type="checkbox" />
    <span>Terrain shadows</span>
  </label>
  <label class="debug-control">
    <span>Shadow Quality <output id="shadow-quality-value"></output></span>
    <input id="shadow-quality-slider" type="range" min="256" max="4096" step="256" />
  </label>
`;
root.appendChild(lightingPanel);

const loadImage = async (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });

const charactersImage = await loadImage(charactersUrl);
const game = new ThreeIsoGame(root, hudStatus, compass, charactersImage);

let fpsFrames = 0;
let fpsWindowStart = performance.now();
const updateFpsCounter = (now: number): void => {
  fpsFrames += 1;
  const elapsed = now - fpsWindowStart;

  if (elapsed >= 250) {
    const fps = (fpsFrames * 1000) / elapsed;
    fpsCounter.textContent = `FPS ${fps.toFixed(fps >= 100 ? 0 : 1)}`;
    fpsFrames = 0;
    fpsWindowStart = now;
  }

  window.requestAnimationFrame(updateFpsCounter);
};

window.requestAnimationFrame(updateFpsCounter);

const ambientSlider = lightingPanel.querySelector<HTMLInputElement>('#ambient-slider');
const sunSlider = lightingPanel.querySelector<HTMLInputElement>('#sun-slider');
const sunAngleSlider = lightingPanel.querySelector<HTMLInputElement>('#sun-angle-slider');
const sunElevationSlider = lightingPanel.querySelector<HTMLInputElement>('#sun-elevation-slider');
const heightTintSlider = lightingPanel.querySelector<HTMLInputElement>('#height-tint-slider');
const shadowToggle = lightingPanel.querySelector<HTMLInputElement>('#shadow-toggle');
const shadowQualitySlider = lightingPanel.querySelector<HTMLInputElement>('#shadow-quality-slider');
const ambientValue = lightingPanel.querySelector<HTMLOutputElement>('#ambient-value');
const sunValue = lightingPanel.querySelector<HTMLOutputElement>('#sun-value');
const sunAngleValue = lightingPanel.querySelector<HTMLOutputElement>('#sun-angle-value');
const sunElevationValue = lightingPanel.querySelector<HTMLOutputElement>('#sun-elevation-value');
const heightTintValue = lightingPanel.querySelector<HTMLOutputElement>('#height-tint-value');
const shadowQualityValue = lightingPanel.querySelector<HTMLOutputElement>('#shadow-quality-value');

if (
  !ambientSlider ||
  !sunSlider ||
  !sunAngleSlider ||
  !sunElevationSlider ||
  !heightTintSlider ||
  !shadowToggle ||
  !shadowQualitySlider ||
  !ambientValue ||
  !sunValue ||
  !sunAngleValue ||
  !sunElevationValue ||
  !heightTintValue ||
  !shadowQualityValue
) {
  throw new Error('Expected lighting debug controls.');
}

const syncLightingUi = (): void => {
  const lighting = game.getDebugLighting();
  ambientSlider.value = lighting.ambientIntensity.toFixed(2);
  sunSlider.value = lighting.sunIntensity.toFixed(2);
  sunAngleSlider.value = lighting.sunAngleDegrees.toFixed(0);
  sunElevationSlider.value = lighting.sunElevationDegrees.toFixed(0);
  heightTintSlider.value = lighting.heightTintStrength.toFixed(2);
  shadowToggle.checked = lighting.shadowsEnabled;
  shadowQualitySlider.value = lighting.shadowQuality.toFixed(0);
  ambientValue.textContent = lighting.ambientIntensity.toFixed(2);
  sunValue.textContent = lighting.sunIntensity.toFixed(2);
  sunAngleValue.textContent = `${lighting.sunAngleDegrees.toFixed(0)}deg`;
  sunElevationValue.textContent = `${lighting.sunElevationDegrees.toFixed(0)}deg`;
  heightTintValue.textContent = lighting.heightTintStrength.toFixed(2);
  shadowQualityValue.textContent = lighting.shadowQuality.toFixed(0);
};

ambientSlider.addEventListener('input', () => {
  game.setDebugAmbientIntensity(Number(ambientSlider.value));
  syncLightingUi();
});

sunSlider.addEventListener('input', () => {
  game.setDebugSunIntensity(Number(sunSlider.value));
  syncLightingUi();
});

sunAngleSlider.addEventListener('input', () => {
  game.setDebugSunAngleDegrees(Number(sunAngleSlider.value));
  syncLightingUi();
});

sunElevationSlider.addEventListener('input', () => {
  game.setDebugSunElevationDegrees(Number(sunElevationSlider.value));
  syncLightingUi();
});

heightTintSlider.addEventListener('input', () => {
  game.setDebugHeightTintStrength(Number(heightTintSlider.value));
  syncLightingUi();
});

shadowToggle.addEventListener('change', () => {
  game.setDebugShadowsEnabled(shadowToggle.checked);
  syncLightingUi();
});

shadowQualitySlider.addEventListener('input', () => {
  game.setDebugShadowQuality(Number(shadowQualitySlider.value));
  syncLightingUi();
});

syncLightingUi();
