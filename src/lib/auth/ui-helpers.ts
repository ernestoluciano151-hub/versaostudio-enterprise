import { TOTP_DIGITS } from './totp';

/**
 * Lógica pura da UI de autenticação.
 *
 * Vive fora dos componentes para ser testável sem React Testing Library
 * — que não é dependência do projeto.
 */

// ── Código TOTP ─────────────────────────────────────────────────────────────

/** Aceita "123 456", "123-456" e códigos colados de apps de autenticação. */
export function normalizeTotpCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, TOTP_DIGITS);
}

export function isCompleteTotpCode(code: string): boolean {
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code);
}

/**
 * Distribui um valor colado pelas caixas de dígito.
 * Colar "123456" no 3.º campo preenche tudo a partir do início — é o que o
 * utilizador espera, e o contrário obriga a apagar e repetir.
 */
export function spreadPastedCode(pasted: string): string[] {
  const digits = normalizeTotpCode(pasted).split('');
  return Array.from({ length: TOTP_DIGITS }, (_, i) => digits[i] ?? '');
}

export function nextFocusIndex(current: number, value: string): number {
  if (value === '') return Math.max(0, current - 1);
  return Math.min(TOTP_DIGITS - 1, current + 1);
}

// ── Redirecionamento seguro ─────────────────────────────────────────────────

/**
 * Só caminhos internos são aceites como destino pós-login.
 * `//evil.example.com` e `https://…` são caminhos válidos para o browser mas
 * levariam o utilizador para fora — é a via clássica do open redirect.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  return raw;
}

// ── Mensagens ───────────────────────────────────────────────────────────────

/**
 * Mensagem única para credenciais inválidas e conta inexistente.
 * Distinguir os dois casos revela que contas existem.
 */
export const AUTH_MESSAGES = {
  invalid_credentials: 'E-mail ou palavra-passe incorrectos.',
  account_locked:
    'Demasiadas tentativas falhadas. Tente novamente dentro de alguns minutos.',
  account_disabled: 'E-mail ou palavra-passe incorrectos.',
  password_required: 'E-mail ou palavra-passe incorrectos.',
  invalid_code: 'Código incorrecto. Verifique a aplicação de autenticação.',
  invalid_session: 'A sessão expirou. Inicie sessão novamente.',
  mfa_not_configured: 'Autenticação em dois factores por configurar. Contacte o administrador.',
  magic_link_sent:
    'Se existir uma conta com este e-mail, enviámos um link de acesso. Verifique a caixa de entrada.',
  network: 'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.',
  unknown: 'Ocorreu um erro. Tente novamente.',
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;

export function messageFor(key: string | null | undefined): string {
  if (key !== null && key !== undefined && key in AUTH_MESSAGES) {
    return AUTH_MESSAGES[key as AuthMessageKey];
  }
  return AUTH_MESSAGES.unknown;
}

// ── E-mail ──────────────────────────────────────────────────────────────────

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Formato mínimo, só para evitar submissões óbvias. A validação real é no servidor. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Mascara o e-mail em ecrãs de confirmação: `er****@versaodigitallda.com`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local === undefined || domain === undefined) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}
