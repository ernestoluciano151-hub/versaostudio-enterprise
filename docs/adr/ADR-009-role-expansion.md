# ADR-009 — Expansão de papéis para operação de estúdio audiovisual

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Responsável do projeto, Security Architect
- **Contexto:** Consolidação da P0, antes do VOL01
- **Exigido por:** [ADR-008](ADR-008-rbac-strategy.md) — *"Adicionar um papel exige ADR"*
- **Política e diff:** [`rbac-policy-final.md`](../security/rbac-policy-final.md)

---

## Contexto

O ADR-008 fixou 8 papéis e escreveu, explicitamente, que a resposta certa a uma necessidade
nova é quase sempre uma **concessão pontual, não um papel novo** — porque papéis multiplicam a
superfície de decisão e de teste.

Este ADR acrescenta três papéis. Tem, portanto, de justificar por que razão a regra do
ADR-008 não se aplica aqui.

O modelo de 8 papéis foi desenhado para uma agência genérica. A operação real da Versão Digital
é um **estúdio audiovisual**: um fotógrafo que trabalha numa sessão de casamento não deve ver a
carteira de clientes inteira, nem a agenda dos colegas, nem um único número financeiro. Com o
modelo anterior, a única forma de o representar era atribuir `STAFF` e esperar que a
verificação de posse cobrisse tudo — o que deixava lacunas: `STAFF` via `project:read` e não
via `client:read`, exatamente ao contrário do que a operação precisa.

---

## Decisão

**8 papéis → 11 papéis.**

| Ação | Papel | Justificação |
|---|---|---|
| **Novo** | `PHOTOGRAPHER` | Âmbito atribuído; ocupação e atribuição precisam de o distinguir |
| **Novo** | `VIDEOGRAPHER` | Idem |
| **Novo** | `CONTENT_MANAGER` | Assume o papel de conteúdo que o `EDITOR` tinha |
| **Redefinido** | `EDITOR` | Passa a editor de **pós-produção**, âmbito atribuído |
| **Ajustado** | `FINANCE_MANAGER` | Perde `org:read` e `booking:update` — "sem configurações" |
| **Ajustado** | `STAFF` | Perde `project:read`, ganha `client:read` 🔒 |

### Porque não bastaram concessões pontuais

Concessões são **aditivas** por desenho (ADR-008 §5). O que a operação exige é o contrário:
um conjunto **mais restrito** que o `STAFF` em algumas dimensões e mais amplo noutras.
Representar isso com concessões exigiria exceções negativas — precisamente o mecanismo que o
ADR-008 proibiu, por tornar impossível responder a *"quem pode ver dados financeiros?"* sem
inspecionar utilizador a utilizador.

Com papéis, a resposta é uma coluna da matriz. Com exceções negativas, seria uma auditoria.

### Porque `PHOTOGRAPHER` e `VIDEOGRAPHER` são papéis distintos com permissões idênticas

São, hoje, indistinguíveis em permissões. Mantêm-se separados porque:

1. A atribuição de trabalho precisa de saber que competência procura.
2. Os relatórios de ocupação por função dependem da distinção.
3. É provável que divirjam — gestão de equipamento de vídeo é o candidato óbvio.

**Compromisso:** se em seis meses continuarem idênticos, funde-se num único papel
`FIELD_OPERATOR`, com um ADR que substitua este. Manter dois papéis iguais indefinidamente é
dívida, não flexibilidade.

---

## A renomeação `EDITOR` → `CONTENT_MANAGER`

O termo "editor" num estúdio audiovisual significa editor de vídeo. Manter `EDITOR` como papel
de conteúdo do site seria uma armadilha permanente: a linguagem ubíqua do domínio
([domain-model §1](../00-foundation/domain-model.md)) diz uma coisa e o código diria outra.

**Custo assumido:** o termo `EDITOR` passa a ter dois significados no histórico do projeto.
Mitigação: nota permanente em `rbac.md §2` e em `rbac-policy-final.md`, e ordem de migração
definida — reclassificar utilizadores **antes** de aplicar a semântica nova.

Como não há ainda utilizadores em produção, o custo real é hoje zero. Adiar esta renomeação
para depois do VOL01 tornaria-a uma migração com risco.

---

## Consequências

**Positivas**
- Um operacional vê exclusivamente o trabalho que lhe foi atribuído — princípio do menor
  privilégio aplicado à realidade do estúdio.
- Cinco dos onze papéis não têm **nenhuma** permissão financeira, nem de leitura.
- Só dois papéis podem mover dinheiro: `OWNER` e `FINANCE_MANAGER`.
- A linguagem do sistema passa a coincidir com a linguagem do estúdio.

**Negativas / custos aceites**
- Superfície de teste: 11 × 73 = **803 células**. Mitigado por matriz gerada e testada por
  script; escrever isto à mão seria inviável e é precisamente o que o ADR-008 previa ao exigir
  cobertura de 100 % em `permissions.ts`.
- Dependência nova de schema: `ProjectAssignment`. Sem ela, `EDITOR` não tem critério de posse
  para "projetos atribuídos". É bloqueante, não opcional.
- Uma sessão sem responsável atribuído fica **invisível** para todos os operacionais. Exige
  alerta em `/admin/producao` para sessões por atribuir — caso contrário, o trabalho
  desaparece silenciosamente da vista de quem o devia executar.
- `Role` no enum do Prisma passa a ter 11 valores; `ALTER TYPE ... ADD VALUE` não é reversível
  numa migração simples em PostgreSQL.

---

## Critérios de revisão

Reavaliar se: `PHOTOGRAPHER` e `VIDEOGRAPHER` continuarem idênticos ao fim de 6 meses (fundir) ·
o número de papéis ultrapassar 12 (sinal de que o modelo de papéis está errado e o problema é
de atribuição, não de permissão) · as concessões pontuais passarem a ser regra.
