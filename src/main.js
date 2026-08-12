// GDGoC The Grid — chapter one entry point.
//
// Wires: scene/camera/renderer, world + props, local player, camera rig, pointer-lock
// input, network client, and the remote player registry. The animation loop runs
// locally at render framerate and pushes outbound STATE to the server at 10Hz.

import * as THREE from 'three';
import { createWorld } from './world/createWorld.js';
import { createCity } from './world/city.js';
import { createCampsite } from './world/campsite.js';
import { Car } from './world/Car.js';
import { createAvatar } from './avatar/createAvatar.js';
import { scatterProps } from './world/props.js';
import { resolveCollisions } from './world/collisions.js';
import { PointerLockInput } from './camera/PointerLockInput.js';
import { CameraRig } from './camera/CameraRig.js';
import { InputState } from './player/InputState.js';
import { LocalPlayer } from './player/LocalPlayer.js';
import { RemotePlayer } from './player/RemotePlayer.js';
import { NetworkClient } from './net/NetworkClient.js';
import { BreakableTreeManager } from './world/breakableTrees.js';
import { InteractionManager } from './world/interactions.js';

const SEND_INTERVAL_MS = 100; // 10 Hz outbound state

const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const appEl = document.getElementById('app');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');
const playBtn = document.getElementById('play-btn');
const bigmapContainer = document.getElementById('bigmap-container');
const interactPrompt = document.getElementById('interact-prompt');
const promptText = interactPrompt?.querySelector('.text');
const interactProgress = interactPrompt?.querySelector('.progress');
const speedometer = document.getElementById('speedometer');
const speedValue = document.getElementById('speed-value');

// Restore saved username if present
const savedName = localStorage.getItem('grid_player_name');
if (savedName && nameInput) {
  nameInput.value = savedName;
}

// --- Scene + renderer ---------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
appEl.appendChild(renderer.domElement);

const colliders = [];
const walkableSurfaces = [];
const treeManager = new BreakableTreeManager(scene);
const interactionManager = new InteractionManager();

const { heightAt } = createWorld(scene);
scatterProps(scene, heightAt, colliders, treeManager);
createCity(scene, heightAt, colliders, walkableSurfaces, treeManager, interactionManager);
createCampsite(scene, heightAt, colliders);

// Spawn 4 cars near the campsite
const cars = [];
const carPositions = [
  new THREE.Vector3(3.5, 0, 442),
  new THREE.Vector3(-3.5, 0, 442),
  new THREE.Vector3(3.5, 0, 448),
  new THREE.Vector3(-3.5, 0, 448)
];
const carColors = [0xd42424, 0x2455d4, 0x1f9e42, 0xd9b310];

for (let i = 0; i < 4; i++) {
  const c = new Car(`car_${i}`, carPositions[i], carColors[i]);
  cars.push(c);
  scene.add(c.group);

  // Register car with unified interaction manager
  interactionManager.register({
    type: 'car',
    position: c.group.position,
    radius: 3.5,
    getPrompt: () => 'HOLD E TO DRIVE',
    onInteract: (player) => {
      player.vehicle = c;
      player.avatar.root.visible = false;
      interactPrompt.classList.remove('visible');
      speedometer.classList.add('visible');
    }
  });
}

// --- Camera + input -----------------------------------------------------------
const rig = new CameraRig(camera);
const input = new InputState(window);
input.attach();
input.onToggleCamera(() => rig.toggleMode());
input.onToggleMap(() => {
  if (bigmapContainer) bigmapContainer.classList.toggle('visible');
});

let hasJoined = false;

const pointerLock = new PointerLockInput(renderer.domElement, {
  onLockChange: (locked) => {
    if (!hasJoined) {
      overlay.classList.toggle('hidden', locked);
    } else {
      overlay.classList.add('hidden');
    }
    
    const target = document.pointerLockElement;
    const targetName = target ? (target.tagName + (target.id ? '#' + target.id : '')) : 'none';
    statusText.textContent = locked
      ? `connected · locked on ${targetName}`
      : 'connected · unlocked (click to resume)';
  },
});
pointerLock.attach();

// Handle username form submission & enter world
const initialName = (nameInput?.value.trim()) || 'Player';

function enterWorld() {
  hasJoined = true;
  overlay.classList.add('hidden');
  const chosenName = nameInput?.value.trim() || 'Player';
  localStorage.setItem('grid_player_name', chosenName);
  localPlayer.setName(chosenName);
  network.sendName(chosenName);
  pointerLock.requestLock();
}

joinForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  enterWorld();
});

playBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  enterWorld();
});

// --- Local player (avatar built now; networked id/color arrive later via INIT) ---
const localPlayer = new LocalPlayer({ id: 'pending', color: 0x4f86f7, name: initialName, heightAt });
scene.add(localPlayer.avatar.root);

// --- Network ------------------------------------------------------------------
const remotePlayers = new Map(); // id -> RemotePlayer
const remoteContainer = new THREE.Group();
remoteContainer.name = 'remotePlayers';
scene.add(remoteContainer);

const network = new NetworkClient({
  onInit: (msg) => {
    localPlayer.id = msg.id;
    localPlayer.color = msg.color;
    const fresh = swapAvatarColor(localPlayer, msg.color);
    if (fresh) {
      scene.remove(localPlayer.avatar.root);
      localPlayer.avatar = fresh.avatar;
      localPlayer.animState.baseHipY = fresh.avatar.parts.hips.position.y;
      scene.add(localPlayer.avatar.root);
    }
    if (localPlayer.name) {
      network.sendName(localPlayer.name);
    }
    for (const p of msg.players) {
      if (p.id === msg.id) continue;
      const rp = new RemotePlayer({ id: p.id, color: p.color, name: p.name || 'Player', heightAt });
      rp.applyState(p);
      remotePlayers.set(p.id, rp);
      remoteContainer.add(rp.avatar.root);
    }
  },
  onJoin: (msg) => {
    if (remotePlayers.has(msg.id)) return;
    const rp = new RemotePlayer({ id: msg.id, color: msg.color, name: msg.name || 'Player', heightAt });
    rp.applyState(msg);
    remotePlayers.set(msg.id, rp);
    remoteContainer.add(rp.avatar.root);
  },
  onLeave: (msg) => {
    const rp = remotePlayers.get(msg.id);
    if (!rp) return;
    remoteContainer.remove(rp.avatar.root);
    remotePlayers.delete(msg.id);
  },
  onState: (msg) => {
    const rp = remotePlayers.get(msg.id);
    if (!rp) return;
    rp.applyState(msg);
  },
  onName: (msg) => {
    const rp = remotePlayers.get(msg.id);
    if (!rp) return;
    rp.setName(msg.name);
  },
  onOpen: () => {
    statusEl.classList.add('connected');
  },
  onClose: () => {
    statusEl.classList.remove('connected');
    statusText.textContent = 'disconnected · reconnecting...';
  },
});

function swapAvatarColor(player, newColor) {
  const av = createAvatar({ color: newColor, name: player.name });
  return { avatar: av };
}

// --- Render + game loop -------------------------------------------------------
let lastTime = performance.now();
let lastSendTime = 0;

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - lastTime) / 1000, 0.1); // clamp large delta spikes
  lastTime = now;

  const yaw = pointerLock.yaw || 0;
  const pitch = pointerLock.pitch || 0;

  // Update local player only if unlocked or joined
  if (pointerLock.locked || hasJoined) {
    const p = input.poll();

    // If driving vehicle
    if (localPlayer.vehicle) {
      interactPrompt.classList.remove('visible');
      speedometer.classList.add('visible');
      speedValue.textContent = Math.round(Math.abs(localPlayer.vehicle.speed) * 3.6);
      
      if (p.interact && !localPlayer.lastInteract) {
        // Step out of car
        localPlayer.position.x += 2.5;
        localPlayer.vehicle = null;
        localPlayer.avatar.root.visible = true;
        speedometer.classList.remove('visible');
      }
    } else {
      speedometer.classList.remove('visible');
      // Update interactive objects (TVs, Drawers, Beds, Cars, Lamps)
      interactionManager.update(dt, localPlayer, p, interactPrompt, interactProgress, promptText);
    }
    
    localPlayer.lastInteract = p.interact;

    if (localPlayer.vehicle) {
      localPlayer.vehicle.update(dt, p, heightAt, colliders, treeManager);
      localPlayer.position.copy(localPlayer.vehicle.group.position);
      localPlayer.position.y += 0.6; 
      localPlayer.facing = localPlayer.vehicle.facing;
    } else if (!localPlayer.isResting) {
      localPlayer.update(dt, p, yaw, colliders, walkableSurfaces);
    }
  }

  // Update dynamic physics particles and falling trees
  treeManager.update(dt);

  // Update camera rig
  rig.update(localPlayer.position, yaw, pitch, !!localPlayer.vehicle);

  // Interpolate / animate remotes
  for (const rp of remotePlayers.values()) {
    rp.update(dt, colliders, walkableSurfaces);
  }

  // Outbound network state at 10Hz
  if (now - lastSendTime >= SEND_INTERVAL_MS && localPlayer.id !== 'pending') {
    lastSendTime = now;
    network.sendState(localPlayer.getState());
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// --- Window resize ------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
