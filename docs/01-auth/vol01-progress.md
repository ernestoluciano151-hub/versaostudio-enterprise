# VOL01 — registo de progresso

**Última execução verificada:** 2026-08-05 · `typecheck` limpo · **11 ficheiros, 239 testes, 239 passaram**

> Este documento regista apenas o que foi **executado**. Não é o relatório de conclusão do
> VOL01 — esse vem no fim, com evidência completa e pedido formal de aprovação.

---

## 1. Estado por requisito da aprovação

| Requisito | Estado | Evidência |
|---|:--:|---|
| TOTP 2FA para staff | 🟡 domínio pronto | 27 testes, incluindo os 6 vetores oficiais da RFC 6238 |
| Cookies `HttpOnly` `Secure` | 🟡 definido | `__Host-` + `SameSite=Lax` em `route-policy.ts`; falta o handler que os emite |
| RBAC em middleware e API | 🟡 middleware e helpers prontos | 17 + 27 testes; **sem API routes ainda** |
| Auditoria imutável | 🟡 lógica pronta | 12 testes; `REVOKE UPDATE/DELETE` por aplicar (precisa de BD) |
| Sessões revogáveis | ✅ lógica verificada | 30 + 33 testes; revogação com efeito no pedido seguinte |
| Testes unitários do login | ✅ | 33 casos em `use-cases.test.ts` |
| Testes E2E do login | ❌ | Adiado até haver base de dados, por sua decisão |
| Documentação e ADRs | 🟡 | ADR-007 a 009 aprovados; faltam 4 documentos do P0-A1 |

**Nada está fechado.** Sete dos oito requisitos dependem da base de dados para passar de
"lógica verificada" a "sistema a funcionar".

---

## 2. O que existe em código

```
src/middleware.ts                    Camada 1 — Edge, não autoriza
src/lib/auth/
  permissions.ts                     73 permissões × 11 papéis (gerado do rbac.md)
  permissions.server.ts              requireAuth · requireRole · requireStaff
                                     requirePermission · requireFinancialAccess
  ownership.ts                       tenantScope · clientScope · scopeFor · assertScoped
  route-policy.ts                    classificação de rotas, forma do cookie, redirect seguro
  session.ts                         máquina de estados: criação, elevação, inatividade, revogação
  totp.ts                            RFC 6238 sobre node:crypto
  policies.ts                        palavras-passe, bloqueio, tokens, códigos de recuperação
  audit.ts                           19 tipos de evento + 5 métodos
  ports.ts                           interfaces que a infraestrutura implementará
  use-cases.ts                       login, TOTP, logout, revogação, mudança de senha, resolveActor
  test-doubles.ts                    repositórios em memória, relógio falso
  errors.ts  types.ts
src/app/                             layouts e páginas mínimas (esqueleto)
```

---

## 3. Distribuição dos 239 testes

| Suite | Testes |
|---|:--:|
| `use-cases.test.ts` | 33 |
| `session.test.ts` | 30 |
| `policies.test.ts` | 30 |
| `permissions.server.test.ts` | 27 |
| `totp.test.ts` | 27 |
| `route-policy.test.ts` | 26 |
| `client-isolation.test.ts` | 20 |
| `middleware.test.ts` | 17 |
| `permissions.matrix.test.ts` | 15 |
| `audit.test.ts` | 12 |
| `server-only.guard.test.ts` | 2 |

---

## 4. Erros reais encontrados e corrigidos

Registados porque a lista de correções é mais informativa do que a de sucessos.

| # | Erro | Onde estava a culpa |
|---|---|---|
| 1 | `server-only` rebentava 2 suites | Config de teste — resolvido com stub + guarda anti-remoção |
| 2 | `it.each` com `undefined` quebrava inferência | Teste |
| 3 | `playwright.config.ts` sem dependência | Config |
| 4 | `next build` sem `app/` | Faltavam páginas |
| 5 | Teste esperava `too_common` em senha de 11 caracteres | **Teste errado** — o código estava certo |
| 6 | `AuthEventInput` sem campo `method` (7 erros) | **Código errado** — usei o campo sem o declarar |

O erro nº 6 tinha consequência prática: sem `method`, a auditoria não distinguiria um login por
palavra-passe de um por magic link, nem TOTP de código de recuperação. Numa investigação de
incidente, é essa a distinção que interessa.

---

## 5. Limitações do que está verificado

| O que está provado | O que **não** está |
|---|---|
| Lógica de permissões, sessões, TOTP, políticas | Comportamento contra PostgreSQL real |
| Escopo de posse produz o `where` correto | Que o Prisma o aplica como esperado |
| Eventos têm os campos certos | Que ficam persistidos e imutáveis |
| Middleware redireciona e regista | Fluxo completo num browser |
| `FakeHasher` valida a lógica do fluxo | **Não é criptografia** — argon2 por instalar |

---

## 6. Caminho até fechar o VOL01

| # | Passo | Depende de |
|---|---|---|
| 1 | PostgreSQL (Docker, Neon ou Supabase) + `prisma migrate` | **Você** |
| 2 | `argon2` — validar compatibilidade com o runtime da Vercel | Passo 1 |
| 3 | Adapters Prisma dos 4 ports | Passo 1 |
| 4 | Testes de integração contra BD real | Passo 3 |
| 5 | `REVOKE UPDATE, DELETE` em `AuthEvent` e `AuditLog` | Passo 1 |
| 6 | NextAuth v5 + emissão real dos cookies | Passo 3 |
| 7 | UI: login cliente, login admin, desafio TOTP, perfil, sessões | Passo 6 |
| 8 | Magic link + Resend (SPF/DKIM/DMARC) | Domínio de envio |
| 9 | Seed: organização + primeiro `OWNER` | Passo 3 |
| 10 | E2E Playwright | Passos 7 e 9 |
| 11 | Os 4 documentos do P0-A1 + relatório de conclusão | Tudo acima |

**O passo 1 desbloqueia oito dos onze.** É a única dependência que não posso resolver.
