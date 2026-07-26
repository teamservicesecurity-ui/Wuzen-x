import crypto from 'crypto';

export const config = {
  port: parseInt(process.env.PORT || '10000'),
  botToken: process.env.BOT_TOKEN || '',
  channelId: process.env.CHANNEL_ID || '',
  adminIds: (() => {
    try { return JSON.parse(process.env.ADMIN_IDS || '[]'); } 
    catch { return []; }
  })(),
  encryptionKey: process.env.ENCRYPTION_KEY || 
    crypto.createHash('sha256').update('WUZ3N-X-MASTER-K3Y-2026').digest('hex').slice(0, 64),
  sessionSecret: process.env.SESSION_SECRET || 'wuzen-x-session',
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  dashboardUser: process.env.DASHBOARD_USER || 'admin',
  dashboardPass: process.env.DASHBOARD_PASS || 'admin123',
  keystorePass: process.env.KEYSTORE_PASSWORD || 'wuzenx2026',
  keyAlias: process.env.KEY_ALIAS || 'wuzenx',
  renderUrl: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`,
};
