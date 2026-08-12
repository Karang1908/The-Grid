// Camera rig that drives a Three.js PerspectiveCamera from yaw/pitch and a mode flag.
//
// Modes: 'first' (FPS-style, camera at eye height, looks around freely) and 'third'
// (camera orbits behind/above the player). Both share the same yaw/pitch so toggling
// with C preserves the aiming direction.
//
// update() takes the player world position and the yaw/pitch values provided by
// PointerLockInput. Movement is camera-relative using yaw only — pitch is ignored for
// movement, so looking up/down doesn't push you into the ground/sky.

import * as THREE from 'three';

const FIRST_PERSON_EYE_HEIGHT = 1.6;
const THIRD_PERSON_TARGET_HEIGHT = 1.4;
const THIRD_PERSON_DISTANCE = 4.5;
const PITCH_LIMIT = Math.PI / 2 - 0.08;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'third'; // start in third-person so the player sees their avatar on spawn
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._forward = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  toggleMode() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
  }

  // Called every frame after the player position has been updated.
  // pitch/yaw are clamped/derived from the pointer-lock input; passed in so the rig
  // stays decoupled from the input pipeline.
  update(playerPos, yaw, pitch) {
    if (this.mode === 'first') {
      this.camera.position.set(
        playerPos.x,
        playerPos.y + FIRST_PERSON_EYE_HEIGHT,
        playerPos.z,
      );
      this._euler.set(clampPitch(pitch), yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(this._euler);
    } else {
      // Spherical offset behind/above the player, using both yaw and pitch.
      const p = clampPitch(pitch);
      const cp = Math.cos(p);
      const sp = Math.sin(p);
      this._forward.set(-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp);
      this._target.set(
        playerPos.x,
        playerPos.y + THIRD_PERSON_TARGET_HEIGHT,
        playerPos.z,
      );
      this.camera.position.copy(this._target).addScaledVector(this._forward, -THIRD_PERSON_DISTANCE);
      this.camera.lookAt(this._target);
    }
  }
}

function clampPitch(p) {
  if (p > PITCH_LIMIT) return PITCH_LIMIT;
  if (p < -PITCH_LIMIT) return -PITCH_LIMIT;
  return p;
}

// Camera-relative forward/right vectors derived from yaw (pitch ignored for movement).
export function movementBasis(yaw, outForward, outRight) {
  outForward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  outRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
  return { forward: outForward, right: outRight };
}
