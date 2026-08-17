import { UnauthenticatedError } from './errors';
import { checkPassword, isLockedOut, lockoutFor, shouldNotifyOwner } from './policies';
import {
  checkSession, createSession, elevateSession, mfaRequiredFor, type SessionState,
} from './session';
import { verifyTotp } from './totp';
import type { AuthDeps } from './ports';
import type { Actor, RequestContext } from './types';

/**
 * USE CASES de autenticação.
 *
 * Regras que atravessam todos:
 *   1. Resposta e mensagem idênticas para conta existente e inexistente.
 *   2. Toda a tentativa — sucesso ou falha — escreve um AuthEvent.
 *   3. Falha fechada: na dúvida, recusa.
 */

export type LoginFailure =
  | 'invalid_credentials' | 'account_locked' | 'account_disabled' | 'password_required';

export type LoginResult =
  | { readonly ok: true; readonly session: SessionState; readonly mfaRequired: boolean;
      readonly mustChangePassword: boolean }
  | { readonly ok: false; readonly reason: LoginFailure };

/** Mensagem única para o utilizador. Nunca revela qual dos dois falhou. */
export const GENERIC_LOGIN_ERROR = 'E-mail ou palavra-passe incorrectos.';

export async function loginWithPassword(
  input: { email: string; password: string },
  ctx: RequestContext,
  deps: AuthDeps,
): Promise<LoginResult> {
  const now = deps.clock.now();
  const email = input.email.trim().toLowerCase();
  const user = await deps.users.findByEmail(email);

  const fail = async (reason: LoginFailure): Promise<LoginResult> => {
    await deps.events.record({
      type: 'LOGIN_FAILED', success: false, method: 'PASSWORD',
      userId: user?.id ?? null, email, reason, context: ctx,
      role: user?.role ?? null,
    });
    return { ok: false, reason };
  };

  // Hash fictício quando a conta não existe — mantém o tempo de resposta constante.
  const hash = user?.passwordHash ?? '$argon2id$dummy';
  const passwordValid = await deps.hasher.verify(hash, input.password);

  if (!user || user.deletedAt !== null) return fail('invalid_credentials');

  if (isLockedOut({ failedLogins: user.failedLogins, lockedUntil: user.lockedUntil }, now)) {
    return fail('account_locked');
  }

  if (user.passwordHash === null) return fail('password_required');

  if (!passwordValid) {
    const failedLogins = user.failedLogins + 1;
    const { lockedUntil } = lockoutFor(failedLogins, now);
    await deps.users.recordFailedLogin(user.id, lockedUntil, failedLogins);
    if (lockedUntil !== null) {
      await deps.events.record({
        type: 'ACCOUNT_LOCKED', success: false, userId: user.id, email,
        reason: `failed_logins=${failedLogins}`, context: ctx, role: user.role,
      });
    }
    if (shouldNotifyOwner(failedLogins)) {
      // À 5.ª falha o titular é avisado — pode ser ele o alvo, não o atacante.
      await deps.events.record({
        type: 'LOGIN_FAILED', success: false, method: 'PASSWORD', userId: user.id,
        email, reason: 'notify_owner_threshold', context: ctx, role: user.role,
      });
    }
    return fail('invalid_credentials');
  }

  await deps.users.resetFailedLogins(user.id);

  const mfaRequired = mfaRequiredFor(user.role) && user.mfaEnabled;
  const session = createSession({
    userId: user.id, role: user.role, mfaRequired, now,
  });
  await deps.sessions.create(session);

  await deps.events.record({
    type: 'LOGIN_SUCCESS', success: true, method: 'PASSWORD',
    userId: user.id, email, context: ctx, role: user.role,
  });

  return {
    ok: true, session, mfaRequired,
    mustChangePassword: user.mustChangePassword,
  };
}

export type TotpFailure = 'invalid_session' | 'mfa_not_configured' | 'invalid_code';

export type TotpResult =
  | { readonly ok: true; readonly session: SessionState }
  | { readonly ok: false; readonly reason: TotpFailure };

export async function verifyTotpChallenge(
  input: { sessionToken: string; code: string },
  ctx: RequestContext,
  deps: AuthDeps,
): Promise<TotpResult> {
  const now = deps.clock.now();
  const session = await deps.sessions.findByToken(input.sessionToken);

  if (session === null || !checkSession(session, { now }).valid) {
    await deps.events.record({
      type: 'MFA_FAILED', success: false, method: 'TOTP',
      reason: 'invalid_session', context: ctx,
    });
    return { ok: false, reason: 'invalid_session' };
  }

  const user = await deps.users.findById(session.userId);
  if (user === null || user.mfaSecret === null) {
    await deps.events.record({
      type: 'MFA_FAILED', success: false, method: 'TOTP',
      userId: session.userId, reason: 'mfa_not_configured', context: ctx,
    });
    return { ok: false, reason: 'mfa_not_configured' };
  }

  const result = verifyTotp(user.mfaSecret, input.code, {
    timestampMs: now.getTime(),
    lastUsedCounter: user.mfaLastCounter,
  });

  if (!result.valid || result.counter === null) {
    await deps.events.record({
      type: 'MFA_FAILED', success: false, method: 'TOTP',
      userId: user.id, reason: 'invalid_code', context: ctx, role: user.role,
    });
    return { ok: false, reason: 'invalid_code' };
  }

  // Regista o período usado — impede reutilização do mesmo código nos 30 s.
  await deps.users.setMfaLastCounter(user.id, result.counter);

  // Rotação do token: impede fixação de sessão.
  const elevated = elevateSession(session, now);
  await deps.sessions.replace(session.sessionToken, elevated);

  await deps.events.record({
    type: 'MFA_VERIFIED', success: true, method: 'TOTP',
    userId: user.id, context: ctx, role: user.role,
  });

  return { ok: true, session: elevated };
}

export async function logout(
  sessionToken: string, ctx: RequestContext, deps: AuthDeps,
): Promise<void> {
  const now = deps.clock.now();
  const session = await deps.sessions.findByToken(sessionToken);
  if (session === null) return; // idempotente: sair duas vezes não é erro

  await deps.sessions.revoke(sessionToken, now);
  await deps.events.record({
    type: 'LOGOUT', success: true, userId: session.userId, context: ctx, role: session.role,
  });
}

export async function logoutEverywhere(
  userId: string, ctx: RequestContext, deps: AuthDeps,
): Promise<number> {
  const now = deps.clock.now();
  const count = await deps.sessions.revokeAllForUser(userId, now);
  await deps.events.record({
    type: 'LOGOUT_ALL', success: true, userId,
    reason: `sessions=${count}`, context: ctx,
  });
  return count;
}

/**
 * Revogação de uma sessão específica. O titular pode revogar as suas;
 * revogar as de terceiros exige `session:revoke_any` — verificado pelo chamador.
 */
export async function revokeOwnSession(
  input: { actorUserId: string; sessionToken: string },
  ctx: RequestContext,
  deps: AuthDeps,
): Promise<boolean> {
  const session = await deps.sessions.findByToken(input.sessionToken);
  // 404 silencioso quando a sessão é de outro utilizador — não revela existência.
  if (session === null || session.userId !== input.actorUserId) return false;

  await deps.sessions.revoke(input.sessionToken, deps.clock.now());
  await deps.events.record({
    type: 'SESSION_REVOKED', success: true, userId: input.actorUserId,
    context: ctx, role: session.role,
  });
  return true;
}

export type ChangePasswordFailure =
  | 'invalid_current' | 'weak_password' | 'user_not_found';

export type ChangePasswordResult =
  | { readonly ok: true; readonly revokedSessions: number }
  | { readonly ok: false; readonly reason: ChangePasswordFailure };

export async function changePassword(
  input: { userId: string; currentPassword: string; newPassword: string; keepSessionToken: string },
  ctx: RequestContext,
  deps: AuthDeps,
): Promise<ChangePasswordResult> {
  const now = deps.clock.now();
  const user = await deps.users.findById(input.userId);
  if (user === null || user.passwordHash === null) {
    return { ok: false, reason: 'user_not_found' };
  }

  const currentValid = await deps.hasher.verify(user.passwordHash, input.currentPassword);
  if (!currentValid) {
    await deps.events.record({
      type: 'PASSWORD_CHANGED', success: false, userId: user.id,
      reason: 'invalid_current', context: ctx, role: user.role,
    });
    return { ok: false, reason: 'invalid_current' };
  }

  const check = checkPassword(input.newPassword, { currentPassword: input.currentPassword });
  if (!check.valid) return { ok: false, reason: 'weak_password' };

  await deps.users.setPassword(user.id, await deps.hasher.hash(input.newPassword), now);

  // Todas as outras sessões caem. A atual sobrevive — quem mudou a senha não é expulso.
  const revoked = await deps.sessions.revokeAllForUser(user.id, now, input.keepSessionToken);

  await deps.events.record({
    type: 'PASSWORD_CHANGED', success: true, userId: user.id,
    reason: `revoked=${revoked}`, context: ctx, role: user.role,
  });

  return { ok: true, revokedSessions: revoked };
}

/** Constrói o ator a partir de uma sessão válida. Nunca a partir de dados do cliente. */
export async function resolveActor(
  sessionToken: string,
  deps: AuthDeps,
  options: { requireMfa?: boolean } = {},
): Promise<Actor> {
  const now = deps.clock.now();
  const session = await deps.sessions.findByToken(sessionToken);
  if (session === null) throw new UnauthenticatedError();

  const user = await deps.users.findById(session.userId);
  if (user === null || user.deletedAt !== null) throw new UnauthenticatedError();

  const check = checkSession(session, {
    now,
    requireMfa: options.requireMfa ?? false,
    passwordChangedAt: user.passwordChangedAt,
  });
  if (!check.valid) throw new UnauthenticatedError(`Sessão inválida: ${check.reason}`);

  await deps.sessions.touch(sessionToken, now);

  const actor: Actor = {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,           // resolvido no servidor, nunca vindo do cliente
    grants: user.grants,
    clientId: user.clientId,
    mfaVerifiedAt: session.mfaVerifiedAt,
  };
  return actor;
}
