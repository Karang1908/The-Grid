import * as THREE from 'three';
import { createAvatar } from '../avatar/createAvatar.js';
import { animateAvatar } from '../avatar/animateAvatar.js';
import { lerpAngle, dampT } from '../utils/math.js';

const _target = new THREE.Vector3();

// Renders another player's avatar. Position/yaw are smoothed toward the latest network
// state each frame; the walk-cycle animator runs every frame so the avatar animates
// smoothly between the 10Hz network updates.
export class RemotePlayer {
  constructor({ id, color, name = 'Player', heightAt }) {
    this.id = id;
    this.name = name;
    this.heightAt = heightAt;
    this.avatar = createAvatar(color, name);
    this.position = this.avatar.root.position;
    this.facing = 0;
    this.targetPos = new THREE.Vector3();
    this.targetYaw = 0;
    this.animState = {
      speed: 0,
      isRunning: false,
      isProne: false,
      isJumping: false,
      runtime: null,
      baseHipY: this.avatar.parts.hips.position.y,
    };
  }

  setName(name) {
    if (!name || name === this.name) return;
    this.name = name;
    if (this.avatar) {
      this.avatar.setName(name);
    }
  }

  // Apply a fresh network state. Does not snap — just stores targets for smoothing.
  applyState(state) {
    if (state.name && state.name !== this.name) {
      this.setName(state.name);
    }
    this.targetPos.set(state.x, state.y, state.z);
    this.targetYaw = state.yaw;
    this.animState.speed = state.speed;
    this.animState.isRunning = state.isRunning;
    this.animState.isProne = state.isProne;
    this.animState.isJumping = state.isJumping;
  }

  update(dt) {
    // Smooth position and yaw toward the latest target state.
    this.position.lerp(this.targetPos, dampT(10, dt));
    this.facing = lerpAngle(this.facing, this.targetYaw, dampT(10, dt));
    this.avatar.root.rotation.y = this.facing;

    // Drive the walk-cycle from the last-known speed/isRunning.
    animateAvatar(this.avatar.parts, this.animState, dt);
  }

  dispose() {
    if (this.avatar.root.parent) this.avatar.root.parent.remove(this.avatar.root);
    this.avatar.dispose();
  }
}
