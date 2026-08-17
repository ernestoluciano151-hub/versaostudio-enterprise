import type { Role, Permission } from './permissions';
import type { SessionState } from './session';
import type { AuthEventInput } from './audit';

/**
 * PORTS — interfaces que o domínio define e a infraestrutura implementa.
 *
 * Nada aqui conhece Prisma, Next ou qualquer SDK. Trocar PostgreSQL por outra
 * coisa é escrever novos adapters; os use cases não mudam (ADR-002).
 */

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string | null;
  readonly mfaEnabled: boolean;
  /** Encriptado at-rest. O port devolve-o já decifrado ao use case. */
  readonly mfaSecret: string | null;
  readonly mfaLastCounter: number | null;
  readonly failedLogins: number;
  readonly lockedUntil: Date | null;
  readonly passwordChangedAt: Date | null;
  readonly mustChangePassword: boolean;
  readonly deletedAt: Date | null;
  readonly organizationId: string;
  readonly role: Role;
  readonly grants: readonly Permission[];
  readonly clientId: string | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  recordFailedLogin(userId: string, lockedUntil: Date | null, failedLogins: number): Promise<void>;
  resetFailedLogins(userId: string): Promise<void>;
  setMfaLastCounter(userId: string, counter: number): Promise<void>;
  setPassword(userId: string, passwordHash: string, changedAt: Date): Promise<void>;
}

export interface SessionRepository {
  create(session: SessionState): Promise<void>;
  findByToken(token: string): Promise<SessionState | null>;
  replace(oldToken: string, session: SessionState): Promise<void>;
  touch(token: string, at: Date): Promise<void>;
  revoke(token: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date, exceptToken?: string): Promise<number>;
  listForUser(userId: string): Promise<readonly SessionState[]>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface AuthEventRecorderPort {
  record(event: AuthEventInput): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export interface AuthDeps {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly hasher: PasswordHasher;
  readonly events: AuthEventRecorderPort;
  readonly clock: Clock;
}
