// Pointer-lock mouse-look with drag fallback.
// Independent of CameraRig so the rig can be unit-shaped without a DOM dependency.

const DEFAULT_SENSITIVITY = 0.0025;

export class PointerLockInput {
  constructor(canvasEl, { sensitivity = DEFAULT_SENSITIVITY, onLockChange } = {}) {
    this.canvas = canvasEl;
    this.sensitivity = sensitivity;
    this.onLockChange = onLockChange || (() => {});
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;
    this._isMouseDown = false;
    this._lastX = null;
    this._lastY = null;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  getAngles() {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  attach() {
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.addEventListener('click', this._onClick);
  }

  detach() {
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.removeEventListener('click', this._onClick);
  }

  requestLock() {
    if (this.locked) return;
    try {
      if (document.body && typeof document.body.requestPointerLock === 'function') {
        const res = document.body.requestPointerLock();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch (e) {
      // Ignore pointer lock permission rejection in automated or restricted browsers
    }
  }

  _onMouseDown(e) {
    if (e.button === 0) {
      this._isMouseDown = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    }
  }

  _onMouseUp() {
    this._isMouseDown = false;
    this._lastX = null;
    this._lastY = null;
  }

  _onMouseMove(e) {
    let dx = e.movementX;
    let dy = e.movementY;

    if (dx === undefined || isNaN(dx)) {
      if (this._lastX !== null && this._lastY !== null) {
        dx = e.clientX - this._lastX;
        dy = e.clientY - this._lastY;
      } else {
        dx = 0;
        dy = 0;
      }
    }

    this._lastX = e.clientX;
    this._lastY = e.clientY;

    if (this.locked || this._isMouseDown) {
      this.yaw -= dx * this.sensitivity;
      this.pitch -= dy * this.sensitivity;
      // Clamp pitch to avoid gimbal flip at +/-90 deg.
      const LIMIT = Math.PI / 2 - 0.08;
      if (this.pitch > LIMIT) this.pitch = LIMIT;
      if (this.pitch < -LIMIT) this.pitch = -LIMIT;
    }
  }

  _onPointerLockChange() {
    this.locked = document.pointerLockElement != null;
    this.onLockChange(this.locked);
  }

  _onClick() {
    if (!this.locked) this.requestLock();
  }
}
