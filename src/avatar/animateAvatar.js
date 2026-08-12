// Procedural walk/idle/run cycle for the procedural humanoid from createAvatar.js.
//
// animateAvatar is a pure function. It reads animState.speed and animState.isRunning
// each frame, advances internal phase/runBlend state, and writes joint rotations on
// the avatar's parts. The same function is used for local and remote players — remote
// state only needs to provide {speed, isRunning} in the same shape.

import { clamp, lerp, dampT } from '../utils/math.js';

// Internal state stored on the avatar handle so multiple instances each have their
// own phase/runBlend. Wired through animState.runtime below.
function ensureRuntime(state) {
  if (!state.runtime) {
    state.runtime = {
      phase: 0,
      runBlend: 0,
      idleTime: 0,
    };
  }
  return state.runtime;
}

const WALK_THRESHOLD = 0.3; // speed (m/s) at which walkBlend saturates to 1
const STRIDE_SCALE = 1.6;   // turns meters-traveled into radians of phase

const LEG_SWING_IDLE = 0.5;
const LEG_SWING_RUN = 0.9;
const ARM_SWING_RATIO = 0.8; // arms swing less than legs
const KNEE_BEND_IDLE = 0.9;
const KNEE_BEND_RUN = 1.3;
const FOREARM_BEND_IDLE = 0.2;
const FOREARM_BEND_RUN = 0.6;

const HIP_BOB_IDLE = 0.03;
const HIP_BOB_RUN = 0.08;

const PI = Math.PI;

export function animateAvatar(parts, animState, dt) {
  const { runtime } = ensureRuntime(animState);
  const speed = animState.speed || 0;
  const targetRunBlend = animState.isRunning ? 1 : 0;
  const walkBlend = clamp(speed / WALK_THRESHOLD, 0, 1);

  // Smooth the run blend so the gait transition doesn't pop.
  runtime.runBlend = lerp(runtime.runBlend, targetRunBlend, dampT(6, dt));

  // Advance phase by distance traveled (so framerate doesn't change stride length).
  runtime.phase += speed * STRIDE_SCALE * dt;
  runtime.idleTime += dt;

  // Blend swing/bend ranges by runBlend.
  const swingAmp = lerp(LEG_SWING_IDLE, LEG_SWING_RUN, runtime.runBlend) * walkBlend;
  const armAmp = swingAmp * ARM_SWING_RATIO;
  const kneeBend = lerp(KNEE_BEND_IDLE, KNEE_BEND_RUN, runtime.runBlend) * walkBlend;
  const forearmBend = lerp(FOREARM_BEND_IDLE, FOREARM_BEND_RUN, runtime.runBlend) * walkBlend;

  const ph = runtime.phase;

  // Legs swing contralateral (opposite phase).
  parts.leftUpperLeg.rotation.x = Math.sin(ph) * swingAmp;
  parts.rightUpperLeg.rotation.x = Math.sin(ph + PI) * swingAmp;

  // Knees bend only on the swing phase (knee folded back of leg).
  parts.leftLowerLeg.rotation.x = Math.max(0, Math.sin(ph + 0.6)) * kneeBend;
  parts.rightLowerLeg.rotation.x = Math.max(0, Math.sin(ph + PI + 0.6)) * kneeBend;

  // Arms swing opposite the same-side leg (counter-swing).
  parts.leftUpperArm.rotation.x = Math.sin(ph + PI) * armAmp;
  parts.rightUpperArm.rotation.x = Math.sin(ph) * armAmp;

  // Forearms: always slightly bent while walking, more so when running.
  parts.leftLowerArm.rotation.x = -Math.abs(Math.sin(ph + PI)) * forearmBend;
  parts.rightLowerArm.rotation.x = -Math.abs(Math.sin(ph)) * forearmBend;

  // Hip bob: two bounces per stride (one per footfall).
  // parts.hips.position.y is the live hip Y; we restore the base when idle and add
  // the bob on top. The base Y is captured each frame on the avatar handle.
  const baseHipY = animState.baseHipY ?? (animState.baseHipY = parts.hips.position.y);
  const bob = Math.abs(Math.sin(ph)) * lerp(HIP_BOB_IDLE, HIP_BOB_RUN, runtime.runBlend) * walkBlend;
  parts.hips.position.y = lerp(parts.hips.position.y, baseHipY + bob, dampT(12, dt));

  // Idle: when not walking, drift limbs back to neutral and add a subtle head sway.
  const idleFactor = 1 - walkBlend;
  const driftT = dampT(8, dt);
  parts.leftUpperLeg.rotation.x = lerp(parts.leftUpperLeg.rotation.x, 0, driftT * idleFactor);
  parts.rightUpperLeg.rotation.x = lerp(parts.rightUpperLeg.rotation.x, 0, driftT * idleFactor);
  parts.leftLowerLeg.rotation.x = lerp(parts.leftLowerLeg.rotation.x, 0, driftT * idleFactor);
  parts.rightLowerLeg.rotation.x = lerp(parts.rightLowerLeg.rotation.x, 0, driftT * idleFactor);
  parts.leftUpperArm.rotation.x = lerp(parts.leftUpperArm.rotation.x, 0, driftT * idleFactor);
  parts.rightUpperArm.rotation.x = lerp(parts.rightUpperArm.rotation.x, 0, driftT * idleFactor);
  parts.leftLowerArm.rotation.x = lerp(parts.leftLowerArm.rotation.x, 0, driftT * idleFactor);
  parts.rightLowerArm.rotation.x = lerp(parts.rightLowerArm.rotation.x, 0, driftT * idleFactor);

  // Subtle head bob while idle.
  parts.head.position.y = lerp(
    parts.head.position.y,
    0.16 + Math.sin(runtime.idleTime * 1.5) * 0.01 * idleFactor,
    dampT(4, dt),
  );
}

export function resetAvatarAnimState(animState) {
  animState.runtime = { phase: 0, runBlend: 0, idleTime: 0 };
}
