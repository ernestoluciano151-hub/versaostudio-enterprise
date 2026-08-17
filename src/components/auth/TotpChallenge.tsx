'use client';

import { useActionState, useId, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { TOTP_DIGITS } from '@/lib/auth/totp';
import {
  isCompleteTotpCode, messageFor, nextFocusIndex, normalizeTotpCode, spreadPastedCode,
} from '@/lib/auth/ui-helpers';
import type { AuthFormState } from '@/lib/auth/actions';

/**
 * Desafio de segundo fator — 6 caixas de dígito.
 *
 * Decisões de usabilidade que também são de segurança: quanto mais difícil for
 * introduzir o código, mais gente desativa o MFA.
 *   · `autoComplete="one-time-code"` — o iOS oferece o código do teclado
 *   · colar distribui os dígitos, em vez de encher a primeira caixa
 *   · Backspace numa caixa vazia recua
 *   · submete sozinho ao 6.º dígito
 */

interface Props {
  readonly action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  readonly callbackUrl: string;
}

const INITIAL: AuthFormState = { status: 'idle', error: null, message: null };

export function TotpChallenge({ callbackUrl, action }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [digits, setDigits] = useState<string[]>(Array<string>(TOTP_DIGITS).fill(''));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = useId();

  const code = digits.join('');

  function focusAt(index: number): void {
    inputs.current[index]?.focus();
    inputs.current[index]?.select();
  }

  function commit(next: string[]): void {
    setDigits(next);
    if (isCompleteTotpCode(next.join(''))) {
      // Submissão automática ao 6.º dígito — evita o clique extra.
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }

  function handleChange(index: number, raw: string): void {
    const value = normalizeTotpCode(raw).slice(-1);
    const next = [...digits];
    next[index] = value;
    commit(next);
    focusAt(nextFocusIndex(index, value));
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      focusAt(index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) focusAt(index - 1);
    if (event.key === 'ArrowRight' && index < TOTP_DIGITS - 1) focusAt(index + 1);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    const next = spreadPastedCode(event.clipboardData.getData('text'));
    commit(next);
    focusAt(Math.min(next.filter(Boolean).length, TOTP_DIGITS - 1));
  }

  return (
    <form action={formAction} ref={formRef} noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="code" value={code} />

      <div aria-live="polite" aria-atomic="true">
        {state.status === 'error' && state.error !== null && (
          <p className="alert alert-error" id={errorId}>
            <span className="alert-icon" aria-hidden="true">!</span>
            <span>{messageFor(state.error)}</span>
          </p>
        )}
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label">Código de 6 dígitos</legend>
        <div className="totp-group">
          {digits.map((digit, index) => (
            <input
              // A posição é a identidade da caixa — não há reordenação possível.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              ref={(el) => { inputs.current[index] = el; }}
              className="totp-digit"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={1}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              aria-label={`Dígito ${index + 1} de ${TOTP_DIGITS}`}
              aria-invalid={state.status === 'error'}
              aria-describedby={state.status === 'error' ? errorId : undefined}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={pending}
              autoFocus={index === 0}
            />
          ))}
        </div>
      </fieldset>

      <button
        className="btn btn-primary"
        type="submit"
        disabled={pending || !isCompleteTotpCode(code)}
      >
        {pending ? 'A verificar…' : 'Verificar'}
      </button>

      <p className="auth-footer">
        Sem acesso à aplicação de autenticação?{' '}
        <a href="/admin/codigo-recuperacao">Usar um código de recuperação</a>
      </p>
    </form>
  );
}
