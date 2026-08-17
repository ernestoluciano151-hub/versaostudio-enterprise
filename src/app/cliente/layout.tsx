import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * CAMADA 2 de 3 — portal do cliente.
 *
 * A ligar no VOL01:
 *   const actor = await getActor();
 *   requireRole(actor, ['CLIENT']);
 *
 * O isolamento entre clientes NÃO é feito aqui — é feito na query, com
 * `clientScope(actor)`. Ver docs/security/rbac.md §7.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <section data-area="cliente">{children}</section>;
}
