# Autenticação — especificação técnica

Complementa [`security-baseline.md`](security-baseline.md) com o detalhe de implementação do
VOL01. Decisão em [ADR-007](../adr/ADR-007-authentication-provider.md).

---

## 1. Métodos por população

| População | Método principal | Segundo fator | Alternativa |
|---|---|---|---|
| Staff (`/admin`) | Palavra-passe | **TOTP obrigatório** | Códigos de recuperação |
| Cliente (`/cliente`) | Magic link por e-mail | Opcional | Palavra-passe, se definida |
| Convidado | Token de reserva assinado | — | — |

**Porquê magic link para clientes:** a população-alvo não gere palavras-passe. Um link no
e-mail elimina a senha esquecida — a causa nº 1 de abandono do portal — sem baixar o nível
de segurança, porque o controlo da caixa de correio é o mesmo fator que a recuperação usaria.

---

## 2. Palavras-passe

### Hashing

```
Algoritmo:  argon2id
Memória:    19 MiB (19456 KiB)
Iterações:  2
Paralelismo: 1
Salt:       16 bytes aleatórios (gerado pela biblioteca)
Saída:      32 bytes
```

Parâmetros conforme a recomendação OWASP para argon2id. **Nunca** bcrypt, nunca SHA sem KDF,
nunca criptografia própria.

Se `argon2` não compilar no runtime da Vercel, a alternativa aprovada é `@node-rs/argon2`
(bindings Rust, sem `node-gyp`), com os mesmos parâmetros.

### Política

| Regra | Valor |
|---|---|
| Comprimento mínimo | 12 caracteres |
| Comprimento máximo | 128 (evita DoS por hashing de entradas enormes) |
| Composição obrigatória | **Nenhuma** — regras de composição produzem `Password1!` |
| Lista de senhas comuns | Verificação contra as 10 000 mais usadas |
| Reutilização | Não pode ser igual à atual |
| Expiração periódica | **Não existe** — rotação forçada piora a qualidade das senhas |
| Indicação de força | zxcvbn no cliente, apenas informativa |

### Verificação em tempo constante

O login executa sempre um hash, mesmo quando o e-mail não existe, comparando contra um hash
fictício. Sem isto, a diferença de tempo de resposta revela que contas existem.

```ts
const user = await users.findByEmail(email);
const hash = user?.passwordHash ?? DUMMY_HASH;   // hash pré-computado
const valid = await hasher.verify(hash, password);
if (!user || !valid) {
  await recordFailure({ email, ip });
  throw new InvalidCredentialsError();            // mensagem idêntica em ambos os casos
}
```

### Limitação conhecida da lista de senhas comuns

A verificação é por **correspondência exata**. Consequência real, exposta por um teste:
quem escrever `password123` recebe `too_short` (11 caracteres) e a reação natural é acrescentar
um dígito — `password12345` passa em todas as verificações e continua fraca.

Mitigação prevista antes do go-live: lista das 10 000 senhas mais usadas carregada de ficheiro,
com normalização (minúsculas, remoção de dígitos finais e de substituições comuns como `@`→`a`).
A implementação atual usa uma amostra de 10 entradas — suficiente para validar a mecânica,
insuficiente para produção.

---

## 3. TOTP (segundo fator)

| Parâmetro | Valor |
|---|---|
| Algoritmo | TOTP (RFC 6238), HMAC-SHA1 |
| Dígitos | 6 |
| Período | 30 s |
| Janela de tolerância | ±1 período (aceita ±30 s de desvio de relógio) |
| Emissor no QR | `Versao Digital` |
| Biblioteca | `otplib` |

**SHA-1 é a escolha correta aqui**, apesar de parecer o contrário: é o que o Google
Authenticator, o Authy e a esmagadora maioria das apps suportam. SHA-256 partiria a
compatibilidade sem ganho prático de segurança neste uso.

### Armazenamento do segredo

`User.mfaSecret` guarda o segredo **encriptado com AES-256-GCM**, usando `MFA_ENCRYPTION_KEY`.
Não é hash — precisamos do valor original para verificar. Consequência: perder essa chave
significa que ninguém consegue verificar TOTP. Ver risco A5 em [VOL01 §8](../01-auth/README.md).

### Ativação

```
1. Gerar segredo → guardar como "pendente" (não ativo)
2. Mostrar QR + segredo em texto (para introdução manual)
3. Exigir um código válido para confirmar → só então mfaEnabled = true
4. Gerar 10 códigos de recuperação, mostrar UMA vez, guardar como hash argon2id
5. AuthEvent(MFA_ENABLED) + AuditLog(severity CRITICAL)
```

Nunca ativar MFA sem confirmação de um código — caso contrário, um QR mal lido tranca o
utilizador para fora da própria conta.

### Verificação

- Comparação em tempo constante
- Rate limit: 5 tentativas por 15 min; excedido → bloqueio temporário + `AuthEvent(MFA_FAILED)`
- Código já usado no mesmo período é rejeitado (previne replay dentro dos 30 s)
- Sucesso: `Session.mfaVerifiedAt = now` **e rotação do token de sessão**

### Códigos de recuperação

10 códigos de 10 caracteres, uso único, hash argon2id. Ao usar um: marca `usedAt`, regista
`AuthEvent(BACKUP_CODE_USED)` e avisa por e-mail. Restando menos de 3, a UI insiste na
regeneração.

### Desativação

Exige palavra-passe atual **e** código TOTP válido. Regista `AuditLog` com severidade
`CRITICAL`. Um `OWNER` pode repor o MFA de outro utilizador — com justificação obrigatória
e auditoria.

---

## 4. Sessões

### Modelo

Sessão em base de dados (não JWT). Justificação em
[ADR-007](../adr/ADR-007-authentication-provider.md).

| Campo | Uso |
|---|---|
| `sessionToken` | 32 bytes aleatórios, base64url; **único e indexado** |
| `expires` | Expiração absoluta |
| `lastActiveAt` | Expiração por inatividade |
| `mfaVerifiedAt` | `null` = sessão não elevada; bloqueia `/admin` |
| `ip`, `userAgent` | Auditoria e lista de sessões do utilizador |

### Duração

| Contexto | Absoluta | Inatividade |
|---|---|---|
| Cliente | 30 dias | 30 dias |
| Staff | 12 horas | **8 horas** |
| Sessão não elevada (pré-MFA) | 10 minutos | — |

### Rotação do token

Obrigatória em: login bem-sucedido · verificação de MFA · alteração de palavra-passe.
Impede fixação de sessão.

### Invalidação

| Evento | Efeito |
|---|---|
| Logout | Apaga a sessão atual |
| Logout global | Apaga todas as sessões do utilizador |
| Alteração de palavra-passe | Apaga todas **exceto** a atual |
| Reset de palavra-passe | Apaga **todas**, incluindo a atual |
| Desativação de MFA | Apaga todas exceto a atual |
| Mudança de papel | Apaga todas as sessões desse utilizador |
| Revogação manual | Apaga a sessão escolhida |
| Conta bloqueada ou desativada | Apaga todas |

Um `DELETE` em `Session` tem efeito no pedido imediatamente seguinte. É esta a razão pela
qual não usamos JWT.

### Desempenho

Uma query por pedido autenticado. Mitigações: `select` apenas dos campos necessários, índice
único em `sessionToken`, cache em memória do processo com TTL de 30 s (não partilhada entre
instâncias — uma revogação demora no máximo 30 s a propagar em todas; aceitável, e
configurável para 0 em rotas financeiras).

---

## 5. Cookies

```
Set-Cookie: __Host-versaostudio.session=<token>;
            Path=/;
            Secure;
            HttpOnly;
            SameSite=Lax;
            Max-Age=<conforme contexto>
```

| Atributo | Porquê |
|---|---|
| `__Host-` | Impede que um subdomínio comprometido escreva o cookie de sessão |
| `HttpOnly` | JavaScript não lê o cookie — XSS não rouba a sessão |
| `Secure` | Só HTTPS |
| `SameSite=Lax` | Bloqueia CSRF em POST cross-site, mantendo navegação normal |
| Sem `Domain` | Restringe ao host exato |

`SameSite=Strict` foi considerado e rejeitado: quebra o retorno do magic link a partir do
cliente de e-mail, que é precisamente o fluxo principal dos clientes.

---

## 6. Recuperação de palavra-passe

```
1. POST /recuperar { email }
   → resposta SEMPRE: "Se existir uma conta com este e-mail, enviámos um link."
   → mesmo tempo de resposta exista ou não a conta
2. Se existir:
   token = 32 bytes aleatórios
   guarda-se SHA-256(token) na BD, nunca o token
   TTL 30 min, uso único
   e-mail com https://…/redefinir/<token>
3. GET /redefinir/[token] → valida sem consumir
4. POST → nova palavra-passe → consome o token →
   REVOGA TODAS AS SESSÕES → AuthEvent(PASSWORD_RESET) →
   e-mail de notificação ao titular
```

Rate limit: 3/h por e-mail, 10/h por IP.
O e-mail de notificação é a defesa que permite ao titular reagir a um reset que não pediu.

---

## 7. Magic link

```
1. POST /entrar { email } → resposta genérica idêntica
2. Token: 32 bytes, hash na BD, TTL 15 min, uso único
3. Clique → valida → cria sessão → invalida token → AuthEvent(MAGIC_LINK_USED)
4. Rate limit: 3/h por e-mail
```

O TTL é curto (15 min) porque o e-mail é o canal e permanece no histórico da caixa de correio.

**Entregabilidade é requisito de segurança, não só de UX:** sem SPF, DKIM e DMARC
verificados, os links vão para spam e os clientes ficam sem forma de entrar. Verificar
**antes** do primeiro teste real.

---

## 8. Bloqueio de conta

| Falhas consecutivas | Bloqueio |
|---|---|
| 1–4 | Nenhum |
| 5 | 1 minuto |
| 6 | 5 minutos |
| 7 | 15 minutos |
| 8+ | 60 minutos |

- Contador reposto em login bem-sucedido.
- Bloqueio aplicado por **IP + conta**, não só por conta — caso contrário, um atacante bloqueia
  a conta de qualquer pessoa à vontade (DoS dirigido).
- O titular é notificado por e-mail ao 5.º falhanço.
- Um `OWNER` pode desbloquear, com registo em auditoria.
- Cada falha escreve `AuthEvent(LOGIN_FAILED)` com `reason`, IP e user-agent.

---

## 9. Rate limiting

| Endpoint | Por IP | Por conta |
|---|---|---|
| `POST /api/auth/login` | 10/min | 5/min |
| `POST /api/auth/magic-link` | 10/h | 3/h |
| `POST /api/auth/recuperar` | 10/h | 3/h |
| `POST /api/auth/redefinir` | 10/h | — |
| `POST /api/auth/mfa/verify` | 20/15 min | 5/15 min |
| `POST /api/auth/mfa/enable` | — | 5/h |

Implementação: Upstash Redis quando configurado; degradação para memória do processo em
desenvolvimento. Cloudflare Turnstile no formulário de login público após 3 falhas.

---

## 10. Auditoria de autenticação

`AuthEvent` é **append-only**: `REVOKE UPDATE, DELETE` na migração inicial.

Registam-se: login com sucesso e falha · logout e logout global · verificação e falha de MFA ·
ativação e desativação de MFA · pedido e conclusão de reset · alteração de palavra-passe ·
bloqueio e desbloqueio · revogação de sessão · envio e uso de magic link · uso de código de
recuperação · mudança de papel.

Campos: `userId` (ou `email` quando a conta não existe), `type`, `success`, `method`, `ip`,
`userAgent`, `reason`, `at`.

**Nunca registado:** palavra-passe, hash, segredo TOTP, código TOTP, token de sessão, token de
reset.

Retenção: 2 anos. Consultável em `/admin/auditoria` por `OWNER`, `ADMIN` e `FINANCE_MANAGER`;
o próprio utilizador vê os seus eventos no perfil.

---

## 11. Onboarding

```
Seed inicial:
  Organization("Versão Digital") + User(OWNER) com palavra-passe temporária
  mustChangePassword = true

Primeiro login do OWNER:
  1. Alteração obrigatória de palavra-passe
  2. Configuração obrigatória de TOTP
  3. Só então acede a /admin

Convite de membro:
  OWNER/ADMIN cria Invitation(email, role), TTL 7 dias, token com hash
  Aceitação → cria User + Membership → força definição de senha e TOTP
  Convite não aceite pode ser revogado; expirado não é reutilizável
```

---

## 12. Checklist de verificação (OWASP ASVS L2, secção de autenticação)

- [ ] Palavras-passe com argon2id e parâmetros OWASP
- [ ] Mínimo 12 caracteres, sem regras de composição, sem expiração forçada
- [ ] Verificação contra lista de senhas comuns
- [ ] Resposta e tempo idênticos para conta existente e inexistente
- [ ] Bloqueio progressivo por IP+conta com notificação ao titular
- [ ] MFA obrigatório para todo o acesso administrativo
- [ ] Segredo TOTP encriptado at-rest
- [ ] Códigos de recuperação de uso único, guardados como hash
- [ ] Token de sessão com ≥ 128 bits de entropia
- [ ] Rotação de token em login, MFA e mudança de palavra-passe
- [ ] Sessão revogável com efeito imediato
- [ ] Cookies `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] Tokens de reset e magic link de uso único, com hash e TTL curto
- [ ] Reset de palavra-passe revoga todas as sessões
- [ ] Notificação por e-mail em alterações sensíveis
- [ ] Rate limiting em todos os endpoints de autenticação
- [ ] Eventos de autenticação registados e imutáveis
- [ ] Nenhum segredo em logs, Sentry ou mensagens de erro
