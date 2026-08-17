'use server';

import { AUTH_MESSAGES, normalizeEmail, safeCallbackUrl } from './ui-helpers';
import { isCompleteTotpCode, normalizeTotpCode } from './ui-helpers';
import type { AuthDeps } from './ports';

/**
 * SERVER ACTIONS de autenticação.
 *
 * ⚠️ ESTADO: os adapters Prisma ainda não existem. `getAuthDeps()` lança até que
 * existam. Isto é deliberado — uma action que devolvesse sucesso falso daria a
 * ilusão de um sistema a funcionar. Ver docs/01-auth/vol01-progress.md §6.
 *
 * As actions verificam a origem automaticamente (Next), mas a validação e a
 * autorização continuam a ser feitas aqui, no servidor.
 */

export interface AuthFormState {
  readonly status: 'idle' | 'error' | 'success';
  readonly error: string | null;
  readonly message: string | null;
}

const NOT_CONFIGURED =
  'Autenticação por ligar: faltam os adapters de base de dados (VOL01, passo 3).';

/** Substituir pela composição real quando os adapters Prisma existirem. */
function getAuthDeps(): AuthDeps {
  throw new Error(NOT_CONFIGURED);
}

function fail(error: string): AuthFormState {
  return { status: 'error', error, message: null };
}

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const callbackUrl = safeCallbackUrl(String(formData.get('callbackUrl') ?? ''), '/cliente');

  if (email === '' || password === '') return fail('invalid_credentials');

  try {
    const deps = getAuthDeps();
    const { loginWithPassword } = await import('./use-cases');
    const result = await loginWithPassword({ email, password }, contextFrom(callbackUrl), deps);

    if (!result.ok) return fail(result.reason);

    // A emissão do cookie e o redirect entram com o NextAuth (passo 6).
    return { status: 'success', error: null, message: null };
  } catch (error) {
    if (error instanceof Error && error.message === NOT_CONFIGURED) {
      return fail('unknown');
    }
    throw error;
  }
}

export async function magicLinkAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));

  // Resposta idêntica exista ou não a conta — e antes de qualquer consulta,
  // para que o tempo de resposta também não varie.
  if (email === '') return fail('invalid_credentials');

  try {
    getAuthDeps();
  } catch {
    return fail('unknown');
  }

  return { status: 'success', error: null, message: AUTH_MESSAGES.magic_link_sent };
}

export async function verifyTotpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const code = normalizeTotpCode(String(formData.get('code') ?? ''));
  if (!isCompleteTotpCode(code)) return fail('invalid_code');

  try {
    getAuthDeps();
  } catch {
    return fail('unknown');
  }

  return { status: 'success', error: null, message: null };
}

function contextFrom(path: string) {
  return { ip: null, userAgent: null, path, requestId: crypto.randomUUID() };
}
