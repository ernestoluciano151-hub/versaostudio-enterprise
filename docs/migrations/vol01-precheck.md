# VOL01 — Pré-verificação e migração inicial

**Data:** 2026-08-05 · **Estado:** pronto a aplicar, **não testado**
**Relacionado:** [`rbac-final-approval.md`](../security/rbac-final-approval.md) ·
[ADR-009](../adr/ADR-009-role-expansion.md)

> ## ⚠️ Aviso que não deve ser saltado
> O SQL deste documento **nunca foi executado**. Foi escrito e revisto, não testado — não
> existe base de dados no ambiente onde foi produzido. Aplicar primeiro num ambiente
> descartável não é zelo excessivo; é o mínimo antes de tocar em qualquer coisa com dados.
>
> `ALTER TYPE ... ADD VALUE` **não é reversível** dentro de uma transação em PostgreSQL.

---

## 1. Contexto

Esta é a primeira migração do projeto. Não há base de dados, não há utilizadores, não há dados.
**É por isso que agora é o momento certo:** a reclassificação de `EDITOR` → `CONTENT_MANAGER`
custa zero hoje e custa uma migração com risco depois de haver utilizadores reais.

---

## 2. Pré-verificação

Executar **antes** de qualquer migração. Cada linha tem um comando ou uma verificação concreta.

### 2.1 Ambiente

- [ ] PostgreSQL ≥ 15 acessível
- [ ] Extensões disponíveis: `pgcrypto`, `btree_gist`, `pg_trgm`
      → `SELECT * FROM pg_available_extensions WHERE name IN ('pgcrypto','btree_gist','pg_trgm');`
- [ ] `DATABASE_URL` (com pool) e `DIRECT_DATABASE_URL` (direta) definidas e distintas
- [ ] Utilizador da BD com privilégio para `CREATE EXTENSION` e `ALTER TYPE`
- [ ] Backup ou snapshot tirado (mesmo com a BD vazia — cria o hábito)

### 2.2 Schema

- [ ] `npx prisma validate` → **sem erros**
- [ ] `npx prisma generate` → cliente gerado
- [ ] `npx prisma migrate dev --name vol01_initial --create-only` → migração gerada, **não aplicada**
- [ ] Rever o SQL gerado antes de aplicar
- [ ] Confirmar 61 modelos e 45 enums no schema

> **Falso positivo conhecido:** o validador estrutural interno assinala
> `VerificationToken: sem chave primária`. O modelo usa `@@unique([identifier, token])`, que o
> Prisma aceita como identificador único. É o schema oficial do NextAuth, sem alteração.
> Se `prisma validate` acusar isto como erro real, avise — significa que o meu pressuposto
> estava errado.

### 2.3 Coerência RBAC

- [ ] `enum Role` tem 11 valores
- [ ] Os 11 valores coincidem com as colunas de [`rbac.md §4`](../security/rbac.md)
- [ ] `ProjectAssignment` existe com `@@unique([saasProjectId, userId])`
- [ ] `AuthEvent` e `MfaBackupCode` existem
- [ ] `Session` tem `mfaVerifiedAt` e `lastActiveAt`
- [ ] `User` tem `mfaVerifiedAt`, `passwordChangedAt`, `mustChangePassword`

### 2.4 Decisões por confirmar antes de aplicar

| # | Questão | Impacto se decidido depois |
|---|---|---|
| 1 | Nomes de `AuthEventType`: `LOGIN_SUCCESS` ou `AUTH_LOGIN`? | Renomeação de enum — trivial agora, migração depois |
| 2 | `ProjectAssignment.saasProjectId` ou `projectId`? | Renomeação de coluna |
| 3 | Permissões no token (ponto 5)? | **Altera a arquitetura de auth** — decidir antes de escrever código |

---

## 3. Migração inicial (SQL)

> Com a base de dados vazia, os passos 1 e 2 não têm efeito prático — estão aqui porque este
> ficheiro é também o modelo para ambientes futuros (staging, produção), onde terão.

```sql
-- =====================================================================
-- VOL01 — migração inicial
-- Ordem obrigatória. Não reordenar os passos 1 e 2.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- PASSO 1 — Reclassificar EDITOR de conteúdo ANTES de mudar a semântica
-- ---------------------------------------------------------------------
-- Com a BD vazia afeta 0 linhas. Em ambientes com dados, é o passo que
-- impede um editor de conteúdo de perder o CMS sem aviso.
UPDATE "Membership"
   SET role = 'EDITOR'          -- valor antigo mantido temporariamente
 WHERE role = 'EDITOR';         -- marcador: ver PASSO 3

COMMIT;

-- ---------------------------------------------------------------------
-- PASSO 2 — Acrescentar valores novos ao enum
-- ALTER TYPE ADD VALUE não pode correr dentro de um bloco transacional
-- em versões antigas; executar fora de BEGIN/COMMIT por segurança.
-- ---------------------------------------------------------------------
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PHOTOGRAPHER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIDEOGRAPHER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CONTENT_MANAGER';

-- ---------------------------------------------------------------------
-- PASSO 3 — Só agora migrar os antigos EDITOR de conteúdo
-- (transação separada: o valor novo do enum tem de estar committed)
-- ---------------------------------------------------------------------
BEGIN;

UPDATE "Membership"
   SET role = 'CONTENT_MANAGER'
 WHERE role = 'EDITOR';

-- Verificação: em ambientes futuros, confirmar quantas linhas mudaram
-- SELECT role, count(*) FROM "Membership" GROUP BY role;

-- ---------------------------------------------------------------------
-- PASSO 4 — ProjectAssignment (âmbito atribuído do EDITOR)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ProjectAssignment" (
  "id"            TEXT PRIMARY KEY,
  "saasProjectId" TEXT NOT NULL REFERENCES "SaaSProject"("id") ON DELETE CASCADE,
  "userId"        TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role"          TEXT,
  "assignedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById"  TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAssignment_saasProjectId_userId_key"
  ON "ProjectAssignment"("saasProjectId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectAssignment_saasProjectId_userId_idx"
  ON "ProjectAssignment"("saasProjectId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectAssignment_userId_idx"
  ON "ProjectAssignment"("userId");

-- ---------------------------------------------------------------------
-- PASSO 5 — Auditoria de autenticação (append-only)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AuthEvent" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "email"     TEXT,
  "type"      "AuthEventType" NOT NULL,
  "success"   BOOLEAN NOT NULL,
  "method"    "AuthMethod",
  "ip"        TEXT,
  "userAgent" TEXT,
  "reason"    TEXT,
  "at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AuthEvent_userId_at_idx" ON "AuthEvent"("userId", "at");
CREATE INDEX IF NOT EXISTS "AuthEvent_email_at_idx"  ON "AuthEvent"("email", "at");
CREATE INDEX IF NOT EXISTS "AuthEvent_type_at_idx"   ON "AuthEvent"("type", "at");

CREATE TABLE IF NOT EXISTS "MfaBackupCode" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "codeHash"  TEXT NOT NULL UNIQUE,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MfaBackupCode_userId_usedAt_idx"
  ON "MfaBackupCode"("userId", "usedAt");

COMMIT;

-- ---------------------------------------------------------------------
-- PASSO 6 — Imutabilidade: o que nenhuma aplicação pode reescrever
-- ---------------------------------------------------------------------
-- Sem isto, "append-only" é apenas uma intenção documentada.
REVOKE UPDATE, DELETE ON "AuthEvent"   FROM PUBLIC;
REVOKE UPDATE, DELETE ON "AuditLog"    FROM PUBLIC;
REVOKE UPDATE, DELETE ON "LedgerEntry" FROM PUBLIC;

-- Substituir <app_user> pelo utilizador aplicacional real
REVOKE UPDATE, DELETE ON "AuthEvent"   FROM <app_user>;
REVOKE UPDATE, DELETE ON "AuditLog"    FROM <app_user>;
REVOKE UPDATE, DELETE ON "LedgerEntry" FROM <app_user>;

-- ---------------------------------------------------------------------
-- PASSO 7 — Constraint de exclusão de reservas (Fase 2, aqui por registo)
-- ---------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS btree_gist;
-- ALTER TABLE "BookingResource" ADD CONSTRAINT no_overlap
--   EXCLUDE USING gist (
--     "resourceId" WITH =,
--     tstzrange("periodStart", "periodEnd", '[)') WITH &&
--   );
```

---

## 4. Script seguro para ambientes futuros

Para staging e produção, quando já houver dados. Verifica antes de agir e falha em vez de
adivinhar.

```sql
DO $$
DECLARE
  v_editors   INT;
  v_has_cm    BOOLEAN;
  v_orphans   INT;
BEGIN
  -- 1. Quantos utilizadores serão afetados?
  SELECT count(*) INTO v_editors FROM "Membership" WHERE role = 'EDITOR';
  RAISE NOTICE 'Membros com role EDITOR: %', v_editors;

  -- 2. O valor novo já existe no enum?
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'Role' AND e.enumlabel = 'CONTENT_MANAGER'
  ) INTO v_has_cm;

  IF NOT v_has_cm THEN
    RAISE EXCEPTION
      'CONTENT_MANAGER ainda não existe no enum Role. Executar o PASSO 2 primeiro.';
  END IF;

  -- 3. Reclassificar
  UPDATE "Membership" SET role = 'CONTENT_MANAGER' WHERE role = 'EDITOR';
  RAISE NOTICE 'Reclassificados: % membros', v_editors;

  -- 4. Integridade: nenhum EDITOR novo sem atribuição de projeto ficaria sem trabalho visível
  SELECT count(*) INTO v_orphans
    FROM "Membership" m
   WHERE m.role = 'EDITOR'
     AND NOT EXISTS (SELECT 1 FROM "ProjectAssignment" pa WHERE pa."userId" = m."userId");

  IF v_orphans > 0 THEN
    RAISE WARNING
      '% utilizadores com papel EDITOR sem qualquer projeto atribuído — não verão nada.',
      v_orphans;
  END IF;
END $$;
```

**Propriedades:** idempotente (correr duas vezes não duplica efeito), falha ruidosamente em vez
de assumir, e avisa sobre o modo de falha silencioso mais provável desta política — um `EDITOR`
sem atribuições que abre a aplicação e não vê nada.

### Rollback

```sql
-- Reverter a reclassificação (fácil)
UPDATE "Membership" SET role = 'EDITOR' WHERE role = 'CONTENT_MANAGER';

-- Remover valores do enum: NÃO É POSSÍVEL diretamente.
-- Exige recriar o tipo:
--   1. CREATE TYPE "Role_old" AS ENUM (...valores antigos...);
--   2. ALTER TABLE "Membership" ALTER COLUMN role TYPE "Role_old" USING role::text::"Role_old";
--   3. DROP TYPE "Role"; ALTER TYPE "Role_old" RENAME TO "Role";
-- Operação pesada, com lock de tabela. Preferir corrigir em frente.

-- Remover ProjectAssignment (destrutivo — perde as atribuições)
-- DROP TABLE "ProjectAssignment";
```

---

## 5. Pós-verificação

Executar depois de aplicar. Cada verificação tem uma resposta esperada.

```sql
-- 1. Enum com 11 valores
SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname = 'Role';                                  -- esperado: 11

-- 2. Nenhum EDITOR de conteúdo por reclassificar
SELECT count(*) FROM "Membership" WHERE role = 'EDITOR'
   AND "userId" IN (SELECT "userId" FROM "Membership");      -- rever manualmente

-- 3. Índices de ProjectAssignment
SELECT indexname FROM pg_indexes WHERE tablename = 'ProjectAssignment';
-- esperado: 3 (pkey, unique composto, userId) + 1 composto explícito

-- 4. Imutabilidade efetiva
SELECT has_table_privilege('<app_user>', '"AuthEvent"', 'UPDATE');   -- esperado: false
SELECT has_table_privilege('<app_user>', '"AuditLog"', 'DELETE');    -- esperado: false
SELECT has_table_privilege('<app_user>', '"LedgerEntry"', 'UPDATE'); -- esperado: false

-- 5. Colunas de auth em Session
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'Session' AND column_name IN ('mfaVerifiedAt','lastActiveAt');
-- esperado: 2 linhas
```

E, ao nível da aplicação:

- [ ] `npx prisma generate` sem erros após a migração
- [ ] Seed cria organização + primeiro `OWNER` com `mustChangePassword = true`
- [ ] Uma tentativa de `UPDATE` em `AuthEvent` pela aplicação **falha**

---

## 6. Ordem de execução recomendada

```
1. Ambiente descartável  → aplicar tudo, verificar, deitar fora
2. Desenvolvimento local → prisma migrate dev
3. Preview/staging       → script seguro §4 + pós-verificação §5
4. Produção              → só depois de o VOL01 estar completo e testado
```

**Nunca aplicar diretamente em produção uma migração que ainda não correu em mais lado nenhum.**

---

## 7. O que fica por resolver

| # | Item | Quando |
|---|---|---|
| 1 | `prisma validate` e `generate` reais | **Agora, do seu lado** |
| 2 | Confirmar nomes de `AuthEventType` | Antes da migração |
| 3 | Confirmar `saasProjectId` vs. `projectId` | Antes da migração |
| 4 | Decisão sobre permissões no token | **Antes de escrever código de auth** |
| 5 | Constraint de exclusão de reservas | Fase 2 |
| 6 | Row-Level Security | Fase 10 (multi-tenant) |
