import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Políticas de autenticação — lógica pura, sem I/O.
 * Especificação: docs/security/authentication.md
 */

// ─────────────────────────── Palavras-passe ───────────────────────────

export const PASSWORD_MIN_LENGTH = 12 as const;
/** Limite superior evita DoS por hashing de entradas enormes. */
export const PASSWORD_MAX_LENGTH = 128 as const;

/**
 * Amostra das senhas mais usadas. Em produção, substituir por verificação contra
 * a lista das 10 000 mais comuns, carregada de ficheiro.
 * Sem regras de composição: `Password1!` cumpre-as todas e continua fraca.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'passwordpassword', '123456789012', 'qwertyuiopas',
  'administrador', 'versaodigital', 'angola123456', 'luanda123456', '111111111111',
]);

export type PasswordRejection =
  | 'too_short' | 'too_long' | 'too_common' | 'same_as_current' | 'only_whitespace';

export interface PasswordCheck {
  readonly valid: boolean;
  readonly reason: PasswordRejection | null;
}

export function checkPassword(
  password: string,
  options: { currentPassword?: string } = {},
): PasswordCheck {
  const reject = (reason: PasswordRejection): PasswordCheck => ({ valid: false, reason });

  if (password.trim().length === 0) return reject('only_whitespace');
  if (password.length < PASSWORD_MIN_LENGTH) return reject('too_short');
  if (password.length > PASSWORD_MAX_LENGTH) return reject('too_long');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return reject('too_common');
  if (options.currentPassword !== undefined && password === options.currentPassword) {
    return reject('same_as_current');
  }
  return { valid: true, reason: null };
}

// ─────────────────────────── Bloqueio de conta ───────────────────────────

/** Progressão em minutos a partir da 5.ª falha consecutiva. */
const LOCKOUT_LADDER_MINUTES = [1, 5, 15, 60] as const;
export const LOCKOUT_THRESHOLD = 5 as const;

export interface LockoutState {
  readonly failedLogins: number;
  readonly lockedUntil: Date | null;
}

export function lockoutFor(failedLogins: number, now: Date): LockoutState {
  if (failedLogins < LOCKOUT_THRESHOLD) {
    return { failedLogins, lockedUntil: null };
  }
  const step = Math.min(failedLogins - LOCKOUT_THRESHOLD, LOCKOUT_LADDER_MINUTES.length - 1);
  const minutes = LOCKOUT_LADDER_MINUTES[step] ?? 60;
  return { failedLogins, lockedUntil: new Date(now.getTime() + minutes * 60_000) };
}

export function isLockedOut(state: LockoutState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** O sucesso repõe o contador — o bloqueio é por falhas *consecutivas*. */
export function resetLockout(): LockoutState {
  return { failedLogins: 0, lockedUntil: null };
}

/** Notifica-se o titular à 5.ª falha: pode ser ele a ser atacado. */
export function shouldNotifyOwner(failedLogins: number): boolean {
  return failedLogins === LOCKOUT_THRESHOLD;
}

// ─────────────────────────── Tokens de uso único ───────────────────────────

export const MAGIC_LINK_TTL_MINUTES = 15 as const;
export const PASSWORD_RESET_TTL_MINUTES = 30 as const;
export const INVITATION_TTL_DAYS = 7 as const;

export interface IssuedToken {
  /** Enviado ao utilizador. Nunca guardado. */
  readonly token: string;
  /** Guardado em base de dados. Nunca enviado. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export function issueToken(ttlMinutes: number, now: Date = new Date()): IssuedToken {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
  };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

// ─────────────────────────── Códigos de recuperação MFA ───────────────────────────

export const BACKUP_CODE_COUNT = 10 as const;
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(10);
    return Array.from(bytes, (b) => BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]).join('');
  });
}

/** Abaixo de 3 códigos por usar, a UI insiste na regeneração. */
export function shouldRegenerateBackupCodes(unusedCount: number): boolean {
  return unusedCount < 3;
}
