/**
 * INTERRUPTOR DE INDEXAÇÃO — falha fechada.
 *
 * A empresa já tem um site real e posicionado em versaodigitallda.com. Enquanto
 * esta plataforma estiver em construção, cada deploy vive num domínio
 * `*.vercel.app` com os títulos e descrições reais do negócio. Se o Google
 * indexar um desses domínios, passa a existir um segundo resultado a competir
 * com o site verdadeiro pelas mesmas pesquisas.
 *
 * Por isso o valor por omissão é NÃO indexar. Só a string exacta "true" liga a
 * indexação, e isso deve acontecer uma única vez: no ambiente de produção, no
 * domínio definitivo, quando a Fase 1 (Website & SEO) estiver pronta.
 *
 * Um `undefined`, um erro de escrita ou uma variável esquecida resultam em
 * não indexar. É o resultado seguro.
 */
export const SITE_INDEXABLE = process.env['SITE_INDEXABLE'] === 'true';

/** Fragmento de `metadata.robots` do Next. Aplicado no layout raiz. */
export const ROBOTS_METADATA = SITE_INDEXABLE
  ? { index: true, follow: true }
  : { index: false, follow: false, nocache: true };
