import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)))
  );

/** scrypt-Parameter (≈ 32 MB Speicher pro Hash) – speicherhart und ohne native Abhängigkeiten. */
const PARAMS = { N: 32768, r: 8, p: 1 };
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 10;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { ...PARAMS, maxmem: MAXMEM });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64 ?? "", "base64");
  if (!expected.length) return false;
  try {
    const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64 ?? "", "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM
    });
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
};

/** Ein Hash, gegen den bei unbekannten Benutzernamen geprüft wird (gleiche Antwortzeit). */
let dummyHash: Promise<string> | null = null;
export const dummyPasswordCheck = async (password: string) => {
  dummyHash ??= hashPassword("letopia-dummy-password");
  await verifyPassword(password, await dummyHash);
  return false;
};

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const hmac = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("hex");

export const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Gut lesbares Zufallspasswort (ohne leicht verwechselbare Zeichen). */
export const generatePassword = (length = 16): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    if (b < 256 - (256 % alphabet.length)) out += alphabet[b % alphabet.length];
  }
  return out.length === length ? out : generatePassword(length);
};

// ---------------------------------------------------------------------------
// Zwei-Faktor-Authentifizierung (TOTP, RFC 6238) – kompatibel mit Google Authenticator, Aegis, 1Password usw.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const base32Encode = (buf: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (input: string): Buffer => {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

export const generateTotpSecret = () => base32Encode(randomBytes(20));

const hotp = (secret: Buffer, counter: number): string => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(msg).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 15;
  const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, "0");
};

/** Prüft einen 6-stelligen Code (±1 Zeitfenster à 30 Sekunden). */
export const verifyTotp = (secretB32: string, code: string, at = Date.now()): boolean => {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const secret = base32Decode(secretB32);
  const step = Math.floor(at / 1000 / 30);
  return [-1, 0, 1].some(d => safeEqual(hotp(secret, step + d), clean));
};

export const totpCode = (secretB32: string, at = Date.now()) => hotp(base32Decode(secretB32), Math.floor(at / 1000 / 30));

export const totpUri = (issuer: string, account: string, secret: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
