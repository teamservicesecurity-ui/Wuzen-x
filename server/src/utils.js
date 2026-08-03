import crypto from 'crypto';
import { config } from './config.js';

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(config.encryptionKey, 'hex');
// ✅ SAFE FALLBACK
const key = Buffer.from(process.env.MY_SECRET_KEY || '', 'base64');
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
    return JSON.parse(dec);
  } catch { return null; }
}

export function timestamp() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

export function generateId(length = 8) {
  return crypto.randomBytes(length).toString('hex');
}

export function sanitize(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
