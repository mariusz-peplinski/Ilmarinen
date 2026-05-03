import './style.css';
import { ThreeIsoGame } from './three-game';
import { NetworkClient } from './network/network-client';
import charactersUrl from '../../../characters.png?url';
import flowersUrl from '../../../Flowers/Flowers_With_Outline_Spritesheet.png?url';
import crystalSheetUrl from '../../../16x16 Assorted RPG Icons/16x16 Assorted RPG Icons/pixelquest16-july-2025-cave.png?url';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Expected #app root element.');
}

const hud = document.createElement('div');
hud.className = 'hud hud-hidden';
hud.innerHTML = `
  <h1>Iso Prototype</h1>
  <p>
    <strong>Move:</strong> WASD or arrows<br />
    <strong>Jump:</strong> Space<br />
    <strong>Attack:</strong> Click or tap Shift<br />
    <strong>Interact:</strong> E<br />
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

const networkPanel = document.createElement('div');
networkPanel.className = 'network-panel';
networkPanel.innerHTML = `
  <h2>Multiplayer</h2>
  <label class="network-field">
    <span>Server</span>
    <input id="network-url" type="text" value="ws://localhost:8787" spellcheck="false" />
  </label>
  <label class="network-field">
    <span>Name</span>
    <input id="network-name" type="text" value="Player" maxlength="24" spellcheck="false" />
  </label>
  <button id="network-toggle" type="button">Connect</button>
  <div id="network-status" class="network-status">Offline</div>
`;
root.appendChild(networkPanel);

const lightingPanel = document.createElement('div');
lightingPanel.className = 'lighting-panel hud-hidden';
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
  <label class="debug-control">
    <span>Edge Darken <output id="top-edge-brightness-value"></output></span>
    <input id="top-edge-brightness-slider" type="range" min="0.3" max="1" step="0.02" />
  </label>
  <label class="debug-control">
    <span>Edge Width <output id="top-edge-width-value"></output></span>
    <input id="top-edge-width-slider" type="range" min="0.04" max="0.4" step="0.01" />
  </label>
  <label class="debug-toggle">
    <input id="top-edge-lighten-toggle" type="checkbox" />
    <span>Edge lighten</span>
  </label>
  <label class="debug-toggle">
    <input id="shadow-toggle" type="checkbox" />
    <span>Terrain shadows</span>
  </label>
  <label class="debug-control">
    <span>Shadow Quality <output id="shadow-quality-value"></output></span>
    <input id="shadow-quality-slider" type="range" min="256" max="4096" step="256" />
  </label>
  <h2>Actor Occlusion Debug</h2>
  <label class="debug-control">
    <span>Proxy Width <output id="proxy-width-value"></output></span>
    <input id="proxy-width-slider" type="range" min="0.3" max="1.4" step="0.01" />
  </label>
  <label class="debug-control">
    <span>Proxy Height <output id="proxy-height-value"></output></span>
    <input id="proxy-height-slider" type="range" min="0.3" max="1.4" step="0.01" />
  </label>
  <label class="debug-control">
    <span>Sprite Bias <output id="sprite-bias-value"></output></span>
    <input id="sprite-bias-slider" type="range" min="0" max="0.1" step="0.001" />
  </label>
  <label class="debug-control">
    <span>Proxy Bias <output id="proxy-bias-value"></output></span>
    <input id="proxy-bias-slider" type="range" min="0" max="0.1" step="0.001" />
  </label>
  <label class="debug-toggle">
    <input id="attack-hurtbox-toggle" type="checkbox" />
    <span>Display Hurtbox</span>
  </label>
  <label class="debug-toggle">
    <input id="trigger-hitbox-toggle" type="checkbox" />
    <span>Display Trigger Hitboxes</span>
  </label>
  <h2>Actor Labels Debug</h2>
  <label class="debug-control">
    <span>Label Radius <output id="label-radius-value"></output></span>
    <input id="label-radius-slider" type="range" min="0" max="24" step="0.5" />
  </label>
  <label class="debug-control">
    <span>Label Font <output id="label-font-value"></output></span>
    <input id="label-font-slider" type="range" min="8" max="48" step="1" />
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

const [charactersImage, flowersImage, crystalSheetImage] = await Promise.all([
  loadImage(charactersUrl),
  loadImage(flowersUrl),
  loadImage(crystalSheetUrl)
]);
const game = new ThreeIsoGame(
  root,
  hudStatus,
  compass,
  charactersImage,
  flowersImage,
  crystalSheetImage
);

const networkUrlInput = networkPanel.querySelector<HTMLInputElement>('#network-url');
const networkNameInput = networkPanel.querySelector<HTMLInputElement>('#network-name');
const networkToggle = networkPanel.querySelector<HTMLButtonElement>('#network-toggle');
const networkStatus = networkPanel.querySelector<HTMLDivElement>('#network-status');

if (!networkUrlInput || !networkNameInput || !networkToggle || !networkStatus) {
  throw new Error('Expected multiplayer controls.');
}

const updateNetworkStatus = (text: string): void => {
  networkStatus.textContent = text;
  game.setNetworkStatusText(text);
};

const networkClient = new NetworkClient({
  onStatusChange: (status, detail) => {
    networkToggle.textContent = status === 'connected' || status === 'connecting'
      ? 'Disconnect'
      : 'Connect';
    updateNetworkStatus(detail);

    if (status === 'offline') {
      game.setLocalNetworkPlayerId(null);
      game.setRemotePlayers([]);
    }
  },
  onMessage: (message) => {
    switch (message.type) {
      case 'welcome':
        game.setLocalNetworkPlayerId(message.playerId);
        game.applyNetworkWorldState(message.world);
        game.setRemotePlayers(message.players);
        for (const actor of message.actors) {
          game.applyNetworkActorSnapshot(actor);
        }
        updateNetworkStatus(`Connected as ${message.playerId}`);
        return;
      case 'playerJoined':
        game.upsertRemotePlayer(message.player);
        return;
      case 'playerLeft':
        game.removeRemotePlayer(message.playerId);
        return;
      case 'playerSnapshot':
        game.bufferRemotePlayerSnapshot(message.player);
        return;
      case 'worldChanged':
        game.applyNetworkWorldState(message.world);
        return;
      case 'inventoryChanged':
        game.applyNetworkCrystalCount(message.crystalCount);
        return;
      case 'actorEvent':
        game.applyNetworkActorEvent(message.actorId, message.event);
        return;
      case 'attack':
        game.applyNetworkAttack(message.playerId, message.event);
        return;
      case 'interact':
        game.applyNetworkInteract(message.playerId, message.event);
        return;
      case 'screenEffect':
        game.applyNetworkScreenEffect(message.effect);
        return;
      case 'teleport':
        game.applyNetworkTeleport(message.playerId, message.mapId, message.x, message.y);
        return;
      case 'actorSnapshot':
        game.applyNetworkActorSnapshot(message.actor);
        return;
    }
  }
});

game.setNetworkEventHandlers({
  isConnected: () => networkClient.connected,
  sendAttack: (event) => networkClient.sendAttack(event),
  sendInteract: (event) => networkClient.sendInteract(event),
  sendActorTouched: (actorId, actorKind) => networkClient.sendActorTouched(actorId, actorKind),
  sendCrystalPickedUp: (actorId) => networkClient.sendCrystalPickedUp(actorId),
  sendTeleport: (targetMapId, targetX, targetY) =>
    networkClient.sendTeleport(targetMapId, targetX, targetY),
  sendRegenerateOverworld: () => networkClient.sendRegenerateOverworld()
});

let networkSeq = 0;
window.setInterval(() => {
  if (!networkClient.connected) {
    return;
  }

  networkSeq += 1;
  networkClient.sendPlayerSnapshot(game.createLocalPlayerSnapshot(networkSeq, performance.now()));
}, 50);

networkToggle.addEventListener('click', () => {
  if (networkClient.active) {
    networkClient.disconnect();
    return;
  }

  networkClient.connect(networkUrlInput.value.trim(), networkNameInput.value.trim());
});

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

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return;
  }

  if (event.code === 'Digit1') {
    hud.classList.toggle('hud-hidden');
  } else if (event.code === 'Digit2') {
    lightingPanel.classList.toggle('hud-hidden');
  }
});

const ambientSlider = lightingPanel.querySelector<HTMLInputElement>('#ambient-slider');
const sunSlider = lightingPanel.querySelector<HTMLInputElement>('#sun-slider');
const sunAngleSlider = lightingPanel.querySelector<HTMLInputElement>('#sun-angle-slider');
const sunElevationSlider = lightingPanel.querySelector<HTMLInputElement>('#sun-elevation-slider');
const heightTintSlider = lightingPanel.querySelector<HTMLInputElement>('#height-tint-slider');
const topEdgeBrightnessSlider = lightingPanel.querySelector<HTMLInputElement>('#top-edge-brightness-slider');
const topEdgeWidthSlider = lightingPanel.querySelector<HTMLInputElement>('#top-edge-width-slider');
const topEdgeLightenToggle = lightingPanel.querySelector<HTMLInputElement>('#top-edge-lighten-toggle');
const shadowToggle = lightingPanel.querySelector<HTMLInputElement>('#shadow-toggle');
const shadowQualitySlider = lightingPanel.querySelector<HTMLInputElement>('#shadow-quality-slider');
const proxyWidthSlider = lightingPanel.querySelector<HTMLInputElement>('#proxy-width-slider');
const proxyHeightSlider = lightingPanel.querySelector<HTMLInputElement>('#proxy-height-slider');
const spriteBiasSlider = lightingPanel.querySelector<HTMLInputElement>('#sprite-bias-slider');
const proxyBiasSlider = lightingPanel.querySelector<HTMLInputElement>('#proxy-bias-slider');
const attackHurtboxToggle = lightingPanel.querySelector<HTMLInputElement>('#attack-hurtbox-toggle');
const triggerHitboxToggle = lightingPanel.querySelector<HTMLInputElement>('#trigger-hitbox-toggle');
const labelRadiusSlider = lightingPanel.querySelector<HTMLInputElement>('#label-radius-slider');
const labelFontSlider = lightingPanel.querySelector<HTMLInputElement>('#label-font-slider');
const ambientValue = lightingPanel.querySelector<HTMLOutputElement>('#ambient-value');
const sunValue = lightingPanel.querySelector<HTMLOutputElement>('#sun-value');
const sunAngleValue = lightingPanel.querySelector<HTMLOutputElement>('#sun-angle-value');
const sunElevationValue = lightingPanel.querySelector<HTMLOutputElement>('#sun-elevation-value');
const heightTintValue = lightingPanel.querySelector<HTMLOutputElement>('#height-tint-value');
const topEdgeBrightnessValue = lightingPanel.querySelector<HTMLOutputElement>('#top-edge-brightness-value');
const topEdgeWidthValue = lightingPanel.querySelector<HTMLOutputElement>('#top-edge-width-value');
const shadowQualityValue = lightingPanel.querySelector<HTMLOutputElement>('#shadow-quality-value');
const proxyWidthValue = lightingPanel.querySelector<HTMLOutputElement>('#proxy-width-value');
const proxyHeightValue = lightingPanel.querySelector<HTMLOutputElement>('#proxy-height-value');
const spriteBiasValue = lightingPanel.querySelector<HTMLOutputElement>('#sprite-bias-value');
const proxyBiasValue = lightingPanel.querySelector<HTMLOutputElement>('#proxy-bias-value');
const labelRadiusValue = lightingPanel.querySelector<HTMLOutputElement>('#label-radius-value');
const labelFontValue = lightingPanel.querySelector<HTMLOutputElement>('#label-font-value');

if (
  !ambientSlider ||
  !sunSlider ||
  !sunAngleSlider ||
  !sunElevationSlider ||
  !heightTintSlider ||
  !topEdgeBrightnessSlider ||
  !topEdgeWidthSlider ||
  !topEdgeLightenToggle ||
  !shadowToggle ||
  !shadowQualitySlider ||
  !proxyWidthSlider ||
  !proxyHeightSlider ||
  !spriteBiasSlider ||
  !proxyBiasSlider ||
  !attackHurtboxToggle ||
  !triggerHitboxToggle ||
  !labelRadiusSlider ||
  !labelFontSlider ||
  !ambientValue ||
  !sunValue ||
  !sunAngleValue ||
  !sunElevationValue ||
  !heightTintValue ||
  !topEdgeBrightnessValue ||
  !topEdgeWidthValue ||
  !shadowQualityValue ||
  !proxyWidthValue ||
  !proxyHeightValue ||
  !spriteBiasValue ||
  !proxyBiasValue ||
  !labelRadiusValue ||
  !labelFontValue
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
  topEdgeBrightnessSlider.value = lighting.topEdgeBandBrightness.toFixed(2);
  topEdgeWidthSlider.value = lighting.topEdgeBandWidth.toFixed(2);
  topEdgeLightenToggle.checked = lighting.topEdgeBandLighten;
  shadowToggle.checked = lighting.shadowsEnabled;
  shadowQualitySlider.value = lighting.shadowQuality.toFixed(0);
  ambientValue.textContent = lighting.ambientIntensity.toFixed(2);
  sunValue.textContent = lighting.sunIntensity.toFixed(2);
  sunAngleValue.textContent = `${lighting.sunAngleDegrees.toFixed(0)}deg`;
  sunElevationValue.textContent = `${lighting.sunElevationDegrees.toFixed(0)}deg`;
  heightTintValue.textContent = lighting.heightTintStrength.toFixed(2);
  topEdgeBrightnessValue.textContent = lighting.topEdgeBandBrightness.toFixed(2);
  topEdgeWidthValue.textContent = lighting.topEdgeBandWidth.toFixed(2);
  shadowQualityValue.textContent = lighting.shadowQuality.toFixed(0);

  const actorOcclusion = game.getDebugActorOcclusion();
  proxyWidthSlider.value = actorOcclusion.proxyWidthFactor.toFixed(2);
  proxyHeightSlider.value = actorOcclusion.proxyHeightFactor.toFixed(2);
  spriteBiasSlider.value = actorOcclusion.spriteCameraBias.toFixed(3);
  proxyBiasSlider.value = actorOcclusion.proxyCameraBias.toFixed(3);
  proxyWidthValue.textContent = actorOcclusion.proxyWidthFactor.toFixed(2);
  proxyHeightValue.textContent = actorOcclusion.proxyHeightFactor.toFixed(2);
  spriteBiasValue.textContent = actorOcclusion.spriteCameraBias.toFixed(3);
  proxyBiasValue.textContent = actorOcclusion.proxyCameraBias.toFixed(3);
  attackHurtboxToggle.checked = actorOcclusion.showAttackHurtbox;
  triggerHitboxToggle.checked = actorOcclusion.showTriggerHitboxes;

  const actorLabels = game.getDebugActorLabels();
  labelRadiusSlider.value = actorLabels.radius.toFixed(1);
  labelFontSlider.value = actorLabels.fontSize.toFixed(0);
  labelRadiusValue.textContent = actorLabels.radius.toFixed(1);
  labelFontValue.textContent = `${actorLabels.fontSize.toFixed(0)}px`;
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

topEdgeBrightnessSlider.addEventListener('input', () => {
  game.setDebugTopEdgeBandBrightness(Number(topEdgeBrightnessSlider.value));
  syncLightingUi();
});

topEdgeWidthSlider.addEventListener('input', () => {
  game.setDebugTopEdgeBandWidth(Number(topEdgeWidthSlider.value));
  syncLightingUi();
});

topEdgeLightenToggle.addEventListener('change', () => {
  game.setDebugTopEdgeBandLighten(topEdgeLightenToggle.checked);
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

proxyWidthSlider.addEventListener('input', () => {
  game.setDebugActorDepthProxyWidthFactor(Number(proxyWidthSlider.value));
  syncLightingUi();
});

proxyHeightSlider.addEventListener('input', () => {
  game.setDebugActorDepthProxyHeightFactor(Number(proxyHeightSlider.value));
  syncLightingUi();
});

spriteBiasSlider.addEventListener('input', () => {
  game.setDebugActorSpriteCameraBias(Number(spriteBiasSlider.value));
  syncLightingUi();
});

proxyBiasSlider.addEventListener('input', () => {
  game.setDebugActorDepthProxyCameraBias(Number(proxyBiasSlider.value));
  syncLightingUi();
});

attackHurtboxToggle.addEventListener('change', () => {
  game.setDebugShowAttackHurtbox(attackHurtboxToggle.checked);
  syncLightingUi();
});

triggerHitboxToggle.addEventListener('change', () => {
  game.setDebugShowTriggerHitboxes(triggerHitboxToggle.checked);
  syncLightingUi();
});

labelRadiusSlider.addEventListener('input', () => {
  game.setDebugActorLabelRadius(Number(labelRadiusSlider.value));
  syncLightingUi();
});

labelFontSlider.addEventListener('input', () => {
  game.setDebugActorLabelFontSize(Number(labelFontSlider.value));
  syncLightingUi();
});

syncLightingUi();
