# P0-A1 Hardening — relatório executivo

**Data:** 2026-08-05
**Estado:** 🟡 **PARCIALMENTE CONCLUÍDO** — 3 de 5 tarefas fechadas, 4 de 5 gates verdes
**VOL01:** continua **BLOQUEADO**. Dois critérios de desbloqueio por cumprir.

---

## 1. Resultados dos quality gates — saída real

Executados por si em `~/Documents/GitHub_Versaodigital/versaostudio-enterprise`.

| Gate | Estado | Evidência |
|---|:--:|---|
| `npm run typecheck` | ✅ | Sem erros (2 corrigidos na primeira passagem) |
| `npm run test` | ✅ | **7 ficheiros · 117 testes · 117 passaram** · 3,83 s |
| `npm run build` | ✅ | Compilado em 6,5 s · 6 páginas estáticas · middleware 34,6 kB |
| `npm run lint` | ⚠️ | **Saída não observada** — o `next build` reporta *"Skipping linting"* porque o lint é gate próprio |
| `npm run test:e2e` | ❌ | **Não executável** — CDN de browsers do Playwright bloqueado; sem BD |

### Distribuição dos 117 testes

| Suite | Testes | Prova |
|---|:--:|---|
| `permissions.server.test.ts` | 27 | Separação financeira, MFA, concessões, âmbito atribuído |
| `route-policy.test.ts` | 26 | Classificação de rotas, forma do token, open-redirect |
| `client-isolation.test.ts` | 20 | **Cliente A não alcança dados de B**; tenant; downloads |
| `middleware.test.ts` | 17 | Redirects, cookies inválidos, auditoria, garantia anti-regressão |
| `permissions.matrix.test.ts` | 15 | **803 células** sincronizadas com `rbac.md` |
| `audit.test.ts` | 10 | Eventos exigidos, campos, redação de segredos |
| `server-only.guard.test.ts` | 2 | O import `server-only` não desapareceu |

### Duas correções necessárias na primeira execução

| Erro | Causa real | Correção |
|---|---|---|
| 2 suites falharam a carregar | `server-only` lança fora de um Server Component; em Vitest não há essa distinção | Alias para stub + `server-only.guard.test.ts` para que a substituição não esconda a remoção do import |
| `route-policy.test.ts:54` | `it.each` com `undefined` misturado com strings quebrava a inferência | Array tipado explicitamente, sem `as` |
| `playwright.config.ts:1` | `@playwright/test` não instalado | Excluído do `tsconfig` |
| `Couldn't find app directory` | Não existia nenhuma página | `layout.tsx` + `page.tsx` na raiz, `/admin` e `/cliente`, com `noindex` |

---

## 2. Estado das tarefas

| # | Tarefa | Estado |
|---|---|:--:|
| H-001 | Middleware server-side | ✅ implementado e testado (17 testes) |
| H-002 | `requirePermission()` centralizado | ✅ implementado e testado (27 testes) |
| H-003 | Isolamento CLIENT | ✅ testado (20 testes) |
| H-004 | E2E RBAC (Playwright) | ❌ **não escrito** |
| H-005 | Auditoria de autenticação | 🟡 eventos e campos implementados; persistência por ligar |

---

## 3. H-001 — Middleware

`src/middleware.ts` + `src/lib/auth/route-policy.ts`

**Decisão que difere do enunciado.** O H-001 pedia que o middleware extraísse `role` e
`permissions` do token. Conforme decidiu, mantém-se o **ADR-007**: o cookie transporta apenas
um identificador opaco de sessão. Papel e permissões são resolvidos no servidor, a cada
pedido, a partir de `Membership`. A revogação continua imediata.

Cumpre todos os restantes bullets do H-001: lê a sessão exclusivamente no servidor, nunca
confia em dados do cliente, protege `/admin/*` e `/cliente/*`, redireciona em segurança e
regista o acesso negado.

**Garantia anti-regressão:** um teste lê o próprio `middleware.ts` e falha se alguém lá
introduzir `ROLE_PERMISSIONS`, `requirePermission` ou nomes de papéis. Impede a erosão
silenciosa da decisão.

**Comportamento verificado**

- Rotas públicas passam sem cookie (5 casos)
- `/cliente/faturas` → 307 para `/entrar?callbackUrl=%2Fcliente%2Ffaturas`
- `/admin/financeiro` → 307 para `/admin/entrar`
- Cookie malformado tratado como ausente; tentativa de injeção rejeitada
- Cookie inválido é limpo na resposta
- `/administracao` e `/clientes-felizes` **não** são confundidas com áreas protegidas
- `//evil.example.com` como callback → reduzido a `/` (sem open redirect)

---

## 4. H-002 — Helpers centralizados

`src/lib/auth/permissions.server.ts` — `requireAuth`, `requireRole`, `requireStaff`,
`requirePermission`, `requireFinancialAccess`.

Todos **lançam**; nenhum devolve booleano. `if (can(...))` sem `else` é a falha aberta mais
comum nesta área, e o tipo `asserts actor is Actor` torna-a impossível.

**Separação financeira — verificada, não afirmada**

- 5 papéis operacionais × 11 permissões financeiras = **55 recusas**, todas testadas
- `ADMIN` recusado em `payment:override` (separação de funções)
- `FINANCE_MANAGER` recusado em `org:update` (financeiro sem configurações)
- Só `OWNER` e `FINANCE_MANAGER` passam em `payment:override`/`payment:refund` — asserção
  automática sobre os 11 papéis

**Sincronização com a documentação:** `permissions.ts` é gerado a partir da matriz do
`rbac.md`, e `permissions.matrix.test.ts` relê o documento e compara as **803 células**.
A promessa do ADR-008 deixou de ser intenção.

**Cobertura de rotas:** 0 de 0. Não existem API routes — a tabela de cobertura pedida no H-002
só faz sentido quando existirem endpoints, no VOL01.

---

## 5. H-003 — Isolamento de cliente

`src/lib/auth/ownership.ts` + 20 testes com base de dados falsa que **honra o `where`**, como
o Prisma faria.

| Prova | Resultado |
|---|:--:|
| A lê a própria fatura | ✅ |
| A **não** lê fatura de B | ✅ `NotFoundError` |
| B **não** lê fatura de A | ✅ |
| Devolve **404 e não 403** (403 confirmaria a existência) | ✅ |
| Mensagem de erro não revela nada | ✅ |
| A não alcança `org_2` mesmo com o mesmo `clientId` | ✅ |
| Query inclui sempre `organizationId` e `clientId` | ✅ |
| `CLIENT` sem `clientId` → escopo impossível, não escopo aberto | ✅ |
| Download bloqueado entre clientes | ✅ |
| `assertScoped` recusa query sem `organizationId` | ✅ |

**Limitação por dizer:** isto prova a **lógica de escopo**, não o Prisma real. A prova final
exige PostgreSQL e testes de integração — impossíveis neste ambiente. Row-Level Security
continua adiada para a Fase 10.

---

## 6. H-005 — Auditoria

19 tipos de evento em `src/lib/auth/audit.ts`, espelhados no `enum AuthEventType` do schema.
**`ACCESS_DENIED` foi acrescentado ao schema nesta sprint** — não existia.

| Pedido | No código |
|---|---|
| `AUTH_LOGIN` | `LOGIN_SUCCESS` (+ `LOGIN_FAILED`) |
| `AUTH_LOGOUT` | `LOGOUT` (+ `LOGOUT_ALL`) |
| `AUTH_2FA_ENABLED` | `MFA_ENABLED` (+ `MFA_DISABLED`, `MFA_VERIFIED`, `MFA_FAILED`) |
| `AUTH_SESSION_REVOKED` | `SESSION_REVOKED` |
| `AUTH_ACCESS_DENIED` | `ACCESS_DENIED` |

Campos verificados em execução real — extraído do `stderr` dos testes:

```json
{"level":"warn","msg":"auth.event","type":"ACCESS_DENIED","success":false,
 "userId":null,"email":null,"reason":"malformed_session_cookie",
 "ip":"10.0.0.1","userAgent":"vitest","at":"2026-08-05T06:27:59.628Z",
 "requestId":"bb0f0dec-7b32-431d-95f1-09a15bb6bfb3","path":"/admin","role":null}
```

`userId`, `role`, `ip`, `userAgent`, `timestamp` e `requestId` presentes. **Nenhum valor de
cookie** — verificado por teste dedicado.

**Por fazer:** a persistência em `AuthEvent`. O Edge Runtime não acede à base de dados, pelo
que o middleware emite log estruturado e a escrita real acontecerá no runtime Node, no VOL01.

---

## 7. O que falta

| # | Item | Bloqueia |
|---|---|---|
| 1 | **H-004** — cenários Playwright | Critério de desbloqueio |
| 2 | Confirmar `npm run lint` verde | Gate |
| 3 | Persistência de `AuthEvent` em BD | H-005 completo |
| 4 | `docs/security/rbac-implementation.md` | Documentação obrigatória |
| 5 | `docs/security/client-isolation.md` | Documentação obrigatória |
| 6 | `docs/security/middleware-auth-flow.md` + fluxograma | Documentação obrigatória |
| 7 | `docs/testing/rbac-e2e.md` | Documentação obrigatória |
| 8 | Tabela de cobertura de rotas | Só possível com API routes (VOL01) |

---

## 8. Critérios de desbloqueio do VOL01

- [x] **middleware server-side validado** — 17 testes verdes
- [x] **`requirePermission()` implementado** — 27 testes verdes
- [x] **isolamento CLIENT testado** — 20 testes verdes
- [ ] **testes E2E RBAC verdes** — não escritos; **não executáveis neste ambiente**
- [x] **build verde** — compilado, 6 páginas, middleware 34,6 kB

**3 de 5 cumpridos, 1 parcial (lint por confirmar), 1 por fazer.**

---

## 9. Decisão que lhe cabe

O E2E não pode ser executado por mim — o CDN de browsers do Playwright está bloqueado e não há
base de dados. Três caminhos:

1. **Escrevo os cenários e você executa-os** no seu ambiente, com seed e Postgres locais.
2. **Aceita os 117 testes unitários e de escopo** como prova suficiente para esta fase, e o
   E2E entra como primeiro item do VOL01 — quando existirem login e sessões reais para testar.
3. **Adia o desbloqueio** até haver ambiente com base de dados.

**A minha leitura:** a opção 2 é a mais honesta. Os cenários E2E que pediu — `CLIENT` → `/admin`,
`STAFF` → financeiro, `PHOTOGRAPHER` → projeto não atribuído — precisam de **autenticação real
com utilizadores de cada papel**, que é precisamente o que o VOL01 vai construir. Escrever
agora testes E2E contra páginas-esqueleto sem login produziria testes que passam sem provar
nada — pior do que não os ter.

Aguardo a sua decisão.
