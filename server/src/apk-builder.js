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

            // Step 1: Create build directory
            fs.mkdirSync(BUILD_DIR, { recursive: true });
            await this.sendProgress(chatId, '📁 **Build directory created**', 10);

            // Step 2: Download or locate base APK
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

            // Step 3: Verify base APK
            if (!fs.existsSync(baseApkPath)) {
                throw new Error('Base APK file not found after download');
            }
            const stats = fs.statSync(baseApkPath);
            if (stats.size < 100000) {
                throw new Error(`Base APK too small (${stats.size} bytes), may be corrupted`);
            }
            await this.sendProgress(chatId, `✅ **Base APK verified** (${(stats.size / 1024 / 1024).toFixed(2)} MB)`, 25);

            // Step 4: Create encrypted config
            await this.sendProgress(chatId, '🔐 **Creating encrypted configuration...**', 30);
            this.createConfigEnc(botToken, adminId, channelId, options);
            await this.sendProgress(chatId, '✅ **Config encrypted**', 40);

            // Step 5: Copy base APK to patched APK
            fs.copyFileSync(baseApkPath, PATCHED_APK);
            await this.sendProgress(chatId, '📝 **Preparing to inject config...**', 50);

            // Step 6: Inject config.enc into APK
            // FIXED: Changed from `zip -f` (freshen - only updates existing entries)
            // to `zip -u` (update - adds new files or updates existing ones)
            await this.sendProgress(chatId, '💉 **Injecting configuration into APK...**', 55);
            try {
                execSync(`zip -u "${PATCHED_APK}" "${CONFIG_ENCRYPTED}"`, {
                    cwd: BUILD_DIR,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 30000
                });
            } catch (zipErr) {
                // Fallback: if zip -u fails, try using aapt
                try {
                    execSync(`aapt add "${PATCHED_APK}" "${CONFIG_ENCRYPTED}"`, {
                        cwd: BUILD_DIR,
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 30000
                    });
                } catch (aaptErr) {
                    // Second fallback: unzip, copy, rezip approach
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

            // Step 7: Verify config.enc is in the APK
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

            // Step 8: Sign the APK
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
