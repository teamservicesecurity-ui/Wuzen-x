import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from './config.js';

const ANDROID_HOME = process.env.ANDROID_SDK_ROOT || '/opt/android-sdk';
const BUILD_TOOLS = path.join(ANDROID_HOME, 'build-tools', '35.0.0');
const KEYSTORE_PATH = path.join(process.cwd(), 'keystore.jks');

export function ensureKeystore() {
  if (!fs.existsSync(KEYSTORE_PATH)) {
    execSync(
      `keytool -genkey -v -keystore "${KEYSTORE_PATH}" ` +
      `-alias ${config.keyAlias} -keyalg RSA -keysize 2048 ` +
      `-validity 10000 -storepass ${config.keystorePass} -keypass ${config.keystorePass} ` +
      `-dname "CN=WuzenX, OU=Security, O=WuzenCorp, L=Unknown, ST=Unknown, C=US"`,
      { stdio: 'pipe' }
    );
  }
  return KEYSTORE_PATH;
}

export function generateDeviceConfig(serverUrl) {
  return {
    serverUrl: serverUrl || 
      (config.renderUrl ? config.renderUrl.replace(/^http/, 'ws') + '/ws' : 'ws://localhost:10000/ws'),
    deviceId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    buildTime: Date.now(),
    version: '2.0.0',
    key: config.encryptionKey?.slice(0, 32) || crypto.randomBytes(16).toString('hex')
  };
}

export function injectAndSign(baseApkPath, tmpDir, configData) {
  const outputName = `wuzenx-patched.apk`;
  
  // Copy + inject
  execSync(`cp "${baseApkPath}" "${tmpDir}/patched.apk"`, { stdio: 'pipe' });
  const configB64 = Buffer.from(JSON.stringify(configData)).toString('base64');
  fs.writeFileSync(`${tmpDir}/config.enc`, configB64);
  execSync(`cd "${tmpDir}" && zip -f patched.apk config.enc 2>/dev/null`, { stdio: 'pipe' });

  // Remove old sigs
  execSync(`zip -d "${tmpDir}/patched.apk" "META-INF/*" 2>/dev/null || true`, { stdio: 'pipe' });

  // Zipalign
  execSync(
    `"${BUILD_TOOLS}/zipalign" -p -f 4 "${tmpDir}/patched.apk" "${tmpDir}/aligned.apk"`,
    { stdio: 'pipe' }
  );

  // Sign
  const ks = ensureKeystore();
  execSync(
    `"${BUILD_TOOLS}/apksigner" sign --ks "${ks}" ` +
    `--ks-pass pass:${config.keystorePass} --ks-key-alias ${config.keyAlias} ` +
    `--v1-signing-enabled true --v2-signing-enabled true ` +
    `--out "${tmpDir}/${outputName}" "${tmpDir}/aligned.apk"`,
    { stdio: 'pipe' }
  );

  // Verify
  execSync(`"${BUILD_TOOLS}/apksigner" verify "${tmpDir}/${outputName}"`, { stdio: 'pipe' });

  return path.join(tmpDir, outputName);
}
