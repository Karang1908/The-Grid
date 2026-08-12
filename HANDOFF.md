# GDGoC · The Grid — Session Handoff

A comprehensive engineering document capturing the entire architecture, implementation details, and known quirks of this codebase. This file supersedes the README for onboarding purposes.

---

## 1. What this is

A 3D browser-based open-world sandbox game built for **GDGoC** (Google Developer Groups on Campus). This project uses the **PlayCanvas** engine for WebGL/WebGPU rendering and **Rapier3D** for highly performant WebAssembly physics. 

Currently, the game features a fully procedural open world containing:
- A central city grid with generated skyscrapers and interior furniture.
- A remote forested campsite area.
- Drivable multi-part vehicles.
- A high-fidelity animated humanoid soldier avatar.
- Advanced player mechanics including First/Third Person toggling, jumping, a Prone mechanic for crawling, and a "Hold E" circular radial progress interaction for vehicles.

Repo: `https://github.com/Karang1908/The-Grid`
Local path: `/Users/karangarg/Desktop/GDGoC-TheGrid`

---

## 2. How to run

```sh
npm install
npm run dev
```

Then open <http://localhost:5173>. The game runs using Vite for instantaneous Hot Module Replacement (HMR).

### Controls
- **Click** the canvas to lock the mouse pointer.
- **WASD** / **Arrow keys** → Move avatar relative to the camera heading.
- **Space** → Jump (only works when standing).
- **Z** → Toggle Prone. The character dives onto their stomach, the physics hitbox dynamically shrinks to allow crawling under low obstacles, and movement speed is reduced to a tactical crawl.
- **V** → Toggle camera perspective (First-person vs. Third-person).
- **Hold E** → Enter/Exit a nearby vehicle. You must hold the key until the circular radial progress UI completes a full revolution (1.0 seconds).
- **Mouse** → Look around (Yaw + Pitch).
- **Esc** → Releases the pointer lock.

---

## 3. Tech Stack

| Component             | Tool | Role |
| --------------------- | ---- | ---- |
| **Graphics Engine**   | `playcanvas` | Renders the 3D world, handles lighting, shadows, materials, and animation state graphs. |
| **Physics Engine**    | `@dimforge/rapier3d-compat` | WebAssembly-based physics engine managing rigidbodies, colliders, and collision detection. |
| **Build Tool**        | `vite` | Dev server, asset bundler, and HMR provider. |

---

## 4. Project Layout

```text
GDGoC-TheGrid/
  package.json
  vite.config.js
  index.html                       # Entry point, houses the canvas and UI overlay divs
  HANDOFF.md                       # This engineering document
  public/
    textures/                      # grass.jpg, brick.jpg, wood.jpg, face.jpg
    models/
      soldier.glb                  # Realistic ThreeJS Vanguard soldier mesh + animations
  src/
    main.js                        # App bootstrap, PlayCanvas/Rapier init, asset loading pipeline
    player.js                      # Avatar setup, GLB loading, physics rig, animation blending, controls
    world/
      city.js                      # Procedural road network, forest generation, vehicle spawning
      building.js                  # Procedural skyscrapers, door/window holes, interior furniture, stairs
```

---

## 5. Architecture & Mechanics in Extreme Detail

### **A. Physics & Player Controller (`player.js`)**
The player is driven by a **Dynamic RigidBody** capsule in Rapier3D.
- **Rotation Locking**: The physics body's rotations are locked (`lockRotations()`). The player is essentially a sliding pill. Visual rotation is handled purely on the rendering side by reading the movement vector.
- **Stair Climbing & Friction**: The player collider's friction is explicitly forced to `0.0`. This prevents the dynamic capsule from snagging or abruptly halting when it collides with the invisible physics ramps placed on the stairs.
- **The Prone Mechanic (`Z`)**: 
  - **Physics Swap**: When prone is toggled, the existing standing physics collider is destroyed via `physicsWorld.removeCollider()`. A new, much shorter collider (`halfHeight = 0.1`) is created and attached to the same RigidBody. The body's translation is manually shifted down to prevent it from clipping through the floor.
  - **Visuals & Camera**: The `soldier.glb` mesh is rotated `-90` degrees around the X-axis so it lies flat on the ground. The first-person and third-person camera offsets are dynamically lowered to match the prone eye-level. Speed is reduced from `10` to `3`.
- **Hold-to-Interact (`E`)**:
  - The UI uses an absolute-positioned `div` containing an SVG `<circle>`.
  - The `stroke-dashoffset` CSS property is lerped over time based on `holdEProgress / 1.0` to draw a smooth radial progress bar.
  - Upon completion, the player's avatar is hidden, they are teleported to the vehicle's coordinates, and WASD inputs are routed directly into the car's kinematic coordinates.

### **B. Avatar Model & Animations (`soldier.glb`)**
The player uses a high-fidelity GLB model containing an armature and multiple animations.
- **Scale and Posture Adjustments**: The raw GLB export from Three.js is massive and authored with Z-up. To fix this without breaking bone translations:
  1. An empty `bodyRig` entity is created as a parent.
  2. The `bodyRig` is scaled to `0.015`.
  3. The instantiated GLB entity is given a local Euler rotation of `-90` on the X-axis to stand it upright within PlayCanvas.
- **Animation State Graph (`animStateGraph`)**: 
  - PlayCanvas requires an explicit state machine for animations.
  - The graph contains an `Idle` state and a `Walk` state.
  - A `speed` parameter (float) is updated every frame based on the length of the player's movement vector.
  - Transitions are defined: `Idle -> Walk` when `speed > 0.1`, and `Walk -> Idle` when `speed <= 0.1`.
  - The component automatically blends the animations together smoothly based on this graph.

### **C. World Generation (`city.js` & `building.js`)**
The entire environment is generated at runtime.
- **Deterministic RNG**: A `mulberry32` seeded random number generator is used globally to ensure the city layout, building heights, colors, and prop placements are identical every time the game runs.
- **Texture Loading Pipeline**: Textures are loaded asynchronously in `main.js`. To prevent the WebGPU backend from crashing due to unresolved assets, textures are *never* assigned to materials directly. Instead, they are assigned inside `texture.ready((asset) => { ... })` callbacks.
- **Building Construction**: Buildings are created by assembling primitive box entities.
  - **Holes (Windows/Doors)**: `createWallWithHole` slices a wall into up to 4 smaller boxes (top, bottom, left, right) to create a physical gap. Glass materials with `blendType = pc.BLEND_NORMAL` and `opacity = 0.4` are placed in the gaps.
- **Staircase Ramps**: Staircases are built visually using multiple small step boxes. However, Rapier3D dynamic bodies snag on stairs. Therefore, invisible physics ramps (`ColliderDesc.cuboid` rotated using quaternions matching the stair angle) are overlaid onto the stairs to provide a smooth, flat surface for the zero-friction player capsule to slide up.

---

## 6. Recent Fixes & Implementation History

- **WebGPU Loading Deadlock**: Initially, passing unloaded `pc.Asset` objects into materials was causing the engine to hang indefinitely at "Loading WebAssembly & WebGPU". The architecture was refactored so that textures are now passed down through the generation functions and strictly applied inside `.ready()` callbacks.
- **Blocky Rig Deprecation**: The previous manual box-rig avatar was completely removed. Replaced with the professional GLB soldier model.
- **Detached Limb Animation Bug**: A bug was introduced where scaling the GLB entity directly caused the animation bones to explode and detach limbs. This was fixed by shifting the `0.015` scaling factor to a parent `bodyRig` entity, preserving the local bone translation scales within the mesh.
- **Prone Hitbox Syncing**: The prone mechanic initially only visually rotated the model. It was updated to correctly destroy and recreate the Rapier physics collider on the fly, allowing the player to actually crawl under physical objects.

---

## 7. Open Questions / Next Steps

1. **Multiplayer Integration**: The WebSocket multiplayer logic from an older iteration of this codebase needs to be ported over. The `animStateGraph` speed parameter will need to be synced across the network so remote players animate correctly.
2. **Vehicle Physics**: Cars are currently driven via raw kinematic coordinate manipulation. They should be converted to proper Rapier Raycast Vehicles or rigidbodies with suspension constraints for realistic driving dynamics.
3. **Collision Optimization**: The procedural city currently generates thousands of individual static `ColliderDesc.cuboid` bodies (one for every wall segment, step, and piece of furniture). If performance becomes a bottleneck, the generation logic should be updated to merge static building colliders into single trimeshes.
