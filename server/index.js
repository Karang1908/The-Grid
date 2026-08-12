// Minimal WebSocket server for chapter one.
//
// Responsibilities:
//   - Assign each connecting client a UUID and a color (round-robin from PLAYER_COLORS)
//   - On connect: send INIT with the client's own id/color + a snapshot of all existing players
//   - Broadcast JOIN to every other client when a new player joins
//   - Relay STATE messages from a client to all other clients (no authoritative simulation)
//   - On disconnect: broadcast LEAVE to remaining clients
//
// JSON over text frames. No rate limiting, no auth, no persistence — explicitly out of scope.

import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { MSG, PLAYER_COLORS } from '../shared/protocol.js';

const PORT = 8080;

const wss = new WebSocketServer({ port: PORT });

// id -> { id, color, x, y, z, yaw, speed, isRunning, ws }
const players = new Map();
let colorIndex = 0;

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastOthers(senderId, message) {
  for (const [id, p] of players) {
    if (id === senderId) continue;
    send(p.ws, message);
  }
}

function snapshot(excludeId) {
  const out = [];
  for (const [id, p] of players) {
    if (id === excludeId) continue;
    out.push({
      id: p.id,
      color: p.color,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      speed: p.speed,
      isRunning: p.isRunning,
    });
  }
  return out;
}

wss.on('connection', (ws) => {
  const id = randomUUID();
  const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  colorIndex++;

  const player = {
    id,
    color,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    speed: 0,
    isRunning: false,
    ws,
  };
  players.set(id, player);

  console.log(`[server] + connect ${id.slice(0, 8)} (color #${color.toString(16)}) -> ${players.size} players`);

  // First: INIT with own id/color + snapshot of existing players (excluding self).
  send(ws, { type: MSG.INIT, id, color, players: snapshot(id) });

  // Then: tell everyone else about the new join.
  broadcastOthers(id, { type: MSG.JOIN, id, color, x: 0, y: 0, z: 0, yaw: 0 });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      console.warn(`[server] bad JSON from ${id.slice(0, 8)}: ${err.message}`);
      return;
    }
    if (msg.type === MSG.STATE) {
      // Sanity-bound the values so a buggy client can't break everyone else.
      const x = Number.isFinite(msg.x) ? msg.x : 0;
      const y = Number.isFinite(msg.y) ? msg.y : 0;
      const z = Number.isFinite(msg.z) ? msg.z : 0;
      const yaw = Number.isFinite(msg.yaw) ? msg.yaw : 0;
      const speed = Number.isFinite(msg.speed) ? msg.speed : 0;
      const isRunning = !!msg.isRunning;

      player.x = x;
      player.y = y;
      player.z = z;
      player.yaw = yaw;
      player.speed = speed;
      player.isRunning = isRunning;

      broadcastOthers(id, {
        type: MSG.STATE,
        id,
        x, y, z,
        yaw,
        speed,
        isRunning,
      });
    }
  });

  ws.on('close', () => {
    players.delete(id);
    console.log(`[server] - disconnect ${id.slice(0, 8)} -> ${players.size} players`);
    broadcastOthers(id, { type: MSG.LEAVE, id });
  });

  ws.on('error', (err) => {
    console.warn(`[server] socket error ${id.slice(0, 8)}: ${err.message}`);
  });
});

console.log(`[server] WS server listening on :${PORT}`);
