import { clamp, lerp, dampT } from '../utils/math.js';

// Internal state stored on the avatar handle so multiple instances each have their
// own phase/runBlend. Wired through animState.runtime below.
function ensureRuntime(state) {
  if (!state.runtime) {
    state.runtime = { phase: 0, runBlend: 0, proneBlend: 0, jumpBlend: 0, idleTime: 0 };
  }
  return state.runtime;
}

const WALK_THRESHOLD = 0.3;
const STRIDE_SCALE = 1.6;

// Increased ranges for better expression
const LEG_SWING_IDLE = 0.6;
const LEG_SWING_RUN = 1.1;
const ARM_SWING_RATIO = 0.9;
const KNEE_BEND_IDLE = 1.0;
const KNEE_BEND_RUN = 1.6;
const FOREARM_BEND_IDLE = 0.3;
const FOREARM_BEND_RUN = 0.8;

const HIP_BOB_IDLE = 0.04;
const HIP_BOB_RUN = 0.12;

const PI = Math.PI;

export function animateAvatar(parts, animState, dt) {
  const runtime = ensureRuntime(animState);
  const speed = animState.speed || 0;
  const targetRunBlend = animState.isRunning ? 1 : 0;
  const targetProne = animState.isProne ? 1 : 0;
  const targetJump = animState.isJumping ? 1 : 0;
  const walkBlend = clamp(speed / WALK_THRESHOLD, 0, 1);

  runtime.runBlend = lerp(runtime.runBlend, targetRunBlend, dampT(6, dt));
  runtime.proneBlend = lerp(runtime.proneBlend, targetProne, dampT(6, dt));
  runtime.jumpBlend = lerp(runtime.jumpBlend, targetJump, dampT(12, dt));
  
  runtime.phase += speed * STRIDE_SCALE * dt;
  runtime.idleTime += dt;

  const swingAmp = lerp(LEG_SWING_IDLE, LEG_SWING_RUN, runtime.runBlend) * walkBlend;
  const armAmp = swingAmp * ARM_SWING_RATIO;
  const kneeBend = lerp(KNEE_BEND_IDLE, KNEE_BEND_RUN, runtime.runBlend) * walkBlend;
  const forearmBend = lerp(FOREARM_BEND_IDLE, FOREARM_BEND_RUN, runtime.runBlend) * walkBlend;

  const ph = runtime.phase;

  // Legs swing contralateral (positive X swings forward for limbs hanging down -Y)
  parts.leftUpperLeg.rotation.x = Math.sin(ph) * swingAmp;
  parts.rightUpperLeg.rotation.x = Math.sin(ph + PI) * swingAmp;

  // Knees bend BACKWARD during the forward swing (negative X bends backward)
  parts.leftLowerLeg.rotation.x = -Math.max(0, Math.sin(ph + 0.6)) * kneeBend;
  parts.rightLowerLeg.rotation.x = -Math.max(0, Math.sin(ph + PI + 0.6)) * kneeBend;

  // Arms counter-swing (opposite of legs)
  parts.leftUpperArm.rotation.x = -Math.sin(ph) * armAmp;
  parts.rightUpperArm.rotation.x = -Math.sin(ph + PI) * armAmp;

  // Forearms bend FORWARD (positive X bends forward)
  parts.leftLowerArm.rotation.x = Math.abs(Math.sin(ph)) * forearmBend + (runtime.runBlend * 0.4);
  parts.rightLowerArm.rotation.x = Math.abs(Math.sin(ph + PI)) * forearmBend + (runtime.runBlend * 0.4);

  // Hip bob (double frequency of stride)
  const baseHipY = animState.baseHipY ?? (animState.baseHipY = parts.hips.position.y);
  const bob = Math.abs(Math.sin(ph)) * lerp(HIP_BOB_IDLE, HIP_BOB_RUN, runtime.runBlend) * walkBlend;
  parts.hips.position.y = lerp(parts.hips.position.y, baseHipY + bob, dampT(12, dt));

  // Forward lean when running (hips point up +Y, so negative X pitches forward)
  const targetLean = lerp(0, -0.25, runtime.runBlend) * walkBlend;
  parts.hips.rotation.x = lerp(parts.hips.rotation.x, targetLean, dampT(6, dt));

  // Spine twist (shoulders twist opposite to hips)
  const twist = -Math.sin(ph) * 0.2 * walkBlend;
  parts.spine.rotation.y = lerp(parts.spine.rotation.y, twist, dampT(8, dt));

  // Head bob when walking/running
  const walkHeadBob = Math.sin(ph * 2) * 0.05 * walkBlend;

  // Idle drift
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

  parts.hips.rotation.x = lerp(parts.hips.rotation.x, 0, driftT * idleFactor);
  parts.spine.rotation.y = lerp(parts.spine.rotation.y, 0, driftT * idleFactor);

  // New head target Y is 0.55 relative to spine. Add bob & sway on top.
  const targetHeadY = 0.55 + walkHeadBob + Math.sin(runtime.idleTime * 1.5) * 0.015 * idleFactor;
  parts.head.position.y = lerp(parts.head.position.y, targetHeadY, dampT(6, dt));

  // --- Posture Overrides (Crouch, Prone, Jump) ---
  
  // Jump blend (hands up, legs slightly bent)
  if (runtime.jumpBlend > 0) {
    parts.leftUpperArm.rotation.x = lerp(parts.leftUpperArm.rotation.x, Math.PI, runtime.jumpBlend);
    parts.rightUpperArm.rotation.x = lerp(parts.rightUpperArm.rotation.x, Math.PI, runtime.jumpBlend);
    parts.leftLowerArm.rotation.x = lerp(parts.leftLowerArm.rotation.x, 0, runtime.jumpBlend);
    parts.rightLowerArm.rotation.x = lerp(parts.rightLowerArm.rotation.x, 0, runtime.jumpBlend);
    parts.leftUpperLeg.rotation.x = lerp(parts.leftUpperLeg.rotation.x, 0.2, runtime.jumpBlend);
    parts.rightUpperLeg.rotation.x = lerp(parts.rightUpperLeg.rotation.x, 0.2, runtime.jumpBlend);
    parts.leftLowerLeg.rotation.x = lerp(parts.leftLowerLeg.rotation.x, -0.2, runtime.jumpBlend);
    parts.rightLowerLeg.rotation.x = lerp(parts.rightLowerLeg.rotation.x, -0.2, runtime.jumpBlend);
  }

  // Prone blend
  if (runtime.proneBlend > 0) {
    parts.hips.position.y = lerp(parts.hips.position.y, baseHipY - 0.75, runtime.proneBlend);
    // Pitch hips forward (-PI/2) so body lays on stomach
    parts.hips.rotation.x = lerp(parts.hips.rotation.x, -Math.PI / 2, runtime.proneBlend);
    
    // Arms reach forward (since body is pitched forward, swinging arms up +PI makes them point forward)
    parts.leftUpperArm.rotation.x = lerp(parts.leftUpperArm.rotation.x, Math.PI - 0.2 + (Math.sin(ph) * 0.3 * walkBlend), runtime.proneBlend);
    parts.rightUpperArm.rotation.x = lerp(parts.rightUpperArm.rotation.x, Math.PI - 0.2 + (Math.sin(ph + PI) * 0.3 * walkBlend), runtime.proneBlend);
    parts.leftLowerArm.rotation.x = lerp(parts.leftLowerArm.rotation.x, 0, runtime.proneBlend);
    parts.rightLowerArm.rotation.x = lerp(parts.rightLowerArm.rotation.x, 0, runtime.proneBlend);
    
    // Legs naturally trail backward when hips are pitched forward, so keep them at 0 relative to hips
    parts.leftUpperLeg.rotation.x = lerp(parts.leftUpperLeg.rotation.x, Math.sin(ph + PI) * 0.2 * walkBlend, runtime.proneBlend);
    parts.rightUpperLeg.rotation.x = lerp(parts.rightUpperLeg.rotation.x, Math.sin(ph) * 0.2 * walkBlend, runtime.proneBlend);
    parts.leftLowerLeg.rotation.x = lerp(parts.leftLowerLeg.rotation.x, 0, runtime.proneBlend);
    parts.rightLowerLeg.rotation.x = lerp(parts.rightLowerLeg.rotation.x, 0, runtime.proneBlend);
    
    // Lift head up (positive X pitches head backward relative to spine) so we face forward
    parts.head.rotation.x = lerp(0, Math.PI / 2.5, runtime.proneBlend);
  } else {
    parts.head.rotation.x = lerp(parts.head.rotation.x, 0, driftT);
  }
}

export function resetAvatarAnimState(animState) {
  animState.runtime = { phase: 0, runBlend: 0, proneBlend: 0, jumpBlend: 0, idleTime: 0 };
}
