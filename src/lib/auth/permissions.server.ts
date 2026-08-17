import 'server-only';

import {
  FINANCIAL_PERMISSIONS, ROLE_PERMISSIONS, STAFF_ROLES,
  type Permission, type Role,
} from './permissions';
import { ForbiddenError, MfaRequiredError, UnauthenticatedError } from './errors';
import type { Actor } from './types';

/**
 * HELPERS DE AUTORIZAÇÃO — Camada 3 de 3. A ÚNICA que autoriza.
 *
 * Todos LANÇAM em vez de devolver booleano: falham FECHADO.
 * `if (can(...))` sem `else` é a falha aberta mais comum nesta área.
 *
 * `import 'server-only'` garante erro de build se algum destes for importado
 * para um componente de cliente.
 */

/** Permissões efetivas = papel ∪ concessões pontuais. Nunca subtrai (ADR-008 §5). */
export function effectivePermissions(actor: Actor): {
  full: ReadonlySet<Permission>;
  owned: ReadonlySet<Permission>;
} {
  const grants = ROLE_PERMISSIONS[actor.role];
  return {
    full: new Set<Permission>([...grants.full, ...actor.grants]),
    owned: new Set<Permission>(grants.owned),
  };
}

export function hasPermission(actor: Actor, permission: Permission): boolean {
  const { full, owned } = effectivePermissions(actor);
  return full.has(permission) || owned.has(permission);
}

/** `true` quando o ator só pode agir sobre registos seus ou atribuídos. */
export function isOwnedScope(actor: Actor, permission: Permission): boolean {
  const { full, owned } = effectivePermissions(actor);
  return !full.has(permission) && owned.has(permission);
}

export function requireAuth(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor) throw new UnauthenticatedError();
}

export function requireRole(
  actor: Actor | null | undefined,
  roles: readonly Role[],
): asserts actor is Actor {
  requireAuth(actor);
  if (!roles.includes(actor.role)) {
    throw new ForbiddenError(`role:${roles.join('|')}`, 'Papel sem acesso a esta área.');
  }
}

/** Acesso ao back-office: papel de staff **e** sessão elevada por MFA. */
export function requireStaff(actor: Actor | null | undefined): asserts actor is Actor {
  requireRole(actor, STAFF_ROLES);
  if (actor.mfaVerifiedAt === null) throw new MfaRequiredError();
}

export function requirePermission(
  actor: Actor | null | undefined,
  permission: Permission,
): asserts actor is Actor {
  requireAuth(actor);
  if (!hasPermission(actor, permission)) throw new ForbiddenError(permission);
}

/**
 * Guarda explícita para operações financeiras.
 * Redundante face a `requirePermission`, deliberadamente: dinheiro merece
 * duas fechaduras. Se um dia alguém acrescentar por engano uma permissão
 * financeira a um papel operacional, isto continua a travar.
 */
export function requireFinancialAccess(
  actor: Actor | null | undefined,
  permission: Permission,
): asserts actor is Actor {
  requireAuth(actor);
  if (!(FINANCIAL_PERMISSIONS as readonly string[]).includes(permission)) {
    throw new ForbiddenError(permission, 'Permissão não é financeira.');
  }
  requirePermission(actor, permission);
}
