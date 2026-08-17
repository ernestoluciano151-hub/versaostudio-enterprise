# Roadmap oficial — VersaoStudio Enterprise

**Regra:** nenhuma fase começa sem o relatório de conclusão da anterior aprovado formalmente.
Estimativas para 1 programador a tempo inteiro.

**Relatório de fim de fase obrigatório** (ver [quality-gate §8](../governance/quality-gate.md)):
o que foi entregue · testes executados com resultados · documentos criados/atualizados ·
ADRs novos · riscos remanescentes · pedido explícito de aprovação.

---

## Sequência

| # | Fase | Semanas | Acum. | Entrega visível para o negócio |
|---|---|---|---|---|
| 0 | **Foundation** | 2 | 2 | Fundação documental e técnica; decisões tomadas |
| 1 | **Website & SEO** | 3 | 5 | Site novo, 8 serviços, sem perda de tráfego |
| 2 | **Booking** | 4 | 9 | **Cliente reserva e paga sozinho — primeira receita** |
| 3 | **Portal** | 2 | 11 | Cliente acompanha, descarrega e paga o remanescente |
| 4 | **CRM** | 2 | 13 | Leads e propostas fora do WhatsApp |
| 5 | **ERP** | 3 | 16 | Financeiro, faturação e reconciliação centralizados |
| 6 | **Documentos** | 2 | 18 | Contratos, cedências de imagem, gestão documental |
| 7 | **Analytics** | 2 | 20 | Decisões com dados: ocupação, margem, funil |
| 8 | **Marketing** | 2 | 22 | Campanhas com origem e custo por lead |
| 9 | **SaaS Projects** | 2 | 24 | Projetos de desenvolvimento na plataforma |
| 10 | **Multi-tenant** | A decidir | — | Licenciar a outros estúdios |

> **Nota sobre a ordem.** A lista original colocava CRM e ERP antes do Portal. Recomendo
> **Portal antes de CRM/ERP** — como está acima — porque o Portal fecha o ciclo que gera
> receita (reservar → pagar → receber o trabalho), enquanto CRM e ERP melhoram eficiência
> interna que, temporariamente, continua a funcionar em WhatsApp e folhas de cálculo.
> A decisão é sua; se preferir a ordem original, as fases 3, 4 e 5 trocam sem impacto técnico.
>
> **Website & SEO** foi inserido como fase 1 por não constar da lista original: sem ele, o site
> estático permanece em produção e a plataforma nova não capta ninguém.

---

## Fase 0 — Foundation (2 semanas) · **em curso**

**Objetivo:** decidir antes de construir. Nenhum código de aplicação.

Entregáveis: auditoria do site atual · estrutura documental · visão de produto · arquitetura
com diagramas · modelo de domínio · 6 ADRs · security baseline · observabilidade · quality
gate · roadmap · relatório executivo.

**Aceite:** todos os documentos criados · schema Prisma validado · ADRs aprovados pelo
responsável · riscos identificados e priorizados.
**Estado:** ver [relatório da Fase 0](../00-foundation/phase-0-report.md).

---

## Fase 1 — Website & SEO (3 semanas)

- Scaffold Next.js 15 + TypeScript strict + Tailwind + shadcn/ui
- Estrutura de módulos com `eslint-plugin-boundaries` a bloquear violações
- Prisma + PostgreSQL + primeira migração + seed
- Design system (tokens, componentes base)
- Homepage + 8 páginas de serviço com copy novo
  ([copywriting](../business-bible/content-copywriting.md))
- CMS mínimo: `SEOPage` + `ContentBlock` + `PageVersion`
- Metadados dinâmicos, JSON-LD, sitemap, robots, OG images geradas
- 301 dos 5 URLs antigos + testes E2E
- Formulário → `Lead` com UTM
- Sentry, logger estruturado, CI completo

**Aceite:** Lighthouse ≥ 90/100/95 · todos os 301 verdes em E2E · leads a chegar à BD ·
Rich Results Test sem erros · violação de fronteira parte o build.
**➡️ Marco: corte do site.**

---

## Fase 2 — Booking (4 semanas) · **fase mais crítica**

- Catálogo: `Service`, `PriceList`, `Resource`, `AvailabilityRule`
- Motor de disponibilidade + constraint de exclusão em PostgreSQL
- Fluxo de reserva público com hold de 30 min
- **EMIS GPO** (iframe + callback + reconciliação por cron)
- **Stripe** (webhook assinado)
- Ledger, faturas, idempotência
- Confirmação automática via evento `PaymentCaptured`
- Notificações por e-mail e WhatsApp
- Expiração automática de holds

**Aceite:** todos os testes de [ADR-006](../adr/ADR-006-stripe-emis-hibrido.md) verdes ·
pagamento real de ponta a ponta em ambos os provedores · callback duplicado não duplica ledger ·
callback perdido resolvido por polling em < 5 min · reembolso testado.
**➡️ Marco: primeira receita pela plataforma.**

---

## Fase 3 — Portal (2 semanas)

- Autenticação de cliente (magic link) + `ClientUser`
- Dashboard, reservas, pagamentos, faturas em PDF
- Entregas: galeria, aprovação, pedido de revisão, download auditado
- Pagamento do remanescente a partir do portal

**Aceite:** teste de IDOR falha em todas as tentativas · downloads registados em
`FileAccessLog` · cliente paga sem contactar ninguém.

---

## Fase 4 — CRM (2 semanas)

- Leads, pipeline, atividades
- Propostas com PDF e validade
- Conversão lead → cliente → reserva
- Histórico completo por cliente

**Aceite:** nenhum lead perdido entre o formulário e o pipeline · proposta aceite congela preços.

---

## Fase 5 — ERP (3 semanas)

- Faturação com séries e numeração sem saltos
- Reconciliação EMIS e Stripe com painel dedicado
- Reembolsos com aprovação
- Exportação para contabilidade
- Ledger consultável e auditável
- Avenças e cobrança recorrente

**Aceite:** um mês fechado sem folhas de cálculo · `soma(ledger) == estado(payments)` no job
diário · contabilista valida as faturas.

---

## Fase 6 — Documentos (2 semanas)

- Contratos e termos de cedência de direitos de imagem
- Assinatura e arquivo (`Document`)
- Geração a partir de modelos com dados da reserva
- Retenção e purga automáticas
- Fluxo de `DataRequest` (acesso, apagamento)

**Aceite:** nenhuma publicação em portfólio sem cedência assinada registada · pedido de
apagamento executado de ponta a ponta.

---

## Fase 7 — Analytics (2 semanas)

- Dashboard executivo: receita, reservas, pipeline, faturas vencidas
- Operacional: ocupação por recurso, entregas em atraso, tempo até confirmação
- Financeiro: margem por linha de serviço, taxa de sucesso por método de pagamento
- Exportações

**Aceite:** decisões de preço e de agenda tomadas a partir do painel, não de memória.

---

## Fase 8 — Marketing (2 semanas)

- Campanhas com objetivo e orçamento
- Plano de conteúdo e calendário editorial
- Posts com aprovação e versionamento
- Atribuição de leads a campanhas e origens
- Custo por lead e retorno por campanha

**Aceite:** cada lead com origem rastreável · custo por lead calculado por campanha.

---

## Fase 9 — SaaS Projects (2 semanas)

- `SaaSProject` com etapas e milestones
- `ClientWebsite`, `DomainManagement`, `Deployment`
- Faturação por milestone
- Alertas de expiração de domínio e certificado
- Visibilidade do projeto no portal do cliente

**Aceite:** um projeto real gerido de ponta a ponta na plataforma.

---

## Fase 10 — Multi-tenant (a decidir)

O schema já é multi-tenant (`organizationId` em todas as tabelas de negócio). Falta:

- Row-Level Security no PostgreSQL
- Onboarding de organização e faturação por subscrição
- Isolamento de armazenamento e limites por plano
- Marca branca por tenant

**Pré-condição comercial:** pelo menos dois estúdios externos com intenção declarada de pagar.
Sem isso, é engenharia especulativa.

---

## Endurecimento e go-live

Antes de qualquer fase entrar em produção com dinheiro real, aplica-se a
[checklist de produção](../release/production-checklist.md) na íntegra, com as seis assinaturas.

---

## Riscos de calendário

| Risco | Impacto | Mitigação |
|---|---|---|
| Credenciais EMIS GPO demoram a ser emitidas pelo banco | **Bloqueia a Fase 2 inteira** | **Iniciar o pedido ao adquirente na Fase 0** |
| Documentação GPO divergente do esperado | Alto | Reunião técnica com o adquirente antes de codificar |
| Produção de conteúdo e fotografia atrasa a Fase 1 | Médio | Escrever copy e fotografar em paralelo com a Fase 0 |
| Decisões de negócio pendentes (preços, prazos, NIF) | Médio | Ver [business-bible §10](../business-bible/README.md) |
| Uma só pessoa a desenvolver e a operar | Alto | ADRs e documentação reduzem o custo de entrada de reforços |
