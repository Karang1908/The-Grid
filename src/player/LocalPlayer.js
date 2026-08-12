import * as THREE from 'three';
import { createAvatar } from '../avatar/createAvatar.js';
import { animateAvatar } from '../avatar/animateAvatar.js';
import { movementBasis } from '../camera/CameraRig.js';
import { lerpAngle, dampT } from '../utils/math.js';
import { resolveCollisions, getFloorY } from '../world/collisions.js';

const WALK_SPEED = 4.0;
const RUN_SPEED = 8.0;
const PRONE_SPEED = 1.0;
const GRAVITY = -25.0;
const JUMP_FORCE = 8.5;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

// Owns the local player's avatar, applies input, drives the walk-cycle animator, and
// exposes the current state on every frame so the network layer can send it.
export class LocalPlayer {
  constructor({ id, color = 0x4f86f7, name = 'Player', heightAt }) {
    this.id = id;
    this.color = color;
    this.name = name;
    this.heightAt = heightAt;
    this.position = new THREE.Vector3(0, 0, 450);
    this.facing = 0; // yaw the avatar body is rotated to
    this.velocityY = 0; // vertical velocity for jumps

    const avatar = createAvatar(color, name);
    this.avatar = avatar;
    this.avatar.root.position.copy(this.position);

    this.animState = {
      speed: 0,
      isRunning: false,
      isProne: false,
      isJumping: false,
      runtime: null,
      baseHipY: avatar.parts.hips.position.y,
    };
  }

  setName(name) {
    this.name = name;
    if (this.avatar) {
      this.avatar.setName(name);
    }
  }

  update(dt, inputData, yaw, colliders, walkableSurfaces) {
    const { forward: fIn, right: rIn, run, jump, prone } = inputData;
    movementBasis(yaw, _forward, _right);

    _move.set(0, 0, 0);
    _move.addScaledVector(_forward, fIn);
    _move.addScaledVector(_right, rIn);

    const inputMag = _move.length();
    let speed = 0;
    
    // Posture intent
    let isProne = prone;

    if (inputMag > 0) {
      _move.divideScalar(inputMag);
      if (isProne) speed = PRONE_SPEED;
      else speed = run ? RUN_SPEED : WALK_SPEED;
      
      this.position.addScaledVector(_move, speed * dt);
    }

    if (colliders && colliders.length > 0) {
      // 1.0 is player radius, 2.0 is player height
      const resolved = resolveCollisions(this.position.x, this.position.y, this.position.z, 1.0, 2.0, colliders);
      this.position.x = resolved.x;
      this.position.z = resolved.z;
    }

    // Vertical physics (gravity and jumping)
    this.velocityY += GRAVITY * dt;
    this.position.y += this.velocityY * dt;

    const terrainY = this.heightAt(this.position.x, this.position.z);
    const groundY = getFloorY(this.position.x, this.position.z, this.position.y, terrainY, walkableSurfaces || []);
    let isJumping = false;

    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocityY = 0;

      // Jump if requested and not in a restricted posture
      if (jump && !isProne) {
        this.velocityY = JUMP_FORCE;
        isJumping = true;
      }
    } else {
      isJumping = true; // We are in the air
    }

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
    this.animState.isRunning = run && !isProne;
    this.animState.isProne = isProne;
    this.animState.isJumping = isJumping;
    animateAvatar(this.avatar.parts, this.animState, dt);
  }

  // Snapshot for the network layer.
  snapshot() {
    return {
      name: this.name,
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      yaw: this.facing,
      speed: this.animState.speed,
      isRunning: !!this.animState.isRunning,
      isProne: !!this.animState.isProne,
      isJumping: !!this.animState.isJumping,
    };
  }

  dispose() {
    this.avatar.root.parent && this.avatar.root.parent.remove(this.avatar.root);
    this.avatar.dispose();
  }
}
