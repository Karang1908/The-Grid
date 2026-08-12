# GDGoC · The Grid — Session Handoff

A single document capturing everything a future contributor (or future me) needs to pick up this codebase without re-deriving it. This file supersedes the README for onboarding purposes; the README is the user-facing quickstart, this is the engineering brain.

---

## 1. What this is

Chapter one of a 3D browser-based multiplayer game for **GDGoC** (Google Developer Groups on Campus). Goal of chapter one is a working foundation: a player spawns into a 3D open world, walks freely, has an animated humanoid avatar, can toggle between first-person and third-person cameras, and exists in a shared WebSocket world where other players' avatars appear and animate live.

The full game/theme comes in later chapters. This chapter deliberately leaves out: physics, collisions, anti-cheat, auth, persistence, asset pipeline, mobile input, anything beyond the foundation.

Repo: `https://github.com/Karang1908/The-Grid`
Local path: `/Users/karangarg/Desktop/GDGoC-TheGrid`

---

## 2. How to run

```sh
npm install
npm run dev
```

Then open <http://localhost:5173> in one or two browser tabs. The `dev` script starts both processes via `concurrently`:

| Process | Port | Source                   | Behavior                            |
| ------- | ---- | ------------------------ | ----------------------------------- |
| CLIENT  | 5173 | Vite (client dev server) | HMR-enabled static + module server |
| SERVER  | 8080 | Node `ws` (no Vite)      | Relays STATE, broadcasts JOIN/LEAVE |

**Node 25.9.0+ is required** — the `dev:server` script uses Node 25's built-in `--watch` for auto-restart on file change. No nodemon, no ts-node, no babel.

### Controls

- **Click** the "Click to play" overlay → captures the mouse.
- **WASD** / **Arrow keys** → walk (camera-relative).
- **Shift** + WASD → run.
- **Mouse** → look (yaw + pitch, pitch clamped ±~80°).
- **C** → toggle first-person / third-person camera.
- **Esc** → releases the pointer.
- **Hard-reload** (Cmd-Shift-R) if you change source and the page doesn't update — see §6 about a known Vite-HMR-staleness case.

### Build / preview

```sh
npm run build      # writes dist/ — 538 KB bundled (three.js is the bulk)
npm run preview    # serves the built dist/
```

No test suite exists. The build is the static surface check.

---

## 3. Stack

| Tool                  | Version  | Role                                  |
| --------------------- | -------- | ------------------------------------- |
| `three`               | 0.185.1  | WebGL rendering                       |
| `vite`                | 8.2.1    | Dev server + bundler                  |
| `ws`                  | 8.21.3   | WebSocket server (Node) + browser client |
| `concurrently`        | 10.0.4   | Run CLI + WS in one terminal          |
| Node                  | 25.9.0   | Runtime (uses built-in `--watch`)     |

No React, no TypeScript, no physics engine, no GLTF assets, no Tailwind. Vanilla JS modules under ESM (`"type": "module"` in `package.json`).

---

## 4. Project layout

```
GDGoC-TheGrid/
  package.json
  package-lock.json
  vite.config.js
  index.html                       # single page, two overlay divs + canvas mount
  HANDOFF.md                       # this file
  README.md                        # user-facing quickstart
  shared/
    protocol.js                    # MSG type constants + PLAYER_COLORS palette
  server/
    index.js                       # Node ws server: relay + connect/disconnect bookkeeping
  src/
    main.js                        # bootstrap + animation loop
    utils/
      math.js                      # clamp, lerp, dampT, lerpAngle, TAU
    world/
      createWorld.js               # ground (terrain) + lighting + sky/fog
      props.js                     # scattered trees/rocks/bushes/pillars
    avatar/
      createAvatar.js              # procedural humanoid hierarchy
      animateAvatar.js             # walk/idle/run cycle (pure function)
    camera/
      CameraRig.js                 # yaw/pitch state, mode toggle, placement math
      PointerLockInput.js          # pointer-lock + mousemove → yaw/pitch deltas
    player/
      InputState.js                # WASD/Shift key tracker
      LocalPlayer.js               # input → movement → avatar + net state out
      RemotePlayer.js              # network state → smoothed avatar in
    net/
      NetworkClient.js             # WebSocket wrapper + callbacks
  dist/                            # vite build output (generated, gitignored)
  node_modules/                    # deps (gitignored)
```

---

## 5. Architecture in one read

```
┌──────────── Browser tab ─────────────┐
│                                      │
│  index.html                          │
│    ├─ #overlay   (z=10, click-to-play)│
│    ├─ #app       (mounts <canvas>)    │
│    └─ #status    (bottom-left pill)   │
│                                      │
│  src/main.js                         │
│    ├─ THREE.WebGLRenderer + Scene    │
│    ├─ World + props (deterministic)  │
│    ├─ CameraRig          (3rd/1st)   │
│    ├─ PointerLockInput   (mouse)     │
│    ├─ InputState         (WASD/Shift)│
│    ├─ LocalPlayer        (avatar +   │
│    │                      movement)  │
│    ├─ NetworkClient      (WebSocket) │
│    ├─ RemotePlayer[]     (per peer)  │
│    └─ tick() @ 60fps                │
│         ├─ read yaw/pitch            │
│         ├─ if locked: update player  │
│         ├─ rig.update (camera)       │
│         ├─ remote.update for each    │
│         └─ 10 Hz: sendState()        │
└──────────────────┬───────────────────┘
                   │ ws://host:8080
                   ▼
┌──────────── Node server ─────────────┐
│  server/index.js                     │
│    ├─ players: Map<id, Player>       │
│    ├─ on connect: assign id+color,   │
│    │   send INIT, broadcast JOIN     │
│    ├─ on message: validate, update,  │
│    │   broadcast STATE to others     │
│    └─ on close: broadcast LEAVE      │
└──────────────────────────────────────┘
```

**Data flow on a tick:**
1. `pointerLock` reads `mousemove` → updates `yaw, pitch`.
2. `localPlayer.update(dt, input, yaw)` — gated on `pointerLock.locked`:
   - `input.poll()` → `{forward, right, run}`.
   - `movementBasis(yaw, ...)` → camera-relative forward/right vectors (pitch ignored so looking up doesn't move you).
   - advance `position` by `move * speed * dt`; `speed` is 4 m/s walk, 8 m/s run.
   - `position.y = heightAt(x, z)` (terrain lookup, not collision).
   - `facing` lerps toward movement direction (`lerpAngle`).
   - avatar root set to `position`, `rotation.y = facing`.
   - `animateAvatar(parts, animState, dt)` — pure walk/idle/run cycle.
3. `rig.update(position, yaw, pitch)` — places camera in first or third person.
4. Each `RemotePlayer.update(dt)` — `position.lerp(target, dampT(10, dt))`, `facing = lerpAngle(...)`, then `animateAvatar`.
5. `network.sendState(snapshot())` at 10 Hz.
6. `renderer.render(scene, camera)`.

**Data flow on a network event:**
- `INIT` → `localPlayer.id/color` updated, avatar rebuilt with new tint, existing players spawn as `RemotePlayer`s.
- `JOIN` → spawn new `RemotePlayer`.
- `STATE` → `remotePlayer.applyState(msg)` — sets target position/yaw and `animState.speed/isRunning`. Smoothing happens in `update`, not at apply time.
- `LEAVE` → `remotePlayer.dispose()` (removes from scene, disposes geometry/materials).

---

## 6. Bugs found and fixed this session

This is the part future-me will be most grateful to find. All three of these were *real* bugs in shipped code; the third one was found post-session and is the live state of the file.

### Bug 1 — Overlay eats the click

**Symptom (didn't occur in this session but was in the codebase):** clicking "Click to play" did nothing. Overlay never hid, pointer never locked, game appeared frozen.

**Cause:** `PointerLockInput` bound `click` to the canvas. The `#overlay` div sits at `position: fixed; inset: 0; z-index: 10` over the canvas. Overlay absorbs every click → canvas's `click` never fires → `requestPointerLock()` never called.

**Fix:** in `src/main.js`, added `overlay.addEventListener('click', () => pointerLock.requestLock());`. Now the overlay's own click triggers the lock request.

**Where in code:** `src/main.js:52`.

### Bug 2 — Lock state check used the wrong element

**Symptom:** after Bug 1's fix, the overlay still didn't hide. Game still appeared frozen.

**Cause:** `PointerLockInput._onPointerLockChange` was checking `document.pointerLockElement === this.canvas`. When the user clicks the overlay, the overlay becomes the locked element, not the canvas. So `pointerlockchange` fires with `pointerLockElement = overlay`, the comparison returns `false`, `this.locked` stays `false`, `onLockChange(false)` keeps the overlay visible, and the `if (pointerLock.locked)` gate in `tick()` keeps `localPlayer.update` from running.

**Fix:** changed the check to `document.pointerLockElement != null`. Pointer-lock is a binary state for our purposes; the specific element doesn't matter.

**Where in code:** `src/camera/PointerLockInput.js:64`.

### Bug 3 — Lock request on the wrong element

**Symptom (post-fix #2):** overlay still doesn't disappear, mouse-look still doesn't respond, WASD still doesn't move the avatar. Camera and input are completely static.

**Cause:** `PointerLockInput.requestLock()` calls `this.canvas.requestPointerLock()`. The click event that reaches this method originates on the overlay, not the canvas. The PointerLock spec requires `requestPointerLock()` to be called inside a user-gesture handler whose target is (or at least contains) the element being locked. Chrome in particular silently rejects `canvas.requestPointerLock()` from a click on a different element. Safari is more permissive. The user is on Chrome.

**Fix:** changed `requestLock()` to call `document.documentElement.requestPointerLock()`. The `<html>` element is always present, accepts pointer-lock identically to any other element, and the call still originates inside a user-gesture handler (the click).

**Where in code:** `src/camera/PointerLockInput.js:38-47`.

### Bug 4 (diagnostic) — Status pill was a black box

**Symptom:** after two patches the user still reported no movement. Without knowing what the browser was actually doing, another guess would just be the third coin flipped.

**Fix:** `onLockChange` now writes the actual lock state to the bottom-left status pill: `connected · locked on HTML` (success on document element), `connected · locked on DIV#overlay` (success on overlay), or `connected · unlocked` (lock denied / not engaged). The pill is the cheapest possible way to turn "I can't see your browser" into "I can see what your browser is doing."

**Where in code:** `src/main.js:42-54`.

**What the user should see after clicking the overlay (once Bug 3 fix is verified):**
- Overlay disappears.
- Status pill changes to `connected · locked on HTML`.
- Mouse motion moves the camera (yaw/pitch).
- WASD moves the avatar, drives the walk cycle, and the avatar's body rotates toward its movement direction.

If the pill instead stays at `connected · unlocked` after clicking, the lock request was denied — environment problem (focus, extension, browser setting), not code.

### Bug 5 — `pointerLock.locked` is stale during the first locked frame

**Not encountered but worth noting:** `onLockChange` and `_onPointerLockChange` set `this.locked` synchronously during the `pointerlockchange` event. The `tick()` loop reads `pointerLock.locked` on the next frame. There's a one-frame gap where the lock has engaged but the next frame hasn't run yet. Doesn't cause visible stutter in practice; flagged here so it's not a mystery later.

---

## 7. Per-file documentation

### `package.json`

```json
{
  "type": "module",
  "scripts": {
    "dev": "concurrently -n CLIENT,SERVER -c blue,green \"npm:dev:client\" \"npm:dev:server\"",
    "dev:client": "vite",
    "dev:server": "node --watch server/index.js",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": { "three": "^0.185.1", "ws": "^8.21.3" },
  "devDependencies": { "vite": "^8.2.1", "concurrently": "^10.0.4" }
}
```

`"type": "module"` is what lets us use `import`/`export` in `.js` files without a build step. Node 25's `--watch` is what makes the WS server hot-reload on save without nodemon.

### `vite.config.js`

```js
import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022' },
});
```

`strictPort: true` so the dev server fails loudly if 5173 is taken instead of silently picking 5174. (See "Noticed, not touched" in §8 — there are two vite processes on this machine.)

ES2022 target because we use optional chaining, nullish coalescing, etc., and modern browsers only.

### `index.html`

Single page. Three DOM elements:

- `#app` — `position: fixed; inset: 0;` mount point for the WebGL canvas. Mounted by `main.js` via `appEl.appendChild(renderer.domElement)`.
- `#overlay` — `position: fixed; inset: 0; z-index: 10; cursor: pointer;` with `.hidden { display: none; }`. The "Click to play" card. Toggled by `onLockChange`.
- `#status` — bottom-left pill. The dot is red → not connected, green → connected. Text shows the current state (now expanded to show lock state — see §6 Bug 4).

Imports `/src/main.js` as a module. Everything else is procedural in JS.

### `shared/protocol.js`

Single source of truth for message type names and the player color palette. Imported by both client and server.

```js
export const MSG = Object.freeze({
  INIT: 'init',
  JOIN: 'join',
  STATE: 'state',
  LEAVE: 'leave',
});

export const PLAYER_COLORS = Object.freeze([
  0x4f86f7, 0xf76d4f, 0x7fdb6a, 0xc779ff,
  0xffd166, 0xef476f, 0x06d6a0, 0xf4a261,
]);
```

`Object.freeze` on both: `MSG` is a string-keyed const lookup, `PLAYER_COLORS` is a fixed array. The server uses `colorIndex` to round-robin through the array.

### `server/index.js`

Node `ws` server on port 8080. **Pure relay** — no authoritative simulation, no rate limiting, no auth.

**State:** `players: Map<id, Player>` where `Player = { id, color, x, y, z, yaw, speed, isRunning, ws }`. Plus `colorIndex` for round-robin.

**On connect:**
1. Generate `id = randomUUID()`.
2. Pick `color = PLAYER_COLORS[colorIndex % 8]`, increment index.
3. Add to `players`.
4. Send INIT to the new client: `{ type: INIT, id, color, players: snapshot(self.id) }`. `snapshot` is all players except `self`, with their known fields.
5. Broadcast JOIN to all *other* clients.

**On STATE message:**
1. Parse JSON. Warn + drop on bad JSON.
2. `Number.isFinite` sanity-check each of `x/y/z/yaw/speed`. Coerce to 0 if not finite. `isRunning` is coerced to boolean. This guards against a buggy client breaking everyone.
3. Update the player's stored state.
4. Broadcast STATE to other clients.

**On close:** remove from `players`, broadcast LEAVE.

**Logging:** `console.log` on connect/disconnect with truncated UUID and color hex. `console.warn` on bad JSON or socket errors.

**Why no authoritative simulation:** chapter one is a stub. Position is whatever the client says it is. A malicious client could teleport. Out of scope.

### `src/main.js`

Bootstrap. ~160 lines. The file to read first.

**Order of operations:**
1. THREE scene + camera + renderer; renderer appended to `#app`.
2. `createWorld(scene)` — terrain, lighting, sky/fog. Returns `{ heightAt }`.
3. `scatterProps(scene, heightAt)` — 120 deterministic props.
4. `CameraRig(camera)` — defaults to `mode = 'third'` so you see your own avatar on spawn.
5. `InputState(window)` — global key tracker.
6. `InputState.onToggleCamera(() => rig.toggleMode())` — `C` key.
7. `PointerLockInput(canvasEl, { onLockChange })` — see §6 for the fixes.
8. `LocalPlayer({ id: 'pending', color: 0x4f86f7, heightAt })` — built with a placeholder id/color; the avatar is *not* added to the scene until just after. Wait — actually it is: `scene.add(localPlayer.avatar.root)` runs immediately. The placeholder color gets swapped to the server's color on INIT.
9. `remotePlayers = new Map()`, `remoteContainer = new Group()`, `scene.add(remoteContainer)`.
10. `NetworkClient({ onInit, onJoin, onState, onLeave, onStatusChange })`. `connect()`.
11. `tick()` loop at `requestAnimationFrame`.

**Animation loop (`tick`):**

```js
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05); // clamp dt to avoid huge jumps after tab inactivity
  const yaw = pointerLock.yaw;
  const pitch = pointerLock.pitch;
  if (pointerLock.locked) localPlayer.update(dt, input, yaw);
  rig.update(localPlayer.position, yaw, pitch);
  for (const rp of remotePlayers.values()) rp.update(dt);
  lastSendAt += dt * 1000;
  if (lastSendAt >= SEND_INTERVAL_MS) {
    network.sendState(localPlayer.snapshot());
    lastSendAt = 0;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
```

The `if (pointerLock.locked)` gate is why input is dead while the overlay is up — and why Bug 2 mattered.

**Avatar color swap on INIT:** `swapAvatarColor(localPlayer, msg.color)` rebuilds the avatar with a new tint and re-parented to the scene. The local player's `position` and `facing` are preserved across the swap.

**Resize:** `camera.aspect` updated, `renderer.setSize` called on `window.resize`.

### `src/utils/math.js`

Pure helpers. No `THREE` dependency so they can be imported anywhere.

```js
export const TAU = Math.PI * 2;
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dampT(k, dt) { return 1 - Math.exp(-k * dt); }   // frame-rate independent smoothing
export function lerpAngle(a, b, t) { /* shortest-path wrap to [-PI, PI] */ }
```

`dampT(k, dt)` is the right idiom for "approach target with half-life `1/k` seconds." Used everywhere for smoothing.

### `src/world/createWorld.js`

**Deterministic** layered-sine heightmap. No noise library.

```js
function heightAt(x, z) {
  return (
    Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.2 +
    Math.sin(x * 0.13 + 1.7) * Math.cos(z * 0.09 - 0.4) * 0.5
  );
}
```

Amplitude ~1.5m over 400m. Gentle rolling hills so movement doesn't feel like walking on a spike field.

**World build:**
- `scene.background = new THREE.Color(0x8ec9f0)` (sky blue).
- `scene.fog = new THREE.Fog(0x8ec9f0, 40, 220)` — same color, fades distant terrain so it doesn't hard-clip.
- `HemisphereLight(0xbfd9ff, 0x3d7a3d, 0.8)` — sky/ground fill.
- `DirectionalLight(0xfff2d6, 1.2)` at `(60, 100, 30)` — sun. **Shadows off** for chapter one.
- `PlaneGeometry(400, 400, 100, 100)` rotated flat, vertices displaced by `heightAt`, vertex normals recomputed. `MeshStandardMaterial(0x3d7a3d, flatShading: true, roughness: 0.95)`.

Returns `{ ground, heightAt }`. The `heightAt` is what every avatar and prop uses to sit on the ground.

### `src/world/props.js`

120 procedurally-scattered props in a ring around the spawn point. **Deterministic** via `mulberry32(1337)` so the layout is identical across clients.

```js
const CLEAR_RADIUS = 8;        // empty zone around spawn
const SCATTER_RADIUS = 150;
const COUNT = 120;
```

For each prop: pick `(angle, radius)` in `[CLEAR, SCATTER]`, get `y = heightAt(x, z)`, pick a kind:
- **50%** — tree (trunk cylinder + cone leaves).
- **25%** — rock (icosahedron, scaled and rotated).
- **20%** — bush (squashed sphere).
- **5%** — pillar (thin cylinder, 4.5m tall, distant landmark).

All materials are `MeshStandardMaterial` with `flatShading: true` and the palette baked in: trunk `0x6b4a2b`, leaves `0x2f6b2f`, rock `0x888888`, bush `0x2a5a2a`, pillar `0xcccac0`.

### `src/avatar/createAvatar.js`

Builds a procedural humanoid ~1.7m tall as a `THREE.Group` joint hierarchy. All joints are `THREE.Group`s with their local origin at the rotation pivot; meshes are offset *downward* from the pivot so a neutral (zero rotation) pose has the limb hanging straight down.

```
avatarRoot (feet at y=0)
  └─ hips (y=0.9)
       ├─ torso (capsule, y=0.45 center)
       ├─ head (group at y=1.0; sphere y=0.16)
       ├─ left upper arm (group at (±0.28, 0.85, 0); mesh extends down)
       │   └─ left lower arm (group at y=-0.36; mesh extends down)
       ├─ right upper arm (mirror)
       ├─ left upper leg (group at (±0.12, 0, 0); mesh y=-0.21)
       │   └─ left lower leg (group at y=-0.42)
       └─ right upper leg (mirror)
```

Skin color is `0xeac8a3` (neutral). All other parts take the `tintColor` parameter (per-player color).

**Returns:**
```js
{
  root: avatarRoot,
  parts: { hips, head, leftUpperArm, leftLowerArm, rightUpperArm, rightLowerArm,
           leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg },
  _baseHipY: hips.position.y,
  dispose() { /* walks the tree and disposes geometry/materials */ },
}
```

`_baseHipY` is captured so the animation code can return to it after the hip bob. `dispose` is what `RemotePlayer.dispose()` calls when a peer leaves — without it, leaving players leak GPU memory.

### `src/avatar/animateAvatar.js`

**Pure function** called identically for the local player and every remote player. The same state machine works because remote players send `{ speed, isRunning }` too.

```js
animateAvatar(parts, animState, dt)
```

Where `animState = { speed, isRunning, runtime, baseHipY }`. The function:
- **Lazy-initializes `runtime`** on first call: `{ phase, runBlend, idleTime }`.
- **Smooths `runBlend`** → 0 if not running, 1 if running, lerped with `dampT(6, dt)`. Prevents gait popping.
- **Advances `phase`** by `speed * 1.6 * dt` — phase advanced by *distance traveled*, so framerate doesn't change stride length.
- **Walks stride ranges** by `runBlend` so transition from walk to run is a continuous blend, not a discrete switch.
- **Legs swing contralateral** via `sin(phase)` / `sin(phase + PI)`.
- **Knees bend** only on the swing phase (gated on `sin > 0`).
- **Arms counter-swing** to same-side leg.
- **Forearms** always slightly bent, more when running.
- **Hip bob** — `abs(sin(phase)) * profile * walkBlend`, applied to `hips.position.y` with `dampT(12, dt)` smoothing toward the target.
- **Idle drift** — when `walkBlend` is low, all joint rotations `lerp` toward 0 with `dampT(8, dt) * idleFactor`. Subtle head bob as a finishing touch.

Key constants to know:
- `WALK_THRESHOLD = 0.3` — speed at which `walkBlend` saturates to 1.
- `STRIDE_SCALE = 1.6` — phase-per-meter.
- `LEG_SWING_IDLE/RUN = 0.5 / 0.9` — leg swing amplitude in radians.
- `KNEE_BEND_IDLE/RUN = 0.9 / 1.3` — knee bend in radians.
- `HIP_BOB_IDLE/RUN = 0.03 / 0.08` — hip bob in meters.

### `src/camera/CameraRig.js`

Drives the `THREE.PerspectiveCamera` from yaw/pitch and a mode flag.

```js
const FIRST_PERSON_EYE_HEIGHT = 1.6;
const THIRD_PERSON_TARGET_HEIGHT = 1.4;
const THIRD_PERSON_DISTANCE = 4.5;
const PITCH_LIMIT = Math.PI / 2 - 0.08;
```

**First person:** camera at `(player.x, player.y + 1.6, player.z)`, rotation from `Euler(clampPitch(pitch), yaw, 0, 'YXZ')`.

**Third person:** spherical offset behind/above using both yaw and pitch:
```js
forward = (-sin(yaw)cos(pitch), sin(pitch), -cos(yaw)cos(pitch))
camera.position = target + forward * -DISTANCE
camera.lookAt(target)
```
where `target = (player.x, player.y + 1.4, player.z)`.

**`movementBasis(yaw, outForward, outRight)`** — exported helper. Returns the camera-relative forward/right direction vectors *projected onto the ground plane* (y=0). Used by `LocalPlayer` so movement is camera-relative in heading but doesn't tilt when you look up/down.

`mode` starts at `'third'` so you see your own avatar on spawn. Press `C` to toggle.

### `src/camera/PointerLockInput.js`

The most-bug-fixed file in the codebase. See §6 for the three patches.

**Current state (post-fix):**

```js
requestLock() {
  if (this.locked) return;
  document.documentElement.requestPointerLock();  // Bug 3 fix
}

_onMouseMove(e) {
  if (!this.locked) return;
  this.yaw -= e.movementX * 0.0025;
  this.pitch -= e.movementY * 0.0025;
  // clamp pitch to ±~80°
}

_onPointerLockChange() {
  this.locked = document.pointerLockElement != null;  // Bug 2 fix
  this.onLockChange(this.locked);
}
```

**Constructor signature:** `new PointerLockInput(canvasEl, { sensitivity = 0.0025, onLockChange })`. The `canvasEl` is stored but only used for the now-redundant `_onClick` listener (`this.canvas.addEventListener('click', this._onClick)`). After Esc, the overlay is hidden, so the canvas click handler is what re-acquires the lock. Either way, `requestLock` calls `document.documentElement.requestPointerLock()`.

**Initial state:** `yaw = 0, pitch = 0, locked = false`.

### `src/player/InputState.js`

Tiny key tracker. Attach once via `input.attach()`, poll every frame via `input.poll()`.

```js
poll() → { forward, right, run }
// forward = +1 if W/Up, -1 if S/Down, else 0
// right   = +1 if D/Right, -1 if A/Left, else 0
// run     = true if either Shift held
```

`onToggleCamera(fn)` registers callbacks for the `KeyC` keydown. `LocalPlayer` doesn't listen; `CameraRig` toggles via the listener registered in `main.js`.

### `src/player/LocalPlayer.js`

Owns the local avatar, applies input, drives the walk-cycle, exposes the network snapshot.

```js
const WALK_SPEED = 4.0;
const RUN_SPEED = 8.0;
```

**Per-frame:**
1. `input.poll()` → `{ forward, right, run }`.
2. `movementBasis(yaw, forward, right)` → camera-relative directions.
3. Build `_move = forward * fwd + right * rgt`. If `length > 0`, normalize, advance `position` by `move * speed * dt`.
4. `position.y = heightAt(x, z)` — keep on terrain.
5. If `length > 0`, set `facing = lerpAngle(facing, atan2(-move.x, -move.z), dampT(12, dt))`. The `atan2(-x, -z)` is because `yaw = 0` should face `-Z` (camera forward).
6. `avatar.root.position = position`, `avatar.root.rotation.y = facing`.
7. `animState.speed = speed`, `animState.isRunning = run`.
8. `animateAvatar(parts, animState, dt)`.

**`snapshot()`** → `{ x, y, z, yaw: facing, speed, isRunning }`. Sent over the wire at 10 Hz.

**`dispose()`** — removes avatar from scene and calls `avatar.dispose()`.

### `src/player/RemotePlayer.js`

Renders another player's avatar. Position/yaw are smoothed toward the latest network state every frame; the walk cycle runs every frame, so remote avatars animate smoothly between 10 Hz updates instead of twitching.

**State:**
- `position` — **alias** for `avatar.root.position` (so `this.position.lerp(...)` directly updates the scene graph).
- `targetPos` — latest known network position.
- `targetYaw` — latest known network yaw.
- `animState` — same shape as `LocalPlayer.animState`, populated from incoming STATE.

**`applyState(state)`** — just stores targets. No snapping.

**`update(dt)`:**
1. `position.lerp(targetPos, dampT(10, dt))`.
2. `facing = lerpAngle(facing, targetYaw, dampT(10, dt))`.
3. `avatar.root.rotation.y = facing`.
4. `animateAvatar(parts, animState, dt)`.

**`dispose()`** — removes avatar from scene, calls `avatar.dispose()`.

### `src/net/NetworkClient.js`

Thin WebSocket wrapper.

```js
new NetworkClient({
  url = `ws://${location.hostname}:8080`,  // not localhost — works on LAN
  onInit, onJoin, onState, onLeave, onStatusChange,
})
```

`url` derives from `location.hostname` so the same build works on two devices on a LAN, not just two tabs on one machine.

**Lifecycle:**
- `connect()` — opens `WebSocket`, sets `onopen`/`onmessage`/`onclose`/`onerror`, fires `onStatusChange('connecting')`.
- `onopen` → `onStatusChange('open')`.
- `onmessage` → JSON parse → `_dispatch(msg)`.
- `onclose` → `onStatusChange('closed')`, schedule a single reconnect after 2s (no exponential backoff).

**`_dispatch(msg)`** switches on `msg.type`:
- `INIT` → cache `selfId`/`selfColor`, call `onInit(msg)`.
- `JOIN` → if `msg.id !== selfId`, call `onJoin(msg)`.
- `STATE` → if `msg.id !== selfId`, call `onState(msg)`.
- `LEAVE` → if `msg.id !== selfId`, call `onLeave(msg)`.
- default → `console.warn('network: unknown msg type', msg.type)`.

**`sendState(state)`** — guards on `readyState === OPEN`, sends `{ type: MSG.STATE, ...state }`.

**Reconnect design:** single retry after 2s. If the connection is closed again within the retry window, the timer is cleared by `close()`. The `node --watch` server will restart on save, so the retry window is enough to recover.

---

## 8. Operational notes

### Vite HMR vs hard-reload

Vite HMR updates JS modules in place, but `main.js` is the bootstrap — its top-level execution creates the scene, camera, renderer, etc. When Vite HMR replaces `main.js`, the **new** module executes and creates a *second* scene/renderer that gets appended to the DOM without removing the old one. The status pill and overlay also re-attach. This often looks like the page "having two of everything" or "not updating."

**Fix:** hard-reload (Cmd-Shift-R) after any change to `main.js`. Changes to deeper modules (and pointer-lock fixes) HMR cleanly.

### Two vite processes on this machine

`ps -A` shows two vite processes:

- `~/Desktop/taylorwebsite/node_modules/.bin/vite` (port 5173)
- `~/Desktop/GDGoC-TheGrid/node_modules/.bin/vite` (port 5173)

Both are bound to `:5173` because `strictPort: true` was honoured by the second one and the first got it first. **This is a cross-project accident**, not a bug in this repo. But if your browser hits `localhost:5173` and somehow gets the taylorwebsite app, that's why the "Click to play" overlay doesn't appear (or appears different). Stop the bleeding by killing the taylorwebsite vite when working on this project, or move it to a different port.

### Build output size

`dist/assets/index-*.js` is ~538 KB (136 KB gzipped). Three.js is the bulk. Not a problem to optimize in chapter one.

### Common gotchas

- **Vite HMR double-execution.** See above.
- **`onStatusChange` overwrites `statusText.textContent`.** If you add a new layer of status (lock state, peer count, etc.), update both `onStatusChange` and `onLockChange` to coordinate, or recompute the text in a single `updateStatus()` function that's called from both.
- **No `pointerLockElement` in Node tests.** If you write unit tests, you'll need to mock `document.pointerLockElement` before testing `PointerLockInput._onPointerLockChange`.
- **The `pointerLock.locked` gate in `tick()`** is the chokepoint for "is the game playable." Any future "let me try without pointer-lock" toggle needs to be careful here, or movement will be impossible from a non-focused tab.

---

## 9. Open questions / next steps

In rough order of priority:

1. **Verify the lock fix end-to-end in a real browser.** The user has reported two failed attempts. The diagnostic in the status pill (§6 Bug 4) should make the next attempt decisive. If the pill says `connected · unlocked` after clicking, the lock is being denied by the browser — that's a different problem (extension? iframe? focus?) and we need a DevTools console log to debug further.
2. **A real test suite.** Even one vitest config with a mock for `document.pointerLockElement` and a fake `WebSocket` would have caught bug 2 immediately. Chapter two.
3. **Camera-collision raycast.** Currently third-person camera clips through props. Out of scope for chapter one, but expected in chapter two.
4. **Shadows.** Chapter one disables them for performance. Re-enable in chapter two with a small `shadowMap` and `castShadow` on the sun.
5. **Player count / UI.** No in-game list of who's connected. Out of scope.
6. **Asset pipeline.** Everything is procedural. Chapter two will likely introduce a GLTF model with proper rigging — at which point `animateAvatar` will need to be replaced by an `AnimationMixer`-based approach. The `parts` API in `createAvatar` is the seam to break.
7. **Authoritative server.** Right now the client is trusted. Don't trust it.

---

## 10. Verbatim transcript of the multiplayer end-to-end probe

For the record, here's what the live WS server does when two clients connect. Reproduced from this session with a Node WS probe (`/tmp/mp_probe.mjs`):

```
[oy0v] A open
[oy0v] A INIT id= cfe80295 color= f76d4f existing= 1
[a126] B open
[a126] B INIT id= ddd112b4 color= 7fdb6a existing= 2
[oy0v] A JOIN id= ddd112b4 color= 7fdb6a
[a126] B STATE id= cfe80295 pos= 0.5 0.0 0.9 speed= 4
... (16 more STATE messages) ...
[oy0v] A close 1005
[a126] B close 1005
```

Expected at the time: `INIT` on first connect, `JOIN` on second connect (broadcast to first), `STATE` relay from first to second, clean close. All observed. **The multiplayer protocol is verified working.** The fix to the local input path is what makes it visible.

---

## 11. Glossary

- **dt** — delta time in seconds since last frame. Clamped to 0.05 (50ms) to survive tab inactivity.
- **yaw** — horizontal rotation (radians, unbounded).
- **pitch** — vertical rotation (radians, clamped ±~80°).
- **dampT(k, dt)** — `1 - exp(-k * dt)`. The lerp factor that achieves "approach target with half-life `1/k` seconds." Frame-rate independent.
- **lerpAngle(a, b, t)** — shortest-path angular interpolation. Use this for rotations, not raw `lerp`.
- **walkBlend** — `clamp(speed / 0.3, 0, 1)`. 0 when stationary, 1 when walking fast enough.
- **runBlend** — same idea but driven by `isRunning`, smoothed via `dampT(6, dt)`. Prevents gait popping.
- **mulberry32** — small fast seeded PRNG. Used in `props.js` so the prop layout is identical across clients.
- **INIT/JOIN/STATE/LEAVE** — see `shared/protocol.js`.

---

End of handoff. Update this file when the codebase changes meaningfully — especially the "bugs found and fixed" section, the file list, and the constraints in §8.
