import { describe, expect, it, vi } from 'vitest';
import { assertScoped, clientScope, scopeFor, tenantScope } from '../ownership';
import { requirePermission } from '../permissions.server';
import { ForbiddenError, NotFoundError } from '../errors';
import type { Actor } from '../types';
import type { Role } from '../permissions';

/**
 * H-003 — ISOLAMENTO DE CLIENTE.
 * Prova que o filtro de posse é imposto NA QUERY e que um cliente nunca
 * alcança dados de outro, nem de outra organização.
 */

function client(id: string, org = 'org_1'): Actor {
  return { userId: `usr_${id}`, organizationId: org, role: 'CLIENT',
           grants: [], clientId: id, mfaVerifiedAt: null };
}
function staff(role: Role, org = 'org_1'): Actor {
  return { userId: 'usr_s', organizationId: org, role, grants: [],
           clientId: null, mfaVerifiedAt: new Date() };
}

// ---- Base de dados falsa que HONRA o where, como o Prisma faria ----
interface Row { id: string; organizationId: string; clientId: string; ownerId?: string }
const ROWS: Row[] = [
  { id: 'inv_A1', organizationId: 'org_1', clientId: 'A', ownerId: 'usr_A' },
  { id: 'inv_A2', organizationId: 'org_1', clientId: 'A', ownerId: 'usr_A' },
  { id: 'inv_B1', organizationId: 'org_1', clientId: 'B', ownerId: 'usr_B' },
  { id: 'inv_X1', organizationId: 'org_2', clientId: 'A', ownerId: 'usr_A' },
];

const findFirst = vi.fn((args: { where: Record<string, unknown> }): Row | null => {
  assertScoped(args.where);
  return ROWS.find((r) =>
    Object.entries(args.where).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
  ) ?? null;
});

function getInvoice(actor: Actor, id: string): Row {
  requirePermission(actor, 'invoice:read');
  const row = findFirst({ where: { id, ...clientScope(actor) } });
  if (!row) throw new NotFoundError();   // 404, não 403 — não revela existência
  return row;
}

describe('cliente A não lê dados do cliente B', () => {
  it('A lê a própria fatura', () => {
    expect(getInvoice(client('A'), 'inv_A1').id).toBe('inv_A1');
  });

  it('A NÃO lê a fatura de B', () => {
    expect(() => getInvoice(client('A'), 'inv_B1')).toThrow(NotFoundError);
  });

  it('B NÃO lê a fatura de A', () => {
    expect(() => getInvoice(client('B'), 'inv_A1')).toThrow(NotFoundError);
  });

  it('devolve 404 e não 403 (403 confirmaria a existência)', () => {
    try {
      getInvoice(client('A'), 'inv_B1');
      expect.unreachable();
    } catch (e) {
      expect((e as NotFoundError).status).toBe(404);
      expect(e).not.toBeInstanceOf(ForbiddenError);
    }
  });

  it('a mensagem de erro não revela nada sobre o registo', () => {
    try {
      getInvoice(client('A'), 'inv_B1');
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toBe('Não encontrado.');
    }
  });
});

describe('isolamento por organização (tenant)', () => {
  it('A não alcança registo da org_2, mesmo com o mesmo clientId', () => {
    expect(() => getInvoice(client('A', 'org_1'), 'inv_X1')).toThrow(NotFoundError);
  });

  it('tenantScope inclui sempre organizationId', () => {
    expect(tenantScope(client('A'))).toEqual({ organizationId: 'org_1' });
  });
});

describe('as queries filtram por clientId', () => {
  it('clientScope acrescenta clientId para CLIENT', () => {
    expect(clientScope(client('A'))).toEqual({ organizationId: 'org_1', clientId: 'A' });
  });

  it('CLIENT sem clientId recebe escopo impossível, não escopo aberto', () => {
    const orfao: Actor = { ...client('A'), clientId: null };
    expect(clientScope(orfao).clientId).toBe('__no_client__');
    expect(() => getInvoice(orfao, 'inv_A1')).toThrow(NotFoundError);
  });

  it('staff não é limitado por clientId', () => {
    expect(clientScope(staff('FINANCE_MANAGER')).clientId).toBeUndefined();
  });

  it('toda a query passa pelo guarda de escopo', () => {
    findFirst.mockClear();
    getInvoice(client('A'), 'inv_A1');
    const where = findFirst.mock.calls[0]?.[0].where ?? {};
    expect(where).toHaveProperty('organizationId', 'org_1');
    expect(where).toHaveProperty('clientId', 'A');
  });
});

describe('assertScoped — falha fechada', () => {
  it('recusa query sem organizationId', () => {
    expect(() => assertScoped({ id: 'inv_A1' })).toThrow(/sem filtro de organização/);
  });
  it('recusa organizationId vazio', () => {
    expect(() => assertScoped({ organizationId: '' })).toThrow();
  });
  it('aceita query com organizationId', () => {
    expect(() => assertScoped({ organizationId: 'org_1' })).not.toThrow();
  });
});

describe('downloads usam o dono do registo', () => {
  function download(actor: Actor, fileId: string): Row {
    requirePermission(actor, 'file:download');
    const row = findFirst({ where: { id: fileId, ...clientScope(actor) } });
    if (!row) throw new NotFoundError();
    return row;
  }

  it('A descarrega ficheiro seu', () => {
    expect(download(client('A'), 'inv_A1').ownerId).toBe('usr_A');
  });

  it('A NÃO descarrega ficheiro de B', () => {
    expect(() => download(client('A'), 'inv_B1')).toThrow(NotFoundError);
  });

  it('CONTENT_MANAGER não tem file:download de todo', () => {
    expect(() => download(staff('CONTENT_MANAGER'), 'inv_A1')).toThrow(ForbiddenError);
  });
});

describe('papéis de âmbito atribuído', () => {
  it('PHOTOGRAPHER recebe filtro de atribuição', () => {
    const scope = scopeFor(staff('PHOTOGRAPHER'), 'booking:read');
    expect(scope.assigneeId).toBe('usr_s');
  });

  it('PRODUCER não recebe filtro de atribuição (âmbito global)', () => {
    expect(scopeFor(staff('PRODUCER'), 'booking:read').assigneeId).toBeUndefined();
  });

  it('CLIENT usa clientId, não assigneeId', () => {
    const scope = scopeFor(client('A'), 'booking:read');
    expect(scope.clientId).toBe('A');
    expect(scope.assigneeId).toBeUndefined();
  });
});
