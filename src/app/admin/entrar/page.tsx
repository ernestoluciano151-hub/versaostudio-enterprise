import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { loginAction } from '@/lib/auth/actions';
import { safeCallbackUrl } from '@/lib/auth/ui-helpers';

export const metadata: Metadata = {
  title: 'Back-office',
  robots: { index: false, follow: false },
};

interface Props {
  readonly searchParams: Promise<{ callbackUrl?: string }>;
}

/**
 * Login do back-office. Palavra-passe + TOTP obrigatório para os 10 papéis de
 * staff (rbac.md §2). A verificação do segundo fator acontece em /admin/verificar.
 */
export default async function AdminEntrarPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, '/admin');

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <p className="auth-brand">Versão Digital · Back-office</p>
        <h1 className="auth-title">Iniciar sessão</h1>
        <p className="auth-subtitle">
          Acesso reservado à equipa. É pedido o código de dois factores a seguir.
        </p>

        <LoginForm action={loginAction} callbackUrl={callbackUrl} mode="password" />

        <p className="auth-footer">
          <a href="/recuperar">Esqueci-me da palavra-passe</a>
        </p>
      </div>
    </main>
  );
}
