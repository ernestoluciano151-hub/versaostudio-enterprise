import type { RequestContext } from './types';
import type { Role } from './permissions';

/**
 * Eventos de autenticação — espelha `AuthEventType` do schema Prisma.
 * APPEND-ONLY: a tabela tem UPDATE e DELETE revogados ao nível da base de dados.
 */
export const AUTH_EVENT_TYPES = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'LOGOUT_ALL',
  'MFA_VERIFIED', 'MFA_FAILED', 'MFA_ENABLED', 'MFA_DISABLED', 'BACKUP_CODE_USED',
  'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET', 'PASSWORD_CHANGED',
  'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SESSION_REVOKED',
  'MAGIC_LINK_SENT', 'MAGIC_LINK_USED', 'ROLE_CHANGED',
  'ACCESS_DENIED',
] as const;
export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];

/** Método usado na tentativa. Espelha `AuthMethod` do schema Prisma. */
export const AUTH_METHODS = [
  'PASSWORD', 'MAGIC_LINK', 'TOTP', 'BACKUP_CODE', 'OAUTH',
] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

export interface AuthEventInput {
  readonly type: AuthEventType;
  readonly success: boolean;
  readonly method?: AuthMethod | null;
  readonly userId?: string | null;
  readonly email?: string | null;
  readonly role?: Role | null;
  readonly reason?: string | null;
  readonly context: RequestContext;
}

export interface AuthEventRecorder {
  record(event: AuthEventInput): Promise<void>;
}

/** Campos que NUNCA são registados, mesmo que cheguem por engano. */
const REDACTED = new Set(['password', 'passwordHash', 'token', 'sessionToken', 'mfaSecret']);

export function toAuthEventRow(event: AuthEventInput): Record<string, unknown> {
  const row: Record<string, unknown> = {
    type: event.type,
    success: event.success,
    method: event.method ?? null,
    userId: event.userId ?? null,
    email: event.email ?? null,
    reason: event.reason ?? null,
    ip: event.context.ip,
    userAgent: event.context.userAgent,
    at: new Date(),
  };
  for (const key of Object.keys(row)) {
    if (REDACTED.has(key)) delete row[key];
  }
  return row;
}

/**
 * Recorder de consola para o Edge Runtime, onde não há acesso à base de dados.
 * A persistência real acontece no runtime Node — ver middleware-auth-flow.md §5.
 */
export function createConsoleRecorder(): AuthEventRecorder {
  return {
    async record(event: AuthEventInput): Promise<void> {
      console.warn(JSON.stringify({
        level: 'warn', msg: 'auth.event', ...toAuthEventRow(event),
        requestId: event.context.requestId, path: event.context.path,
        role: event.role ?? null,
      }));
    },
  };
}
