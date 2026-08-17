import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { magicLinkAction } from '@/lib/auth/actions';
import { safeCallbackUrl } from '@/lib/auth/ui-helpers';

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
};

interface Props {
  readonly searchParams: Promise<{ callbackUrl?: string }>;
}

/**
 * Login do portal do cliente.
 * Magic link é o método principal — a maioria dos clientes não gere palavras-passe
 * (ADR-007, decisão 2).
 */
export default async function EntrarPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, '/cliente');

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <p className="auth-brand">Versão Digital</p>
        <h1 className="auth-title">Entrar</h1>
        <p className="auth-subtitle">
          Enviamos um link de acesso para o seu e-mail. Sem palavra-passe para memorizar.
        </p>

        <LoginForm
          action={magicLinkAction}
          callbackUrl={callbackUrl}
          mode="magic-link"
          showPasswordFallback
        />

        <p className="auth-footer">
          Ainda não é cliente? <a href="/contacto">Fale connosco</a>
        </p>
      </div>
    </main>
  );
}
