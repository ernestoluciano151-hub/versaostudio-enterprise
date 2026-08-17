# Documentação — VersaoStudio Enterprise

**Estado do projeto:** 🟢 **READY TO START VOL01** — fundação consolidada e aprovada.
VOL01 (Autenticação, RBAC e Estrutura Base) com desenho concluído e política RBAC final
aplicada. Nenhum código de aplicação existe ainda.

Regras permanentes do repositório: [`../CLAUDE.md`](../CLAUDE.md)

---

## Por onde começar

| Se és… | Lê por esta ordem |
|---|---|
| Novo no projeto | `00-foundation/product-vision.md` → `00-foundation/architecture.md` → `CLAUDE.md` |
| Programador | `CLAUDE.md` → `00-foundation/architecture.md` → `architecture/folder-structure.md` → `governance/quality-gate.md` |
| A trabalhar em autenticação | `01-auth/README.md` → `security/authentication.md` → `security/rbac.md` → `adr/ADR-007` e `ADR-008` |
| A trabalhar em pagamentos | `adr/ADR-006` → `operations/payments-strategy.md` → `security/security-baseline.md` |
| A trabalhar no site público | `audit/current-site-audit.md` → `business-bible/seo-strategy.md` → `business-bible/content-copywriting.md` |
| Gestão / negócio | `00-foundation/phase-0-report.md` → `business-bible/README.md` → `roadmap/README.md` |

---

## Índice

### `00-foundation/` — fundação

| Documento | Conteúdo |
|---|---|
| [`product-vision.md`](00-foundation/product-vision.md) | Missão, visão, personas, proposta de valor, modelo de negócio |
| [`architecture.md`](00-foundation/architecture.md) | **Arquitetura canónica** com diagramas Mermaid |
| [`domain-model.md`](00-foundation/domain-model.md) | Bounded contexts, agregados, invariantes, eventos, ER |
| [`phase-0-report.md`](00-foundation/phase-0-report.md) | **Relatório executivo da Fase 0** |

### `01-auth/` — VOL01: Autenticação, RBAC e Estrutura Base

| Documento | Conteúdo |
|---|---|
| [`README.md`](01-auth/README.md) | **Desenho do VOL01**: análise multi-agente, arquitetura, fluxos, riscos, plano de testes |

### `adr/` — decisões arquiteturais

| ADR | Decisão | Estado |
|---|---|---|
| [001](adr/ADR-001-stack.md) | Stack tecnológica | Aceite |
| [002](adr/ADR-002-monolito-modular.md) | Monólito modular | Aceite |
| [003](adr/ADR-003-prisma-postgresql.md) | Prisma + PostgreSQL | Aceite |
| [004](adr/ADR-004-clerk-vs-nextauth.md) | NextAuth v5 (vs. Clerk) | Aceite |
| [005](adr/ADR-005-cloudflare-r2.md) | Cloudflare R2 | Aceite |
| [006](adr/ADR-006-stripe-emis-hibrido.md) | Stripe + EMIS GPO híbrido | Aceite |
| [007](adr/ADR-007-authentication-provider.md) | Sessão em BD, fatores por população | Aceite |
| [008](adr/ADR-008-rbac-strategy.md) | RBAC: permissões em código, posse na query | Aceite |
| [009](adr/ADR-009-role-expansion.md) | 11 papéis para operação de estúdio audiovisual | Aceite |

### `architecture/` — detalhe técnico

| Documento | Conteúdo |
|---|---|
| [`system-architecture.md`](architecture/system-architecture.md) | Rotas completas, contratos, testes, riscos |
| [`folder-structure.md`](architecture/folder-structure.md) | Estrutura de pastas e regras de dependência |
| [`design-system.md`](architecture/design-system.md) | Identidade visual evolutiva, tokens, acessibilidade |

### `api/`

| Documento | Conteúdo |
|---|---|
| [`README.md`](api/README.md) | Contratos de API, convenções, formatos de erro |

### `audit/` — site atual

| Documento | Conteúdo |
|---|---|
| [`current-site-audit.md`](audit/current-site-audit.md) | Auditoria completa: páginas, assets, SEO, segurança |
| [`site-migration-plan.md`](audit/site-migration-plan.md) | Plano de migração faseado e reversível |

### `business-bible/` — regras de negócio

| Documento | Conteúdo |
|---|---|
| [`README.md`](business-bible/README.md) | Serviços, preços, políticas, glossário, decisões pendentes |
| [`seo-strategy.md`](business-bible/seo-strategy.md) | Migração SEO, dados estruturados, Core Web Vitals |
| [`content-copywriting.md`](business-bible/content-copywriting.md) | Posicionamento, tom de voz, keywords, copy |

### `security/`

| Documento | Conteúdo |
|---|---|
| [`security-baseline.md`](security/security-baseline.md) | Modelo de ameaça, RBAC, auth, CSP, uploads, auditoria |
| [`authentication.md`](security/authentication.md) | Hashing, TOTP, sessões, cookies, recuperação, rate limit |
| [`rbac.md`](security/rbac.md) | **SSoT da matriz de permissões** — 11 papéis × 73 permissões |
| [`rbac-policy-final.md`](security/rbac-policy-final.md) | Política operacional, diff da matriz, resumo executivo por papel |
| [`rbac-final-approval.md`](security/rbac-final-approval.md) | **Resposta aos 8 pontos de confirmação** antes do VOL01 |

### `migrations/`

| Documento | Conteúdo |
|---|---|
| [`vol01-precheck.md`](migrations/vol01-precheck.md) | Pré-verificação, SQL da migração inicial, script seguro, pós-verificação |

### `operations/`

| Documento | Conteúdo |
|---|---|
| [`observability.md`](operations/observability.md) | Sentry, logs, métricas, alertas, SLOs, runbooks |
| [`payments-strategy.md`](operations/payments-strategy.md) | Stripe + EMIS: implementação e runbook |
| [`environment-variables.md`](operations/environment-variables.md) | Variáveis, validação, rotação de segredos |

### `governance/`

| Documento | Conteúdo |
|---|---|
| [`quality-gate.md`](governance/quality-gate.md) | Portões de CI, cobertura, Definition of Done, política de PR |

### `roadmap/`

| Documento | Conteúdo |
|---|---|
| [`README.md`](roadmap/README.md) | 11 fases com critérios de aceite e riscos de calendário |

### `release/`

| Documento | Conteúdo |
|---|---|
| [`production-checklist.md`](release/production-checklist.md) | Checklist de go-live com 6 assinaturas |

### `prisma/`

| Ficheiro | Conteúdo |
|---|---|
| [`schema.prisma`](prisma/schema.prisma) | **SSoT do modelo de dados** — 61 modelos, 45 enums |

---

## Convenções da documentação

- Português de Angola.
- Um documento, um assunto. Sem duplicação — liga-se ao original.
- Decisão arquitetural = ADR. ADR aceite é vinculativo; mudar exige novo ADR que o substitua.
- Números vêm de verificação, não de estimativa. Quando são estimativa, diz-se.
- Correções a afirmações anteriores ficam visíveis, não são apagadas em silêncio.
