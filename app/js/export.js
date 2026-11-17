// LVQ1 export code (SPEC section 6). Standalone: no imports, works in browsers and node, so
// Leviathan can import { decodeLVQ1 } from this file as is.
//
//   LVQ1-<base64url(compact JSON)>-<4-char checksum>
//
// Checksum: FNV-1a 32-bit over the base64url payload text, mod 36^4, base36, upper case, zero padded.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Bytes(str) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
  const out = [];
  for (const ch of unescape(encodeURIComponent(str))) out.push(ch.charCodeAt(0));
  return out;
}
function utf8String(bytes) {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  return decodeURIComponent(escape(String.fromCharCode(...bytes)));
}

export function base64urlEncode(str) {
  const b = utf8Bytes(str);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64[n & 63];
  }
  return out;
}

export function base64urlDecode(s) {
  const bytes = [];
  let buf = 0, bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad character in code');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 255);
    }
  }
  return utf8String(bytes);
}

export function checksum4(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 1679616).toString(36).toUpperCase().padStart(4, '0');
}

export function encodeLVQ1(data) {
  const payload = base64urlEncode(JSON.stringify(data));
  return `LVQ1-${payload}-${checksum4(payload)}`;
}

// Returns { ok: true, data, checksum } or { ok: false, error }.
export function decodeLVQ1(code) {
  try {
    const s = String(code || '').trim().replace(/\s+/g, '');
    const m = /^LVQ1-([A-Za-z0-9_-]+)-([0-9A-Za-z]{4})$/.exec(s);
    if (!m) return { ok: false, error: 'Not an LVQ1 code.' };
    const [, payload, sum] = m;
    if (checksum4(payload) !== sum.toUpperCase()) return { ok: false, error: 'Checksum does not match. The code was cut or changed.' };
    const data = JSON.parse(base64urlDecode(payload));
    if (!data || data.v !== 1) return { ok: false, error: 'Unknown code version.' };
    return { ok: true, data, checksum: sum.toUpperCase() };
  } catch (e) {
    return { ok: false, error: `Could not read the code: ${e.message}` };
  }
}

if (typeof globalThis !== 'undefined') globalThis.LVQ1 = { encode: encodeLVQ1, decode: decodeLVQ1 };
