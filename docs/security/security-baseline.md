# Security Baseline — VersaoStudio Enterprise

**Referência:** OWASP ASVS nível 2 · OWASP Top 10 2021 · Lei n.º 22/11 (Proteção de Dados, Angola)
**Regra de partida:** *fail-safe defaults* — na dúvida, negar.

---

## 1. Modelo de ameaça

| Ativo | Ameaça principal | Impacto |
|---|---|---|
| Pagamentos | Callback forjado; replay; manipulação de montante | Receita perdida, disputas |
| Dados de clientes | IDOR no portal; fuga de base de dados | Legal, reputacional |
| Ficheiros de clientes | Acesso não autorizado a galerias e vídeos | Contratual, reputacional |
| Contas de staff | Credenciais comprometidas → acesso total | Catastrófico |
| Faturação | Adulteração retroativa de registos | Legal, fiscal |
| Website | Defacement, injeção de conteúdo | Reputacional, SEO |

**Atacantes considerados:** oportunista automatizado (bots, credential stuffing, spam de
formulários) · concorrente ou terceiro a tentar aceder a trabalho de clientes · cliente
malicioso a tentar ver dados de outro cliente (IDOR) · insider com acesso de admin a tentar
alterar registos financeiros.

---

## 2. RBAC

### Papéis

| Papel | Alcance | MFA |
|---|---|---|
| `OWNER` | Tudo, incluindo definições da organização | **Obrigatório** |
| `ADMIN` | Tudo exceto destruição da organização | **Obrigatório** |
| `FINANCE_MANAGER` | Financeiro, faturas, reconciliação, reembolsos, overrides | **Obrigatório** |
| `PRODUCER` | Agenda, produção, entregas | **Obrigatório** |
| `EDITOR` | Conteúdo, SEO, marketing | **Obrigatório** |
| `SALES` | CRM, propostas | **Obrigatório** |
| `STAFF` | Leitura da agenda e das suas tarefas | **Obrigatório** |
| `CLIENT` | Apenas os seus próprios dados | Opcional |

**MFA é obrigatório para todo o acesso a `/admin`.** Um único papel de staff sem MFA anula
a proteção dos restantes.

### Matriz de permissões (excerto)

| Recurso | OWNER | ADMIN | FINANCE | PRODUCER | EDITOR | SALES | STAFF | CLIENT |
|---|---|---|---|---|---|---|---|---|
| Ver reservas | ✅ | ✅ | ✅ | ✅ | — | ✅ | próprias | próprias |
| Confirmar reserva | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Override de pagamento | ✅ | — | ✅ | — | — | — | — | — |
| Emitir/anular fatura | ✅ | ✅ | ✅ | — | — | — | — | — |
| Aprovar reembolso | ✅ | — | ✅ | — | — | — | — | — |
| Publicar entrega | ✅ | ✅ | — | ✅ | — | — | — | — |
| Descarregar ficheiros | ✅ | ✅ | — | ✅ | — | — | — | próprios |
| Publicar página | ✅ | ✅ | — | — | ✅ | — | — | — |
| Gerir utilizadores | ✅ | ✅ | — | — | — | — | — | — |
| Ver auditoria | ✅ | ✅ | ✅ | — | — | — | — | — |

### Dois princípios de implementação

1. **A permissão é resolvida no servidor.** A UI esconde o que o utilizador não pode fazer,
   mas esconder não é autorizar. Toda a ação é verificada no use case.
2. **Verificação de posse na query, não no controlador.**

```ts
// ERRADO — janela para IDOR
const booking = await db.booking.findUnique({ where: { id } });
if (booking.clientId !== session.clientId) throw new Forbidden();

// CORRETO — impossível devolver dados de outro cliente
const booking = await db.booking.findFirst({
  where: { id, clientId: session.clientId, organizationId: session.organizationId },
});
if (!booking) throw new NotFound(); // não revela existência
```

Teste automático obrigatório: para cada recurso do portal, um teste tenta aceder com a sessão
de outro cliente e **tem de falhar**. Bloqueia o merge.

---

## 3. Autenticação

Decisão em [ADR-004](../adr/ADR-004-clerk-vs-nextauth.md).

| Item | Regra |
|---|---|
| Hashing | `argon2id`, parâmetros ≥ OWASP (m=19 MiB, t=2, p=1) |
| Palavra-passe | Mínimo 12 caracteres; verificação contra listas de senhas comuns; sem regras de composição arbitrárias |
| Bloqueio | 5 falhas → bloqueio progressivo (1, 5, 15, 60 min); registado em `AuditLog` |
| Rate limit | 5 tentativas/min por IP; 10/h por conta |
| Recuperação | Token de uso único, TTL 30 min, invalidado após uso; resposta idêntica exista ou não a conta |
| Mudança de palavra-passe | Invalida todas as outras sessões |
| Clientes | Magic link por e-mail (menos fricção, menos senhas fracas) |

### TOTP (MFA)

- Algoritmo: TOTP, SHA-1, 6 dígitos, janela de 30 s, tolerância ±1 período
- Segredo encriptado at-rest com `MFA_ENCRYPTION_KEY` (AES-256-GCM)
- 10 códigos de recuperação de uso único, mostrados uma vez, guardados como hash
- Desativar MFA exige palavra-passe + código atual, e gera `AuditLog` de severidade `CRITICAL`
- Rate limit específico: 5 tentativas de código por 15 min

---

## 4. Sessões e cookies

| Item | Valor |
|---|---|
| Estratégia | Sessão em base de dados (não JWT) |
| Duração | 30 dias, com rotação a cada utilização |
| Sessão de admin | 8 horas de inatividade → expira |
| Revogação | Imediata (apagar registo); lista de sessões visível ao utilizador |
| Registo | IP e user-agent guardados por sessão, para auditoria |

```
Set-Cookie: __Host-versaostudio.session=<token>;
            Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000
```

Prefixo `__Host-`: impede que um subdomínio comprometido escreva o cookie de sessão.
Sessão em BD e não JWT: um JWT não se revoga; uma sessão revoga-se num `DELETE`.

---

## 5. Cabeçalhos HTTP

```ts
// next.config.ts
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
```

### CSP

```
default-src 'self';
script-src 'self' 'nonce-{RANDOM}' https://js.stripe.com;
style-src 'self' 'nonce-{RANDOM}' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https://*.r2.cloudflarestorage.com;
connect-src 'self' https://api.stripe.com https://*.sentry.io https://*.r2.cloudflarestorage.com;
frame-src https://js.stripe.com https://pagamentonline.emis.co.ao;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
upgrade-insecure-requests;
```

**`frame-src` restrito ao gateway EMIS e ao Stripe** — nenhum outro domínio pode ser embebido.
Nonce por pedido; `unsafe-inline` proibido. Reporting em modo `report-only` durante 2 semanas
antes de aplicar em produção.

---

## 6. Validação de entrada

- **Zod em todas as fronteiras**: body, query, params, headers relevantes, variáveis de ambiente
- Validação também na **saída** de API pública, para não vazar campos por acidente
- `any` proibido; `tsc --noEmit` strict tem de passar
- Sem SQL cru sem parametrização; `$queryRaw` isolado em `lib/db/queries/`
- Escapamento de HTML em conteúdo de utilizador; `dangerouslySetInnerHTML` só com sanitização
  explícita e revisão de PR
- Erros no formato RFC 9457, sem stack trace nem detalhes internos em produção

---

## 7. Uploads

| Controlo | Regra |
|---|---|
| Autorização | `presign` verifica sessão **e** posse do `Deliverable` |
| Tipo | Verificado por **magic bytes**, não por extensão nem `Content-Type` |
| Tamanho | Limite por tipo, imposto no servidor (`MAX_UPLOAD_SIZE_MB`) |
| Nome | Gerado (`storageKey`); nome original apenas como metadado |
| Destino | Bucket **privado**; sem acesso público direto |
| Integridade | Checksum SHA-256 verificado após upload |
| TTL | 15 min upload, 5 min download |
| Execução | Nenhum ficheiro carregado é servido do nosso domínio como HTML/JS |
| Auditoria | Todo o download escreve `FileAccessLog` |

Tipos permitidos: imagem (JPEG, PNG, WebP, AVIF, TIFF, RAW), vídeo (MP4, MOV, MKV), áudio
(WAV, MP3), documento (PDF, DOCX), design (PSD, AI, sob arquivo). Tudo o resto é rejeitado.

---

## 8. Pagamentos

Detalhe em [ADR-006](../adr/ADR-006-stripe-emis-hibrido.md). Controlos de segurança:

1. **Montante recalculado no servidor** a partir da `PriceList`. Nunca aceitar valor do cliente.
2. **Assinatura verificada** no webhook Stripe, com o corpo cru.
3. **Allowlist de IP** no callback EMIS, na WAF Cloudflare **e** na aplicação.
4. **Payload bruto registado** em `PaymentProviderEvent` antes de qualquer interpretação.
5. **Re-consulta obrigatória** ao provedor — nenhum estado muda por confiança no payload.
6. **Idempotência** em três níveis: `Idempotency-Key`, `providerEventId`, máquina de estados.
7. **Ledger append-only**; `REVOKE UPDATE, DELETE` ao nível da base de dados.
8. **Zero dados de cartão** no sistema. Stripe Elements e iframe EMIS. Âmbito PCI: SAQ-A.
9. **Override manual** exige `FINANCE_MANAGER`, justificação escrita e `AuditLog` `CRITICAL`.

---

## 9. Rate limiting e anti-abuso

| Endpoint | Limite |
|---|---|
| Login | 5/min por IP, 10/h por conta |
| Recuperação de senha | 3/h por e-mail |
| Código MFA | 5/15 min |
| Formulário de contacto | 3/h por IP + Turnstile |
| Criação de reserva | 5/h por IP |
| Iniciar pagamento | 10/h por conta |
| `presign` de upload | 100/h por conta |
| API geral | 100/min por IP |

Cloudflare Turnstile em todos os formulários públicos. Honeypot como segunda camada.
WAF da Cloudflare com regras geográficas e de reputação.

> **Nota sobre o site atual:** a chave pública do Web3Forms está embutida no HTML. Deve ser
> restringida ao domínio e ter captcha ativo até o backend próprio existir — ver
> [auditoria §6](../audit/current-site-audit.md).

---

## 10. Auditoria

Escrita obrigatória de `AuditLog` em: confirmação/cancelamento de reserva · qualquer mudança
de estado de pagamento · override manual · emissão/anulação de fatura · reembolso ·
publicação/despublicação de entrega · download de ficheiro · alteração de papel · alteração de
preços · publicação de página · login falhado e bloqueio de conta · ativação/desativação de MFA.

Campos: `actorId`, `actorType`, `action`, `entityType`, `entityId`, `before`, `after`,
`reason` (obrigatório em overrides), `ip`, `userAgent`, `requestId`, `severity`, `at`.

**`UPDATE` e `DELETE` revogados ao nível da base de dados.** Um administrador de aplicação
não consegue reescrever o passado.

Retenção: 7 anos para registos financeiros, 2 anos para os restantes.

---

## 11. Privacidade (Privacy by Design)

| Princípio | Aplicação |
|---|---|
| Minimização | Só se recolhe o necessário à prestação do serviço |
| Finalidade | Cada campo tem uma finalidade documentada |
| Retenção | `Deliverable.purgeAt` por contrato; purga automática e registada |
| Direitos do titular | `DataRequest` com prazo; exportação e apagamento operacionais |
| Transferência a terceiros | Stripe, EMIS, Resend, Cloudflare — declarados na política de privacidade |
| PII em logs | Redigida por omissão (`redact` no logger) |
| PII no Sentry | `sendDefaultPii: false` + `beforeSend` com scrubbing |
| Session Replay | `maskAllText: true`, `blockAllMedia: true` |

---

## 12. Gestão de segredos

Ver [environment-variables.md](../operations/environment-variables.md).
Regras: nenhum segredo em `NEXT_PUBLIC_*` · nenhum segredo commitado · `gitleaks` em CI e em
pre-commit · rotação documentada · acesso a variáveis de produção restrito e registado.

---

## 13. Segurança em CI

| Verificação | Bloqueia merge? |
|---|---|
| `npm audit` — severidade alta ou crítica | ✅ |
| `gitleaks` — segredos no diff e no histórico | ✅ |
| Teste de RBAC — todos os papéis | ✅ |
| Teste de IDOR — acesso cruzado entre clientes | ✅ |
| ZAP baseline — cabeçalhos e endpoints expostos | ✅ |
| Verificação de CSP em resposta | ✅ |
| Dependabot | Automático |

---

## 14. Resposta a incidentes

1. **Conter** — revogar credenciais, bloquear IPs, ativar modo de manutenção se necessário
2. **Avaliar** — que dados foram afetados, quantos titulares, durante quanto tempo
3. **Notificar** — titulares e autoridade quando exigido; clientes afetados sempre
4. **Corrigir** — causa raiz, não sintoma
5. **Documentar** — post-mortem sem culpabilização, com ações concretas e prazos

Contacto de segurança publicado em `/.well-known/security.txt`.
Prazo de resposta inicial a relato externo: 72 horas.

---

## 15. Revisão

Este baseline é revisto: a cada nova fase do roadmap · após qualquer incidente · pelo menos
uma vez por ano. Alterações exigem PR revisto e, se mudarem uma decisão estrutural, um ADR.
