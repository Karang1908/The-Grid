// Thin WebSocket wrapper.
//
// Responsibilities:
//   - Connect to ws://<hostname>:8080
//   - Parse (JSON) and dispatch messages to provided callbacks
//   - Expose sendState() for the local loop
//   - Reconnect once after a 2s delay on close (no exponential backoff — chapter one)
//
// Status callbacks: onStatusChange('connecting' | 'open' | 'closed').

import { MSG } from '../../shared/protocol.js';

export class NetworkClient {
  constructor({
    url = `ws://${location.hostname}:8080`,
    onInit,
    onJoin,
    onState,
    onLeave,
    onStatusChange,
  } = {}) {
    this.url = url;
    this.onInit = onInit || (() => {});
    this.onJoin = onJoin || (() => {});
    this.onState = onState || (() => {});
    this.onLeave = onLeave || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.ws = null;
    this.selfId = null;
    this.selfColor = null;
    this._reconnectT = null;
  }

  connect() {
    this.onStatusChange('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.onStatusChange('open');
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch (err) {
        console.warn('network: bad JSON', err);
        return;
      }
      this._dispatch(msg);
    };
    ws.onclose = () => {
      this.onStatusChange('closed');
      this.ws = null;
      if (this._reconnectT) return;
      this._reconnectT = setTimeout(() => {
        this._reconnectT = null;
        this.connect();
      }, 2000);
    };
    ws.onerror = (e) => {
      console.warn('network: socket error', e);
    };
  }

  _dispatch(msg) {
    switch (msg.type) {
      case MSG.INIT: {
        this.selfId = msg.id;
        this.selfColor = msg.color;
        this.onInit(msg);
        break;
      }
      case MSG.JOIN: {
        // Don't notify for our own id (server shouldn't send it, but guard anyway).
        if (msg.id !== this.selfId) this.onJoin(msg);
        break;
      }
      case MSG.STATE: {
        if (msg.id !== this.selfId) this.onState(msg);
        break;
      }
      case MSG.LEAVE: {
        if (msg.id !== this.selfId) this.onLeave(msg);
        break;
      }
      default:
        console.warn('network: unknown msg type', msg.type);
    }
  }

  sendState(state) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: MSG.STATE, ...state }));
  }

  close() {
    if (this._reconnectT) {
      clearTimeout(this._reconnectT);
      this._reconnectT = null;
    }
    if (this.ws) this.ws.close();
  }
}
