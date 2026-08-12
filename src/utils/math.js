// Small numeric helpers shared across the client.
// Kept dependency-free so they can be imported from anywhere.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent exponential smoothing factor:
// approaches 1 in roughly 1/k seconds.
export function dampT(k, dt) {
  return 1 - Math.exp(-k * dt);
}

// Shortest-path angle interpolation in radians. Wraps the result to [-PI, PI].
export function lerpAngle(a, b, t) {
  let diff = (b - a) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  const result = a + diff * t;
  return ((result + Math.PI) % TAU + TAU) % TAU - Math.PI;
}
