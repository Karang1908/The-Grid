// Minimal keystate tracker for movement + run.
//
// Usage:
//   const input = new InputState(window);
//   input.attach();
//   input.poll() returns { forward, right, run } each frame.

const KEY_FORWARD = new Set(['KeyW', 'ArrowUp']);
const KEY_BACKWARD = new Set(['KeyS', 'ArrowDown']);
const KEY_LEFT = new Set(['KeyA', 'ArrowLeft']);
const KEY_RIGHT = new Set(['KeyD', 'ArrowRight']);
const KEY_RUN = new Set(['ShiftLeft', 'ShiftRight']);
const KEY_TOGGLE_CAMERA = new Set(['KeyC']);

export class InputState {
  constructor(target = window) {
    this.target = target;
    this.keys = new Set();
    this.toggleCameraListeners = [];
    this._onDown = this._onDown.bind(this);
    this._onUp = this._onUp.bind(this);
  }

  attach() {
    this.target.addEventListener('keydown', this._onDown);
    this.target.addEventListener('keyup', this._onUp);
  }

  detach() {
    this.target.removeEventListener('keydown', this._onDown);
    this.target.removeEventListener('keyup', this._onUp);
  }

  onToggleCamera(fn) {
    this.toggleCameraListeners.push(fn);
  }

  _onDown(e) {
    this.keys.add(e.code);
    if (KEY_TOGGLE_CAMERA.has(e.code)) {
      for (const fn of this.toggleCameraListeners) fn();
    }
  }

  _onUp(e) {
    this.keys.delete(e.code);
  }

  _any(set) {
    for (const k of this.keys) if (set.has(k)) return true;
    return false;
  }

  poll() {
    const forward = (this._any(KEY_FORWARD) ? 1 : 0) - (this._any(KEY_BACKWARD) ? 1 : 0);
    const right = (this._any(KEY_RIGHT) ? 1 : 0) - (this._any(KEY_LEFT) ? 1 : 0);
    const run = this._any(KEY_RUN);
    return { forward, right, run };
  }
}
