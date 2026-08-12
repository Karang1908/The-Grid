// Pointer-lock mouse-look. Independent of CameraRig so the rig can be unit-shaped
// without a DOM dependency.
//
// Usage:
//   const input = new PointerLockInput(canvasEl, { onLockChange });
//   input.attach();   // installs window-level mousemove + pointerlockchange listeners
//   // canvas click => lock requested
//   // Esc => browser releases lock; we just observe and update state
//   // input.yaw / input.pitch are read by CameraRig each frame.

const DEFAULT_SENSITIVITY = 0.0025;

export class PointerLockInput {
  constructor(canvasEl, { sensitivity = DEFAULT_SENSITIVITY, onLockChange } = {}) {
    this.canvas = canvasEl;
    this.sensitivity = sensitivity;
    this.onLockChange = onLockChange || (() => {});
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  attach() {
    window.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.addEventListener('click', this._onClick);
  }

  detach() {
    window.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.removeEventListener('click', this._onClick);
  }

  requestLock() {
    if (this.locked) return;
    // Lock the document element rather than the canvas. Browsers require
    // requestPointerLock() to be called inside a user-gesture handler that originated
    // on (or at least bubbled to) the target element. The overlay sits on top of the
    // canvas and absorbs the "click to play" click, so locking on the canvas from that
    // click is unreliable across browsers. document.documentElement is always present
    // and accepts pointer-lock identically to any other element.
    document.documentElement.requestPointerLock();
  }

  _onMouseMove(e) {
    if (!this.locked) return;
    this.yaw -= e.movementX * this.sensitivity;
    this.pitch -= e.movementY * this.sensitivity;
    // Clamp pitch to avoid gimbal flip at +/-90 deg.
    const LIMIT = Math.PI / 2 - 0.08;
    if (this.pitch > LIMIT) this.pitch = LIMIT;
    if (this.pitch < -LIMIT) this.pitch = -LIMIT;
  }

  _onPointerLockChange() {
    // Pointer-lock is a binary state for our purposes — the specific locked element
    // doesn't matter. The overlay (not the canvas) may be the locked element when the
    // user clicks "click to play", so comparing to this.canvas would incorrectly
    // report unlocked and keep the overlay visible forever.
    this.locked = document.pointerLockElement != null;
    this.onLockChange(this.locked);
  }

  _onClick() {
    if (!this.locked) this.requestLock();
  }
}
