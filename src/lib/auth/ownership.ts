import type { Actor } from './types';
import type { Permission } from './permissions';
import { isOwnedScope } from './permissions.server';

/**
 * FILTROS DE POSSE — impostos NA QUERY, nunca depois de ler.
 *
 * Ler primeiro e comparar depois deixa uma janela de IDOR e revela existência.
 * Estes helpers devolvem fragmentos de `where` que os repositórios têm de aplicar.
 */

export interface OwnershipScope {
  readonly organizationId: string;
  readonly clientId?: string;
  readonly assigneeId?: string;
}

/** Escopo mínimo obrigatório: tenant. Nenhuma query de negócio pode omiti-lo. */
export function tenantScope(actor: Actor): { organizationId: string } {
  return { organizationId: actor.organizationId };
}

/** Escopo de cliente: o portal só devolve registos do próprio cliente. */
export function clientScope(actor: Actor): OwnershipScope {
  const scope: OwnershipScope = { organizationId: actor.organizationId };
  if (actor.role !== 'CLIENT') return scope;
  if (actor.clientId === null) {
    // CLIENT sem clientId não pode ver nada. Escopo impossível em vez de escopo aberto.
    return { ...scope, clientId: '__no_client__' };
  }
  return { ...scope, clientId: actor.clientId };
}

/**
 * Escopo completo para uma permissão: tenant + cliente + atribuição.
 * Papéis de âmbito atribuído (🔒) ficam limitados ao que lhes foi atribuído.
 */
export function scopeFor(actor: Actor, permission: Permission): OwnershipScope {
  const base = clientScope(actor);
  if (!isOwnedScope(actor, permission)) return base;
  if (actor.role === 'CLIENT') return base;
  return { ...base, assigneeId: actor.userId };
}

/** Falha fechada: um escopo sem `organizationId` nunca deve chegar à base de dados. */
export function assertScoped(where: Record<string, unknown>): void {
  if (typeof where['organizationId'] !== 'string' || where['organizationId'].length === 0) {
    throw new Error('Query sem filtro de organização — recusada.');
  }
}
