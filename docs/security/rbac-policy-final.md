# Política RBAC final — estúdio audiovisual

**Data:** 2026-08-05 · **Estado:** aprovada, consolidação da P0
**Decisão:** [ADR-009](../adr/ADR-009-role-expansion.md)
**Matriz completa (SSoT):** [`rbac.md §4`](rbac.md)

> Este documento é o **registo da alteração** — política, diff e resumo executivo.
> Não repete a matriz: a matriz vive em `rbac.md` e só lá. Duas cópias de uma matriz de
> permissões divergem em semanas.

---

## 1. O que mudou e porquê

O modelo anterior tinha 8 papéis desenhados para uma agência genérica. A operação real é um
**estúdio audiovisual**: quem fotografa, quem filma e quem edita não deve ver a carteira de
clientes inteira, nem a agenda de terceiros, nem um único número financeiro.

Três alterações estruturais:

1. **Três papéis de âmbito atribuído** — `PHOTOGRAPHER`, `VIDEOGRAPHER`, `EDITOR` veem apenas
   o trabalho que lhes foi atribuído.
2. **`EDITOR` mudou de significado.** Era o editor de conteúdo do site; passa a ser o editor de
   pós-produção. O papel de conteúdo passou a `CONTENT_MANAGER`.
3. **Separação financeira reforçada.** `FINANCE_MANAGER` tem o financeiro completo mas perde
   configurações; os papéis operacionais ficam com **zero** permissões financeiras.

---

## 2. Política por papel (o requisito, traduzido)

| Requisito operacional | Tradução em permissões |
|---|---|
| **STAFF**: operacional sem acesso financeiro | 8 permissões, 7 delas 🔒 (atribuídas). **0 financeiras.** Perdeu `project:read`; ganhou `client:read` 🔒 (precisa de saber para quem trabalha na sessão que lhe foi atribuída). |
| **PHOTOGRAPHER**: apenas sessões atribuídas | 10 permissões, 9 🔒 via `ProductionJob.assigneeId`. Única permissão plena: `resource:read`. Gere a própria disponibilidade. **0 financeiras.** |
| **VIDEOGRAPHER**: apenas sessões atribuídas | Idêntico ao fotógrafo. Papel distinto para atribuição e relatórios de ocupação, não por diferença de permissões. |
| **EDITOR**: apenas projetos atribuídos | 11 permissões, 10 🔒. Acrescenta `project:read` e `project:update` 🔒 face aos operadores de câmara — a pós-produção trabalha sobre projetos, não sobre sessões. **0 financeiras.** |
| **FINANCE**: financeiro completo sem configurações | 23 permissões, **as 11 financeiras**, incluindo `payment:override`, `payment:refund` e `invoice:void` — que o `ADMIN` não tem. Perdeu `org:read` e `booking:update`. |
| **SALES**: CRM + propostas sem financeiro completo | 22 permissões. CRM e propostas completos; do financeiro só `invoice:read` e `price:read` — precisa de saber se o cliente pagou, não de mexer no dinheiro. |

---

## 3. Diff da matriz

### 3.1 Papéis

| Papel | Antes | Depois |
|---|---|---|
| `OWNER` | ✅ existia | Sem alteração |
| `ADMIN` | ✅ existia | Sem alteração |
| `FINANCE_MANAGER` | ✅ existia | **2 permissões removidas** |
| `PRODUCER` | ✅ existia | Sem alteração |
| `EDITOR` | Editor de **conteúdo** | **Redefinido** → editor de pós-produção, âmbito atribuído |
| `CONTENT_MANAGER` | — | **NOVO** — assume as permissões do antigo `EDITOR` de conteúdo |
| `PHOTOGRAPHER` | — | **NOVO** — âmbito atribuído |
| `VIDEOGRAPHER` | — | **NOVO** — âmbito atribuído |
| `SALES` | ✅ existia | Sem alteração |
| `STAFF` | ✅ existia | **1 removida, 1 acrescentada** |
| `CLIENT` | ✅ existia | Sem alteração |

**8 papéis → 11 papéis.** Permissões inalteradas: 73.

### 3.2 Células alteradas em papéis pré-existentes

Quatro células. Todas as restantes mudanças resultam de papéis novos ou da redefinição do
`EDITOR`.

| Permissão | Papel | Antes | Depois | Motivo |
|---|---|:--:|:--:|---|
| `org:read` | FINANCE | ✅ | — | "Financeiro **sem configurações**" |
| `booking:update` | FINANCE | ✅ | — | Corrigir reservas é operação, não finanças |
| `project:read` | STAFF | 🔒 | — | Projetos SaaS não são âmbito da equipa de estúdio |
| `client:read` | STAFF | — | 🔒 | Precisa de saber para quem trabalha na sessão atribuída |

### 3.3 Renomeação `EDITOR` → `CONTENT_MANAGER`

As 15 permissões do antigo `EDITOR` (conteúdo, campanhas, posts, `lead:read`, `lead:create`,
`file:upload`, `analytics:read`) transitaram integralmente para `CONTENT_MANAGER`.
**Nenhuma foi perdida nem acrescentada.** O novo `EDITOR` parte de zero e recebe apenas o
conjunto de âmbito atribuído.

> **Atenção na migração:** utilizadores com `role = 'EDITOR'` na base de dados têm de ser
> reclassificados **antes** de a nova política entrar em vigor. Um `EDITOR` de conteúdo que
> fique com o papel `EDITOR` novo perde o acesso ao CMS sem aviso. Ver §6.

---

## 4. Resumo executivo das permissões por papel

Contagens verificadas por script sobre a matriz gerada.

| Papel | Total | Plenas ✅ | Atribuídas 🔒 | Financeiras | Pode gastar/mover dinheiro? |
|---|:--:|:--:|:--:|:--:|:--:|
| `OWNER` | 73 | 73 | 0 | 11 | ✅ Sim |
| `ADMIN` | 67 | 67 | 0 | 8 | ❌ Não (sem override, refund, void) |
| `FINANCE_MANAGER` | 23 | 23 | 0 | **11** | ✅ Sim |
| `PRODUCER` | 22 | 22 | 0 | 1 | ❌ Não (só `price:read`) |
| `SALES` | 22 | 22 | 0 | 2 | ❌ Não (só leitura) |
| `CONTENT_MANAGER` | 15 | 15 | 0 | **0** | ❌ Não |
| `EDITOR` | 11 | 1 | 10 | **0** | ❌ Não |
| `CLIENT` | 11 | 0 | 11 | 2 | ❌ Não (só os seus) |
| `PHOTOGRAPHER` | 10 | 1 | 9 | **0** | ❌ Não |
| `VIDEOGRAPHER` | 10 | 1 | 9 | **0** | ❌ Não |
| `STAFF` | 8 | 1 | 7 | **0** | ❌ Não |

**Leitura desta tabela:** dos 11 papéis, apenas **2** podem mover dinheiro (`OWNER` e
`FINANCE_MANAGER`) e **5** não têm sequer uma permissão financeira de leitura. Os quatro papéis
operacionais somam 39 permissões, das quais 35 são de âmbito atribuído.

### O que cada papel vê ao entrar

| Papel | Primeira coisa que vê |
|---|---|
| `OWNER` / `ADMIN` | KPIs, receita, pipeline, agenda completa |
| `FINANCE_MANAGER` | Faturas por cobrar, pagamentos pendentes, reconciliação |
| `PRODUCER` | Agenda da semana, atribuições por fazer, entregas em atraso |
| `PHOTOGRAPHER` / `VIDEOGRAPHER` | **Só as suas sessões**, com cliente, local e hora |
| `EDITOR` | **Só os seus projetos**, com prazos e ficheiros de origem |
| `CONTENT_MANAGER` | Calendário editorial, campanhas, páginas por publicar |
| `SALES` | Pipeline, propostas por responder, leads novos |
| `STAFF` | As suas tarefas do dia |
| `CLIENT` | As suas reservas, faturas e entregas |

---

## 5. Alterações necessárias ao schema

```prisma
enum Role {
  OWNER
  ADMIN
  FINANCE_MANAGER
  PRODUCER
  PHOTOGRAPHER      // NOVO
  VIDEOGRAPHER      // NOVO
  EDITOR            // REDEFINIDO — pós-produção (era conteúdo)
  CONTENT_MANAGER   // NOVO — assume o papel de conteúdo
  SALES
  STAFF
  CLIENT
}
```

E, para o âmbito atribuído em projetos de pós-produção:

```prisma
// NOVO — o EDITOR precisa de atribuição a projetos, tal como o
// PHOTOGRAPHER/VIDEOGRAPHER a têm via ProductionJob.assigneeId
model ProjectAssignment {
  id            String      @id @default(cuid())
  saasProjectId String
  saasProject   SaaSProject @relation(fields: [saasProjectId], references: [id], onDelete: Cascade)
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  role          String?     // função no projeto: "editor", "colorista", "sound"
  assignedAt    DateTime    @default(now())
  assignedById  String

  @@unique([saasProjectId, userId])
  @@index([userId])
}
```

**Sem `ProjectAssignment`, `EDITOR` não tem como filtrar "projetos atribuídos"** — as queries
de posse ficariam sem critério. É uma dependência bloqueante da política, não um extra.

---

## 6. Plano de migração dos papéis

O seed inicial ainda não correu e não há utilizadores em produção, portanto a migração é
trivial **agora**. Se for adiada para depois do VOL01, deixa de ser.

```sql
-- 1. Reclassificar antes de aplicar a nova semântica
UPDATE "Membership" SET role = 'CONTENT_MANAGER' WHERE role = 'EDITOR';

-- 2. Só depois, acrescentar os valores novos ao enum
ALTER TYPE "Role" ADD VALUE 'PHOTOGRAPHER';
ALTER TYPE "Role" ADD VALUE 'VIDEOGRAPHER';
ALTER TYPE "Role" ADD VALUE 'CONTENT_MANAGER';

-- 3. Atribuir os papéis operacionais manualmente, caso a caso
```

**A ordem importa.** Acrescentar `CONTENT_MANAGER` ao enum antes de reclassificar os
utilizadores deixa uma janela em que um `EDITOR` de conteúdo já é lido com a semântica nova e
perde acesso ao CMS.

---

## 7. Testes adicionais exigidos

Acrescentam-se ao plano do [VOL01 §9](../01-auth/README.md):

| # | Teste | Resultado esperado |
|---|---|---|
| 15 | `PHOTOGRAPHER` acede a sessão **não** atribuída | 404 |
| 16 | `PHOTOGRAPHER` acede a sessão atribuída | 200 |
| 17 | `VIDEOGRAPHER` tenta qualquer rota `/admin/financeiro` | 403 |
| 18 | `EDITOR` acede a projeto não atribuído | 404 |
| 19 | `EDITOR` tenta publicar página do site (`content:publish`) | 403 |
| 20 | `CONTENT_MANAGER` tenta ver o ledger | 403 |
| 21 | `STAFF` tenta ver qualquer fatura | 403 |
| 22 | `FINANCE_MANAGER` tenta alterar definições da organização | 403 |
| 23 | `FINANCE_MANAGER` executa `payment:override` com justificação | 200 + `AuditLog` `CRITICAL` |
| 24 | `SALES` tenta emitir fatura | 403 |
| 25 | Os 5 papéis sem financeiro tentam as 11 permissões financeiras | **55 × 403** |

O teste 25 é a verificação direta do requisito "sem acesso financeiro" e deve ser escrito como
matriz, não como casos avulsos.

---

## 8. Riscos introduzidos por esta política

| # | Risco | Mitigação |
|---|---|---|
| P1 | Papel `EDITOR` com dois significados no histórico do projeto | Nota permanente em `rbac.md §2` e neste documento; migração SQL com ordem definida |
| P2 | 11 papéis multiplicam a superfície de teste (11 × 73 = 803 células) | Matriz gerada e testada por script, não à mão |
| P3 | `PHOTOGRAPHER` e `VIDEOGRAPHER` têm permissões idênticas — tentação de os fundir | Mantidos separados por necessidade de atribuição e relatórios; se em 6 meses continuarem idênticos, fundir com ADR |
| P4 | Âmbito atribuído depende de `ProductionJob.assigneeId` e `ProjectAssignment` estarem sempre preenchidos | Sessão sem responsável atribuído fica invisível para os operacionais — alerta em `/admin/producao` para sessões sem atribuição |
| P5 | Operacionais sem `client:read` pleno podem precisar do contacto do cliente no terreno | `client:read` 🔒 dá acesso ao cliente da sessão atribuída, incluindo telefone e morada |

---

## 9. Decisões que deixo à sua confirmação

Um resolvido, dois em aberto:

1. ~~**`FINANCE_MANAGER` mantém `price:manage`.**~~ ✅ **RESOLVIDO em 2026-08-05.**
   Confirmado: `price:manage` fica no financeiro, **limitado a preços de serviços e pacotes**.
   Configurações do sistema, IVA, série de faturação e moeda continuam em `org:update`, que o
   financeiro não tem. Ver [`rbac.md §4-A`](rbac.md).
   **Lacuna detetada na mesma revisão:** a política aprovada inclui `expense:manage`, mas não
   existe modelo de despesas no schema. Adiado para a Fase 5 (ERP), documentado em §4-A.
2. **`PHOTOGRAPHER` e `VIDEOGRAPHER` ficaram com permissões idênticas.** A distinção é de
   atribuição e relatório, não de acesso. Se pretende diferenças reais — por exemplo, o
   videógrafo gerir equipamento — diga quais.
3. **`STAFF` perdeu `project:read`.** Assumi que a equipa de estúdio não acompanha projetos de
   desenvolvimento de software. Se houver sobreposição de pessoas entre as duas operações,
   reponho.
