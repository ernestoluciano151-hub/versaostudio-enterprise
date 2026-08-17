# ADR-003 — Prisma + PostgreSQL

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Backend Lead, Chief Software Architect
- **Relacionado:** [ADR-001](ADR-001-stack.md), [ADR-006](ADR-006-stripe-emis-hibrido.md)

---

## Contexto

O sistema tem de garantir três coisas que a maioria das aplicações não precisa de garantir:

1. **Dinheiro correto.** Um pagamento capturado tem de gerar exatamente uma entrada no ledger
   e confirmar exatamente uma reserva — mesmo com callback duplicado e cron a correr em
   simultâneo.
2. **Zero sobreposição de reservas.** Duas reservas confirmadas não podem ocupar o mesmo
   fotógrafo à mesma hora. Um bug aqui significa uma equipa em dois sítios ao mesmo tempo.
3. **Auditoria imutável.** Registos financeiros que ninguém pode alterar retroativamente,
   incluindo quem tem acesso de administrador à aplicação.

---

## Decisão

**PostgreSQL** como base de dados e **Prisma** como ORM e ferramenta de migrações.

### Porquê PostgreSQL, concretamente

| Necessidade | Recurso do PostgreSQL |
|---|---|
| Transações financeiras | ACID real, `SERIALIZABLE`, `SELECT ... FOR UPDATE` |
| Impedir sobreposição de reservas | **Constraint de exclusão** com `btree_gist` sobre `tstzrange` |
| Ledger imutável | `REVOKE UPDATE, DELETE` ao nível da base de dados |
| Metadados flexíveis | `JSONB` com índices GIN |
| Pesquisa de clientes e leads | `pg_trgm` para pesquisa aproximada |
| Identificadores opacos | `pgcrypto` |
| Recuperação | PITR nos serviços geridos |

A constraint de exclusão é a razão mais forte. Escrita assim:

```sql
ALTER TABLE "BookingResource"
  ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("periodStart", "periodEnd", '[)') WITH &&
  ) WHERE (status = 'CONFIRMED');
```

Nenhuma condição de corrida na aplicação consegue criar uma sobreposição. A base de dados
recusa. Isto não se replica com lógica em TypeScript — em concorrência, verificar-e-inserir
tem sempre uma janela.

### Porquê Prisma

- Migrações versionadas e revisíveis em PR
- Tipos gerados a partir do schema: o modelo de dados é Single Source of Truth
- API de transações interativas (`$transaction` com `isolationLevel`)
- Suporte a extensões PostgreSQL via `previewFeatures`
- Curva de entrada baixa — relevante para uma equipa pequena e para quem vier a seguir

### O que Prisma **não** faz, e como se resolve

| Limitação | Solução |
|---|---|
| Não gera constraints de exclusão | Migração SQL manual (`prisma migrate dev --create-only`) |
| Não revoga permissões | Migração SQL manual para o ledger e a auditoria |
| Queries analíticas complexas ficam pesadas | `$queryRaw` **parametrizado**, isolado em `lib/db/queries/` |
| `$queryRaw` perde tipagem | Tipo de retorno declarado explicitamente + teste de integração |

---

## Alternativas consideradas

| Alternativa | Avaliação |
|---|---|
| **Drizzle ORM** | SQL-first, mais leve, melhor para queries complexas. Rejeitado nesta fase: migrações e ferramentas menos maduras, e a equipa é uma pessoa. Reavaliar se o volume de SQL cru crescer muito. |
| **Kysely** | Excelente segurança de tipos em queries. Não resolve migrações — precisaria de outra ferramenta ao lado. |
| **TypeORM** | Histórico de bugs em migrações e API inconsistente. |
| **SQL puro + node-postgres** | Máximo controlo, custo de manutenção alto. Sem geração de tipos, tudo verificado à mão. |
| **MySQL / PlanetScale** | Sem constraints de exclusão, sem `tstzrange`. O problema nº 2 ficaria por resolver. |
| **MongoDB** | Sem garantias transacionais adequadas ao ledger. Descartado sem discussão. |
| **Supabase (Postgres gerido + auth + storage)** | Postgres é o mesmo; o acoplamento das três camadas ao mesmo fornecedor é que foi rejeitado. Usar Postgres gerido "simples" mantém a portabilidade. |

---

## Consequências

**Positivas**
- Invariantes críticas garantidas pela base de dados, não pela boa vontade do código.
- Uma transação atravessa domínios: confirmar reserva + criar ledger + marcar fatura, atómico.
- Tipos gerados eliminam uma classe inteira de erros de acesso a dados.
- Portabilidade: qualquer Postgres gerido serve (Neon, Supabase, RDS, Railway).

**Negativas / custos aceites**
- Prisma adiciona uma camada de abstração e algum overhead em queries muito complexas.
- Constraints e permissões exigem migrações SQL escritas à mão — que têm de ser testadas.
- Serverless + Postgres exige *connection pooling* (PgBouncer); daí as duas URLs
  (`DATABASE_URL` com pool, `DIRECT_DATABASE_URL` para migrações).
- O binário do engine Prisma aumenta o tamanho do bundle da função serverless.

---

## Regras que decorrem desta decisão

1. Todo o campo monetário é `Int` (menor unidade) + `currency`. `Float` proibido.
2. `LedgerEntry` e `AuditLog`: `REVOKE UPDATE, DELETE` na migração inicial.
3. Migrações são **expand/contract** — nunca `DROP` no mesmo deploy que deixa de usar a coluna.
4. Toda a migração é testada numa cópia de produção antes de ser aplicada.
5. `$queryRaw` só em `lib/db/queries/`, sempre parametrizado, sempre com teste de integração.
6. Índices são explícitos no schema; nenhuma query frequente sem índice verificado com
   `EXPLAIN ANALYZE`.
7. Testes de integração correm contra PostgreSQL real em contentor, nunca SQLite.

---

## Critérios de revisão

Reavaliar se: o volume de SQL cru ultrapassar ~30 % do acesso a dados · o tamanho do bundle
serverless se tornar limitante · surgir necessidade de réplicas de leitura com routing
automático que o Prisma não suporte bem.
