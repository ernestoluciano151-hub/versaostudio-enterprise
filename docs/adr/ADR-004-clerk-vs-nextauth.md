# ADR-004 — Autenticação: Clerk vs. NextAuth v5

- **Estado:** Aceite — **NextAuth v5 (Auth.js)**
- **Data:** 2026-08-05
- **Decisores:** Security Architect, Backend Lead, Fundador (custo)

---

## Contexto

O sistema tem três populações de utilizadores com requisitos distintos:

| População | Volume esperado (ano 1) | Requisitos |
|---|---|---|
| Staff (`/admin`) | 3–10 | MFA obrigatório, RBAC granular, sessões revogáveis |
| Clientes (`/cliente`) | 100–1 000 | Entrada simples, sem fricção; muitos são pouco técnicos |
| Visitantes | Ilimitado | Reserva **sem conta** (convidado) tem de funcionar |

Restrições relevantes:

- Dados pessoais de clientes angolanos, sujeitos à Lei n.º 22/11 (Proteção de Dados).
- Orçamento operacional contido; a receita é em AOA, os serviços cobram em USD.
- Muitos clientes usam WhatsApp como identidade prática, não e-mail.

---

## Opções

### Opção A — Clerk

**A favor:** UI pronta e polida; MFA, magic links e OAuth em minutos; gestão de sessões e
dispositivos incluída; menos código de segurança escrito por nós — logo, menos superfície para
errarmos.

**Contra:**
- **Custo por utilizador ativo mensal.** O modelo de preço escala com o sucesso do negócio.
  Com 1 000 clientes ativos, o custo torna-se material face à margem de um estúdio.
- **Dados de utilizador fora da nossa infraestrutura.** Nomes, e-mails e telefones de clientes
  angolanos passam a residir num terceiro estrangeiro. Isto tem de constar da política de
  privacidade e complica o cumprimento de pedidos de acesso e apagamento.
- **RBAC custom mais rígido.** Oito papéis com permissões granulares e verificação de posse
  por organização encaixa mal no modelo de metadata do Clerk.
- **Utilizador convidado.** Reservas sem conta obrigam a um caminho paralelo fora do Clerk —
  perde-se parte da simplicidade que justificava a escolha.
- **Dependência estratégica.** Migrar de Clerk mais tarde significa migrar palavras-passe que
  não temos.

### Opção B — NextAuth v5 (Auth.js) com sessões em base de dados

**A favor:**
- **Sem custo por utilizador.** O custo é o mesmo com 10 ou 10 000 clientes.
- **Dados de utilizador na nossa base de dados**, ao lado de `Client`, `Booking` e `Invoice`.
  Um pedido de apagamento resolve-se com uma transação, não com dois sistemas a sincronizar.
- **RBAC exatamente como o domínio precisa** — `Membership`, `Role`, `permissions[]`, e
  verificação de posse na mesma query.
- **Sessões em BD**: revogáveis instantaneamente, com IP e user-agent registados para auditoria.
- **Convidado é natural**: uma reserva sem conta é uma `Booking` com `guestEmail`, ligada mais
  tarde a um `User` quando o cliente criar conta.
- Modelos `Account`, `Session` e `VerificationToken` já estão no schema.

**Contra:**
- **Escrevemos código de segurança.** Hashing, política de palavras-passe, bloqueio por
  tentativas, recuperação, TOTP — tudo por nossa conta, e portanto por nossa responsabilidade.
- Sem UI pronta: ecrãs de login, registo e MFA a construir.
- Auth.js v5 teve alterações de API relevantes face à v4; documentação de terceiros
  desatualizada é uma fonte de erros.
- MFA (TOTP) não vem incluído — implementa-se com `otplib` e segredo encriptado at-rest.

---

## Decisão

**NextAuth v5 com sessões em base de dados.**

O fator determinante não foi o custo — foi a **soberania dos dados e o RBAC**. Um sistema que
guarda faturas, contratos e fotografias de clientes angolanos, e que tem de responder a pedidos
de acesso e apagamento ao abrigo da Lei n.º 22/11, fica materialmente mais simples com a
identidade na mesma base de dados que o resto do domínio.

O custo por MAU foi o segundo fator: um modelo de preço que cresce com o sucesso do negócio é
um imposto sobre a própria estratégia do produto.

### Implicações de implementação

| Item | Decisão |
|---|---|
| Hashing | `argon2id` (não bcrypt, não PBKDF2) |
| MFA | TOTP com `otplib`; segredo encriptado com `MFA_ENCRYPTION_KEY`; **obrigatório** para todos os papéis de `/admin` |
| Sessões | Em base de dados, `maxAge` 30 dias com rotação; revogação imediata possível |
| Cookies | `HttpOnly`, `Secure`, `SameSite=Lax`, prefixo `__Host-` |
| Clientes | Magic link por e-mail como método principal (menos fricção, menos palavras-passe esquecidas) |
| Staff | Palavra-passe + TOTP |
| Bloqueio | 5 tentativas falhadas → bloqueio progressivo; registado em `AuditLog` |
| Recuperação | Token de uso único, TTL 30 min, invalidado após uso |
| Convidado | `Booking.guestEmail` + token de reserva assinado; conversão em conta sem perder histórico |

---

## Consequências

**Positivas**
- Custo de autenticação constante e previsível.
- Apagamento de dados de um cliente é uma transação única.
- RBAC e verificação de posse na mesma query — sem sincronização entre sistemas.
- Auditoria de sessões completa (IP, user-agent, data) sem depender de terceiros.

**Negativas / custos aceites**
- ~1 semana adicional de desenvolvimento na Fase 0/3 para ecrãs e fluxos de auth.
- Responsabilidade nossa sobre a correção da implementação — mitigada por: revisão de segurança
  dedicada no checklist de produção, testes E2E de RBAC obrigatórios, e ZAP baseline em CI.
- Sem UI pronta para gestão de dispositivos; construir apenas se houver procura real.

**Risco aceite e como se mitiga**
Implementar autenticação mal é uma forma clássica de comprometer um sistema. Mitigação:
usar apenas primitivas da biblioteca (sem criptografia caseira), seguir a checklist OWASP ASVS
nível 2, e ter os testes de RBAC e IDOR a bloquear o merge.

---

## Critérios de revisão

Reavaliar esta decisão se: for necessário SSO empresarial (SAML) para um cliente grande ·
o esforço de manutenção de auth exceder claramente o custo do Clerk · surgir requisito de
verificação de identidade que não queiramos construir.
