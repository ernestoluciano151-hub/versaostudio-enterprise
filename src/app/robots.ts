import type { MetadataRoute } from 'next';
import { SITE_INDEXABLE } from '@/lib/seo/indexing';

/**
 * robots.txt gerado.
 *
 * Falha fechada: enquanto `SITE_INDEXABLE` não for explicitamente "true",
 * nenhum motor de busca é convidado a indexar. A plataforma vive em domínios
 * `*.vercel.app` durante todo o desenvolvimento e uma indexação acidental
 * competiria nos resultados com o site real da empresa.
 *
 * Nota: o `Disallow` do robots.txt impede o rastreio, não a indexação — um URL
 * ligado a partir de outro sítio pode aparecer nos resultados só com o endereço.
 * Por isso a proteção real é a meta `noindex` do layout, que este ficheiro
 * apenas acompanha. Ver `src/lib/seo/indexing.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  if (!SITE_INDEXABLE) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/cliente', '/entrar', '/api'] },
    ],
    sitemap: 'https://www.versaodigitallda.com/sitemap.xml',
  };
}
