import { randomBytes } from 'node:crypto';
import type { Role } from './permissions';

/**
 * Máquina de estados da sessão — lógica pura, sem I/O.
 *
 * Sessão em base de dados, não JWT (ADR-007): a revogação tem de ser imediata.
 * Este ficheiro decide *quando* uma sessão é válida; a persistência é do repositório.
 */

export const SESSION_TOKEN_BYTES = 32 as const; // 256 bits de entropia

/** Duração por contexto. Staff tem sessões curtas: o back-office mexe em dinheiro. */
export const SESSION_LIFETIME = {
  CLIENT: { absoluteMinutes: 30 * 24 * 60, idleMinutes: 30 * 24 * 60 },
  STAFF: { absoluteMinutes: 12 * 60, idleMinutes: 8 * 60 },
  /** Sessão criada mas ainda sem TOTP verificado. */
  PENDING_MFA: { absoluteMinutes: 10, idleMinutes: 10 },
} as const;

export interface SessionState {
  readonly sessionToken: string;
  readonly userId: string;
  readonly role: Role;
  readonly createdAt: Date;
  readonly expires: Date;
  readonly lastActiveAt: Date;
  /** `null` = sessão não elevada. Bloqueia todo o /admin. */
  readonly mfaVerifiedAt: Date | null;
  readonly revokedAt: Date | null;
}

export type SessionRejection =
  | 'revoked' | 'expired' | 'idle_timeout' | 'mfa_required' | 'password_changed';

export interface SessionCheck {
  readonly valid: boolean;
  readonly reason: SessionRejection | null;
}

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function lifetimeFor(role: Role, mfaVerified: boolean): { absoluteMinutes: number; idleMinutes: number } {
  if (role === 'CLIENT') return SESSION_LIFETIME.CLIENT;
  return mfaVerified ? SESSION_LIFETIME.STAFF : SESSION_LIFETIME.PENDING_MFA;
}

/**
 * Validação da sessão. A ordem das verificações importa: revogação primeiro,
 * porque é a que tem de ter efeito imediato.
 */
export function checkSession(
  session: SessionState,
  options: {
    now?: Date;
    /** Exigir sessão elevada — verdadeiro em todas as rotas /admin. */
    requireMfa?: boolean;
    /** Alteração de palavra-passe invalida sessões anteriores. */
    passwordChangedAt?: Date | null;
  } = {},
): SessionCheck {
  const { now = new Date(), requireMfa = false, passwordChangedAt = null } = options;
  const reject = (reason: SessionRejection): SessionCheck => ({ valid: false, reason });

  if (session.revokedAt !== null) return reject('revoked');
  if (session.expires.getTime() <= now.getTime()) return reject('expired');

  if (passwordChangedAt !== null && passwordChangedAt.getTime() > session.createdAt.getTime()) {
    return reject('password_changed');
  }

  const { idleMinutes } = lifetimeFor(session.role, session.mfaVerifiedAt !== null);
  const idleFor = now.getTime() - session.lastActiveAt.getTime();
  if (idleFor > idleMinutes * 60_000) return reject('idle_timeout');

  if (requireMfa && session.mfaVerifiedAt === null) return reject('mfa_required');

  return { valid: true, reason: null };
}

export function createSession(input: {
  userId: string;
  role: Role;
  mfaRequired: boolean;
  now?: Date;
}): SessionState {
  const now = input.now ?? new Date();
  const { absoluteMinutes } = lifetimeFor(input.role, !input.mfaRequired);
  return {
    sessionToken: generateSessionToken(),
    userId: input.userId,
    role: input.role,
    createdAt: now,
    expires: new Date(now.getTime() + absoluteMinutes * 60_000),
    lastActiveAt: now,
    mfaVerifiedAt: input.mfaRequired ? null : now,
    revokedAt: null,
  };
}

/**
 * Eleva a sessão após TOTP válido.
 * **Rotaciona o token** — impede fixação de sessão: um token obtido antes da
 * autenticação deixa de valer depois dela.
 */
export function elevateSession(session: SessionState, now: Date = new Date()): SessionState {
  const { absoluteMinutes } = lifetimeFor(session.role, true);
  return {
    ...session,
    sessionToken: generateSessionToken(),
    mfaVerifiedAt: now,
    lastActiveAt: now,
    expires: new Date(now.getTime() + absoluteMinutes * 60_000),
  };
}

export function touchSession(session: SessionState, now: Date = new Date()): SessionState {
  return { ...session, lastActiveAt: now };
}

export function revokeSession(session: SessionState, now: Date = new Date()): SessionState {
  return { ...session, revokedAt: now };
}

/** MFA é obrigatório para todo o staff — `CLIENT` é o único isento. Ver rbac.md §2. */
export function mfaRequiredFor(role: Role): boolean {
  return role !== 'CLIENT';
}
