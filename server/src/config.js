const encryptionKey = process.env.ENCRYPTION_KEY || 'WuzenX2026DefaultKey!@#$%^&*()';

const config = {
  botToken: process.env.BOT_TOKEN || '',
  adminIds: (process.env.ADMIN_IDS || '').split(',').filter(Boolean).map(Number),
  channelId: process.env.CHANNEL_ID || '',
  renderUrl: process.env.RENDER_URL || 'http://localhost:3000',
  dashboardUser: process.env.DASHBOARD_USER || 'admin',
  dashboardPass: process.env.DASHBOARD_PASS || 'wuzen',

  BASE_APK_URL: process.env.BASE_APK_URL || '',
  SERVER_URL: process.env.SERVER_URL || '',
  ENCRYPTION_KEY: encryptionKey,
  encryptionKey,
  KEYSTORE_BASE64: process.env.KEYSTORE_BASE64 || '',
  KEYSTORE_PASS: process.env.KEYSTORE_PASS || 'WuzenX2026!',
  KEY_ALIAS: process.env.KEY_ALIAS || 'wuzenx'
};

export default config;   // apk-builder.js
export { config };       // bot.js, utils.js
