/**
 * Constantes TOTP — SEM dependências de Node.
 *
 * Existe separado de `totp.ts` porque este é importado por componentes de cliente
 * (`TotpChallenge.tsx`). O `totp.ts` usa `node:crypto`, que o webpack não consegue
 * empacotar para o browser — importar uma única constante de lá contaminava todo
 * o grafo do cliente.
 */

export const TOTP_PERIOD_SECONDS = 30 as const;
export const TOTP_DIGITS = 6 as const;
/** ±1 período = tolera ±30 s de desvio de relógio. */
export const TOTP_WINDOW = 1 as const;
