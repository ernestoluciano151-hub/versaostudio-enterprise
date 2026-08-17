# Confirmação final antes do VOL01 — resposta aos 8 pontos

**Data:** 2026-08-05
**Método:** verificação executada sobre os ficheiros, não declaração de intenção.

> **Legenda honesta**
> ✅ **Facto verificado** — verifiquei agora, no ficheiro.
> 🟡 **Compromisso** — está desenhado e documentado; só será facto quando houver código.
> ❌ **Não confirmo** — e explico porquê.

---

## Resumo

| # | Ponto | Estado |
|---|---|:--:|
| 1 | `enum Role` sincronizado com os 11 papéis | ✅ |
| 2 | Migration SQL para `CONTENT_MANAGER` e `ProjectAssignment` | ✅ (escrita agora) |
| 3 | Script de migração seguro para ambientes futuros | ✅ (escrito, **por testar**) |
| 4 | APIs usarão `requirePermission()` centralizado | 🟡 |
| 5 | Middleware lê permissões do JWT/session token | ❌ **Não confirmo** |
| 6 | `AuditLog` suporta eventos de autenticação | ✅ com ressalva de nomes |
| 7 | `ProjectAssignment` com índices | ✅ |
| 8 | `CLIENT` impedido de leitura cruzada | 🟡 |

**5 de 8 confirmados. Um recusado com fundamentação. Dois são compromissos de implementação.**

---

## 1. `enum Role` sincronizado ✅

Verificado em `docs/prisma/schema.prisma`:

```
OWNER ADMIN FINANCE_MANAGER PRODUCER PHOTOGRAPHER VIDEOGRAPHER
EDITOR CONTENT_MANAGER SALES STAFF CLIENT
```

11 valores. Comparação automática contra as colunas da matriz de
[`rbac.md §4`](rbac.md): **conjuntos idênticos**, zero divergências.

O schema tem também um comentário permanente a assinalar que `EDITOR` foi redefinido — para
que ninguém, daqui a um ano, assuma a semântica antiga.

---

## 2. Migration SQL ✅

**Antes desta confirmação, não existia.** Escrita agora, em
[`../migrations/vol01-precheck.md`](../migrations/vol01-precheck.md) §3, com a ordem correta:

1. `UPDATE "Membership" SET role='CONTENT_MANAGER' WHERE role='EDITOR'` — **primeiro**
2. `ALTER TYPE "Role" ADD VALUE` para os três valores novos
3. `CREATE TABLE "ProjectAssignment"` com índices
4. Tabelas de auth (`AuthEvent`, `MfaBackupCode`) e colunas novas em `User` e `Session`
5. `REVOKE UPDATE, DELETE` em `AuthEvent`

**A ordem não é estética.** Inverter os passos 1 e 2 abre uma janela em que um editor de
conteúdo já é lido com a semântica nova e perde o acesso ao CMS sem aviso.

> Nota de rigor: o ficheiro é SQL pronto a aplicar, **não** uma pasta `prisma/migrations/`.
> Essa é gerada por `prisma migrate dev` no primeiro passo do VOL01. Escrever à mão a estrutura
> interna do Prisma sem o Prisma presente produziria uma migração que a ferramenta não
> reconhece.

---

## 3. Script de migração seguro ✅ — mas por testar

Em [`vol01-precheck.md`](../migrations/vol01-precheck.md) §4: transacional, idempotente,
com verificação prévia de estado e rollback documentado.

**Ressalva que faço questão de deixar escrita:** este script **nunca foi executado**. Não
existe base de dados neste ambiente. É SQL revisto, não SQL testado. Executá-lo primeiro num
ambiente descartável não é zelo excessivo — é o mínimo.

`ALTER TYPE ... ADD VALUE` **não é reversível** numa transação em PostgreSQL: remover um valor
de enum exige recriar o tipo. O rollback está documentado, mas é uma operação pesada.

---

## 4. `requirePermission()` centralizado 🟡

**Compromisso assumido, com uma alteração de nomenclatura:** o desenho chamava-lhe
`authorize()`. Adoto `requirePermission()` — é mais explícito quanto ao facto de lançar
exceção em vez de devolver booleano, o que evita a classe de bug mais comum nesta área:

```ts
if (can(actor, 'payment:override')) { /* ... */ }   // esquecer o else → falha aberta
requirePermission(actor, 'payment:override');       // falha fechada, sempre
```

Assinatura acordada:

```ts
export function requirePermission(
  actor: Actor,
  permission: Permission,        // tipo literal — erro de escrita não compila
): asserts actor is AuthorizedActor;
```

Garantias que ficam em `CLAUDE.md` como regra vinculativa:

- É a **única** função que autoriza. `if (role === 'ADMIN')` disperso pelo código é motivo de
  rejeição de PR.
- Não devolve booleano — lança. Falha fechada por omissão.
- **Não substitui a verificação de posse.** Permissão e posse são verificações independentes e
  ambas obrigatórias: `requirePermission()` responde a *"pode confirmar reservas?"*;
  o filtro na query responde a *"pode confirmar **esta** reserva?"*.

É 🟡 e não ✅ porque não existe uma linha de código. Passa a ✅ no fim do VOL01.

---

## 5. Middleware lê permissões do JWT/session token ❌ **Não confirmo**

Este ponto contradiz o [ADR-007](../adr/ADR-007-authentication-provider.md), aprovado. Não o
confirmo, e explico porquê em vez de o contornar em silêncio.

### Porque não

**O middleware do Next corre no Edge Runtime.** Sem Prisma, sem acesso à base de dados. Para
o middleware conseguir decidir com base em permissões, essas permissões teriam de viajar no
token — e é aí que o problema começa:

| Consequência | Detalhe |
|---|---|
| **A revogação deixa de ser imediata** | Um token assinado é válido até expirar. Despedir alguém, mudar-lhe o papel ou revogar-lhe a sessão passa a ter efeito só na renovação seguinte. Foi exatamente por isto que o ADR-007 recusou JWT. |
| **Duas fontes de verdade** | O que está no token e o que está em `Membership` divergem no momento em que o papel muda. A partir daí, a resposta a *"o que pode este utilizador fazer?"* depende de a quem se pergunta. |
| **Proteção ilusória** | O maior risco não é o token ser forjado — é olhar-se para o middleware e concluir que a aplicação está protegida. Não está: o middleware não vê chamadas de API feitas fora do browser. |

### O que confirmo em substituição

**A permissão nunca vem do cliente. É resolvida no servidor a cada pedido, a partir de
`Membership`.** Isto é mais forte do que o pedido — a arquitetura de três camadas está em
[`01-auth/README.md §3`](../01-auth/README.md):

| Camada | Runtime | O que faz |
|---|---|---|
| 1. Middleware | Edge | Cookie presente e bem formado? Rota exige sessão? Redireciona. **Não autoriza.** |
| 2. Layout / RSC | Node | Sessão válida em BD? Não revogada? Papel adequado à área? MFA verificado? |
| 3. Use case | Node | `requirePermission()` + filtro de posse na query. **Única autorização real.** |

O cookie transporta **apenas** o identificador opaco de sessão. Nenhum papel, nenhuma
permissão, nenhum dado de utilizador. Alterar o cookie não altera permissões — só invalida a
sessão.

Existe um teste dedicado que confirma que o middleware sozinho **não** autoriza.

**Se ainda assim preferir permissões no token**, é uma decisão sua e legítima — mas exige um
ADR novo que substitua explicitamente o ADR-007, com o custo da revogação diferida assumido
por escrito. Não o faço sem essa decisão formal.

---

## 6. Eventos de autenticação ✅ — com ressalva de nomes

**Aplicado ao schema nesta consolidação.** Os eventos existem, mas em `AuthEvent`, não em
`AuditLog`, e com nomes diferentes dos que indicou:

| Nome que indicou | No nosso schema | Onde |
|---|---|---|
| `AUTH_LOGIN` | `LOGIN_SUCCESS` (+ `LOGIN_FAILED`, que faltava na sua lista) | `AuthEventType` |
| `AUTH_LOGOUT` | `LOGOUT` (+ `LOGOUT_ALL`) | `AuthEventType` |
| `AUTH_2FA_ENABLED` | `MFA_ENABLED` (+ `MFA_DISABLED`, `MFA_VERIFIED`, `MFA_FAILED`) | `AuthEventType` |
| `AUTH_SESSION_REVOKED` | `SESSION_REVOKED` | `AuthEventType` |

`AuthEventType` tem **18 valores**, incluindo `ACCOUNT_LOCKED`, `MAGIC_LINK_USED`,
`BACKUP_CODE_USED` e `PASSWORD_RESET`.

### Porquê `AuthEvent` e não `AuditLog`

Não é preferência de arrumação. São duas coisas diferentes:

| | `AuditLog` | `AuthEvent` |
|---|---|---|
| Regista | Alterações de estado de negócio, com `before`/`after` | Tentativas de autenticação |
| Volume | Baixo | Alto — cada tentativa falhada conta |
| Índice por e-mail | Não faz sentido | **Essencial** — tentativas em contas inexistentes não têm `userId` |
| Retenção | 7 anos (financeiro) | 2 anos |

Misturá-los degradaria as consultas de auditoria financeira com ruído de login. Ambos são
append-only, com `UPDATE`/`DELETE` revogados na base de dados.

**Ações de segurança com impacto no negócio escrevem nos dois:** ativar/desativar MFA e mudar
o papel de um utilizador geram `AuthEvent` **e** `AuditLog` com severidade `CRITICAL`.

Se preferir o prefixo `AUTH_` nos nomes, mudo — é uma renomeação de enum sem consequências,
desde que feita antes da primeira migração.

---

## 7. Índices de `ProjectAssignment` ✅

Verificado no schema:

```prisma
@@unique([saasProjectId, userId])  // cria índice composto único
@@index([saasProjectId, userId])   // explícito
@@index([userId])                  // queries "os meus projetos"
```

**Um ajuste de nomenclatura ao seu ponto:** o campo chama-se `saasProjectId`, não `projectId`.
A convenção do schema é `<modelo>Id`, e o modelo é `SaaSProject`. Se preferir `projectId`,
altera-se agora — depois da primeira migração custa uma renomeação de coluna.

O `@@unique` já garante o índice composto; acrescentei o `@@index` explícito por legibilidade e
porque é a query mais frequente do `EDITOR`. O custo é uma estrutura duplicada em disco —
aceitável e removível se o volume o justificar.

---

## 8. `CLIENT` sem leitura cruzada 🟡

**Por desenho, sim. Por verificação, ainda não — e a diferença importa.**

O que está desenhado ([`rbac.md §7`](rbac.md)):

```ts
// Posse imposta NA QUERY, nunca depois
const b = await db.booking.findFirst({
  where: { id, clientId: actor.clientId, organizationId: actor.organizationId },
});
if (!b) throw new NotFoundError();   // 404, não 403 — 403 confirmaria a existência
```

Três camadas de isolamento: `organizationId` em todas as tabelas de negócio (tenant),
`clientId` no filtro (cliente), e `404` em vez de `403` (não revela existência).

**Porque não é ✅:** não há código, logo não há teste. E isto é precisamente o tipo de garantia
que só vale depois de ser testada — a lacuna de posse mais comum é uma query nova que alguém
escreve sem o filtro, e nenhuma quantidade de documentação a impede.

O que a torna ✅, no fim do VOL01:

- Teste de IDOR **por cada recurso** do portal: cliente A tenta aceder a registos de B → `404`
- Teste equivalente ao nível de organização
- Ambos bloqueiam o merge ([quality-gate](../governance/quality-gate.md))

**Row-Level Security no PostgreSQL** — que tornaria o isolamento independente do código — está
adiada para a fase multi-tenant ([ADR-008](../adr/ADR-008-rbac-strategy.md)). Até lá, o
isolamento depende de disciplina no código e de testes. É uma escolha consciente, com risco
assumido e registado.

---

## Estado final

**5 factos verificados · 2 compromissos de implementação · 1 ponto recusado com fundamentação.**

O ponto 5 é o único que exige decisão sua antes de começar. As duas hipóteses:

- **Manter o ADR-007** (recomendado): permissões resolvidas no servidor a cada pedido,
  revogação imediata. O VOL01 arranca já.
- **Permissões no token**: exige ADR novo que substitua o ADR-007, assumindo por escrito a
  revogação diferida.

Nos restantes sete pontos, nada bloqueia o arranque.

---

## Pré-condições operacionais (independentes destes 8 pontos)

Continuam por resolver do seu lado:

1. Base de dados PostgreSQL para desenvolvimento
2. `npx prisma validate` e `npx prisma generate` locais
3. Domínio de envio com SPF, DKIM e DMARC + chave Resend
4. Decisão sobre o e-mail remetente
5. Lista de membros da equipa e respetivos papéis

Nenhuma bloqueia os passos 1–7 da sequência do VOL01.
