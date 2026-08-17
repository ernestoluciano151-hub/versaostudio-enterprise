import { describe, expect, it, vi } from 'vitest';
import { AUTH_EVENT_TYPES, createConsoleRecorder, toAuthEventRow } from '../audit';

const ctx = { ip: '10.0.0.1', userAgent: 'vitest', path: '/admin', requestId: 'req_1' };

describe('H-005 — eventos de autenticação exigidos', () => {
  it.each(['LOGIN_SUCCESS', 'LOGOUT', 'MFA_ENABLED', 'SESSION_REVOKED', 'ACCESS_DENIED'])(
    '%s existe', (t) => {
      expect(AUTH_EVENT_TYPES).toContain(t);
    });

  it('cobre também os casos de falha, ausentes da lista original', () => {
    expect(AUTH_EVENT_TYPES).toContain('LOGIN_FAILED');
    expect(AUTH_EVENT_TYPES).toContain('MFA_FAILED');
    expect(AUTH_EVENT_TYPES).toContain('ACCOUNT_LOCKED');
  });
});

describe('campos obrigatórios', () => {
  it('inclui userId, ip, userAgent e timestamp', () => {
    const row = toAuthEventRow({ type: 'LOGIN_SUCCESS', success: true, userId: 'usr_1', context: ctx });
    expect(row).toMatchObject({ type: 'LOGIN_SUCCESS', success: true, userId: 'usr_1',
                                ip: '10.0.0.1', userAgent: 'vitest' });
    expect(row['at']).toBeInstanceOf(Date);
  });

  it('regista o método usado na tentativa', () => {
    const row = toAuthEventRow({ type: 'LOGIN_SUCCESS', success: true, method: 'PASSWORD',
                                 userId: 'usr_1', context: ctx });
    expect(row['method']).toBe('PASSWORD');
  });

  it('método é null quando não se aplica', () => {
    const row = toAuthEventRow({ type: 'SESSION_REVOKED', success: true, context: ctx });
    expect(row['method']).toBeNull();
  });

  it('regista tentativa em conta inexistente por e-mail, sem userId', () => {
    const row = toAuthEventRow({ type: 'LOGIN_FAILED', success: false,
                                 email: 'quem@exemplo.ao', context: ctx });
    expect(row['userId']).toBeNull();
    expect(row['email']).toBe('quem@exemplo.ao');
  });

  it('o recorder inclui o papel quando existe', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await createConsoleRecorder().record({ type: 'ACCESS_DENIED', success: false,
                                           role: 'STAFF', context: ctx });
    expect(JSON.parse(String(spy.mock.calls[0]?.[0])).role).toBe('STAFF');
    spy.mockRestore();
  });
});

describe('nunca regista segredos', () => {
  it('remove campos sensíveis mesmo que cheguem', () => {
    const input = { type: 'LOGIN_SUCCESS', success: true, userId: 'u',
                    password: 'segredo', sessionToken: 'tok', context: ctx } as never;
    const row = toAuthEventRow(input);
    expect(JSON.stringify(row)).not.toContain('segredo');
    expect(JSON.stringify(row)).not.toContain('tok');
  });
});
