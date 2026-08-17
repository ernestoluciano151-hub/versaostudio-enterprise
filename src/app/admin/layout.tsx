import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * CAMADA 2 de 3 — back-office.
 *
 * Aqui é onde a autorização real começa: sessão validada contra a base de dados,
 * papel adequado à área e MFA verificado. O middleware (camada 1) só garantiu que
 * existe um cookie com forma válida.
 *
 * A ligar no VOL01, quando existir sessão persistida:
 *   const actor = await getActor();
 *   requireStaff(actor);   // CLIENT → 403 · sem MFA → /admin/verificar
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <section data-area="admin">{children}</section>;
}
