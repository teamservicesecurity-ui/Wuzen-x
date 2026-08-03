import crypto from 'crypto';
import { config } from './config.js';

const ALGO = 'aes-256-gcm';
// ✅ 32-byte key derived from the passphrase — always valid for aes-256-gcm,
//    works with ANY string (hex, base64, or plain passphrase)
const KEY = crypto
  .createHash('sha256')
  .update(config.encryptionKey || 'WuzenX2026DefaultKey!@#$%^&*()')
  .digest();

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  let enc = cipher.update(
    typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext),
    'utf8', 'hex'
  );
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({ iv: iv.toString('hex'), tag, data: enc });
}

export function decrypt(packet) {
  try {
    const p = typeof packet === 'string' ? JSON.parse(packet) : packet;
    const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(p.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(p.tag, 'hex'));
    let dec = decipher.update(p.data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    try { return JSON.parse(dec); } catch { return dec; } // JSON or raw string
  } catch { return null; }
}

export function timestamp() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

export function generateId(length = 8) {
  return crypto.randomBytes(length).toString('hex');
}

export function sanitize(text = '') {
  return String(text).replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
