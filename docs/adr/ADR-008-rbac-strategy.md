# ADR-008 — Estratégia de RBAC

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Security Architect, Backend Lead
- **Contexto:** VOL01
- **Detalhe:** [`rbac.md`](../security/rbac.md)

---

## Contexto

Oito papéis, ~70 permissões, três contextos de interface e um requisito adicional que muda
tudo: um `CLIENT` não é limitado por *permissão*, é limitado por *posse* — só vê o que é seu.

As decisões a tomar:

1. Permissões definidas em código ou em base de dados?
2. Papéis fixos ou papéis personalizáveis pelo administrador?
3. Onde é aplicada a autorização?
4. Como se modela a posse, que não é uma permissão?

---

## Decisão 1 — Permissões em código, papéis fixos

**Escolhido:** o mapa papel → permissões vive em
`src/modules/identity/domain/policies/permissions.ts`, versionado em Git. Os oito papéis são
fixos; criar um novo exige ADR.

```ts
export const ROLE_PERMISSIONS = {
  OWNER: [...],
  FINANCE_MANAGER: ['invoice:read', 'invoice:issue', 'payment:override', ...],
  // ...
} as const satisfies Record<Role, readonly Permission[]>;
```

| Critério | Em código | Em base de dados |
|---|---|---|
| Revisão em PR | ✅ Uma mudança de permissão é um diff que alguém aprova | ❌ Muda em produção sem rasto de revisão |
| Segurança de tipos | ✅ `Permission` é tipo literal; erro de escrita não compila | ❌ String solta em runtime |
| Testabilidade | ✅ Matriz completa testada sem base de dados | ⚠️ Requer fixtures |
| Auditoria de alterações | ✅ Histórico Git | ⚠️ Precisa de auditoria própria |
| Desempenho | ✅ Zero queries | ⚠️ Query ou cache |
| Flexibilidade em runtime | ❌ Exige deploy | ✅ Imediata |

**Decisivo:** alterar quem pode fazer `payment:override` é uma decisão de segurança. Deve
passar por revisão de código, ficar no histórico e ser testada — não ser um toggle numa
página de definições que alguém muda numa tarde.

A flexibilidade perdida recupera-se com concessões pontuais (Decisão 5), que cobrem o caso
real: *"o João precisa de aprovar reembolsos este mês"*.

---

## Decisão 2 — Nomenclatura `recurso:ação`

`booking:confirm`, `payment:override`, `file:download`.

Legível, agrupável por recurso, e permite validar em CI que toda a permissão usada no código
existe no catálogo. Alternativas — permissões numéricas ou bitmask — são mais compactas e
ilegíveis em logs e mensagens de erro, o que custa tempo em cada investigação.

---

## Decisão 3 — Autorização em quatro camadas, com uma só a decidir

```
1. Middleware (Edge)   → redireciona quem não tem cookie. NÃO autoriza.
2. Layout / RSC (Node) → sessão válida, papel adequado à área, MFA verificado.
3. Use case (Node)     → authorize() + posse na query.  ← ÚNICA AUTORIZAÇÃO REAL
4. UI                  → esconde o que não se pode usar. NÃO protege.
```

**`requirePermission(actor, permission)` é a única função que decide.** Verificações de papel
espalhadas por componentes (`if (role === 'ADMIN')`) são proibidas e rejeitadas em revisão de
PR: multiplicam pontos de decisão e garantem que, mais cedo ou mais tarde, um deles fica
desatualizado.

---

## Decisão 4 — Posse é ortogonal à permissão

Permissão responde a *"pode confirmar reservas?"*.
Posse responde a *"pode confirmar **esta** reserva?"*.

São verificações independentes e ambas obrigatórias. A posse é imposta **na query**, nunca
depois:

```ts
requirePermission(actor, 'booking:read');                // permissão
const b = await db.booking.findFirst({                   // posse
  where: { id, clientId: actor.clientId, organizationId: actor.organizationId },
});
if (!b) throw new NotFoundError();                       // 404, não 403
```

**`404` e não `403`** quando o registo existe mas não é do utilizador: `403` confirma a
existência do registo, o que é, por si, uma fuga de informação.

Alternativa considerada e rejeitada para a fase 1: **Row-Level Security no PostgreSQL**.
É mais robusta — a base de dados impõe o isolamento independentemente do código —, mas
acrescenta complexidade significativa a um schema ainda em evolução, e obriga a propagar o
contexto de sessão para a base de dados em cada pedido. Fica planeada para a fase de
multi-tenant (Fase 10), quando houver tenants externos e o risco justificar o custo.

---

## Decisão 5 — Concessões aditivas, nunca subtrativas

```
permissõesEfetivas = ROLE_PERMISSIONS[role] ∪ membership.permissions
```

`Membership.permissions[]` só **acrescenta**. Não existe mecanismo para remover uma permissão
do papel.

**Porquê:** exceções negativas tornam o sistema impossível de raciocinar. Com elas, responder
a *"quem pode aprovar reembolsos?"* deixa de ser consultar uma tabela e passa a ser inspecionar
todos os utilizadores um a um. Se alguém não deve ter uma permissão do seu papel, o papel está
errado — muda-se o papel.

Toda a concessão gera `AuditLog` com justificação obrigatória e é revista trimestralmente.

---

## Decisão 6 — Papel resolvido no servidor, nunca no cliente

O papel não é guardado no cookie nem enviado ao cliente como fonte de verdade. É resolvido a
partir de `Membership` a cada pedido, em conjunto com a sessão.

Consequência positiva: mudar o papel de alguém tem efeito imediato. Por precaução, uma
mudança de papel também revoga as sessões desse utilizador.

---

## Decisão 7 — Separação de funções no financeiro

`ADMIN` **não** tem `payment:override` nem `invoice:void`.

Quem administra o sistema não deve poder alterar registos financeiros sozinho. Isto é
deliberadamente incómodo: um `ADMIN` que precise de forçar um pagamento tem de pedir a um
`FINANCE_MANAGER`, e a operação fica com dois nomes associados. É a defesa mais simples
contra o insider — a ameaça que nenhuma criptografia resolve.

---

## Consequências

**Positivas**
- Mudanças de permissão passam por revisão de código e ficam no histórico.
- Matriz completa testável sem base de dados; cobertura de 100 % é exigível e realista.
- Zero queries para resolver permissões.
- Erro de escrita numa permissão não compila.
- IDOR fica estruturalmente difícil: a posse está na query, não numa verificação posterior.

**Negativas / custos aceites**
- Alterar permissões exige deploy. Aceitável: são decisões de segurança, não configuração.
- Papéis fixos podem não servir uma futura necessidade — resolvido por ADR quando surgir.
- Sem RLS, o isolamento depende de disciplina no código. Mitigado por: repositórios que
  **exigem** o contexto do ator, testes de IDOR obrigatórios em cada recurso, e revisão de PR
  focada neste ponto.
- Duplicação entre `rbac.md` e `permissions.ts` — mitigada por teste automático que compara
  os dois e falha em caso de divergência.

---

## Critérios de revisão

Reavaliar se: chegar o primeiro tenant externo (ativar RLS) · surgirem mais de 12 papéis
distintos na prática (indica que o modelo de papéis está errado) · as concessões pontuais
passarem a ser a regra e não a exceção.
