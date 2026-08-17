import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * O interruptor lê `process.env` no momento em que o módulo é avaliado. Para
 * testar valores diferentes é preciso limpar o registo de módulos antes de cada
 * import — sem isso, o segundo caso receberia o módulo já em cache do primeiro
 * e o teste passaria sempre, medindo nada.
 */
async function loadWith(value: string | undefined) {
  if (value === undefined) {
    delete process.env['SITE_INDEXABLE'];
  } else {
    process.env['SITE_INDEXABLE'] = value;
  }
  vi.resetModules();
  return import('../indexing');
}

afterEach(() => {
  delete process.env['SITE_INDEXABLE'];
  vi.resetModules();
});

describe('interruptor de indexação — falha fechada', () => {
  const naoIndexam: ReadonlyArray<readonly [string | undefined, string]> = [
    [undefined, 'variável ausente'],
    ['', 'string vazia'],
    ['false', 'desligado explicitamente'],
    ['TRUE', 'maiúsculas — não é a string exacta'],
    ['True', 'capitalizado'],
    ['1', 'número em vez de booleano'],
    ['yes', 'palavra em vez de booleano'],
    [' true', 'espaço à frente — erro de configuração típico'],
    ['true ', 'espaço atrás'],
  ];

  it.each(naoIndexam)('%s (%s) não indexa', async (value) => {
    const { SITE_INDEXABLE, ROBOTS_METADATA } = await loadWith(value);
    expect(SITE_INDEXABLE).toBe(false);
    expect(ROBOTS_METADATA.index).toBe(false);
    expect(ROBOTS_METADATA.follow).toBe(false);
  });

  it('só a string exacta "true" liga a indexação', async () => {
    const { SITE_INDEXABLE, ROBOTS_METADATA } = await loadWith('true');
    expect(SITE_INDEXABLE).toBe(true);
    expect(ROBOTS_METADATA.index).toBe(true);
    expect(ROBOTS_METADATA.follow).toBe(true);
  });

  it('o robots.txt acompanha o interruptor', async () => {
    vi.resetModules();
    delete process.env['SITE_INDEXABLE'];
    const { default: robots } = await import('../../../app/robots');
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules[0]?.disallow).toBe('/');
    expect(result.sitemap).toBeUndefined();
  });
});
