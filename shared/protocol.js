// Shared protocol constants — imported by both the client and the server.
// Single source of truth for message type names.

export const MSG = Object.freeze({
  INIT: 'init',
  JOIN: 'join',
  STATE: 'state',
  LEAVE: 'leave',
});

// Server-assigned player colors, cycled round-robin.
export const PLAYER_COLORS = Object.freeze([
  0x4f86f7, // blue
  0xf76d4f, // orange
  0x7fdb6a, // green
  0xc779ff, // violet
  0xffd166, // yellow
  0xef476f, // pink
  0x06d6a0, // teal
  0xf4a261, // sand
]);
