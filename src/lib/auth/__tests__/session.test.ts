import { describe, expect, it } from 'vitest';
import {
  SESSION_LIFETIME, checkSession, createSession, elevateSession,
  generateSessionToken, lifetimeFor, mfaRequiredFor, revokeSession, touchSession,
} from '../session';
import { ROLES, type Role } from '../permissions';

const AGORA = new Date('2026-08-05T10:00:00Z');
const mais = (minutos: number) => new Date(AGORA.getTime() + minutos * 60_000);

function sessao(role: Role, mfaRequired = mfaRequiredFor(role)) {
  return createSession({ userId: 'usr_1', role, mfaRequired, now: AGORA });
}

describe('token de sessão', () => {
  it('tem pelo menos 128 bits de entropia', () => {
    expect(generateSessionToken().length).toBeGreaterThanOrEqual(43);
  });
  it('dois tokens nunca coincidem', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });
});

describe('MFA obrigatório para todo o staff', () => {
  it.each(ROLES.filter((r) => r !== 'CLIENT'))('%s exige MFA', (role) => {
    expect(mfaRequiredFor(role)).toBe(true);
  });
  it('CLIENT é o único isento', () => {
    expect(mfaRequiredFor('CLIENT')).toBe(false);
  });
});

describe('criação de sessão', () => {
  it('staff começa NÃO elevado', () => {
    expect(sessao('ADMIN').mfaVerifiedAt).toBeNull();
  });

  it('sessão pré-MFA dura apenas 10 minutos', () => {
    expect(sessao('ADMIN').expires.getTime())
      .toBe(mais(SESSION_LIFETIME.PENDING_MFA.absoluteMinutes).getTime());
  });

  it('cliente entra já elevado e dura 30 dias', () => {
    const s = sessao('CLIENT');
    expect(s.mfaVerifiedAt).toEqual(AGORA);
    expect(s.expires.getTime()).toBe(mais(SESSION_LIFETIME.CLIENT.absoluteMinutes).getTime());
  });

  it('staff tem sessão muito mais curta que cliente', () => {
    expect(lifetimeFor('OWNER', true).absoluteMinutes)
      .toBeLessThan(lifetimeFor('CLIENT', true).absoluteMinutes);
  });
});

describe('elevação após TOTP', () => {
  it('marca a sessão como verificada', () => {
    expect(elevateSession(sessao('FINANCE_MANAGER'), AGORA).mfaVerifiedAt).toEqual(AGORA);
  });

  it('ROTACIONA o token — impede fixação de sessão', () => {
    const antes = sessao('ADMIN');
    expect(elevateSession(antes, AGORA).sessionToken).not.toBe(antes.sessionToken);
  });

  it('estende a validade de 10 min para 12 h', () => {
    const elevada = elevateSession(sessao('ADMIN'), AGORA);
    expect(elevada.expires.getTime())
      .toBe(mais(SESSION_LIFETIME.STAFF.absoluteMinutes).getTime());
  });
});

describe('validação de sessão', () => {
  it('aceita sessão de cliente válida', () => {
    expect(checkSession(sessao('CLIENT'), { now: mais(10) }).valid).toBe(true);
  });

  it('recusa sessão revogada — e antes de tudo o resto', () => {
    const revogada = revokeSession(sessao('CLIENT'), AGORA);
    expect(checkSession(revogada, { now: mais(1) }).reason).toBe('revoked');
  });

  it('a revogação tem efeito no pedido seguinte', () => {
    const s = sessao('CLIENT');
    expect(checkSession(s, { now: mais(1) }).valid).toBe(true);
    expect(checkSession(revokeSession(s, mais(1)), { now: mais(1) }).valid).toBe(false);
  });

  it('recusa sessão expirada', () => {
    expect(checkSession(sessao('ADMIN'), { now: mais(11) }).reason).toBe('expired');
  });

  it('recusa por inatividade', () => {
    const elevada = elevateSession(sessao('PRODUCER'), AGORA);
    // 8 h de inatividade para staff
    expect(checkSession(elevada, { now: mais(8 * 60 + 1) }).reason).toBe('idle_timeout');
  });

  it('touchSession renova a inatividade', () => {
    const elevada = elevateSession(sessao('PRODUCER'), AGORA);
    const tocada = touchSession(elevada, mais(7 * 60));
    expect(checkSession(tocada, { now: mais(7 * 60 + 30) }).valid).toBe(true);
  });

  it('recusa sessão não elevada em rota que exige MFA', () => {
    expect(checkSession(sessao('ADMIN'), { now: mais(1), requireMfa: true }).reason)
      .toBe('mfa_required');
  });

  it('aceita sessão elevada em rota que exige MFA', () => {
    const elevada = elevateSession(sessao('ADMIN'), AGORA);
    expect(checkSession(elevada, { now: mais(1), requireMfa: true }).valid).toBe(true);
  });

  it('alteração de palavra-passe invalida sessões anteriores', () => {
    const s = sessao('CLIENT');
    expect(checkSession(s, { now: mais(10), passwordChangedAt: mais(5) }).reason)
      .toBe('password_changed');
  });

  it('alteração anterior à sessão não a invalida', () => {
    const s = sessao('CLIENT');
    expect(checkSession(s, { now: mais(10), passwordChangedAt: mais(-5) }).valid).toBe(true);
  });
});
