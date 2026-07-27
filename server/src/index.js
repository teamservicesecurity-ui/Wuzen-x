import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { setupWebSocket } from './ws.js';
import { setupBot } from './bot.js';
import { setupDashboard } from './dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '2.0', timestamp: Date.now() });
});

// Setup WebSocket server
const wss = setupWebSocket(server);
console.log('[WuzenX] WebSocket server initialized');

// Setup Telegram bot
const bot = setupBot();
console.log('[WuzenX] Telegram bot initialized');

// Setup dashboard
setupDashboard(app);
console.log('[WuzenX] Dashboard initialized');

// Start server
const PORT = config.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WuzenX] Server running on port ${PORT}`);
    console.log(`[WuzenX] Dashboard: http://localhost:${PORT}`);
    console.log(`[WuzenX] WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`[WuzenX] Health: http://localhost:${PORT}/health`);
});
