# CLAUDE.md — VersaoStudio Enterprise

Instruções permanentes para qualquer agente ou programador que trabalhe neste repositório.
Este ficheiro é lido antes de qualquer tarefa. **As regras aqui são vinculativas.**

---

## O que é este projeto

SaaS enterprise de gestão para estúdio audiovisual + agência digital full-service da
**Versão Digital LDA** (Luanda, Angola). Substitui gradualmente o site estático em
`versaodigitallda.com` e adiciona reservas, pagamentos, CRM, ERP, portal de cliente,
CMS/SEO, gestão de campanhas e gestão de projetos de desenvolvimento.

**Estado atual: 🟢 READY TO START VOL01.** Fundação aprovada e consolidada. VOL01 com desenho
concluído e política RBAC final aplicada (11 papéis). Não existe código de aplicação; o
primeiro ficheiro aguarda autorização.

---

## Documentação obrigatória antes de programar

| Antes de tocar em… | Ler primeiro |
|---|---|
| Qualquer coisa | `docs/00-foundation/architecture.md` |
| Modelo de dados | `docs/00-foundation/domain-model.md` + `docs/prisma/schema.prisma` |
| Pagamentos | `docs/adr/ADR-006-stripe-emis-hibrido.md` + `docs/operations/payments-strategy.md` |
| Autenticação / permissões | `docs/01-auth/README.md` + `docs/security/authentication.md` + `docs/security/rbac.md` |
| Estrutura de ficheiros | `docs/architecture/folder-structure.md` |
| UI | `docs/architecture/design-system.md` |
| Conteúdo do site | `docs/business-bible/content-copywriting.md` |
| Abrir um PR | `docs/governance/quality-gate.md` |

---

## Regras invioláveis

### Dinheiro
1. Valores monetários **sempre** `Int` na menor unidade (`amountMinor`) + `currency` ISO-4217.
   `Float`/`Decimal` para dinheiro é motivo de rejeição imediata de PR.
2. Montantes **sempre** recalculados no servidor a partir da `PriceList`. Nunca aceitar valor
   vindo do cliente.
3. Nenhum estado de pagamento muda por confiança num payload externo — sempre re-consultar
   o provedor.
4. `LedgerEntry` e `AuditLog` são **append-only**. Sem `UPDATE`, sem `DELETE`.
5. Toda a rota que mexe em dinheiro ou reservas exige `Idempotency-Key`.

### Arquitetura
6. `domain/` não importa Prisma, Next, React nem SDKs externos. Se não compila sem base de
   dados e sem rede, a fronteira foi violada.
7. Módulos comunicam apenas através de `index.ts` ou de eventos de domínio. Nunca acedem às
   tabelas uns dos outros.
8. Toda a query de dados de cliente inclui filtro de posse (`organizationId` / `clientId`)
   no `where`. Sem exceções.

### Autenticação e permissões
9. `docs/security/rbac.md` é a **fonte única** da matriz de permissões. `permissions.ts`
   espelha-a e um teste automático compara os dois.
10. `requirePermission(actor, permission)` é a única função que autoriza — lança, não devolve
    booleano. `if (role === 'ADMIN')` espalhado pelo código é motivo de rejeição de PR.
11. O middleware corre no Edge e **não autoriza** — só redireciona quem não tem cookie.
    A proteção real está nos layouts e nos use cases. O cookie transporta apenas um
    identificador opaco de sessão: zero papéis, zero permissões.
12. Papel nunca vem do cliente nem do cookie: é resolvido no servidor a cada pedido.

### Segurança
13. Nenhum segredo em `NEXT_PUBLIC_*`. Nenhum segredo commitado, nunca.
14. Validação Zod em toda a fronteira de entrada e saída.
15. `any` proibido. `tsc --noEmit` tem de passar em modo strict.
16. Escrita em dados financeiros, de cliente ou de ficheiros gera sempre `AuditLog`.

### Processo
17. Nenhuma funcionalidade entra em `main` sem: segurança revista, auditoria, testes,
    monitorização, plano de rollback e documentação.
18. Decisão arquitetural relevante = novo ADR. Mudar um ADR aprovado exige outro ADR que o
    substitua explicitamente.
19. Correção de bug acompanha teste que falha antes da correção.

---

## Ordem de trabalho obrigatória

Antes de escrever código, por esta ordem:

1. Analisar requisitos
2. Identificar riscos
3. Propor arquitetura
4. Definir domínio
5. Definir modelos de dados
6. Definir contratos de API
7. Definir testes
8. Definir observabilidade
9. Definir critérios de aceite
10. **Só então implementar**

---

## Mudança de fase

Nenhuma fase começa sem que a anterior entregue:

- relatório de conclusão
- testes executados, com resultados
- documentos criados ou atualizados
- ADRs novos
- riscos remanescentes
- **pedido explícito de aprovação ao responsável do projeto**

---

## Stack

Next.js 15/16 (App Router) · React 19 · TypeScript strict · Tailwind · shadcn/ui · Prisma ·
PostgreSQL · NextAuth v5 · Stripe · EMIS GPO · Cloudflare R2 · Zod · Resend · Sentry ·
Vitest · Playwright · Vercel

---

## Contexto de negócio

- **Mercado:** Angola. Português de Angola em toda a UI e conteúdo.
- **Moeda base:** AOA. IVA 14 %. Fuso `Africa/Luanda`.
- **Pagamento dominante:** Multicaixa Express via EMIS GPO. Stripe só para clientes fora de AO.
- **Canal dominante:** WhatsApp (+244 939 183 513).
- **Rede:** assumir 3G instável. Mobile-first é literal, não uma preferência estética.
- **Identidade:** dourado `#B8862A`, creme, castanho escuro; Playfair Display + Inter.

---

## Convenções

| Item | Convenção |
|---|---|
| Componentes React | `PascalCase.tsx` |
| Use cases | `kebab-case.ts`, verbo primeiro (`confirm-booking.ts`) |
| Rotas | kebab-case, em português, sem `.html` |
| Modelos Prisma | `PascalCase` singular |
| Enums | `SCREAMING_SNAKE_CASE` |
| Commits | Conventional Commits (`feat(billing): reconciliação EMIS`) |
| Branches | `tipo/escopo-descricao` |
| Documentação e UI | Português de Angola |
| Código e identificadores | Inglês |

---

## O que nunca fazer

- Criar ficheiros de código de um volume antes da aprovação formal desse volume
- Confirmar uma reserva sem pagamento verificado (ou override auditado com justificação)
- Guardar dados de cartão em qualquer lado
- Publicar afirmação de resultado de cliente sem número verificável e autorização escrita
- Alterar o slug de uma página publicada sem gerar o 301
- Contornar o CI para "desbloquear" um merge
