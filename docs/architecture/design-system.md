# 07 — Identidade visual evolutiva e design system

**Princípio:** evolução, não rutura. A paleta dourada sobre creme já é reconhecível e distingue
a Versão Digital das agências que usam azul/roxo genérico. Mantém-se o ADN; corrige-se o que
não passa em contraste, densidade de informação e uso em interface de produto.

---

## 1. O que se herda do site atual

```css
--gold: #B8862A;   /* dourado principal */
--gb:   #FDF6E8;   /* creme claro */
--gm:   #F5E6C0;   /* creme médio */
--cr:   #FEFCF5;   /* quase branco */
--dk:   #1A1208;   /* castanho escuro (texto) */
--bd:   #E8D5A0;   /* bordas */
```

Tipografia: **Playfair Display** (títulos) + **Raleway** (corpo).

**Diagnóstico honesto**

| Aspeto | Avaliação |
|---|---|
| Dourado sobre creme | Distintivo e memorável — **manter** |
| Playfair Display | Excelente para títulos de marca — **manter em `(public)`** |
| Raleway em corpo pequeno | Legibilidade fraca abaixo de 14 px em ecrãs de baixa densidade — **substituir no produto** |
| Contraste `#B8862A` sobre `#FDF6E8` | ≈ 3,4:1 — **falha WCAG AA para texto** (mínimo 4,5:1) |
| Ausência de escala de cinzentos | Impossível construir tabelas, formulários e estados de UI |
| Ausência de cores semânticas | Sem sucesso/erro/aviso — obrigatório num produto financeiro |

---

## 2. Tokens

### Cor

```ts
// tailwind.config.ts — extend.colors
const colors = {
  brand: {
    50:'#FEFCF5', 100:'#FDF6E8', 200:'#F5E6C0', 300:'#E8D5A0', 400:'#D4AF5F',
    500:'#B8862A',  // dourado da marca — decorativo, fundos, ícones
    600:'#966D1F',  // ← usar este para TEXTO dourado (contraste ≥ 4,5:1 sobre creme)
    700:'#7A5818', 800:'#5C4212', 900:'#3D2C0C', 950:'#1A1208',
  },
  ink: { // escala neutra derivada do castanho da marca — não cinzento puro
    50:'#FAF9F7', 100:'#F2F0EC', 200:'#E3E0D9', 300:'#C9C4B9', 400:'#A39D8F',
    500:'#7D776A', 600:'#5F5A50', 700:'#474339', 800:'#2E2A22', 900:'#1A1208',
  },
  success: { 50:'#ECFDF3', 500:'#12B76A', 700:'#027A48' },
  warning: { 50:'#FFFAEB', 500:'#F79009', 700:'#B54708' },
  danger:  { 50:'#FEF3F2', 500:'#F04438', 700:'#B42318' },
  info:    { 50:'#EFF8FF', 500:'#2E90FA', 700:'#175CD3' },
};
```

**Regra de contraste, sem exceções:** `brand.500` nunca é usado para texto sobre fundos claros.
Para texto dourado, `brand.600` ou mais escuro. Verificado por teste de acessibilidade em CI.

### Cores de estado de negócio

Reutilizadas em toda a aplicação, sempre com **ícone além da cor** (daltonismo):

| Estado | Cor | Uso |
|---|---|---|
| `CONFIRMED`, `CAPTURED`, `PAID` | `success` | Reserva confirmada, pagamento capturado |
| `PENDING`, `INITIATED` | `warning` | Aguarda pagamento ou confirmação |
| `FAILED`, `CANCELLED`, `OVERDUE` | `danger` | Falha, cancelamento, atraso |
| `DRAFT`, `ARCHIVED` | `ink` | Rascunho, arquivado |
| `IN_PRODUCTION`, `SCHEDULED` | `info` | Em curso |

### Tipografia

```ts
fontFamily: {
  display: ['var(--font-playfair)', 'Georgia', 'serif'],  // títulos em (public)
  sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'], // TODO o produto
}
```

**Decisão:** Playfair Display fica no website público (é a voz da marca). O portal e o
back-office usam **Inter** — desenhada para densidade de informação, números tabulares e
tamanhos pequenos. Raleway sai do produto e mantém-se apenas onde já vive, no marketing.

**Números tabulares obrigatórios** em qualquer coluna monetária:
`font-variant-numeric: tabular-nums` — sem isto, colunas de kwanzas ficam desalinhadas.

```
Escala:  xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 · 3xl 30 · 4xl 36 · 5xl 48 · 6xl 60
Corpo mínimo em produto: 14 px.  Nunca abaixo.
```

### Espaçamento, raio e sombra

```
Espaçamento: escala de 4 px (4, 8, 12, 16, 24, 32, 48, 64, 96)
Raio:        sm 6 · md 8 · lg 12 · xl 16 · full 9999
Sombra:      brand: 0 4px 32px rgba(184,134,42,.10)   ← herdada do site atual
             card:  0 1px 3px rgba(26,18,8,.08)
             modal: 0 20px 48px rgba(26,18,8,.18)
```

---

## 3. Dois modos visuais, uma marca

| | Website público | Produto (portal + admin) |
|---|---|---|
| Objetivo | Emocionar e converter | Executar tarefas depressa |
| Tipografia | Playfair + Inter | Inter |
| Densidade | Ampla, respirada | Compacta |
| Cor | Dourado generoso | Dourado como acento; neutros dominam |
| Imagem | Grande, protagonista | Miniaturas funcionais |
| Movimento | Transições suaves | Mínimo — feedback apenas |

São o mesmo sistema de tokens com densidades diferentes. Não são duas marcas.

---

## 4. Componentes (shadcn/ui personalizado)

**Base:** Button, Input, Select, Checkbox, Radio, Switch, Textarea, Label, Dialog, Sheet,
Dropdown, Popover, Tooltip, Toast, Tabs, Accordion, Badge, Avatar, Skeleton, Table, Pagination.

**De domínio, construídos sobre a base:**

| Componente | Regra crítica |
|---|---|
| `<Money>` | Formata a partir de `amountMinor` + `currency`. **Nunca** recebe `number` solto. Tabular nums. |
| `<StatusBadge>` | Cor + ícone + rótulo em português. Mapeamento único e central. |
| `<BookingCard>` | Mostra estado, data, valor pago vs. total, e a próxima ação |
| `<AvailabilityCalendar>` | Slots livres/ocupados/em hold; fuso `Africa/Luanda` sempre explícito |
| `<PaymentMethodPicker>` | MCX Express primeiro em AO; Stripe só fora de AO |
| `<FileDropzone>` | Upload direto para R2 com progresso, retoma e verificação de checksum |
| `<DeliverableGallery>` | Lazy loading, marca de água em pré-visualização, download auditado |
| `<DataTable>` | Ordenação, filtros, paginação no servidor, exportação CSV |

---

## 5. Acessibilidade (não negociável)

- Contraste ≥ 4,5:1 em texto normal, ≥ 3:1 em texto grande e componentes de interface.
- Todo o fluxo operável só com teclado; foco visível com anel dourado `brand.600`.
- `aria-expanded`, `aria-current`, `aria-live` corretos — o site atual já faz isto no menu
  mobile, o que é um bom sinal e deve manter-se.
- Formulários: `<label>` associado, erro ligado por `aria-describedby`, nunca só cor a indicar erro.
- Alvos de toque ≥ 44×44 px.
- `prefers-reduced-motion` respeitado.
- Testes `axe-core` em CI; violação de nível A ou AA bloqueia o merge.

---

## 6. Responsividade e realidade angolana

```
Breakpoints: sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536
```

**Mobile-first é literal, não uma preferência.** A maioria do tráfego angolano chega por
telemóvel, frequentemente em 3G/4G instável.

- Imagens em AVIF com fallback WebP; `sizes` sempre declarado.
- Fontes: `display: swap`, subset latino, pré-carregamento apenas da fonte da dobra.
- Sem bibliotecas de animação pesadas. Transições CSS bastam.
- Estados de carregamento com skeletons — nunca um ecrã em branco.
- Formulários guardam rascunho localmente para sobreviver a quebras de ligação.
- Botão de WhatsApp fixo no mobile: é o canal preferido do mercado.

---

## 7. Diretrizes de imagem

| Contexto | Rácio | Formato |
|---|---|---|
| Hero | 16:9 (desktop) / 4:5 (mobile) | AVIF, ≤ 200 KB |
| Cartão de serviço | 3:2 | AVIF, ≤ 80 KB |
| Portfólio | Variável, grelha masonry | AVIF, ≤ 150 KB |
| OG image | 1200×630 | Gerada dinamicamente por `opengraph-image.tsx` |
| Avatar | 1:1 | WebP, ≤ 20 KB |

Fotografia da própria empresa é o principal ativo visual — **zero imagens de stock** no site
de um estúdio de fotografia. Todas as fotos com `alt` descritivo real, não "imagem1".

---

## 8. Plano de implementação

| Fase | Ação |
|---|---|
| 1 | Extrair tokens para `styles/tokens.css` + `tailwind.config.ts` |
| 2 | Instalar shadcn/ui e sobrepor tema da marca |
| 3 | Construir componentes de domínio com testes de acessibilidade |
| 4 | Storybook (ou rota `/admin/design-system`) como referência viva |
| 5 | Auditoria de contraste em toda a UI; corrigir todos os usos de `brand.500` em texto |
| 6 | Testes de regressão visual (Playwright screenshots) nas páginas críticas |
