# Relatório Executivo — Fase 0: Foundation

**Projeto:** VersaoStudio Enterprise (VersaoDigital OS)
**Data:** 2026-08-05 · consolidação final 2026-08-05
**Estado:** 🟢 **READY FOR VOL01** — aprovada formalmente e consolidada
**Código de aplicação escrito:** nenhum, conforme instruído

---

## Sumário

A Fase 0 estabeleceu a fundação arquitetural, documental e de governança do VersaoStudio
Enterprise. Foram produzidos 36 documentos (incluindo 9 ADRs) e um schema de dados completo com
59 modelos, validado estruturalmente. Foi feita auditoria real ao site atual, cujos achados
alteraram duas conclusões preliminares.

**Consolidação final (2026-08-05):** política RBAC alinhada com a operação de um estúdio
audiovisual — 8 → 11 papéis, `EDITOR` redefinido como pós-produção, separação financeira
reforçada. Ver [`rbac-policy-final.md`](../security/rbac-policy-final.md) e
[ADR-009](../adr/ADR-009-role-expansion.md).

**Nenhum ficheiro de código Next.js foi criado.** O VOL01 aguarda autorização para o primeiro
commit.

---

## 1. Arquitetura aprovada

**Monólito modular Next.js** — uma base de código, uma base de dados PostgreSQL, três
contextos de interface (público, cliente, admin), dez módulos com fronteiras impostas em CI.

| Decisão | Escolha | Porquê, em uma linha |
|---|---|---|
| Estrutura | Monólito modular | Transações financeiras atómicas sem sagas distribuídas |
| Framework | Next.js 15/16 + React 19 | RSC reduz o JavaScript enviado — decisivo em rede angolana |
| Dados | PostgreSQL + Prisma | Constraint de exclusão impede sobreposição de reservas ao nível da BD |
| Auth | NextAuth v5 | Soberania dos dados + RBAC granular + custo constante |
| Ficheiros | Cloudflare R2 | Egress gratuito; o produto são ficheiros pesados |
| Pagamentos | Stripe + EMIS GPO | Multicaixa Express é indispensável no mercado angolano |

Documento: [`architecture.md`](architecture.md) — com diagramas Mermaid de contexto, camadas,
módulos, sequência de pagamento, máquinas de estado e integrações.

**Três invariantes estruturantes:**

1. `domain/` não compila com dependências de infraestrutura — verificado em CI.
2. Duas reservas confirmadas não podem ocupar o mesmo recurso — garantido por constraint de
   exclusão no PostgreSQL, não por lógica de aplicação.
3. Nenhum estado de pagamento muda por confiança num payload externo — sempre re-consulta.

---

## 2. Riscos identificados

### Bloqueadores

| # | Risco | Impacto | Mitigação | Prazo |
|---|---|---|---|---|
| R1 | **Credenciais EMIS GPO não emitidas** | Bloqueia a Fase 2 inteira (4 semanas) | Iniciar pedido ao banco adquirente **esta semana** | Imediato |
| R2 | Documentação GPO varia por adquirente | Retrabalho na integração | Reunião técnica antes de codificar | Antes da Fase 2 |

### Altos

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R3 | Callback EMIS perdido ou duplicado | Reservas por confirmar, ledger duplicado | Polling obrigatório + idempotência em três níveis ([ADR-006](../adr/ADR-006-stripe-emis-hibrido.md)) |
| R4 | Perda de tráfego orgânico na migração | Perda de leads | 301 testados em E2E, migração faseada, reversão por DNS em minutos |
| R5 | Zero portfólio fotográfico publicado | Conversão baixa em toda a Fase 1 | Produção de conteúdo a começar já, em paralelo |
| R6 | Uma só pessoa a desenvolver e operar | Continuidade do projeto | ADRs, documentação e CI a impor regras |

### Médios

| # | Risco | Mitigação |
|---|---|---|
| R7 | Custo de armazenamento de vídeo a crescer | R2 (egress zero) + retenção contratual + alertas de custo |
| R8 | Decisões de negócio pendentes (preços, prazos, NIF) | Lista com prazos em [business-bible §10](../business-bible/README.md) |
| R9 | Divergência ledger vs. pagamentos | Job diário de verificação + alerta |
| R10 | Clientes continuam a usar só WhatsApp | Notificações WhatsApp com link direto para o portal |

---

## 3. Decisões (ADR)

| ADR | Decisão | Alternativa principal rejeitada | Motivo |
|---|---|---|---|
| [001](../adr/ADR-001-stack.md) | Next.js 15 · React 19 · TS strict · Tailwind · Prisma · Postgres | — | Produtividade de equipa pequena + desempenho em rede fraca |
| [002](../adr/ADR-002-monolito-modular.md) | Monólito modular | Microserviços | Consistência eventual e sagas não são pagas por benefício real nesta escala |
| [003](../adr/ADR-003-prisma-postgresql.md) | Prisma + PostgreSQL | Drizzle; MySQL; MongoDB | Constraint de exclusão + ACID + permissões ao nível da BD |
| [004](../adr/ADR-004-clerk-vs-nextauth.md) | NextAuth v5 | Clerk | Soberania de dados (Lei 22/11), RBAC granular, custo constante |
| [005](../adr/ADR-005-cloudflare-r2.md) | Cloudflare R2 | AWS S3 | Egress gratuito — decisivo num negócio de ficheiros pesados |
| [006](../adr/ADR-006-stripe-emis-hibrido.md) | Stripe + EMIS híbrido | Só Stripe; só EMIS | Mercado local exige Multicaixa; diáspora exige cartão internacional |
| [007](../adr/ADR-007-authentication-provider.md) | Sessão em BD; magic link para clientes, TOTP para staff | JWT; SMS; passkeys | Revogação imediata; SIM swap; suporte irregular em Android de gama média |
| [008](../adr/ADR-008-rbac-strategy.md) | Permissões em código, posse na query | Permissões em BD; RLS já na fase 1 | Mudança de permissão é decisão de segurança — passa por revisão de PR |
| [009](../adr/ADR-009-role-expansion.md) | 11 papéis de estúdio audiovisual | Concessões pontuais sobre `STAFF` | Exigia exceções negativas, proibidas pelo ADR-008 |

---

## 4. Domínio modelado

**59 modelos · 43 enums · 11 bounded contexts.**
Fonte de verdade: [`schema.prisma`](../prisma/schema.prisma) ·
Documentação: [`domain-model.md`](domain-model.md)

| Contexto | Modelos | Agregado raiz |
|---|---|---|
| Identity & Access | 7 | `Organization`, `User` |
| CRM | 6 | `Lead`, `Client`, `Proposal` |
| Catálogo e preços | 6 | `Service`, `PriceList` |
| Booking & Production | 4 | `Booking`, `ProductionJob` |
| Billing & Payments | 10 | `Invoice`, `Payment` |
| Delivery & Files | 5 | `Deliverable` |
| Agency & Marketing | 5 | `MarketingCampaign` |
| SaaS Projects | 6 | `SaaSProject` |
| Content & SEO | 6 | `SEOPage` |
| Notifications | 2 | `NotificationEvent` |
| Audit & Compliance | 4 | `AuditLog` |

**Validação executada:** verificador estrutural sobre o schema — todas as relações
emparelhadas (2 lados), todos os `@relation(fields/references)` a apontar para campos
existentes, todos os `@@index`/`@@unique` válidos, zero campos monetários em `Float`,
zero enums órfãos. `prisma validate` oficial não pôde correr no ambiente (download do engine
bloqueado) e deve ser executado localmente antes da primeira migração.

---

## 5. Estratégia de migração do site

Documentos: [auditoria](../audit/current-site-audit.md) ·
[plano de migração](../audit/site-migration-plan.md)

**Achados da auditoria que alteram o plano:**

| Achado | Correção ao que se assumia antes |
|---|---|
| As 5 páginas **têm** JSON-LD válido (`LocalBusiness` + `Service`) | Eu tinha afirmado que não tinham. **Estava errado.** O ponto de partida de SEO técnico é melhor do que o previsto. |
| O formulário **está ligado** ao Web3Forms e funciona | Eu tinha assumido que os leads se perdiam. Não se perdem — mas a chave pública permite spam de terceiros. |
| **Cinco** `og:image` inexistentes, não uma | Todas as partilhas em redes sociais, de todas as páginas, aparecem sem imagem |
| **Zero elementos `<img>`** em todo o site | Um estúdio de fotografia sem uma única fotografia publicada. Maior problema comercial da auditoria. |
| Contraste do dourado ≈ 3,4:1 | Falha WCAG AA para texto |
| `lang="pt"` em vez de `pt-AO` | Corrigir |
| Tokens de cor divergentes (`--gold` vs. `--g1`) | Unificar no design system |

**Três fases:** correções imediatas (2 dias) → construção paralela em staging com `noindex` →
corte com o site antigo mantido em `legacy.` durante 60 dias.
**Reversão:** mudança de DNS, minutos. **Gatilho:** queda > 25 % em impressões durante 7 dias.

---

## 6. Estratégia SEO

Documento: [`seo-strategy.md`](../business-bible/seo-strategy.md)

- **Preservar:** 5 URLs com 301 diretos, sem cadeias, testados em E2E que bloqueia deploy.
- **Expandir:** de 5 para 20+ páginas indexáveis — 8 serviços, subcategorias de fotografia,
  portfólio, blog.
- **Densidade:** o site atual tem ~2 938 palavras no total. Cada página nova tem mínimo de 800.
- **Estruturar:** manter o `LocalBusiness` existente e acrescentar `BreadcrumbList`, `FAQPage`,
  `Offer`, `ImageObject`.
- **Medir:** baseline no Search Console **antes** do corte — é impossível reconstruir depois.
- **Orçamento:** LCP < 2 s em 4G lento, Lighthouse SEO = 100 a bloquear merge.

---

## 7. Estratégia de pagamentos

Documentos: [ADR-006](../adr/ADR-006-stripe-emis-hibrido.md) ·
[payments-strategy](../operations/payments-strategy.md)

**Princípio central:** o callback é um gatilho, nunca uma fonte de verdade.

1. Ledger append-only como verdade contabilística
2. Re-consulta obrigatória ao provedor antes de qualquer transição
3. Polling de reconciliação a cada 5 min — obrigatório, não opcional
4. Idempotência em três níveis: `Idempotency-Key`, `providerEventId`, máquina de estados
5. Dinheiro em inteiros na menor unidade + moeda; `Float` proibido
6. Confirmação de reserva é consequência de `PaymentCaptured`, nunca causa
7. Zero dados de cartão no sistema — âmbito PCI em SAQ-A

Métodos: Multicaixa Express (dominante) · referência Multicaixa · cartão local · cartão
internacional via Stripe · transferência · numerário.

---

## 8. Estratégia de segurança

Documento: [`security-baseline.md`](../security/security-baseline.md)
Referência: OWASP ASVS nível 2 · OWASP Top 10 · Lei n.º 22/11 (Angola)

| Camada | Controlo principal |
|---|---|
| Autenticação | argon2id · TOTP obrigatório em todo o `/admin` · sessões em BD revogáveis |
| Autorização | RBAC de 8 papéis · verificação de posse **na query**, não no controlador |
| Entrada | Zod em toda a fronteira · sem `any` · sem SQL cru não parametrizado |
| Transporte | CSP com nonce · HSTS preload · `frame-src` limitado ao GPO e Stripe |
| Ficheiros | Bucket privado · magic bytes · URLs assinadas de curta duração · download auditado |
| Pagamentos | Assinatura · allowlist de IP · re-consulta · idempotência · ledger imutável |
| Auditoria | `AuditLog` append-only com `UPDATE`/`DELETE` revogados na BD |
| CI | `npm audit` · `gitleaks` · testes de RBAC e IDOR · ZAP baseline — todos a bloquear |

**Achado de segurança no site atual:** chave pública Web3Forms embutida no HTML permite que
terceiros submetam ao endpoint. Não é fuga de credencial privada, mas é um vetor de spam.
Mitigar com restrição de domínio e captcha.

---

## 9. Estratégia operacional

Documentos: [observabilidade](../operations/observability.md) ·
[variáveis de ambiente](../operations/environment-variables.md) ·
[quality gate](../governance/quality-gate.md) ·
[checklist de produção](../release/production-checklist.md)

- **Quatro sinais:** erros (Sentry), traces, logs estruturados com `correlationId`, métricas
  de negócio. Um sistema com 99,9 % de disponibilidade e zero reservas confirmadas está avariado.
- **Alertas acionáveis:** cada alerta P1/P2 tem runbook. Alertas sem ação são ruído, e ruído
  faz ignorar os verdadeiros.
- **SLOs:** website 99,9 % · API de pagamentos 99,9 % com p95 < 1,5 s · 99 % das reservas
  confirmadas < 5 min após pagamento.
- **Quality gate:** 10 portões em CI, orçamento de 25 min · cobertura 90 % no domínio, 95 % em
  billing, 100 % em aritmética monetária · cobertura não pode descer entre PRs.
- **Go-live:** checklist com 9 secções e 6 assinaturas obrigatórias.

---

## 10. Backlog priorizado

### P0 — Esta semana, fora do desenvolvimento

| # | Ação | Responsável | Porquê agora |
|---|---|---|---|
| 1 | **Pedir credenciais EMIS GPO ao banco adquirente** | Negócio | Prazo externo bloqueia a Fase 2 |
| 2 | Criar as 5 imagens `og:*.jpg` (1200×630) e commitar | Design | Todas as partilhas estão sem imagem |
| 3 | Restringir chave Web3Forms ao domínio + captcha | Técnico | Vetor de spam aberto |
| 4 | Registar baseline no Search Console | Marketing | Impossível reconstruir depois do corte |
| 5 | Decidir: expor preços ou manter "A Negociar" | Negócio | Bloqueia o copy da Fase 1 |
| 6 | Definir prazos de entrega de vídeo, design e edição | Negócio | Sem prazo não há promessa verificável |

### P1 — Fase 1

7. Scaffold Next.js + CI + fronteiras de módulo
8. Prisma + migração inicial + constraint de exclusão + seed
9. Design system com contraste corrigido
10. Copy e páginas dos 8 serviços
11. CMS mínimo com versionamento
12. 301 + testes E2E de SEO
13. Sessão fotográfica própria para portfólio

### P2 — Fase 2

14. Motor de disponibilidade
15. Integração EMIS GPO + reconciliação
16. Integração Stripe
17. Ledger + faturação + idempotência
18. Notificações e-mail e WhatsApp

### P3 — Correções ao site atual (baixo custo, enquanto a plataforma não existe)

19. `lang="pt"` → `pt-AO`
20. Remover os 4 `href="#"`
21. `FAQPage` JSON-LD em `fotografia.html`
22. Publicar política de privacidade e aviso de cookies

---

## 11. Documentos produzidos

```
CLAUDE.md                                    regras permanentes do repositório
docs/README.md                               índice
docs/00-foundation/product-vision.md         missão, personas, modelo de negócio
docs/00-foundation/architecture.md           arquitetura canónica + Mermaid
docs/00-foundation/domain-model.md           DDD, invariantes, ER diagram
docs/00-foundation/phase-0-report.md         este documento
docs/adr/ADR-001-stack.md                    stack tecnológica
docs/adr/ADR-002-monolito-modular.md         monólito modular
docs/adr/ADR-003-prisma-postgresql.md        Prisma + PostgreSQL
docs/adr/ADR-004-clerk-vs-nextauth.md        NextAuth v5
docs/adr/ADR-005-cloudflare-r2.md            Cloudflare R2
docs/adr/ADR-006-stripe-emis-hibrido.md      Stripe + EMIS
docs/architecture/system-architecture.md     detalhe de rotas, API, testes
docs/architecture/folder-structure.md        estrutura e regras de dependência
docs/architecture/design-system.md           identidade visual evolutiva
docs/api/README.md                           contratos de API
docs/audit/current-site-audit.md             auditoria do site atual
docs/audit/site-migration-plan.md            plano de migração
docs/business-bible/README.md                regras de negócio
docs/business-bible/seo-strategy.md          estratégia SEO
docs/business-bible/content-copywriting.md   conteúdo e copywriting
docs/security/security-baseline.md           baseline de segurança
docs/operations/observability.md             observabilidade
docs/operations/payments-strategy.md         pagamentos, detalhe
docs/operations/environment-variables.md     variáveis e segredos
docs/governance/quality-gate.md              portões, DoD, política de PR
docs/roadmap/README.md                       roadmap oficial, 11 fases
docs/release/production-checklist.md         checklist de go-live
docs/prisma/schema.prisma                    58 modelos, 43 enums
.env.example                                 variáveis de ambiente
```

---

## 12. Verificações executadas

| Verificação | Resultado |
|---|---|
| Auditoria do site — análise estática dos 10 ficheiros | ✅ Concluída; 13 problemas de SEO, 5 de segurança/privacidade catalogados |
| Schema Prisma — validador estrutural próprio | ✅ 58 modelos, 43 enums, 0 erros |
| Relações emparelhadas (2 lados) | ✅ Todas |
| `@relation(fields/references)` válidos | ✅ Todos |
| `@@index` / `@@unique` a referir campos existentes | ✅ Todos |
| Campos monetários em `Float` | ✅ Nenhum |
| Ligações internas entre documentos | ✅ 0 quebradas |
| Variáveis de ambiente: docs vs. `.env.example` | ✅ 0 em falta |
| `prisma validate` oficial | ⚠️ Não executado — download do engine bloqueado no ambiente. **Correr localmente antes da primeira migração.** |

---

## 13. Riscos remanescentes

| # | Risco | Estado |
|---|---|---|
| 1 | Credenciais EMIS GPO por pedir | **Aberto — ação P0 nº 1** |
| 2 | Campos exatos do callback GPO por confirmar com o adquirente | Aberto — resolver antes da Fase 2 |
| 3 | `prisma validate` oficial não executado | Aberto — correr no primeiro ambiente local |
| 4 | 6 decisões de negócio pendentes | Aberto — [business-bible §10](../business-bible/README.md) |
| 5 | Sem portfólio fotográfico | Aberto — produção a agendar |
| 6 | Baseline de SEO por registar | **Aberto — janela a fechar; cada dia sem registo perde dados** |

---

## 13-A. Consolidação final da P0 (2026-08-05)

**Aprovação formal recebida.** Executado após a aprovação:

| Ação | Resultado |
|---|---|
| Política RBAC de estúdio audiovisual | 8 → **11 papéis**; 73 permissões inalteradas |
| `EDITOR` redefinido | Conteúdo → pós-produção; conteúdo passa a `CONTENT_MANAGER` |
| Separação financeira | 5 dos 11 papéis com **zero** permissões financeiras; só 2 movem dinheiro |
| ADR-009 | Criado — exigido pela regra do próprio ADR-008 |
| `enum Role` no schema | 8 → 11 valores, com nota de migração |
| `ProjectAssignment` | Modelo novo — sem ele `EDITOR` não tem critério de posse |
| Documentos | `rbac-policy-final.md` (política, diff, resumo executivo) |

**Verificações executadas na consolidação:** 121 ligações internas (0 quebradas) · matriz RBAC
73 = 73 com 12 colunas em todas as linhas · `enum Role` do schema idêntico às colunas da matriz ·
validador estrutural do schema sem erros (59 modelos, 43 enums).

**Por confirmar consigo:** três interpretações do requisito estão listadas em
[`rbac-policy-final.md §9`](../security/rbac-policy-final.md) — `price:manage` no financeiro,
`PHOTOGRAPHER`/`VIDEOGRAPHER` com permissões idênticas, e `STAFF` sem `project:read`.

**Pendente do seu lado:** `npx prisma validate` e `npx prisma generate` localmente. É a única
verificação da P0 que não pôde correr neste ambiente.

---

## 14. Pedido de aprovação

A Fase 0 está concluída. Peço aprovação formal para:

1. **Aprovar os seis ADRs** como decisões vinculativas.
2. **Aprovar a arquitetura** descrita em `architecture.md`.
3. **Aprovar o roadmap** e a ordem de fases proposta — incluindo a inserção de Website & SEO
   como Fase 1 e a recomendação de Portal antes de CRM/ERP.
4. **Autorizar o início da Fase 1**, o que significa a criação dos primeiros ficheiros de
   código Next.js.

**Sem esta aprovação, nenhum ficheiro de código será criado.**

> **Estado em 2026-08-05:** aprovação recebida. P0 marcada como **READY FOR VOL01**.
> O VOL01 tem desenho concluído e aguarda autorização específica para o primeiro commit de
> código, conforme o processo definido.

Peço ainda decisão sobre os seis pontos P0, em particular o pedido de credenciais EMIS ao
banco — é a única dependência externa com prazo fora do nosso controlo.

---

| Aprovação | Nome | Data | Assinatura |
|---|---|---|---|
| Responsável do projeto | | | |
