import { beforeEach, describe, expect, it } from 'vitest';
import {
  GENERIC_LOGIN_ERROR, changePassword, loginWithPassword, logout,
  logoutEverywhere, resolveActor, revokeOwnSession, verifyTotpChallenge,
} from '../use-cases';
import { createHarness, makeUser, TEST_CONTEXT, type TestHarness } from '../test-doubles';
import { generateSecret, generateTotp } from '../totp';
import { UnauthenticatedError } from '../errors';

const SENHA = 'uma palavra passe forte';
const CTX = TEST_CONTEXT;

let h: TestHarness;
beforeEach(() => { h = createHarness(); });

describe('login com palavra-passe', () => {
  it('autentica com credenciais válidas', async () => {
    h.users.add(makeUser());
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    expect(r.ok).toBe(true);
    expect(h.sessions.size).toBe(1);
    expect(h.events.types()).toContain('LOGIN_SUCCESS');
  });

  it('normaliza o e-mail (maiúsculas e espaços)', async () => {
    h.users.add(makeUser());
    const r = await loginWithPassword(
      { email: '  ERNESTO@VersaoDigitalLda.com  ', password: SENHA }, CTX, h);
    expect(r.ok).toBe(true);
  });

  it('recusa palavra-passe errada', async () => {
    h.users.add(makeUser());
    const r = await loginWithPassword({ email: makeUser().email, password: 'errada' }, CTX, h);
    expect(r).toEqual({ ok: false, reason: 'invalid_credentials' });
    expect(h.sessions.size).toBe(0);
  });

  it('conta inexistente devolve exatamente o mesmo que senha errada', async () => {
    h.users.add(makeUser());
    const inexistente = await loginWithPassword(
      { email: 'ninguem@exemplo.ao', password: SENHA }, CTX, h);
    const senhaErrada = await loginWithPassword(
      { email: makeUser().email, password: 'errada' }, CTX, h);
    expect(inexistente).toEqual(senhaErrada);
  });

  it('executa o hash mesmo sem conta — tempo de resposta constante', async () => {
    const antes = h.hasher.calls;
    await loginWithPassword({ email: 'ninguem@exemplo.ao', password: SENHA }, CTX, h);
    expect(h.hasher.calls).toBeGreaterThan(antes);
  });

  it('regista a tentativa em conta inexistente por e-mail, sem userId', async () => {
    await loginWithPassword({ email: 'ninguem@exemplo.ao', password: SENHA }, CTX, h);
    const evento = h.events.last();
    expect(evento?.type).toBe('LOGIN_FAILED');
    expect(evento?.userId).toBeNull();
    expect(evento?.email).toBe('ninguem@exemplo.ao');
  });

  it('recusa conta apagada', async () => {
    h.users.add(makeUser({ deletedAt: new Date('2026-01-01') }));
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    expect(r).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('a mensagem para o utilizador não distingue os casos', () => {
    expect(GENERIC_LOGIN_ERROR).toBe('E-mail ou palavra-passe incorrectos.');
  });
});

describe('bloqueio após falhas', () => {
  it('bloqueia à 5.ª falha consecutiva', async () => {
    h.users.add(makeUser());
    for (let i = 0; i < 5; i += 1) {
      await loginWithPassword({ email: makeUser().email, password: 'errada' }, CTX, h);
    }
    expect(h.users.get('usr_1')?.failedLogins).toBe(5);
    expect(h.users.get('usr_1')?.lockedUntil).not.toBeNull();
    expect(h.events.types()).toContain('ACCOUNT_LOCKED');
  });

  it('recusa mesmo com a senha CORRETA enquanto bloqueado', async () => {
    h.users.add(makeUser());
    for (let i = 0; i < 5; i += 1) {
      await loginWithPassword({ email: makeUser().email, password: 'errada' }, CTX, h);
    }
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    expect(r).toEqual({ ok: false, reason: 'account_locked' });
  });

  it('o bloqueio expira e o login volta a funcionar', async () => {
    h.users.add(makeUser());
    for (let i = 0; i < 5; i += 1) {
      await loginWithPassword({ email: makeUser().email, password: 'errada' }, CTX, h);
    }
    h.clock.advanceMinutes(2);
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    expect(r.ok).toBe(true);
  });

  it('o sucesso repõe o contador', async () => {
    h.users.add(makeUser());
    await loginWithPassword({ email: makeUser().email, password: 'errada' }, CTX, h);
    await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    expect(h.users.get('usr_1')?.failedLogins).toBe(0);
  });
});

describe('elevação por TOTP', () => {
  const secret = generateSecret();

  async function loginComMfa() {
    h.users.add(makeUser({ mfaEnabled: true, mfaSecret: secret }));
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    if (!r.ok) throw new Error('login devia ter passado');
    return r;
  }

  it('a sessão nasce NÃO elevada quando há MFA', async () => {
    const r = await loginComMfa();
    expect(r.mfaRequired).toBe(true);
    expect(r.session.mfaVerifiedAt).toBeNull();
  });

  it('eleva a sessão com o código correto', async () => {
    const r = await loginComMfa();
    const code = generateTotp(secret, h.clock.now().getTime());
    const v = await verifyTotpChallenge({ sessionToken: r.session.sessionToken, code }, CTX, h);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.session.mfaVerifiedAt).not.toBeNull();
    expect(h.events.types()).toContain('MFA_VERIFIED');
  });

  it('ROTACIONA o token na elevação — impede fixação de sessão', async () => {
    const r = await loginComMfa();
    const code = generateTotp(secret, h.clock.now().getTime());
    const v = await verifyTotpChallenge({ sessionToken: r.session.sessionToken, code }, CTX, h);
    if (!v.ok) throw new Error('devia ter elevado');
    expect(v.session.sessionToken).not.toBe(r.session.sessionToken);
    // O token antigo deixa de existir
    expect(await h.sessions.findByToken(r.session.sessionToken)).toBeNull();
  });

  it('recusa código errado e regista MFA_FAILED', async () => {
    const r = await loginComMfa();
    const v = await verifyTotpChallenge(
      { sessionToken: r.session.sessionToken, code: '000000' }, CTX, h);
    expect(v).toEqual({ ok: false, reason: 'invalid_code' });
    expect(h.events.types()).toContain('MFA_FAILED');
  });

  it('recusa o MESMO código uma segunda vez (replay)', async () => {
    const r = await loginComMfa();
    const code = generateTotp(secret, h.clock.now().getTime());
    const primeira = await verifyTotpChallenge(
      { sessionToken: r.session.sessionToken, code }, CTX, h);
    if (!primeira.ok) throw new Error('a primeira devia passar');

    const segunda = await verifyTotpChallenge(
      { sessionToken: primeira.session.sessionToken, code }, CTX, h);
    expect(segunda).toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('recusa sessão inexistente', async () => {
    const v = await verifyTotpChallenge(
      { sessionToken: 'nao-existe', code: '123456' }, CTX, h);
    expect(v).toEqual({ ok: false, reason: 'invalid_session' });
  });

  it('recusa quando o utilizador não tem MFA configurado', async () => {
    h.users.add(makeUser({ mfaEnabled: true, mfaSecret: null }));
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    if (!r.ok) throw new Error('login devia ter passado');
    const v = await verifyTotpChallenge(
      { sessionToken: r.session.sessionToken, code: '123456' }, CTX, h);
    expect(v).toEqual({ ok: false, reason: 'mfa_not_configured' });
  });
});

describe('sessões revogáveis', () => {
  async function sessaoDe(email: string) {
    const r = await loginWithPassword({ email, password: SENHA }, CTX, h);
    if (!r.ok) throw new Error('login devia ter passado');
    return r.session;
  }

  it('logout revoga a sessão atual', async () => {
    h.users.add(makeUser({ role: 'CLIENT' }));
    const s = await sessaoDe(makeUser().email);
    await logout(s.sessionToken, CTX, h);
    expect((await h.sessions.findByToken(s.sessionToken))?.revokedAt).not.toBeNull();
    expect(h.events.types()).toContain('LOGOUT');
  });

  it('logout é idempotente', async () => {
    await expect(logout('nao-existe', CTX, h)).resolves.toBeUndefined();
  });

  it('a revogação tem efeito imediato — resolveActor falha logo a seguir', async () => {
    h.users.add(makeUser({ role: 'CLIENT' }));
    const s = await sessaoDe(makeUser().email);
    await expect(resolveActor(s.sessionToken, h)).resolves.toBeTruthy();
    await logout(s.sessionToken, CTX, h);
    await expect(resolveActor(s.sessionToken, h)).rejects.toThrow(UnauthenticatedError);
  });

  it('logoutEverywhere revoga todas as sessões do utilizador', async () => {
    h.users.add(makeUser({ role: 'CLIENT' }));
    await sessaoDe(makeUser().email);
    await sessaoDe(makeUser().email);
    expect(await logoutEverywhere('usr_1', CTX, h)).toBe(2);
    expect(h.events.types()).toContain('LOGOUT_ALL');
  });

  it('o titular revoga uma sessão sua', async () => {
    h.users.add(makeUser({ role: 'CLIENT' }));
    const s = await sessaoDe(makeUser().email);
    expect(await revokeOwnSession(
      { actorUserId: 'usr_1', sessionToken: s.sessionToken }, CTX, h)).toBe(true);
  });

  it('NÃO revoga sessão de outro utilizador — e não revela que existe', async () => {
    h.users.add(makeUser({ role: 'CLIENT' }));
    const s = await sessaoDe(makeUser().email);
    expect(await revokeOwnSession(
      { actorUserId: 'usr_outro', sessionToken: s.sessionToken }, CTX, h)).toBe(false);
    expect((await h.sessions.findByToken(s.sessionToken))?.revokedAt).toBeNull();
  });
});

describe('alteração de palavra-passe', () => {
  const NOVA = 'outra palavra passe bem forte';

  async function comSessoes(n: number) {
    h.users.add(makeUser({ role: 'CLIENT' }));
    const tokens: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
      if (r.ok) tokens.push(r.session.sessionToken);
    }
    return tokens;
  }

  it('altera com a palavra-passe atual correta', async () => {
    const [token] = await comSessoes(1);
    const r = await changePassword(
      { userId: 'usr_1', currentPassword: SENHA, newPassword: NOVA, keepSessionToken: token ?? '' },
      CTX, h);
    expect(r.ok).toBe(true);
    expect(h.users.get('usr_1')?.passwordHash).toBe(`hashed:${NOVA}`);
  });

  it('recusa com a palavra-passe atual errada', async () => {
    const [token] = await comSessoes(1);
    const r = await changePassword(
      { userId: 'usr_1', currentPassword: 'errada', newPassword: NOVA, keepSessionToken: token ?? '' },
      CTX, h);
    expect(r).toEqual({ ok: false, reason: 'invalid_current' });
  });

  it('recusa nova palavra-passe fraca', async () => {
    const [token] = await comSessoes(1);
    const r = await changePassword(
      { userId: 'usr_1', currentPassword: SENHA, newPassword: 'curta', keepSessionToken: token ?? '' },
      CTX, h);
    expect(r).toEqual({ ok: false, reason: 'weak_password' });
  });

  it('REVOGA as outras sessões e mantém a atual', async () => {
    const tokens = await comSessoes(3);
    const atual = tokens[0] ?? '';
    const r = await changePassword(
      { userId: 'usr_1', currentPassword: SENHA, newPassword: NOVA, keepSessionToken: atual },
      CTX, h);
    expect(r.ok && r.revokedSessions).toBe(2);
    expect((await h.sessions.findByToken(atual))?.revokedAt).toBeNull();
    expect((await h.sessions.findByToken(tokens[1] ?? ''))?.revokedAt).not.toBeNull();
  });
});

describe('resolveActor — o papel vem sempre do servidor', () => {
  it('constrói o ator a partir da sessão e do Membership', async () => {
    h.users.add(makeUser({ role: 'FINANCE_MANAGER', grants: ['content:read'] }));
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    if (!r.ok) throw new Error('login devia ter passado');

    const actor = await resolveActor(r.session.sessionToken, h);
    expect(actor.role).toBe('FINANCE_MANAGER');
    expect(actor.organizationId).toBe('org_1');
    expect(actor.grants).toEqual(['content:read']);
  });

  it('recusa sessão inexistente', async () => {
    await expect(resolveActor('nao-existe', h)).rejects.toThrow(UnauthenticatedError);
  });

  it('recusa sessão não elevada quando se exige MFA', async () => {
    const secret = generateSecret();
    h.users.add(makeUser({ mfaEnabled: true, mfaSecret: secret }));
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    if (!r.ok) throw new Error('login devia ter passado');
    await expect(resolveActor(r.session.sessionToken, h, { requireMfa: true }))
      .rejects.toThrow(/mfa_required/);
  });

  it('recusa sessão anterior a uma mudança de palavra-passe', async () => {
    h.users.add(makeUser({ role: 'CLIENT' }));
    const r = await loginWithPassword({ email: makeUser().email, password: SENHA }, CTX, h);
    if (!r.ok) throw new Error('login devia ter passado');

    h.clock.advanceMinutes(5);
    await h.users.setPassword('usr_1', 'hashed:nova', h.clock.now());
    await expect(resolveActor(r.session.sessionToken, h)).rejects.toThrow(/password_changed/);
  });
});
