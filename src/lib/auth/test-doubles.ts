import type {
  AuthDeps, AuthEventRecorderPort, AuthUser, Clock,
  PasswordHasher, SessionRepository, UserRepository,
} from './ports';
import type { AuthEventInput } from './audit';
import type { SessionState } from './session';
import type { Role } from './permissions';

/**
 * Duplos de teste — repositórios em memória.
 *
 * Enquanto não houver PostgreSQL, os use cases são verificados contra estes.
 * Os adapters Prisma implementam exatamente os mesmos ports; quando existirem,
 * estes testes continuam a valer e acrescentam-se testes de integração.
 */

export class FakeClock implements Clock {
  constructor(private current: Date) {}
  now(): Date { return this.current; }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
  set(date: Date): void { this.current = date; }
}

/** Hasher determinístico. NÃO é criptografia — serve só para testar a lógica. */
export class FakeHasher implements PasswordHasher {
  public calls = 0;
  async hash(password: string): Promise<string> {
    this.calls += 1;
    return `hashed:${password}`;
  }
  async verify(hash: string, password: string): Promise<boolean> {
    this.calls += 1;
    return hash === `hashed:${password}`;
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, AuthUser>();

  add(user: AuthUser): void { this.users.set(user.id, user); }
  get(id: string): AuthUser | undefined { return this.users.get(id); }

  async findByEmail(email: string): Promise<AuthUser | null> {
    for (const user of this.users.values()) {
      if (user.email === email.toLowerCase()) return user;
    }
    return null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    return this.users.get(id) ?? null;
  }

  async recordFailedLogin(userId: string, lockedUntil: Date | null, failedLogins: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, failedLogins, lockedUntil });
  }

  async resetFailedLogins(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, failedLogins: 0, lockedUntil: null });
  }

  async setMfaLastCounter(userId: string, counter: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, mfaLastCounter: counter });
  }

  async setPassword(userId: string, passwordHash: string, changedAt: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, {
        ...user, passwordHash, passwordChangedAt: changedAt, mustChangePassword: false,
      });
    }
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionState>();

  get size(): number { return this.sessions.size; }
  all(): readonly SessionState[] { return [...this.sessions.values()]; }

  async create(session: SessionState): Promise<void> {
    this.sessions.set(session.sessionToken, session);
  }

  async findByToken(token: string): Promise<SessionState | null> {
    return this.sessions.get(token) ?? null;
  }

  async replace(oldToken: string, session: SessionState): Promise<void> {
    this.sessions.delete(oldToken);
    this.sessions.set(session.sessionToken, session);
  }

  async touch(token: string, at: Date): Promise<void> {
    const session = this.sessions.get(token);
    if (session) this.sessions.set(token, { ...session, lastActiveAt: at });
  }

  async revoke(token: string, at: Date): Promise<void> {
    const session = this.sessions.get(token);
    if (session) this.sessions.set(token, { ...session, revokedAt: at });
  }

  async revokeAllForUser(userId: string, at: Date, exceptToken?: string): Promise<number> {
    let count = 0;
    for (const [token, session] of this.sessions) {
      if (session.userId !== userId) continue;
      if (token === exceptToken) continue;
      if (session.revokedAt !== null) continue;
      this.sessions.set(token, { ...session, revokedAt: at });
      count += 1;
    }
    return count;
  }

  async listForUser(userId: string): Promise<readonly SessionState[]> {
    return [...this.sessions.values()].filter((s) => s.userId === userId);
  }
}

export class RecordingEventRecorder implements AuthEventRecorderPort {
  public readonly events: AuthEventInput[] = [];
  async record(event: AuthEventInput): Promise<void> { this.events.push(event); }
  types(): string[] { return this.events.map((e) => e.type); }
  last(): AuthEventInput | undefined { return this.events[this.events.length - 1]; }
  clear(): void { this.events.length = 0; }
}

export interface TestHarness extends AuthDeps {
  readonly users: InMemoryUserRepository;
  readonly sessions: InMemorySessionRepository;
  readonly hasher: FakeHasher;
  readonly events: RecordingEventRecorder;
  readonly clock: FakeClock;
}

export function createHarness(now = new Date('2026-08-05T10:00:00Z')): TestHarness {
  return {
    users: new InMemoryUserRepository(),
    sessions: new InMemorySessionRepository(),
    hasher: new FakeHasher(),
    events: new RecordingEventRecorder(),
    clock: new FakeClock(now),
  };
}

export function makeUser(over: Partial<AuthUser> = {}): AuthUser {
  const role: Role = over.role ?? 'ADMIN';
  return {
    id: 'usr_1',
    email: 'ernesto@versaodigitallda.com',
    passwordHash: 'hashed:uma palavra passe forte',
    mfaEnabled: false,
    mfaSecret: null,
    mfaLastCounter: null,
    failedLogins: 0,
    lockedUntil: null,
    passwordChangedAt: null,
    mustChangePassword: false,
    deletedAt: null,
    organizationId: 'org_1',
    role,
    grants: [],
    clientId: role === 'CLIENT' ? 'cli_1' : null,
    ...over,
  };
}

export const TEST_CONTEXT = {
  ip: '10.0.0.1', userAgent: 'vitest', path: '/entrar', requestId: 'req_test',
} as const;
