import { describe, expect, it } from 'vitest';
import {
  effectivePermissions, hasPermission, isOwnedScope, requireAuth,
  requireFinancialAccess, requirePermission, requireRole, requireStaff,
} from '../permissions.server';
import { FINANCIAL_PERMISSIONS, ROLES, type Role } from '../permissions';
import { ForbiddenError, MfaRequiredError, UnauthenticatedError } from '../errors';
import type { Actor } from '../types';

function actor(role: Role, over: Partial<Actor> = {}): Actor {
  return {
    userId: 'usr_1', organizationId: 'org_1', role, grants: [],
    clientId: role === 'CLIENT' ? 'cli_1' : null,
    mfaVerifiedAt: role === 'CLIENT' ? null : new Date(),
    ...over,
  };
}

describe('requireAuth', () => {
  it('lança sem ator', () => {
    expect(() => requireAuth(null)).toThrow(UnauthenticatedError);
    expect(() => requireAuth(undefined)).toThrow(UnauthenticatedError);
  });
  it('passa com ator', () => {
    expect(() => requireAuth(actor('OWNER'))).not.toThrow();
  });
});

describe('requireRole', () => {
  it('permite papel na lista', () => {
    expect(() => requireRole(actor('SALES'), ['SALES', 'ADMIN'])).not.toThrow();
  });
  it('recusa papel fora da lista', () => {
    expect(() => requireRole(actor('STAFF'), ['OWNER'])).toThrow(ForbiddenError);
  });
  it('recusa sem autenticação antes de olhar ao papel', () => {
    expect(() => requireRole(null, ['OWNER'])).toThrow(UnauthenticatedError);
  });
});

describe('requireStaff', () => {
  it('recusa CLIENT', () => {
    expect(() => requireStaff(actor('CLIENT'))).toThrow(ForbiddenError);
  });
  it('recusa staff sem MFA verificado', () => {
    expect(() => requireStaff(actor('ADMIN', { mfaVerifiedAt: null }))).toThrow(MfaRequiredError);
  });
  it('permite staff com sessão elevada', () => {
    expect(() => requireStaff(actor('PRODUCER'))).not.toThrow();
  });
});

describe('requirePermission', () => {
  it('OWNER pode fazer override de pagamento', () => {
    expect(() => requirePermission(actor('OWNER'), 'payment:override')).not.toThrow();
  });
  it('ADMIN NÃO pode fazer override de pagamento (separação de funções)', () => {
    expect(() => requirePermission(actor('ADMIN'), 'payment:override')).toThrow(ForbiddenError);
  });
  it('FINANCE_MANAGER pode fazer override', () => {
    expect(() => requirePermission(actor('FINANCE_MANAGER'), 'payment:override')).not.toThrow();
  });
  it('FINANCE_MANAGER NÃO pode alterar configurações', () => {
    expect(() => requirePermission(actor('FINANCE_MANAGER'), 'org:update')).toThrow(ForbiddenError);
  });
  it('SALES não emite faturas', () => {
    expect(() => requirePermission(actor('SALES'), 'invoice:issue')).toThrow(ForbiddenError);
  });
  it('o erro identifica a permissão negada', () => {
    try {
      requirePermission(actor('STAFF'), 'ledger:read');
      expect.unreachable('devia ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      expect((e as ForbiddenError).permission).toBe('ledger:read');
      expect((e as ForbiddenError).status).toBe(403);
    }
  });
});

describe('separação financeira — requisito central da política', () => {
  const semFinanceiro: Role[] = ['PHOTOGRAPHER', 'VIDEOGRAPHER', 'EDITOR', 'CONTENT_MANAGER', 'STAFF'];

  it('há 11 permissões financeiras', () => {
    expect(FINANCIAL_PERMISSIONS).toHaveLength(11);
  });

  it.each(semFinanceiro)('%s é recusado nas 11 permissões financeiras', (role) => {
    for (const permission of FINANCIAL_PERMISSIONS) {
      expect(() => requirePermission(actor(role), permission),
        `${role} × ${permission}`).toThrow(ForbiddenError);
    }
  });

  it('só OWNER e FINANCE_MANAGER movem dinheiro', () => {
    const movem = ROLES.filter((r) =>
      hasPermission(actor(r), 'payment:override') || hasPermission(actor(r), 'payment:refund'));
    expect(movem.sort()).toEqual(['FINANCE_MANAGER', 'OWNER']);
  });

  it('requireFinancialAccess recusa permissão não financeira', () => {
    expect(() => requireFinancialAccess(actor('OWNER'), 'content:publish')).toThrow(ForbiddenError);
  });
});

describe('concessões pontuais', () => {
  it('acrescentam permissões', () => {
    const a = actor('STAFF', { grants: ['invoice:read'] });
    expect(hasPermission(a, 'invoice:read')).toBe(true);
  });
  it('não removem as do papel', () => {
    const a = actor('OWNER', { grants: [] });
    expect(effectivePermissions(a).full.size).toBeGreaterThan(70);
  });
});

describe('âmbito atribuído', () => {
  it('PHOTOGRAPHER tem booking:read em âmbito atribuído, não pleno', () => {
    expect(isOwnedScope(actor('PHOTOGRAPHER'), 'booking:read')).toBe(true);
  });
  it('PRODUCER tem booking:read pleno', () => {
    expect(isOwnedScope(actor('PRODUCER'), 'booking:read')).toBe(false);
  });
  it('CLIENT tem tudo em âmbito próprio', () => {
    expect(isOwnedScope(actor('CLIENT'), 'invoice:read')).toBe(true);
  });
});
