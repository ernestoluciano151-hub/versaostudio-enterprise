'use client';

import { useActionState, useId, useState } from 'react';
import { looksLikeEmail, messageFor } from '@/lib/auth/ui-helpers';
import type { AuthFormState } from '@/lib/auth/actions';

/**
 * Formulário de login. Usado no portal do cliente e no back-office.
 *
 * O componente não decide nada de segurança: envia e mostra o que o servidor
 * responde. Toda a autorização acontece na server action.
 */

interface Props {
  /** Server action. Recebe o estado anterior e o FormData. */
  readonly action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  readonly callbackUrl: string;
  /** `magic-link` para clientes, `password` para staff. */
  readonly mode: 'magic-link' | 'password';
  readonly showPasswordFallback?: boolean;
}

const INITIAL: AuthFormState = { status: 'idle', error: null, message: null };

export function LoginForm({ action, callbackUrl, mode, showPasswordFallback = false }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [usePassword, setUsePassword] = useState(mode === 'password');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const emailInvalid = touched && email !== '' && !looksLikeEmail(email);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {/* aria-live: o leitor de ecrã anuncia o erro sem o utilizador ter de o procurar */}
      <div aria-live="polite" aria-atomic="true">
        {state.status === 'error' && state.error !== null && (
          <p className="alert alert-error" id={errorId}>
            <span className="alert-icon" aria-hidden="true">!</span>
            <span>{messageFor(state.error)}</span>
          </p>
        )}
        {state.status === 'success' && state.message !== null && (
          <p className="alert alert-success">
            <span className="alert-icon" aria-hidden="true">✓</span>
            <span>{state.message}</span>
          </p>
        )}
      </div>

      <label className="field" htmlFor={emailId}>
        <span className="field-label">E-mail</span>
        <input
          id={emailId}
          className="field-input"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={emailInvalid || state.status === 'error'}
          aria-describedby={state.status === 'error' ? errorId : undefined}
          disabled={pending}
        />
        {emailInvalid && <span className="field-hint">Introduza um e-mail válido.</span>}
      </label>

      {usePassword && (
        <label className="field" htmlFor={passwordId}>
          <span className="field-label">Palavra-passe</span>
          <input
            id={passwordId}
            className="field-input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={state.status === 'error'}
            aria-describedby={state.status === 'error' ? errorId : undefined}
            disabled={pending}
          />
        </label>
      )}

      {/* `disabled` enquanto pendente: em 3G instável, o duplo clique é a norma */}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending
          ? 'A verificar…'
          : usePassword
            ? 'Entrar'
            : 'Enviar link de acesso'}
      </button>

      {showPasswordFallback && (
        <p className="auth-footer">
          <button
            type="button"
            className="btn-link"
            onClick={() => setUsePassword((v) => !v)}
            disabled={pending}
          >
            {usePassword ? 'Prefiro receber um link por e-mail' : 'Prefiro usar palavra-passe'}
          </button>
        </p>
      )}
    </form>
  );
}
