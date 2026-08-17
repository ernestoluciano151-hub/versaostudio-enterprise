import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Em teste, `server-only` é substituído por um stub (ver vitest.config.ts).
 * Este teste garante que a substituição não esconde a remoção acidental do
 * import nos módulos que só podem correr no servidor.
 */
const MODULOS_SO_SERVIDOR = ['permissions.server.ts'] as const;

describe('proteção server-only', () => {
  it.each(MODULOS_SO_SERVIDOR)('%s importa server-only', (ficheiro) => {
    const src = readFileSync(new URL(`../${ficheiro}`, import.meta.url), 'utf8');
    expect(src).toMatch(/^import 'server-only';/m);
  });

  it('o middleware NÃO importa server-only (corre no Edge)', () => {
    const src = readFileSync(new URL('../../../middleware.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/server-only/);
  });
});
