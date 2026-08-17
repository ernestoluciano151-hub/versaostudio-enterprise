# Auditoria do site atual — versaodigitallda.com

**Data:** 2026-08-05
**Commit auditado:** `2fcb820` — "fix: SEO & accessibility audit — versaodigitallda.com"
**Método:** análise estática dos ficheiros do repositório + verificação do HTML servido em
produção. Todos os números abaixo foram extraídos dos ficheiros, não estimados.

> ### Correção a afirmações anteriores
> Numa análise preliminar feita a partir do HTML renderizado, afirmei que o site **não tinha
> dados estruturados JSON-LD**. **Estava errado.** As cinco páginas têm JSON-LD válido
> (`LocalBusiness` na homepage, `Service` nas sub-páginas) e o site tem um trabalho de SEO
> técnico bastante acima do que é comum em sites de agências locais. As recomendações abaixo
> partem desse ponto de partida real, não de zero.

---

## 1. Inventário de páginas

| # | Ficheiro | Bytes | Palavras | H1 | H2 | H3 | JSON-LD | Canónico |
|---|---|---|---|---|---|---|---|---|
| 1 | `index.html` | 41 726 | ~593 | 1 | 5 | 10 | `LocalBusiness` | ✅ |
| 2 | `fotografia.html` | 22 867 | ~690 | 1 | 5 | 13 | `Service` | ✅ |
| 3 | `design.html` | 22 404 | ~539 | 1 | 4 | 9 | `Service` | ✅ |
| 4 | `videoclips.html` | 21 632 | ~539 | 1 | 4 | 13 | `Service` | ✅ |
| 5 | `edicao-video.html` | 21 299 | ~577 | 1 | 4 | 13 | `Service` | ✅ |

**Total:** 5 páginas, ~2 938 palavras de conteúdo indexável em todo o site.

### Metadados por página

| Página | `<title>` (car.) | `description` (car.) | Avaliação |
|---|---|---|---|
| `index.html` | 55 | 151 | Dentro dos limites |
| `fotografia.html` | 57 | 139 | Dentro dos limites |
| `design.html` | 59 | 113 | Descrição curta — desperdiça espaço na SERP |
| `videoclips.html` | 58 | 122 | Descrição curta |
| `edicao-video.html` | 61 | 137 | Título 1 car. acima do ideal (60) |

---

## 2. Inventário de assets

| Ficheiro | Bytes | Observação |
|---|---|---|
| `assets/css/pages.css` | 11 697 | Partilhado pelas 4 sub-páginas |
| `assets/js/index.js` | 1 733 | Exclusivo da homepage |
| `assets/js/pages.js` | 1 909 | Partilhado pelas sub-páginas |
| `robots.txt` | 77 | Correto, aponta para o sitemap |
| `sitemap.xml` | 997 | 5 URLs, `lastmod` 2026-05-27 |
| `CNAME` | 24 | `www.versaodigitallda.com` |
| **`assets/img/`** | — | **NÃO EXISTE** |

**CSS embutido dentro do HTML:**

| Página | CSS inline |
|---|---|
| `index.html` | **12 713 bytes** |
| Sub-páginas | 77–84 bytes cada (residual) |

**JS embutido:** `index.html` tem 2 052 bytes inline (lógica do formulário de contacto).

**Recursos externos:** Google Fonts (Playfair Display + Raleway) com `preconnect` correto para
`fonts.googleapis.com` e `fonts.gstatic.com`. Favicon é um SVG embutido em base64 — sem pedido
de rede adicional, boa prática.

---

## 3. Ligações quebradas e problemas de navegação

| Problema | Ocorrências | Ficheiros | Gravidade |
|---|---|---|---|
| `href="#"` — link morto | 4 | `fotografia`, `videoclips`, `design`, `edicao-video` | Média |
| Âncoras internas inválidas | 0 | — | — |
| Ligações internas quebradas | 0 | — | — |
| Ligações externas | Instagram, Facebook, TikTok, WhatsApp — todas bem formadas | — | — |

**Nota positiva:** as ligações de WhatsApp têm mensagem pré-preenchida e contextual por página
(`"Quero agendar uma sessão fotográfica"`, `"Quero saber mais sobre produção de video clips"`).
É um detalhe de conversão bem executado, e deve ser preservado na migração.

---

## 4. Imagens ausentes — o problema mais grave

As cinco páginas declaram `og:image`. **Nenhum dos ficheiros existe no repositório.**

| Página | `og:image` declarado | Existe? |
|---|---|---|
| `index.html` | `/assets/img/og-cover.jpg` | ❌ |
| `fotografia.html` | `/assets/img/og-fotografia.jpg` | ❌ |
| `design.html` | `/assets/img/og-design.jpg` | ❌ |
| `videoclips.html` | `/assets/img/og-videoclips.jpg` | ❌ |
| `edicao-video.html` | `/assets/img/og-edicao-video.jpg` | ❌ |

**Consequência:** todas as partilhas em WhatsApp, Facebook, Instagram e LinkedIn aparecem sem
imagem de pré-visualização. Num mercado onde o WhatsApp é o principal canal de divulgação,
isto reduz a taxa de clique de forma significativa em **todas** as partilhas feitas até hoje.

### Segundo problema de imagem, igualmente sério

```
Total de elementos <img> em todo o site: 0
```

**Um estúdio de fotografia e vídeo tem um site sem uma única fotografia.** Toda a
apresentação visual assenta em emojis (📷 🎬 ✏️ ✂️) e gradientes CSS. Não há portfólio,
não há prova visual do trabalho, e não há nada para o Google Images indexar.

Para o negócio em causa, este é o problema com maior impacto comercial de toda a auditoria —
maior do que qualquer questão técnica listada abaixo.

---

## 5. Problemas de SEO

### 5.1 O que já está bem feito

- ✅ JSON-LD válido nas 5 páginas (`LocalBusiness` + `Service`)
- ✅ `LocalBusiness` completo: morada, telefone, e-mail, `geo` (−8.8368, 13.2343), `sameAs`
  com as três redes sociais, `openingHours`, `priceRange`
- ✅ Canónicos absolutos e corretos em todas as páginas
- ✅ Open Graph e Twitter Card configurados
- ✅ `meta robots: index, follow`
- ✅ `sitemap.xml` e `robots.txt` coerentes entre si
- ✅ Um `H1` por página, hierarquia de títulos correta
- ✅ `aria-expanded`, `aria-label`, `aria-hidden` presentes no menu
- ✅ `viewport` correto

### 5.2 O que falta ou está errado

| # | Problema | Impacto | Esforço |
|---|---|---|---|
| 1 | `og:image` inexistentes (5×) | **Alto** | Baixo |
| 2 | Zero imagens no site | **Alto** | Médio |
| 3 | `lang="pt"` em vez de `lang="pt-AO"` | Médio | Trivial |
| 4 | `fotografia.html` tem FAQ visual mas **sem** `FAQPage` JSON-LD | Médio | Baixo |
| 5 | Sem `BreadcrumbList` em nenhuma sub-página | Médio | Baixo |
| 6 | Sem `Offer`/`AggregateOffer` — preços "A Negociar" | Médio | Depende do negócio |
| 7 | Sem `ImageObject`/`VideoObject` (não há media) | Médio | Médio |
| 8 | Extensões `.html` nos URLs | Baixo | Resolvido na migração |
| 9 | Sem blog nem portfólio — zero cauda longa | **Alto** | Alto |
| 10 | Só 4 serviços expostos; marketing digital, redes sociais e desenvolvimento não têm página | **Alto** | Alto |
| 11 | `description` curtas em `design` (113) e `videoclips` (122) | Baixo | Trivial |
| 12 | Sem `hreflang` (irrelevante hoje, relevante se houver PT-PT/EN) | Baixo | Baixo |
| 13 | `Service` JSON-LD sem `offers` nem `aggregateRating` | Baixo | Depende |

### 5.3 Densidade de conteúdo

~2 938 palavras em todo o site. Uma única página de serviço bem construída de um concorrente
sério tem mais texto do que isto. A oportunidade não é otimizar o que existe — é **haver mais
para otimizar**.

---

## 6. Segurança e privacidade

| # | Achado | Gravidade | Nota |
|---|---|---|---|
| 1 | Chave Web3Forms `b1282a18-…-d66d0a70b3dd` embutida no HTML público | **Média** | É o modelo de funcionamento do Web3Forms (chave pública por desenho), mas **qualquer pessoa pode submeter ao endpoint com esta chave** e inundar a caixa de correio. Mitigar com restrição de domínio e captcha nas definições do Web3Forms, enquanto o backend próprio não existir. |
| 2 | Sem `Content-Security-Policy` | Média | GitHub Pages não permite cabeçalhos personalizados; configurável na Cloudflare |
| 3 | Sem política de privacidade nem aviso de cookies | Média | Recolhem-se nome, e-mail e telefone sem base legal documentada (Lei n.º 22/11) |
| 4 | Dados do formulário vão para um terceiro (Web3Forms) sem menção ao utilizador | Média | Requer divulgação na política de privacidade |
| 5 | E-mail exposto em texto claro no JSON-LD (12 ocorrências de `geral@versaodigitallda.com`) | Baixa | Inevitável e desejável para SEO local; aceitar |

**Nada crítico.** Não há credenciais de servidor, chaves de API privadas nem dados de clientes
no repositório.

---

## 7. Desempenho e código

| Achado | Detalhe |
|---|---|
| CSS duplicado | `index.html` tem 12,7 KB de CSS inline; as sub-páginas usam `pages.css` (11,7 KB). Grande parte das regras é comum. |
| **Tokens de cor divergentes** | `index.html` define `--gold`; `pages.css` define `--g1`, `--g2`, `--g3` para os mesmos douradores. Dois vocabulários para a mesma paleta. |
| JS duplicado | `index.js` e `pages.js` implementam a mesma lógica com IDs diferentes (`mobileMenu`/`hamburger` vs. `mob`/`hbg`) |
| Sem build | Sem minificação, sem *bundling*, sem *cache busting* por hash |
| Fontes | Google Fonts com `preconnect` e `display=swap` — correto |
| Sem imagens | Ironicamente, garante um LCP excelente. Deixará de ser verdade quando houver portfólio — o que torna a estratégia de imagens da nova plataforma crítica desde o início. |

---

## 8. Acessibilidade

**Bem:** `aria-expanded` gerido por JS no menu mobile, `aria-label` em elementos interativos,
`aria-hidden` em ícones decorativos, hierarquia de títulos correta, `scroll-behavior` do CSS
removido para evitar conflito com o scroll suave em JS (decisão deliberada e documentada em
comentário — bom sinal de cuidado).

**A corrigir:** `lang="pt"` deve ser `pt-AO` · zero atributos `role` · contraste do dourado
`#B8862A` sobre creme `#FDF6E8` ≈ **3,4:1**, abaixo do mínimo WCAG AA de 4,5:1 para texto ·
4 links `href="#"` são focáveis mas não fazem nada.

---

## 9. Mapa de URLs e plano de redirects

| URL atual | Estado | URL novo | Ação |
|---|---|---|---|
| `https://www.versaodigitallda.com/` | 200 | `/` | Manter |
| `/index.html` | 200 | `/` | **301** |
| `/fotografia.html` | 200 | `/servicos/fotografia` | **301** |
| `/videoclips.html` | 200 | `/servicos/videoclipes` | **301** |
| `/design.html` | 200 | `/servicos/design-branding` | **301** |
| `/edicao-video.html` | 200 | `/servicos/edicao-video` | **301** |
| `/robots.txt` | 200 | dinâmico | Substituir |
| `/sitemap.xml` | 200 | dinâmico | Substituir |
| `versaodigitallda.com` (apex) | redirect | `www.` | Manter canónico |

**Regra:** nenhuma cadeia de redirects. `/fotografia.html` vai diretamente ao destino final.

---

## 10. Estratégia de migração (resumo)

Detalhe completo em [`site-migration-plan.md`](site-migration-plan.md).

**Três fases, com o site antigo sempre disponível para reversão:**

1. **Correções imediatas** (2 dias, antes de qualquer desenvolvimento) — criar as 5 imagens
   OG, corrigir `lang`, remover os `href="#"`, adicionar `FAQPage` em `fotografia.html`,
   restringir a chave Web3Forms ao domínio, publicar política de privacidade, registar
   o baseline no Search Console.
2. **Construção paralela** — plataforma nova em `staging.versaodigitallda.com` com `noindex`,
   até cada página nova superar a antiga em conteúdo.
3. **Corte com reversão possível** — DNS para o Vercel, site antigo mantido em
   `legacy.versaodigitallda.com` durante 60 dias.

---

## 11. Priorização dos achados

### Fazer esta semana (custo baixo, impacto alto)

1. Criar as 5 imagens `og:*.jpg` (1200×630) — **todas as partilhas estão sem imagem**
2. Restringir a chave Web3Forms ao domínio + ativar captcha
3. `lang="pt"` → `lang="pt-AO"`
4. Remover os 4 `href="#"`
5. `FAQPage` JSON-LD em `fotografia.html`
6. Registar baseline no Search Console (impossível reconstruir depois)

### Fazer antes do lançamento da plataforma

7. Fotografar e publicar portfólio real
8. Páginas para os 4 serviços sem presença (marketing digital, redes sociais, vídeo
   institucional, desenvolvimento)
9. Decidir sobre a exposição de preços ("A Negociar" custa leads qualificados)
10. Política de privacidade e aviso de cookies
11. Unificar tokens de cor (`--gold` vs. `--g1`)
12. Corrigir o contraste do dourado em texto

### Resolvido pela nova plataforma

13. Duplicação de CSS/JS · pipeline de build · CMS · blog · backend do formulário ·
    cabeçalhos de segurança · URLs sem `.html`

---

## 12. Conclusão

O site atual está **melhor construído do que o esperado** para um site estático de agência:
JSON-LD correto, canónicos, acessibilidade cuidada e ligações de WhatsApp contextualizadas
revelam trabalho deliberado, não um modelo genérico.

Os dois problemas dominantes não são de código:

1. **Zero imagens** num negócio cujo produto é imagem.
2. **Cinco `og:image` inexistentes**, o que anula a pré-visualização em todas as partilhas.

Ambos se corrigem em dias, sem esperar pela plataforma nova. O resto — CMS, reservas,
pagamentos, portal — é o que a Fase 1 em diante vai construir.
