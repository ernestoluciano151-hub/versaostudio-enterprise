import type { Permission, Role } from './permissions';

/** Identidade resolvida NO SERVIDOR. Nunca construída a partir de dados do cliente. */
export interface Actor {
  readonly userId: string;
  readonly organizationId: string;
  readonly role: Role;
  /** Concessões pontuais — só acrescentam, nunca removem (ADR-008 §5). */
  readonly grants: readonly Permission[];
  /** `null` quando o utilizador não é um cliente do portal. */
  readonly clientId: string | null;
  /** `null` = sessão NÃO elevada; bloqueia todo o /admin. */
  readonly mfaVerifiedAt: Date | null;
}

export interface RequestContext {
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly path: string;
  readonly requestId: string;
}
