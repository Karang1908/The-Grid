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

const SEND_INTERVAL_MS = 100; // 10 Hz outbound state

const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const appEl = document.getElementById('app');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');
const playBtn = document.getElementById('play-btn');

// UI elements for car interaction
const interactPrompt = document.getElementById('interact-prompt');
const interactProgress = document.querySelector('.progress-ring .progress');
const speedometer = document.getElementById('speedometer');
const speedValue = document.getElementById('speed-value');

// Minimap setup
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

// Bigmap setup
const bigmapContainer = document.getElementById('bigmap-container');
const bigmapCanvas = document.getElementById('bigmap');
const bigmapCtx = bigmapCanvas ? bigmapCanvas.getContext('2d') : null;

// Load saved username if present
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
const { heightAt } = createWorld(scene);
scatterProps(scene, heightAt, colliders);
createCity(scene, heightAt, colliders, walkableSurfaces);
createCampsite(scene, heightAt, colliders);

// Spawn 4 cars near the campsite
const cars = [];
const carPositions = [
  new THREE.Vector3(3, 0, 443),
  new THREE.Vector3(-3, 0, 443),
  new THREE.Vector3(3, 0, 447),
  new THREE.Vector3(-3, 0, 447)
];
const carColors = [0xcc2222, 0x2255cc, 0x22cc55, 0xeedd22];

for (let i = 0; i < 4; i++) {
  const c = new Car(`car_${i}`, carPositions[i], carColors[i]);
  cars.push(c);
  scene.add(c.group);
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
    
    // Diagnostics: surface the actual lock state in the status pill so we can tell
    // at a glance whether pointer-lock actually engaged (and on which element).
    const target = document.pointerLockElement;
    const targetName = target ? (target.tagName + (target.id ? '#' + target.id : '')) : 'none';
    statusText.textContent = locked
      ? `connected · locked on ${targetName}`
      : 'connected · unlocked (click to resume)';
  },
});
pointerLock.attach();

// Handle username form submission
const initialName = (nameInput?.value.trim()) || 'Player';

joinForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  hasJoined = true;
  overlay.classList.add('hidden');
  const chosenName = nameInput.value.trim() || 'Player';
  localStorage.setItem('grid_player_name', chosenName);
  localPlayer.setName(chosenName);
  network.sendName(chosenName);
  pointerLock.requestLock();
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
    // Apply our network-assigned id/color to the local avatar.
    localPlayer.id = msg.id;
    localPlayer.color = msg.color;
    // Re-tint the avatar in place. Easiest path: build a fresh avatar, swap.
    const fresh = swapAvatarColor(localPlayer, msg.color);
    if (fresh) {
      scene.remove(localPlayer.avatar.root);
      localPlayer.avatar = fresh.avatar;
      localPlayer.animState.baseHipY = fresh.avatar.parts.hips.position.y;
      scene.add(localPlayer.avatar.root);
    }
    // Broadcast our current name once connected
    if (localPlayer.name) {
      network.sendName(localPlayer.name);
    }
    // Spawn remotes for everyone already connected.
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
  onState: (msg) => {
    const rp = remotePlayers.get(msg.id);
    if (rp) rp.applyState(msg);
  },
  onName: (msg) => {
    const rp = remotePlayers.get(msg.id);
    if (rp) rp.setName(msg.name);
  },
  onLeave: (msg) => {
    const rp = remotePlayers.get(msg.id);
    if (!rp) return;
    rp.dispose();
    remotePlayers.delete(msg.id);
  },
  onStatusChange: (status) => {
    statusEl.classList.toggle('connected', status === 'open');
    statusText.textContent =
      status === 'open' ? 'connected' : status === 'connecting' ? 'connecting…' : 'disconnected';
  },
});
network.connect();

// --- Animation loop -----------------------------------------------------------
const clock = new THREE.Clock();
let lastSendAt = 0;
let holdTime = 0;
const REQUIRED_HOLD = 1.0; // 1 second to enter

function drawMap(ctx, size, scale, offset) {
  if (!ctx) return;
  
  // Clear map
  ctx.clearRect(0, 0, size, size);
  
  // Draw city zone (center)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  // City is -60 to 60.
  const citySize = 120 * scale;
  const cityOffset = -60 * scale + offset;
  ctx.fillRect(cityOffset, cityOffset, citySize, citySize);
  
  // Draw outskirts area
  ctx.fillStyle = 'rgba(200, 150, 50, 0.1)';
  const campSize = 40 * scale;
  ctx.fillRect(offset - campSize/2, 450 * scale + offset - campSize/2, campSize, campSize);

  // Helper to draw a blip
  const drawBlip = (x, z, name, color) => {
    const cx = x * scale + offset;
    const cy = z * scale + offset;
    
    // Dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Name
    ctx.fillStyle = 'white';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name || 'Unknown', cx, cy - 6);
  };
  
  // Draw Remote Players
  for (const rp of remotePlayers.values()) {
    drawBlip(rp.targetPos.x, rp.targetPos.z, rp.name, '#f76d4f');
  }
  
  // Draw Local Player
  drawBlip(localPlayer.position.x, localPlayer.position.z, localPlayer.name, '#4f86f7');
}

function updateMinimap() {
  drawMap(minimapCtx, 200, 0.2, 100);
  drawMap(bigmapCtx, 600, 0.6, 300);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05); // clamp dt to avoid huge jumps after tab inactivity

  const yaw = pointerLock.yaw;
  const pitch = pointerLock.pitch;

  // Movement only when pointer-locked, so the keyboard doesn't drive the player
  // while the player is on the "click to play" overlay.
  if (pointerLock.locked) {
    const p = input.poll();
    
    // Find closest car
    let closestCar = null;
    let minCarDist = 5; // Interaction radius
    
    for (const c of cars) {
      const dist = localPlayer.position.distanceTo(c.group.position);
      if (dist < minCarDist) {
        minCarDist = dist;
        closestCar = c;
      }
    }

    if (localPlayer.vehicle) {
      interactPrompt.classList.remove('visible');
      speedometer.classList.add('visible');
      // Update speedometer (1 unit/s roughly 3.6 km/h)
      speedValue.textContent = Math.round(Math.abs(localPlayer.vehicle.speed) * 3.6);
      
      if (p.interact) {
        // Exit is instant
        if (!localPlayer.lastInteract) {
          localPlayer.position.x += 3; // Step out
          localPlayer.vehicle = null;
          localPlayer.avatar.root.visible = true;
          speedometer.classList.remove('visible');
        }
      }
    } else {
      speedometer.classList.remove('visible');
      
      if (closestCar) {
        interactPrompt.classList.add('visible');
        
        if (p.interact) {
          holdTime += dt;
          if (holdTime >= REQUIRED_HOLD) {
            localPlayer.vehicle = closestCar;
            localPlayer.avatar.root.visible = false;
            holdTime = 0;
            interactProgress.style.strokeDashoffset = 88;
            interactPrompt.classList.remove('visible');
          } else {
            // Update circular progress (dashoffset from 88 to 0)
            interactProgress.style.strokeDashoffset = 88 - (holdTime / REQUIRED_HOLD) * 88;
          }
        } else {
          holdTime = 0;
          interactProgress.style.strokeDashoffset = 88;
        }
      } else {
        interactPrompt.classList.remove('visible');
        holdTime = 0;
        interactProgress.style.strokeDashoffset = 88;
      }
    }
    
    localPlayer.lastInteract = p.interact;

    if (localPlayer.vehicle) {
      localPlayer.vehicle.update(dt, p, heightAt, colliders);
      
      // Keep player inside the car
      localPlayer.position.copy(localPlayer.vehicle.group.position);
      // Optional: adjust height to seat
      localPlayer.position.y += 1.0; 
      localPlayer.facing = localPlayer.vehicle.facing;
    } else {
      localPlayer.update(dt, p, yaw, colliders, walkableSurfaces);
    }
  }
  // Update camera rig
  rig.update(localPlayer.position, yaw, pitch);
  
  // Hide avatar in first-person mode to prevent camera clipping
  if (localPlayer.vehicle) {
    localPlayer.avatar.root.visible = false;
  } else {
    localPlayer.avatar.root.visible = (rig.mode !== 'first');
  }
  
  updateMinimap();

  // Remote players advance toward their last-known targets every frame.
  for (const rp of remotePlayers.values()) rp.update(dt);

  // Outbound state at a fixed cadence.
  lastSendAt += dt * 1000;
  if (lastSendAt >= SEND_INTERVAL_MS) {
    network.sendState(localPlayer.snapshot());
    lastSendAt = 0;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// --- Resize -------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Helpers ------------------------------------------------------------------
// Rebuild the local avatar with a new tint color. Cheap — the avatar is a small
// hierarchy of primitives.
function swapAvatarColor(localPlayer, color) {
  const oldAvatar = localPlayer.avatar;
  const fresh = createAvatar(color, localPlayer.name);
  fresh.root.position.copy(oldAvatar.root.position);
  fresh.root.rotation.copy(oldAvatar.root.rotation);
  if (oldAvatar.root.parent) oldAvatar.root.parent.remove(oldAvatar.root);
  oldAvatar.dispose();
  return { avatar: fresh };
}
