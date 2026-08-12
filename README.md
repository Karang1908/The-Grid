# GDGoC · The Grid

Chapter one of a 3D browser-based multiplayer game for GDGoC.

## What's in chapter one

- 3D open world rendered with [three.js](https://threejs.org/)
- Player spawns, free WASD movement, no boundaries
- Toggleable first-person and third-person cameras (press **C**)
- Procedural humanoid avatar with a hand-coded walk / run / idle cycle
- Live multiplayer over WebSocket: open two browser tabs and each tab's player appears in the other

## Run it

```sh
npm install
npm run dev
```

Then open <http://localhost:5173> in your browser.

The `dev` script starts both the Vite client (port 5173) and a small Node WebSocket server
(port 8080) via `concurrently`. The server uses Node 25's built-in `--watch` so it
auto-restarts when you edit `server/index.js`.

Click the canvas to capture the mouse, then WASD to move, Shift to run, C to toggle camera.
Press Esc to release the mouse.

## Project layout

```
shared/protocol.js     # WebSocket message type constants (single source of truth)
src/
  main.js              # bootstrap + animation loop
  world/               # terrain + scattered props
  avatar/              # procedural humanoid + walk-cycle animation
  camera/              # camera rig + pointer-lock input
  player/              # local + remote player controllers
  net/                 # WebSocket client
  utils/               # math helpers
server/index.js        # Node ws server (relay + connect/disconnect bookkeeping)
```

## Stack

- `three` 0.185 — WebGL rendering
- `vite` 8.x — dev server / bundler
- `ws` 8.x — WebSocket server
- `concurrently` 10.x — run client + server in one terminal

No physics engine, no asset pipeline, no auth. Deliberately bare — the full game comes
in later chapters.