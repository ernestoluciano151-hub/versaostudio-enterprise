# RBAC — modelo de permissões

**Fonte única de verdade da matriz de permissões.** Em implementação, o ficheiro
`src/modules/identity/domain/policies/permissions.ts` espelha exatamente as tabelas deste
documento, e um teste automático compara os dois. Se divergirem, o CI falha.

Decisão em [ADR-008](../adr/ADR-008-rbac-strategy.md).

---

## 1. Conceitos

| Conceito | Definição |
|---|---|
| **Papel** (`Role`) | Conjunto nomeado de permissões. Um utilizador tem um papel por organização. |
| **Permissão** | Par `recurso:ação`, por exemplo `booking:confirm`. Granularidade de decisão. |
| **Concessão** (`Membership.permissions[]`) | Permissões extra atribuídas a um utilizador específico. **Só acrescenta, nunca remove.** |
| **Posse** | Um `CLIENT` só acede ao que é seu. Verificada na query, não por permissão. |
| **Elevação** | Sessão com MFA verificado. Sem elevação, nenhum acesso a `/admin`. |

**Princípio:** permissão responde a *"pode fazer isto?"*; posse responde a *"pode fazer isto
**a este registo**?"*. As duas verificações são independentes e ambas obrigatórias.

---

## 2. Papéis

11 papéis, alinhados com a operação real de um estúdio audiovisual. Decisão e justificação em
[ADR-009](../adr/ADR-009-role-expansion.md); política operacional e diff em
[`rbac-policy-final.md`](rbac-policy-final.md).

| Papel | Sigla | Descrição | Âmbito | MFA |
|---|---|---|---|---|
| `OWNER` | OWN | Proprietário. Tudo, incluindo destruir a organização e repor MFA. | Global | Obrigatório |
| `ADMIN` | ADM | Administrador. Tudo exceto destruição e alterações financeiras irreversíveis. | Global | Obrigatório |
| `FINANCE_MANAGER` | FIN | Financeiro completo: faturas, pagamentos, reembolsos, overrides, reconciliação. **Sem configurações do sistema.** | Financeiro | Obrigatório |
| `PRODUCER` | PRD | Produção. Agenda, recursos, atribuições, entregas de toda a operação. | Operacional global | Obrigatório |
| `PHOTOGRAPHER` | PHO | Fotógrafo. **Apenas sessões atribuídas.** Sem acesso financeiro. | Atribuído | Obrigatório |
| `VIDEOGRAPHER` | VID | Videógrafo. **Apenas sessões atribuídas.** Sem acesso financeiro. | Atribuído | Obrigatório |
| `EDITOR` | EDT | Editor de pós-produção. **Apenas projetos e sessões atribuídos.** Sem acesso financeiro. | Atribuído | Obrigatório |
| `CONTENT_MANAGER` | CNT | Conteúdo e marketing: site, SEO, blog, campanhas, redes sociais. | Marketing | Obrigatório |
| `SALES` | SAL | Comercial: leads, propostas, clientes. Vê faturas, **não gere dinheiro**. | Comercial | Obrigatório |
| `STAFF` | STF | Equipa operacional de apoio. Agenda e tarefas atribuídas. **Zero financeiro.** | Atribuído | Obrigatório |
| `CLIENT` | CLI | Cliente. Apenas os seus próprios dados, via portal. | Posse | Opcional |

> **Nota sobre `EDITOR`:** até esta revisão, `EDITOR` designava o editor de *conteúdo do site*.
> Num estúdio audiovisual, "editor" significa editor de vídeo. O papel de conteúdo passou a
> `CONTENT_MANAGER` e `EDITOR` passa a ser pós-produção. Ver
> [ADR-009](../adr/ADR-009-role-expansion.md).

### Os três papéis de âmbito atribuído

`PHOTOGRAPHER`, `VIDEOGRAPHER` e `EDITOR` partilham o mesmo modelo: veem **apenas** o que lhes
está atribuído através de `ProductionJob.assigneeId` (sessões) ou `ProjectAssignment` (projetos
de pós-produção). A diferença entre eles é operacional — que tipo de trabalho recebem —, não
de permissão. São papéis distintos porque a atribuição e os relatórios de ocupação precisam de
os distinguir, não porque o conjunto de permissões seja diferente.

---

## 3. Catálogo de permissões

### Organização e utilizadores

| Permissão | Descrição |
|---|---|
| `org:read` | Ver definições da organização |
| `org:update` | Alterar definições |
| `org:delete` | Destruir a organização |
| `user:read` | Listar utilizadores |
| `user:invite` | Convidar membros |
| `user:update` | Alterar dados de utilizador |
| `user:change_role` | Alterar papel de outro utilizador |
| `user:deactivate` | Desativar conta |
| `user:reset_mfa` | Repor MFA de outro utilizador |
| `session:revoke_any` | Revogar sessões de terceiros |

### CRM

`lead:read` · `lead:create` · `lead:update` · `lead:delete` · `lead:assign`
`client:read` · `client:create` · `client:update` · `client:delete`
`proposal:read` · `proposal:create` · `proposal:send` · `proposal:delete`

### Reservas e produção

`booking:read` · `booking:create` · `booking:update` · `booking:confirm` ·
`booking:cancel` · `booking:reschedule`
`production:read` · `production:update` · `production:assign`
`resource:read` · `resource:manage` · `availability:manage`

### Financeiro

| Permissão | Descrição |
|---|---|
| `invoice:read` / `invoice:create` / `invoice:issue` / `invoice:void` | Faturação |
| `payment:read` | Ver pagamentos |
| `payment:refund` | Aprovar reembolso |
| `payment:override` | **Confirmar pagamento manualmente.** Exige justificação. |
| `ledger:read` | Consultar o ledger |
| `reconciliation:run` | Executar reconciliação manual |
| `price:read` / `price:manage` | Tabela de preços. **`price:manage` limita-se a preços de serviços e pacotes** — não abrange definições do sistema. Ver §4-A. |

### Ficheiros e entregas

`deliverable:read` · `deliverable:create` · `deliverable:publish` · `deliverable:delete`
`file:upload` · `file:download` · `file:delete`

### Conteúdo e marketing

`content:read` · `content:create` · `content:publish` · `content:delete`
`campaign:read` · `campaign:create` · `campaign:update` · `campaign:launch`
`post:read` · `post:create` · `post:approve` · `post:publish`

### Projetos

`project:read` · `project:create` · `project:update` · `project:deploy` · `domain:manage`

### Auditoria e analytics

`audit:read` · `analytics:read` · `analytics:financial`

---

## 4. Matriz papel × permissão

Legenda: ✅ concedido · — negado · 🔒 apenas registos próprios ou **atribuídos**

| Permissão | OWN | ADM | FIN | PRD | PHO | VID | EDT | CNT | SAL | STF | CLI |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Organização** | | | | | | | | | | | |
| `org:read` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `org:update` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `org:delete` | ✅ | — | — | — | — | — | — | — | — | — | — |
| `user:read` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `user:invite` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `user:update` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `user:change_role` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `user:deactivate` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `user:reset_mfa` | ✅ | — | — | — | — | — | — | — | — | — | — |
| `session:revoke_any` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| **CRM** | | | | | | | | | | | |
| `lead:read` | ✅ | ✅ | — | — | — | — | — | ✅ | ✅ | — | — |
| `lead:create` | ✅ | ✅ | — | — | — | — | — | ✅ | ✅ | — | — |
| `lead:update` | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| `lead:assign` | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| `lead:delete` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `client:read` | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | — | ✅ | 🔒 | 🔒 |
| `client:create` | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| `client:update` | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | — | 🔒 |
| `client:delete` | ✅ | — | — | — | — | — | — | — | — | — | — |
| `proposal:read` | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | — | 🔒 |
| `proposal:create` | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| `proposal:send` | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| `proposal:delete` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| **Reservas** | | | | | | | | | | | |
| `booking:read` | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | — | ✅ | 🔒 | 🔒 |
| `booking:create` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — | 🔒 |
| `booking:update` | ✅ | ✅ | — | ✅ | — | — | — | — | ✅ | — | — |
| `booking:confirm` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| `booking:cancel` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | 🔒 |
| `booking:reschedule` | ✅ | ✅ | — | ✅ | — | — | — | — | — | — | — |
| `production:read` | ✅ | ✅ | — | ✅ | 🔒 | 🔒 | 🔒 | — | — | 🔒 | — |
| `production:update` | ✅ | ✅ | — | ✅ | 🔒 | 🔒 | 🔒 | — | — | 🔒 | — |
| `production:assign` | ✅ | ✅ | — | ✅ | — | — | — | — | — | — | — |
| `resource:read` | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |
| `resource:manage` | ✅ | ✅ | — | ✅ | — | — | — | — | — | — | — |
| `availability:manage` | ✅ | ✅ | — | ✅ | 🔒 | 🔒 | — | — | — | — | — |
| **Financeiro** | | | | | | | | | | | |
| `invoice:read` | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | — | 🔒 |
| `invoice:create` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `invoice:issue` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| **`invoice:void`** | ✅ | — | ✅ | — | — | — | — | — | — | — | — |
| `payment:read` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | 🔒 |
| `payment:refund` | ✅ | — | ✅ | — | — | — | — | — | — | — | — |
| **`payment:override`** | ✅ | — | ✅ | — | — | — | — | — | — | — | — |
| `ledger:read` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `reconciliation:run` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `price:read` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — | — |
| `price:manage` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| **Ficheiros** | | | | | | | | | | | |
| `deliverable:read` | ✅ | ✅ | — | ✅ | 🔒 | 🔒 | 🔒 | — | — | 🔒 | 🔒 |
| `deliverable:create` | ✅ | ✅ | — | ✅ | 🔒 | 🔒 | 🔒 | — | — | — | — |
| `deliverable:publish` | ✅ | ✅ | — | ✅ | — | — | — | — | — | — | — |
| `deliverable:delete` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `file:upload` | ✅ | ✅ | — | ✅ | 🔒 | 🔒 | 🔒 | ✅ | — | 🔒 | — |
| `file:download` | ✅ | ✅ | — | ✅ | 🔒 | 🔒 | 🔒 | — | — | 🔒 | 🔒 |
| `file:delete` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| **Conteúdo e marketing** | | | | | | | | | | | |
| `content:read` | ✅ | ✅ | — | — | — | — | — | ✅ | ✅ | — | — |
| `content:create` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| `content:publish` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| `content:delete` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `campaign:read` | ✅ | ✅ | ✅ | — | — | — | — | ✅ | ✅ | — | — |
| `campaign:create` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| `campaign:update` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| `campaign:launch` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| `post:read` | ✅ | ✅ | — | — | — | — | — | ✅ | ✅ | — | — |
| `post:create` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| `post:approve` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| `post:publish` | ✅ | ✅ | — | — | — | — | — | ✅ | — | — | — |
| **Projetos** | | | | | | | | | | | |
| `project:read` | ✅ | ✅ | ✅ | ✅ | — | — | 🔒 | — | ✅ | — | 🔒 |
| `project:create` | ✅ | ✅ | — | — | — | — | — | — | ✅ | — | — |
| `project:update` | ✅ | ✅ | — | ✅ | — | — | 🔒 | — | — | — | — |
| `project:deploy` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `domain:manage` | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| **Auditoria** | | | | | | | | | | | |
| `audit:read` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `analytics:read` | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — | — |
| `analytics:financial` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |

### Decisões explicadas

- **`FINANCE_MANAGER` perdeu `org:read` e `booking:update`.** "Financeiro completo sem
  configurações": gere dinheiro, não gere o sistema nem altera reservas. Corrigir uma reserva é
  operação, não finanças.
- **`ADMIN` continua sem `payment:override`, `payment:refund` e `invoice:void`.** Separação de
  funções: quem administra o sistema não altera registos financeiros sozinho.
- **`PHOTOGRAPHER`, `VIDEOGRAPHER`, `EDITOR` e `STAFF` têm zero permissões financeiras.**
  Nenhuma linha do bloco Financeiro lhes é concedida. É o requisito operacional central desta
  revisão.
- **`SALES` vê `invoice:read` mas não emite nem cobra.** Precisa de saber se o cliente pagou
  para gerir a relação comercial; não precisa de mexer no dinheiro.
- **`PHOTOGRAPHER` e `VIDEOGRAPHER` gerem a própria disponibilidade** (`availability:manage` 🔒).
  Quem sabe quando pode filmar é quem filma.
- **`deliverable:publish` fica em `PRODUCER` e acima.** Quem executa pode preparar a entrega;
  publicar ao cliente é decisão de produção, com implicações de faturação.
- **Editar o próprio perfil não é permissão, é posse.** `user:update` refere-se a alterar dados
  de *outros*.
- **`CLIENT` nunca tem `Membership`.** O acesso é por `ClientUser`, limitado por `clientId`.

---

## 4-A. Política aprovada — `FINANCE_MANAGER`

Confirmada pelo responsável do projeto em 2026-08-05. Resolve a questão em aberto nº 1 de
[`rbac-policy-final.md §9`](rbac-policy-final.md): **`price:manage` fica no financeiro, mas
apenas para preços de serviços e pacotes.**

| Capacidade | Estado | Permissões no nosso catálogo |
|---|:--:|---|
| Ler dados financeiros | ✅ | `invoice:read` · `payment:read` · `ledger:read` · `analytics:financial` |
| Alterar dados financeiros | ✅ | `invoice:create` · `invoice:void` · `payment:refund` · `payment:override` · `reconciliation:run` |
| Emitir faturas | ✅ | `invoice:issue` |
| Confirmar pagamentos | ✅ | `payment:override` (confirmação manual, com justificação obrigatória e `AuditLog` `CRITICAL`) |
| Gerir despesas | ⚠️ | **Não existe ainda** — ver nota de lacuna abaixo |
| Gerir preços | ⚠️ | `price:manage` — **apenas preços de serviços e pacotes** |
| Gerir configurações do sistema | ❌ | `org:read` e `org:update` negados |
| Gerir papéis e utilizadores | ❌ | `user:*` e `session:revoke_any` negados |

### Nota de âmbito de `price:manage`

`price:manage` autoriza criar e alterar `PriceList` e `PriceListItem` — os preços comerciais
de serviços e pacotes. **Não autoriza** alterar `Organization.settings`, taxas de IVA,
série de faturação, moeda base, nem qualquer parâmetro de configuração do sistema. Esses
vivem em `org:update`, que o `FINANCE_MANAGER` não tem.

Onde isto é imposto: o use case de alteração de preços verifica `price:manage` e opera
exclusivamente sobre `PriceList`/`PriceListItem`. Qualquer alteração a `Organization` passa
por um use case distinto, que exige `org:update`. A separação está no use case, não na UI.

### Lacuna identificada: gestão de despesas

A política aprovada inclui `expense:manage`. **Esse conceito não existe no modelo de dados** —
não há `Expense`, `Supplier` nem `CostCenter` no schema. O sistema regista o que entra
(`Payment`, `LedgerEntry`), não o que sai.

Não foi acrescentada uma permissão `expense:manage` porque uma permissão sem ponto de aplicação
é código morto que dá falsa sensação de cobertura. Fica registado como **dependência da Fase 5
(ERP)**: quando o modelo de despesas existir, acrescenta-se `expense:read`, `expense:create`,
`expense:approve` e `expense:manage`, atribuídas a `OWNER` e `FINANCE_MANAGER`.

Consequência prática: até lá, a contabilidade de custos continua fora da plataforma.

### Equivalência de nomenclatura

A política foi expressa com nomes agregados; o catálogo usa `recurso:ação` granular
([ADR-008](../adr/ADR-008-rbac-strategy.md)). Correspondência:

| Nome na política | Permissões equivalentes |
|---|---|
| `finance:read` | `invoice:read` + `payment:read` + `ledger:read` + `analytics:financial` |
| `finance:update` | `invoice:create` + `invoice:void` + `payment:refund` + `reconciliation:run` |
| `payment:confirm` | `payment:override` |
| `settings:manage` | `org:update` |
| `role:manage` | `user:change_role` |
| `expense:manage` | **por criar** — Fase 5 |

A granularidade mantém-se: `finance:read` como permissão única impediria dar leitura de
faturas ao `SALES` sem lhe dar também o ledger — que é exatamente a distinção que a política
pretende.

---

## 5. Concessões pontuais

`Membership.permissions[]` acrescenta permissões a um utilizador concreto.

```
permissõesEfetivas = PAPEL[role] ∪ membership.permissions
```

**Nunca remove.** Se um utilizador não deve ter uma permissão do seu papel, o papel está
errado — muda-se o papel, não se cria uma exceção negativa. Exceções negativas tornam o
sistema impossível de raciocinar.

Toda a concessão pontual gera `AuditLog` com justificação obrigatória e é revista
trimestralmente.

---

## 6. Aplicação (enforcement)

### Camada 1 — Middleware (Edge, sem base de dados)

```ts
// Só decide: rota pública ou protegida? cookie presente e bem formado?
const PUBLIC = ['/', '/servicos', '/pacotes', '/contacto', '/entrar', '/recuperar'];
// Sem sessão numa rota protegida → redirect. NADA MAIS é decidido aqui.
```

O middleware **não** verifica papéis. Não tem como — não acede à base de dados.
Serve para redirecionar cedo, não para autorizar.

### Camada 2 — Layout / Server Component (Node)

```ts
// app/(admin)/admin/layout.tsx
const session = await requireSession();
requireStaff(session);                    // CLIENT → 403
requireMfaVerified(session);              // sessão não elevada → /admin/verificar
// A partir daqui, a área é adequada ao papel. A permissão fina é da camada 3.
```

### Camada 3 — Use case (única autorização real)

```ts
export async function confirmBooking(input: Input, actor: Actor) {
  requirePermission(actor, 'booking:confirm');            // permissão

  const booking = await bookings.findOwned(input.id, {    // posse na query
    organizationId: actor.organizationId,
  });
  if (!booking) throw new NotFoundError();                // não revela existência

  // ... regra de domínio ... + AuditLog
}
```

**`requirePermission()` é a única função que decide.** Não há `if (role === 'ADMIN')` espalhado pelo
código — isso é proibido por revisão de PR.

### Camada 4 — UI (conveniência, não segurança)

```tsx
<PermissionGate permission="payment:override">
  <OverrideButton />
</PermissionGate>
```

Esconde o que o utilizador não pode usar. **Não protege nada.** Um utilizador que force o
pedido é travado na camada 3.

---

## 7. Posse — a defesa contra IDOR

```ts
// ERRADO — janela para IDOR e revela existência
const b = await db.booking.findUnique({ where: { id } });
if (b.clientId !== actor.clientId) throw new Forbidden();

// CORRETO
const b = await db.booking.findFirst({
  where: { id, clientId: actor.clientId, organizationId: actor.organizationId },
});
if (!b) throw new NotFoundError();
```

Devolver `404` e não `403` é deliberado: `403` confirma que o registo existe.

**Teste obrigatório:** para cada recurso do portal, um teste tenta aceder com a sessão de
outro cliente e tem de receber `404`. Bloqueia o merge.

---

## 8. Papel na sessão

O papel **nunca** vem do cliente e **não** é guardado no cookie. É resolvido no servidor a
partir de `Membership` a cada pedido, junto com a sessão. Uma mudança de papel tem efeito
imediato — e revoga as sessões desse utilizador, por precaução.

---

## 9. Testes obrigatórios

| Teste | Descrição |
|---|---|
| Matriz completa | 8 papéis × todas as permissões — tabela inteira, não amostra |
| Sincronização | `permissions.ts` coincide exatamente com este documento |
| Negação por papel | Cada papel tenta o que não pode e recebe `403` |
| IDOR | Cliente A tenta aceder a recursos de B e recebe `404` |
| Elevação | Sessão sem MFA não acede a `/admin` |
| Concessão pontual | Permissão extra funciona e fica auditada |
| Mudança de papel | Efeito imediato; sessões revogadas |
| Middleware isolado | Confirmar que o middleware sozinho **não** autoriza |

Cobertura exigida em `permissions.ts`: **100 %**.

---

## 10. Evolução

Adicionar uma permissão implica: acrescentar ao catálogo (§3) · acrescentar à matriz (§4) ·
atualizar `permissions.ts` · atualizar os testes · registar no PR.

Adicionar um papel exige **ADR**. Papéis novos multiplicam a superfície de decisão e o custo
de teste; a resposta certa é quase sempre uma concessão pontual, não um papel novo.
