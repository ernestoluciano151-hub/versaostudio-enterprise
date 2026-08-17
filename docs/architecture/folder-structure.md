# 03 — Estrutura de pastas e regras de dependência

```
versaostudio-enterprise/
├── .github/workflows/          ci.yml · e2e.yml · lighthouse.yml · security.yml
├── prisma/
│   ├── schema.prisma           SSoT do modelo de dados
│   ├── migrations/
│   └── seed.ts
├── public/
├── docs/                       este pacote (ADRs, estratégias, runbooks)
├── e2e/                        testes Playwright
├── src/
│   ├── app/
│   │   ├── (public)/           website SEO — SSG/ISR
│   │   │   ├── page.tsx
│   │   │   ├── servicos/[slug]/page.tsx
│   │   │   ├── portfolio/[slug]/page.tsx
│   │   │   ├── blog/[slug]/page.tsx
│   │   │   ├── pacotes/  contacto/  agendar/  sobre/
│   │   │   ├── sitemap.ts  robots.ts  opengraph-image.tsx
│   │   │   └── layout.tsx
│   │   ├── (client)/cliente/   portal autenticado — noindex
│   │   ├── (admin)/admin/      back-office — RBAC + MFA
│   │   ├── api/                route handlers
│   │   │   ├── bookings/  payments/  files/  crm/  marketing/
│   │   │   ├── notifications/  cron/  health/
│   │   └── layout.tsx
│   │
│   ├── modules/                ◀── fronteiras impostas em CI
│   │   ├── identity/
│   │   │   ├── domain/         entidades, value objects, invariantes, ports
│   │   │   ├── application/    use cases
│   │   │   ├── infra/          repositórios Prisma, adapters
│   │   │   ├── ui/             componentes específicos do módulo
│   │   │   └── index.ts        ◀── ÚNICA API pública do módulo
│   │   ├── crm/  booking/  billing/  delivery/
│   │   ├── marketing/  projects/  content/
│   │   ├── notifications/  audit/
│   │   └── shared/             tipos e utilitários sem regra de negócio
│   │
│   ├── components/
│   │   ├── ui/                 shadcn/ui
│   │   ├── marketing/          hero, pricing, testimonials, CTA
│   │   └── layout/
│   │
│   ├── lib/
│   │   ├── auth/               NextAuth config, RBAC, guards
│   │   ├── db/                 Prisma client, transações, queries SQL isoladas
│   │   ├── validation/         schemas Zod partilhados
│   │   ├── money/              aritmética monetária (inteiros), formatação AOA
│   │   ├── seo/                metadata helpers, JSON-LD builders
│   │   ├── observability/      logger, Sentry, métricas
│   │   ├── idempotency/
│   │   └── errors/             erros de domínio, RFC 9457
│   │
│   ├── styles/                 tokens do design system
│   └── types/
├── .env.example
├── eslint.config.mjs           inclui eslint-plugin-boundaries
├── next.config.ts              headers de segurança, redirects 301
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── tsconfig.json               strict + noUncheckedIndexedAccess
```

---

## Anatomia de um módulo

Exemplo `modules/booking/`:

```
booking/
├── domain/
│   ├── entities/Booking.ts            invariantes e transições — sem I/O
│   ├── value-objects/TimeSlot.ts
│   ├── events/BookingConfirmed.ts
│   ├── ports/BookingRepository.ts     interface, não implementação
│   └── services/AvailabilityService.ts
├── application/
│   ├── create-booking.ts              use case
│   ├── confirm-booking.ts
│   ├── expire-holds.ts
│   └── __tests__/
├── infra/
│   ├── prisma-booking-repository.ts   implementa o port
│   └── calendar-adapter.ts
├── ui/
│   ├── BookingForm.tsx
│   └── AvailabilityCalendar.tsx
└── index.ts                            exporta apenas o necessário
```

**Teste de sanidade do domínio:** se `domain/` não compila sem base de dados, sem rede e sem
React, a fronteira foi violada.

---

## Regras de dependência (verificadas por lint)

| De | Pode importar | Nunca importa |
|---|---|---|
| `app/` | `modules/*` (só `index.ts`), `components/`, `lib/` | `modules/*/infra/*`, `modules/*/domain/*` diretamente |
| `modules/X/domain` | `modules/shared`, tipos próprios | Prisma, Next, React, SDKs, outros módulos |
| `modules/X/application` | `modules/X/domain`, ports | `infra` concreto, React |
| `modules/X/infra` | tudo do próprio módulo, `lib/db` | domínio de outro módulo |
| `modules/X/ui` | `components/ui`, `modules/X/domain` (tipos) | `infra` de qualquer módulo |
| `modules/X` | `modules/Y` **apenas via** `modules/Y/index.ts` | ficheiros internos de Y |

### Configuração ESLint (excerto)

```js
// eslint.config.mjs
{
  plugins: { boundaries },
  settings: {
    'boundaries/elements': [
      { type: 'app',         pattern: 'src/app/**' },
      { type: 'domain',      pattern: 'src/modules/*/domain/**' },
      { type: 'application', pattern: 'src/modules/*/application/**' },
      { type: 'infra',       pattern: 'src/modules/*/infra/**' },
      { type: 'ui',          pattern: 'src/modules/*/ui/**' },
      { type: 'lib',         pattern: 'src/lib/**' },
    ],
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        { from: 'domain',      allow: ['domain'] },
        { from: 'application', allow: ['domain', 'application'] },
        { from: 'infra',       allow: ['domain', 'application', 'lib'] },
        { from: 'ui',          allow: ['domain', 'lib'] },
        { from: 'app',         allow: ['application', 'ui', 'lib'] },
      ],
    }],
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['**/modules/*/domain/**', '**/modules/*/infra/**'],
          message: 'Importa através do index.ts do módulo.' },
        { group: ['@prisma/client'],
          message: 'Apenas em infra/ e lib/db/.' },
      ],
    }],
  },
}
```

---

## Convenções

| Item | Convenção | Exemplo |
|---|---|---|
| Componentes React | `PascalCase.tsx` | `BookingForm.tsx` |
| Use cases | `kebab-case.ts`, verbo primeiro | `confirm-booking.ts` |
| Entidades | `PascalCase.ts` | `Booking.ts` |
| Rotas | kebab-case, português, sem `.html` | `/servicos/edicao-video` |
| Tabelas Prisma | `PascalCase` singular | `model Booking` |
| Enums | `SCREAMING_SNAKE_CASE` | `PENDING`, `CAPTURED` |
| Env vars | `SCREAMING_SNAKE_CASE`, prefixo por serviço | `EMIS_GPO_FRAME_TOKEN` |
| Branches | `tipo/escopo-descricao` | `feat/booking-emis-checkout` |
| Commits | Conventional Commits | `feat(billing): reconciliação EMIS` |

---

## Portões de qualidade em CI

```
1. typecheck        tsc --noEmit                        bloqueia
2. lint             eslint (inclui boundaries)          bloqueia
3. test:unit        vitest, cobertura domínio ≥ 90 %    bloqueia
4. test:integration vitest + postgres service           bloqueia
5. build            next build                          bloqueia
6. test:e2e         playwright (crítico: pagamentos)    bloqueia
7. lighthouse       perf ≥ 90, SEO = 100, a11y ≥ 95     bloqueia em (public)
8. security         npm audit + ZAP baseline            bloqueia em severidade alta
9. migrations       verificação de retrocompatibilidade  bloqueia
```
