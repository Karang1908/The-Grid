import * as THREE from 'three';
import { createAvatar } from '../avatar/createAvatar.js';
import { animateAvatar } from '../avatar/animateAvatar.js';
import { movementBasis } from '../camera/CameraRig.js';
import { lerpAngle, dampT } from '../utils/math.js';

const WALK_SPEED = 4.0;
const RUN_SPEED = 8.0;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

// Owns the local player's avatar, applies input, drives the walk-cycle animator, and
// exposes the current state on every frame so the network layer can send it.
export class LocalPlayer {
  constructor({ id, color = 0x4f86f7, heightAt }) {
    this.id = id;
    this.color = color;
    this.heightAt = heightAt;
    this.position = new THREE.Vector3(0, 0, 0);
    this.facing = 0; // yaw the avatar body is rotated to

    const avatar = createAvatar(color);
    this.avatar = avatar;
    this.avatar.root.position.copy(this.position);

    this.animState = {
      speed: 0,
      isRunning: false,
      runtime: null,
      baseHipY: avatar.parts.hips.position.y,
    };
  }

  update(dt, input, yaw) {
    const { forward: fIn, right: rIn, run } = input.poll();
    movementBasis(yaw, _forward, _right);

    _move.set(0, 0, 0);
    _move.addScaledVector(_forward, fIn);
    _move.addScaledVector(_right, rIn);

    const inputMag = _move.length();
    let speed = 0;
    if (inputMag > 0) {
      _move.divideScalar(inputMag);
      speed = run ? RUN_SPEED : WALK_SPEED;
      this.position.addScaledVector(_move, speed * dt);
    }

    // Keep the avatar on the ground (heightAt lookup, not collision).
    this.position.y = this.heightAt(this.position.x, this.position.z);

    // Avatar body faces its movement direction (not the camera look direction).
    if (inputMag > 0) {
      // atan2: we want yaw=0 to face -Z (avatar's "forward"), so
      //   target = atan2(-moveDir.x, -moveDir.z)
      const targetFacing = Math.atan2(-_move.x, -_move.z);
      this.facing = lerpAngle(this.facing, targetFacing, dampT(12, dt));
    }

    this.avatar.root.position.copy(this.position);
    this.avatar.root.rotation.y = this.facing;

    this.animState.speed = speed;
    this.animState.isRunning = run;
    animateAvatar(this.avatar.parts, this.animState, dt);
  }

  // Snapshot for the network layer.
  snapshot() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      yaw: this.facing,
      speed: this.animState.speed,
      isRunning: !!this.animState.isRunning,
    };
  }

  dispose() {
    this.avatar.root.parent && this.avatar.root.parent.remove(this.avatar.root);
    this.avatar.dispose();
  }
}
