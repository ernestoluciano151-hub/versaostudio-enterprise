import type { Metadata } from 'next';
import { TotpChallenge } from '@/components/auth/TotpChallenge';
import { verifyTotpAction } from '@/lib/auth/actions';
import { safeCallbackUrl } from '@/lib/auth/ui-helpers';

export const metadata: Metadata = {
  title: 'Verificação em dois factores',
  robots: { index: false, follow: false },
};

interface Props {
  readonly searchParams: Promise<{ callbackUrl?: string }>;
}

/**
 * Desafio de segundo fator.
 *
 * Chega-se aqui com uma sessão criada mas NÃO elevada — dura 10 minutos e não
 * dá acesso a nenhuma rota de /admin (session.ts, SESSION_LIFETIME.PENDING_MFA).
 * A verificação bem-sucedida roda o token da sessão: impede fixação.
 */
export default async function VerificarPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl, '/admin');

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <p className="auth-brand">Versão Digital · Back-office</p>
        <h1 className="auth-title">Verificação em dois factores</h1>
        <p className="auth-subtitle">
          Introduza o código de 6 dígitos da sua aplicação de autenticação.
        </p>

        <TotpChallenge action={verifyTotpAction} callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
