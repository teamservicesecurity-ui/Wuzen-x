import { WebSocketServer } from 'ws';
import EventEmitter from 'events';

const HEARTBEAT_MS = 25_000;

export class C2 extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.pending = new Map();
  }

  attachWss(wss) {
    wss.on('connection', (ws) => this.onConnection(ws));
    const timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    timer.unref?.();
  }

  onConnection(ws) {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'hello') {
        const id = String(msg.id || 'unknown');
        const existing = this.devices.get(id);
        const dev = {
          id,
          info: msg.info || existing?.info || {},
          online: true,
          ws,
          firstSeen: existing?.firstSeen || Date.now(),
          lastSeen: Date.now(),
          uptime: msg.uptime || 0,
          bufferSize: this.pending.get(id)?.length || 0
        };
        this.devices.set(id, dev);
        this.emit('event', 'device_online', { id, info: dev.info });

        const queue = this.pending.get(id) || [];
        this.pending.delete(id);
        queue.forEach((cmd) => this.sendCommand(id, cmd));
        return;
      }

      const dev = [...this.devices.values()].find((d) => d.ws === ws);
      if (!dev) return;

      if (msg.type === 'event') {
        this.emit('event', msg.event, { id: dev.id, ...(msg.data || {}) });
      } else if (msg.type === 'info') {
        dev.info = { ...dev.info, ...(msg.data || {}) };
        dev.lastSeen = Date.now();
      }
    });

    ws.on('close', () => {
      const dev = [...this.devices.values()].find((d) => d.ws === ws);
      if (dev) {
        dev.online = false;
        dev.ws = null;
        this.emit('event', 'device_offline', { id: dev.id, info: dev.info });
      }
    });

    ws.on('error', () => {});
  }

  heartbeat() {
    for (const dev of this.devices.values()) {
      if (!dev.ws) continue;
      if (!dev.ws.isAlive) {
        dev.ws.terminate();
        continue;
      }
      dev.ws.isAlive = false;
      dev.ws.ping();
    }
  }

  getDevices() {
    return [...this.devices.values()];
  }

  getOnlineDevices() {
    return this.getDevices().filter((d) => d.online);
  }

  getDevice(id) {
    return this.devices.get(id) || null;
  }

  getOnlineCount() {
    return this.getOnlineDevices().length;
  }

  getTotalCount() {
    return this.devices.size;
  }

  sendCommand(id, cmd) {
    const dev = this.devices.get(id);
    if (dev?.online && dev.ws?.readyState === 1) {
      dev.ws.send(JSON.stringify({ cmd }));
      return true;
    }
    if (!this.pending.has(id)) this.pending.set(id, []);
    this.pending.get(id).push(cmd);
    return false;
  }
}
