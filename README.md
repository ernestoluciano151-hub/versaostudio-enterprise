# VersaoStudio Enterprise — VersaoDigital OS

SaaS enterprise de gestão para estúdio audiovisual + agência digital full-service da
**Versão Digital LDA** (Luanda, Angola).

> ## 🟢 READY TO START VOL01
>
> Fundação aprovada e consolidada. Política RBAC final aplicada (11 papéis, 73 permissões).
> **Nenhum código de aplicação foi criado** — o VOL01 aguarda autorização para o primeiro commit.
>
> ⚠️ **Um ponto aguarda decisão sua:** permissões no token vs. resolvidas no servidor —
> ver [confirmação final, ponto 5](docs/security/rbac-final-approval.md).
>
> ➡️ **[Relatório executivo da Fase 0](docs/00-foundation/phase-0-report.md)** ·
> **[Desenho do VOL01](docs/01-auth/README.md)** ·
> **[Confirmação final](docs/security/rbac-final-approval.md)** ·
> **[Pré-verificação de migração](docs/migrations/vol01-precheck.md)**

---

## Navegação

| | |
|---|---|
| 📋 **Regras do repositório** | [`CLAUDE.md`](CLAUDE.md) |
| 📚 **Índice da documentação** | [`docs/README.md`](docs/README.md) |
| 🏛️ **Arquitetura** | [`docs/00-foundation/architecture.md`](docs/00-foundation/architecture.md) |
| 🗺️ **Roadmap** | [`docs/roadmap/README.md`](docs/roadmap/README.md) |
| 🔍 **Auditoria do site atual** | [`docs/audit/current-site-audit.md`](docs/audit/current-site-audit.md) |
| 🗄️ **Modelo de dados** | [`docs/prisma/schema.prisma`](docs/prisma/schema.prisma) |

---

## O que é

Uma plataforma única que serve três públicos a partir de uma base de código e uma base de dados:

1. **Website público** — captação, SEO e conversão. Substitui o site estático atual.
2. **Portal do cliente** — reservas, pagamentos Multicaixa, entregas, faturas, documentos.
3. **Back-office** — CRM, ERP financeiro, agenda de produção, campanhas, projetos, analytics.

---

## Stack

Next.js 15/16 (App Router) · React 19 · TypeScript strict · Tailwind · shadcn/ui · Prisma ·
PostgreSQL · NextAuth v5 · Stripe · EMIS GPO · Cloudflare R2 · Zod · Resend · Sentry ·
Vitest · Playwright · Vercel

Justificação: [ADR-001](docs/adr/ADR-001-stack.md) a [ADR-006](docs/adr/ADR-006-stripe-emis-hibrido.md).

---

## Contexto de partida

**Site atual:** https://versaodigitallda.com — HTML/CSS/JS vanilla, GitHub Pages + Cloudflare.
5 páginas, ~2 938 palavras, sem backend, sem base de dados, sem build.
Repositório: `ernestoluciano151-hub/versaodigitallda.com`.

**Identidade herdada:** dourado `#B8862A`, creme `#FDF6E8`, escuro `#1A1208`,
Playfair Display + Raleway.

---

## Princípios não negociáveis

Clean Architecture · DDD · Single Source of Truth · SOLID · DRY · KISS ·
Security by Design · Privacy by Design · Observability by Design · Testability by Design ·
Fail-safe defaults.

**Nenhuma funcionalidade entra em `main` sem:** segurança revista, trilho de auditoria,
testes, monitorização, plano de rollback e documentação.

---

## Números do modelo de dados

| | |
|---|---|
| Modelos Prisma | 61 |
| Enums | 45 |
| Bounded contexts | 11 |
| ADRs aprovados | 9 |
| Papéis RBAC | 11 |
| Permissões | 73 |
| Documentos (.md) | 38 |

---

*Versão Digital LDA · Rua N2, Casa N55, Bairro Cassenda, Luanda, Angola · +244 939 183 513*
