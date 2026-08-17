import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP — RFC 6238, HMAC-SHA1, 6 dígitos, período de 30 s, tolerância ±1.
 *
 * SHA-1 é a escolha correta apesar de parecer o contrário: é o que o Google
 * Authenticator, o Authy e praticamente todas as apps suportam. SHA-256 partiria
 * a compatibilidade sem ganho prático neste uso.
 *
 * Implementado sobre `node:crypto` em vez de uma dependência: são 40 linhas,
 * verificáveis contra os vetores oficiais da RFC — o que uma dependência não
 * dispensaria de qualquer forma.
 */

import { TOTP_DIGITS, TOTP_PERIOD_SECONDS, TOTP_WINDOW } from './totp-constants';

export { TOTP_DIGITS, TOTP_PERIOD_SECONDS, TOTP_WINDOW };

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(bytes = 20): string {
  return toBase32(randomBytes(bytes));
}

export function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function fromBase32(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Segredo TOTP inválido: caractere fora de base32.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226) — base do TOTP. `counter` é o número de períodos desde a época. */
export function hotp(secret: Buffer, counter: number, digits: number = TOTP_DIGITS): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret).update(buffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);

  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function counterFor(timestampMs: number, period: number = TOTP_PERIOD_SECONDS): number {
  return Math.floor(timestampMs / 1000 / period);
}

export function generateTotp(
  secretBase32: string,
  timestampMs: number = Date.now(),
  digits: number = TOTP_DIGITS,
): string {
  return hotp(fromBase32(secretBase32), counterFor(timestampMs), digits);
}

/** Comparação em tempo constante — uma comparação `===` vaza informação por temporização. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export interface TotpVerification {
  readonly valid: boolean;
  /** Período em que o código foi aceite. Guardar para impedir replay dentro dos 30 s. */
  readonly counter: number | null;
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  options: {
    timestampMs?: number;
    window?: number;
    /** Último período já usado por este utilizador — impede reutilização do mesmo código. */
    lastUsedCounter?: number | null;
  } = {},
): TotpVerification {
  const {
    timestampMs = Date.now(),
    window = TOTP_WINDOW,
    lastUsedCounter = null,
  } = options;

  if (!/^\d{6}$/.test(code)) return { valid: false, counter: null };

  const secret = fromBase32(secretBase32);
  const current = counterFor(timestampMs);

  for (let drift = -window; drift <= window; drift += 1) {
    const counter = current + drift;
    if (lastUsedCounter !== null && counter <= lastUsedCounter) continue; // replay
    if (safeCompare(hotp(secret, counter), code)) return { valid: true, counter };
  }
  return { valid: false, counter: null };
}

/** URI para o QR code da app de autenticação. */
export function otpauthUri(secretBase32: string, accountEmail: string): string {
  const issuer = encodeURIComponent('Versao Digital');
  const account = encodeURIComponent(accountEmail);
  return (
    `otpauth://totp/${issuer}:${account}` +
    `?secret=${secretBase32}&issuer=${issuer}` +
    `&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`
  );
}
