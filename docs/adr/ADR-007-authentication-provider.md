# ADR-007 — Authentication Provider: estratégia de sessão e fatores

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Security Architect, Backend Lead, Frontend Lead
- **Contexto:** VOL01
- **Relação com [ADR-004](ADR-004-clerk-vs-nextauth.md):** ADR-004 escolheu **quem** fornece a
  autenticação (NextAuth v5 em vez de Clerk). Este ADR decide **como** — estratégia de sessão,
  fatores e tratamento de credenciais. Não substitui o ADR-004; completa-o.

---

## Contexto

O ADR-004 deixou três questões em aberto, que só se tornam decidíveis ao desenhar o VOL01:

1. Sessão em base de dados ou JWT?
2. Que fatores para cada população de utilizadores?
3. Como conciliar o Edge Runtime do middleware do Next com autenticação que precisa da base
   de dados?

---

## Decisão 1 — Sessão em base de dados, não JWT

**Escolhido:** `session: { strategy: 'database' }` no Auth.js v5, com a tabela `Session`.

| Critério | Sessão em BD | JWT |
|---|---|---|
| Revogação imediata | ✅ `DELETE` e acabou | ❌ Requer denylist — que é uma sessão em BD com passos extra |
| Mudança de papel com efeito imediato | ✅ | ❌ Só na renovação do token |
| Lista de sessões ativas para o utilizador | ✅ | ❌ |
| Auditoria de IP e user-agent por sessão | ✅ | ❌ |
| Elevação MFA no meio da sessão | ✅ Campo `mfaVerifiedAt` | ⚠️ Exige reemitir o token |
| Custo por pedido | ⚠️ 1 query | ✅ 0 queries |
| Funciona no Edge Runtime | ❌ | ✅ |

**O fator decisivo é a revogação.** Num sistema que lida com dinheiro e com ficheiros de
clientes, "esta sessão deixa de valer agora" tem de ser verdade agora — não daqui a 15
minutos, quando o token expirar. Um `FINANCE_MANAGER` despedido, um portátil roubado ou uma
sessão suspeita exigem corte imediato.

O custo — uma query por pedido autenticado — é mitigado com `select` mínimo, índice único em
`sessionToken` e cache em memória do processo com TTL de 30 s. A latência acrescentada é
tipicamente inferior a 2 ms.

---

## Decisão 2 — Fatores por população

| População | Primeiro fator | Segundo fator |
|---|---|---|
| Staff (`/admin`) | Palavra-passe (argon2id) | **TOTP obrigatório** + códigos de recuperação |
| Cliente (`/cliente`) | **Magic link** por e-mail | Opcional |
| Convidado | Token de reserva assinado | — |

**Magic link como método principal para clientes** e não palavra-passe. A população-alvo —
empresários e particulares angolanos que interagem sobretudo por WhatsApp — não gere
palavras-passe. A senha esquecida é a principal causa de abandono de portais deste tipo, e a
recuperação já depende, na prática, do acesso à caixa de correio. Usar o e-mail diretamente
elimina um passo sem baixar o nível real de segurança.

**TOTP e não SMS** como segundo fator: SMS é vulnerável a SIM swap, tem custo por mensagem e
fiabilidade de entrega irregular em Angola. TOTP funciona offline, é gratuito e é suportado
por qualquer app de autenticação.

**Sem WebAuthn/passkeys na fase 1.** Tecnicamente superior, mas o suporte em dispositivos
Android de gama média — a maioria do parque em Angola — ainda é irregular. Fica em aberto
para volume posterior; o schema não impede a adição.

**Sem login social.** Reduziria fricção, mas acrescenta dependência de terceiros e complica
a resposta a pedidos de apagamento de dados. `Account` já existe no schema, portanto a porta
fica aberta sem migração destrutiva.

---

## Decisão 3 — Autorização em três camadas

O middleware do Next corre no **Edge Runtime**: sem Prisma, sem `argon2`, sem acesso à base
de dados. Isto não é uma limitação contornável — é a natureza do runtime.

**Consequência aceite:** o middleware **não autoriza**. Verifica apenas se o cookie existe e
é estruturalmente válido, e redireciona quem não tem sessão. A autorização real acontece em
runtime Node, nos layouts e nos use cases.

```
1. Middleware (Edge)   → cookie presente e bem formado? rota exige sessão?
2. Layout / RSC (Node) → sessão válida em BD? papel adequado à área? MFA verificado?
3. Use case (Node)     → requirePermission(actor, permission) + filtro de posse na query
```

A alternativa — assinar um JWT curto com o papel só para o middleware conseguir decidir —
foi **rejeitada**: reintroduz o problema da revogação pela porta das traseiras e cria duas
fontes de verdade sobre quem é o utilizador.

**Risco explícito:** é fácil olhar para o middleware e concluir que a aplicação está
protegida. Não está. Por isso existe um teste dedicado que confirma que o middleware sozinho
não autoriza, e a regra está escrita em `CLAUDE.md`.

---

## Decisão 4 — Providers do Auth.js

| Provider | Uso |
|---|---|
| `Credentials` | Login de staff (palavra-passe + TOTP) |
| `Email` (magic link) | Login de cliente |
| `Google` / OAuth | **Não configurado** na fase 1 |

O provider `Credentials` do Auth.js não suporta nativamente sessão em base de dados. Contorna-se
criando a `Session` explicitamente no callback `signIn`, o que é um padrão conhecido e
documentado. É o único ponto de atrito da biblioteca neste desenho, e está isolado em
`infra/auth-config.ts`.

---

## Consequências

**Positivas**
- Revogação imediata de qualquer sessão.
- Mudança de papel com efeito no pedido seguinte.
- Lista de sessões ativas e auditoria completa por sessão.
- Elevação de MFA modelada como estado da sessão, não como token novo.
- Clientes entram sem gerir palavras-passe.

**Negativas / custos aceites**
- Uma query por pedido autenticado.
- Middleware limitado a redirecionar; a proteção real está noutro lado, e isso tem de estar
  bem documentado para não induzir em erro.
- Adaptação necessária ao `Credentials` provider para criar sessão em BD.
- Entregabilidade de e-mail passa a ser um requisito de segurança: sem SPF, DKIM e DMARC, os
  clientes não conseguem entrar. Verificar antes do primeiro teste real.

---

## Critérios de revisão

Reavaliar se: a query de sessão se tornar um gargalo mensurável (p95 acima do orçamento) ·
o suporte a passkeys em Android de gama média se generalizar · surgir requisito de SSO
empresarial · o volume de utilizadores tornar o cache de 30 s insuficiente.
