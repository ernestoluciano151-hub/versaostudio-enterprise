# 05 — Estratégia de migração SEO

**Objetivo:** substituir o site estático sem perder uma única posição orgânica, e sair da
migração com mais superfície indexável do que antes.

---

## 1. Inventário atual (auditado em 2026-08-05)

| URL atual | Título | Destino novo | Ação |
|---|---|---|---|
| `/` | Versão Digital · Agência de Marketing em Luanda, Angola | `/` | Reescrever, manter URL |
| `/fotografia.html` | Fotografia | `/servicos/fotografia` | **301** |
| `/videoclips.html` | Video Clips | `/servicos/videoclipes` | **301** |
| `/design.html` | Design & Branding | `/servicos/design-branding` | **301** |
| `/edicao-video.html` | Edição de Vídeo | `/servicos/edicao-video` | **301** |
| `/sitemap.xml` | — | dinâmico | Substituir |
| `/robots.txt` | — | dinâmico | Substituir |

**Ativos a preservar:** domínio com histórico, `www.versaodigitallda.com` como canónico,
metadados `pt_AO`, Open Graph já configurado, presença nas redes (Instagram, Facebook, TikTok)
a apontar para o domínio.

**Problemas encontrados no site atual (corrigir na migração):**

- `og:image` aponta para `/assets/img/og-cover.jpg`, mas **a pasta de imagens não existe no
  repositório** → partilhas em redes sociais sem imagem. Corrigir antes de tudo o resto.
- Sem `JSON-LD` / schema.org — nenhum rich result possível.
- Sem `hreflang`, sem breadcrumbs, sem página de portfólio ou blog (zero superfície de
  cauda longa).
- Preços apresentados como "A Negociar" — perde-se intenção transacional.
- Formulário de contacto sem backend visível → leads possivelmente perdidos.
- Endereço e telefone presentes, mas sem `LocalBusiness` estruturado → fraco desempenho em
  pesquisa local ("agência de marketing perto de mim").

---

## 2. Princípios da migração

1. **Nunca quebrar um URL indexado.** Um 404 num URL com histórico é perda permanente.
2. **Um 301, nunca uma cadeia.** `/fotografia.html → /servicos/fotografia`, direto.
3. **Conteúdo primeiro, layout depois.** A página nova tem de ter *mais* conteúdo útil que a
   antiga, não apenas melhor aspeto.
4. **Migrar por fases.** O site novo entra em produção quando cada página nova já supera a
   antiga em conteúdo e desempenho.
5. **Medir antes e depois.** Sem baseline, não há forma de detetar uma quebra.

---

## 3. Implementação dos redirects

### Camada 1 — `next.config.ts` (estáticos, rápidos)

```ts
async redirects() {
  return [
    { source: '/fotografia.html',   destination: '/servicos/fotografia',      permanent: true },
    { source: '/videoclips.html',   destination: '/servicos/videoclipes',     permanent: true },
    { source: '/design.html',       destination: '/servicos/design-branding', permanent: true },
    { source: '/edicao-video.html', destination: '/servicos/edicao-video',    permanent: true },
    { source: '/index.html',        destination: '/',                          permanent: true },
    // Canónico: apex -> www (também garantido na Cloudflare)
  ];
}
```

### Camada 2 — middleware (dinâmicos, geridos no admin)

Consulta a tabela `Redirect` para URLs criados depois do lançamento (mudanças de slug do CMS),
com cache em memória e incremento de `hitCount` para saber quais podem ser retirados.

**Regra do CMS:** alterar o slug de uma página `PUBLISHED` **cria automaticamente** o
`Redirect` 301. Não é opcional, não é um checkbox.

### Teste automático (bloqueia deploy)

```ts
// e2e/seo-redirects.spec.ts
const LEGACY = [
  ['/fotografia.html', '/servicos/fotografia'],
  ['/videoclips.html', '/servicos/videoclipes'],
  ['/design.html', '/servicos/design-branding'],
  ['/edicao-video.html', '/servicos/edicao-video'],
];
for (const [from, to] of LEGACY) {
  test(`301 ${from}`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers()['location'], BASE).pathname).toBe(to);
  });
}
```

---

## 4. Arquitetura de informação alvo

```
/                                  marca + prova + conversão
├── /servicos                      hub (link equity para as filhas)
│   ├── /fotografia                ← 301
│   │   ├── /fotografia/corporativa
│   │   ├── /fotografia/eventos
│   │   ├── /fotografia/casamentos
│   │   └── /fotografia/produtos
│   ├── /videoclipes               ← 301
│   ├── /design-branding           ← 301
│   ├── /edicao-video              ← 301
│   ├── /marketing-digital         NOVO
│   ├── /gestao-redes-sociais      NOVO
│   ├── /videos-institucionais     NOVO
│   └── /desenvolvimento-saas      NOVO
├── /pacotes                       preços — intenção transacional
├── /portfolio  /portfolio/[slug]  prova social + cauda longa
├── /blog       /blog/[slug]       autoridade (EEAT)
├── /sobre  /contacto  /agendar
└── /politica-privacidade  /termos
```

As sub-páginas de fotografia existem porque "fotografia de casamento Luanda" e "fotografia de
produto Angola" são pesquisas distintas com intenção distinta. Uma página genérica não ganha
nenhuma das duas.

---

## 5. Dados estruturados (JSON-LD)

Gerados por `lib/seo/json-ld.ts`, um builder por tipo, validados em teste.

**Em todas as páginas** — `Organization` + `LocalBusiness`:

```json
{
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  "name": "Versão Digital",
  "legalName": "Versão Digital LDA",
  "url": "https://www.versaodigitallda.com",
  "logo": "https://www.versaodigitallda.com/logo.png",
  "image": "https://www.versaodigitallda.com/og-cover.jpg",
  "telephone": "+244939183513",
  "email": "versaodigitallda@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rua N2, Casa N55, Bairro Cassenda",
    "addressLocality": "Luanda",
    "addressCountry": "AO"
  },
  "areaServed": { "@type": "Country", "name": "Angola" },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens": "08:00", "closes": "18:00"
  }],
  "sameAs": [
    "https://www.instagram.com/versaodigitallda",
    "https://www.facebook.com/share/18ZgsbAdVi/",
    "https://www.tiktok.com/@verso.digital.lda"
  ]
}
```

**Páginas de serviço** — `Service` + `BreadcrumbList` + `FAQPage` (quando há FAQ real).
**Portfólio** — `CreativeWork` / `ImageObject` / `VideoObject`.
**Blog** — `Article` com `author`, `datePublished`, `dateModified`.
**Pacotes** — `Offer` com `priceCurrency: "AOA"`.

> Se os preços passarem a ser públicos, usar `Offer` com valor real. `"A Negociar"` não gera
> rich result e afasta quem procura com intenção de compra.

---

## 6. Metadados

```ts
// app/(public)/servicos/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const page = await getSEOPage(`servicos/${params.slug}`);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `${BASE}/servicos/${params.slug}` },
    openGraph: {
      title: page.ogTitle ?? page.metaTitle,
      description: page.ogDescription ?? page.metaDescription,
      url: `${BASE}/servicos/${params.slug}`,
      siteName: 'Versão Digital', locale: 'pt_AO', type: 'website',
      images: [{ url: ogImageUrl(page), width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
    robots: page.noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}
```

**Regras:** `title` ≤ 60 caracteres · `description` 140–160 · canónico sempre absoluto e com
`www` · imagens OG geradas dinamicamente por `opengraph-image.tsx` (elimina de vez o problema
da imagem em falta) · um só `H1` por página.

---

## 7. Sitemap e robots dinâmicos

```ts
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await db.sEOPage.findMany({
    where: { status: 'PUBLISHED', noindex: false },
    select: { slug: true, updatedAt: true, pageType: true },
  });
  return pages.map((p) => ({
    url: `${BASE}/${p.slug}`.replace(/\/$/, '') || BASE,
    lastModified: p.updatedAt,
    changeFrequency: p.pageType === 'BLOG_POST' ? 'monthly' : 'weekly',
    priority: p.pageType === 'HOME' ? 1 : p.pageType === 'SERVICE' ? 0.8 : 0.6,
  }));
}
```

`robots.ts` permite tudo em `(public)` e bloqueia `/admin`, `/cliente`, `/api`.

---

## 8. Core Web Vitals — orçamento de desempenho

| Métrica | Alvo | Como se consegue |
|---|---|---|
| LCP | < 2,0 s (4G lento) | Imagem hero em AVIF/WebP com `priority`, fontes com `next/font` e `display: swap` |
| INP | < 200 ms | RSC por omissão; `use client` só onde há interação real |
| CLS | < 0,05 | `width`/`height` explícitos em todas as imagens; sem inserção de conteúdo acima da dobra |
| TTFB | < 600 ms | ISR + cache Cloudflare |
| JS inicial | < 100 KB gzip | Sem bibliotecas de animação pesadas; ícones tree-shaken |

Lighthouse CI em cada PR: **performance ≥ 90, SEO = 100, acessibilidade ≥ 95**. Abaixo disso,
o merge é bloqueado.

---

## 9. Cronograma da migração

| Fase | Duração | Ações | Critério de saída |
|---|---|---|---|
| **0. Baseline** | 1 semana | Search Console + GA4 + registo de posições e tráfego atuais; exportar todas as queries | Baseline documentado |
| **1. Correções no site atual** | 2 dias | Corrigir `og:image` em falta, adicionar JSON-LD básico, ligar o formulário a um destino real | Partilhas com imagem; leads a chegar |
| **2. Construção paralela** | 4–6 semanas | Site novo em `staging.versaodigitallda.com`, com `noindex` | Todas as páginas ≥ antigas em conteúdo |
| **3. Ensaio de corte** | 2 dias | Testar todos os 301 em staging; validar JSON-LD; Lighthouse | E2E de SEO verde |
| **4. Corte** | 1 dia, fora de horas | DNS/deploy, remover `noindex`, submeter sitemap, pedir indexação das 5 principais | 200 em todas as páginas; 301 corretos |
| **5. Vigilância** | 4 semanas | Search Console diário nos primeiros 7 dias; monitorizar 404, rastreio e posições | Tráfego orgânico ≥ 95 % do baseline |

**Critério de rollback:** queda > 25 % em impressões orgânicas durante 7 dias consecutivos,
ou aumento anómalo de erros de rastreio → reverter DNS para o GitHub Pages (mantido intacto
durante 60 dias) e investigar.

---

## 10. Pós-migração — checklist semanal (primeiras 4 semanas)

- [ ] Search Console: cobertura, 404s, erros de dados estruturados
- [ ] Posições das 20 keywords principais vs. baseline
- [ ] Core Web Vitals em dados de campo (CrUX)
- [ ] `Redirect.hitCount` — quais estão a ser usados
- [ ] Logs de 404 → criar redirect ou página
- [ ] Taxa de conversão do formulário e cliques de WhatsApp vs. baseline
