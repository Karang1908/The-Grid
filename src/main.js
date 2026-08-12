// GDGoC The Grid — chapter one entry point.
//
// Wires: scene/camera/renderer, world + props, local player, camera rig, pointer-lock
// input, network client, and the remote player registry. The animation loop runs
// locally at render framerate and pushes outbound STATE to the server at 10Hz.

import * as THREE from 'three';
import { createWorld } from './world/createWorld.js';
import { createAvatar } from './avatar/createAvatar.js';
import { scatterProps } from './world/props.js';
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

// --- Scene + renderer ---------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
appEl.appendChild(renderer.domElement);

const { heightAt } = createWorld(scene);
scatterProps(scene, heightAt);

// --- Camera + input -----------------------------------------------------------
const rig = new CameraRig(camera);
const input = new InputState(window);
input.attach();
input.onToggleCamera(() => rig.toggleMode());

const pointerLock = new PointerLockInput(renderer.domElement, {
  onLockChange: (locked) => {
    overlay.classList.toggle('hidden', locked);
  },
});
pointerLock.attach();

// --- Local player (avatar built now; networked id/color arrive later via INIT) ---
const localPlayer = new LocalPlayer({ id: 'pending', color: 0x4f86f7, heightAt });
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
    // Spawn remotes for everyone already connected.
    for (const p of msg.players) {
      if (p.id === msg.id) continue;
      const rp = new RemotePlayer({ id: p.id, color: p.color, heightAt });
      rp.applyState(p);
      remotePlayers.set(p.id, rp);
      remoteContainer.add(rp.avatar.root);
    }
  },
  onJoin: (msg) => {
    if (remotePlayers.has(msg.id)) return;
    const rp = new RemotePlayer({ id: msg.id, color: msg.color, heightAt });
    rp.applyState(msg);
    remotePlayers.set(msg.id, rp);
    remoteContainer.add(rp.avatar.root);
  },
  onState: (msg) => {
    const rp = remotePlayers.get(msg.id);
    if (rp) rp.applyState(msg);
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

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05); // clamp dt to avoid huge jumps after tab inactivity

  const yaw = pointerLock.yaw;
  const pitch = pointerLock.pitch;

  // Movement only when pointer-locked, so the keyboard doesn't drive the player
  // while the player is on the "click to play" overlay.
  if (pointerLock.locked) {
    localPlayer.update(dt, input, yaw);
  }
  rig.update(localPlayer.position, yaw, pitch);

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
  const fresh = createAvatar(color);
  fresh.root.position.copy(oldAvatar.root.position);
  fresh.root.rotation.copy(oldAvatar.root.rotation);
  if (oldAvatar.root.parent) oldAvatar.root.parent.remove(oldAvatar.root);
  oldAvatar.dispose();
  return { avatar: fresh };
}
