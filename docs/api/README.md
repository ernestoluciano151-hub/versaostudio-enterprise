# Contratos de API

**Convenções transversais** aplicáveis a todas as rotas.

---

## 1. Regras gerais

| Regra | Detalhe |
|---|---|
| Validação | Zod à entrada **e** à saída |
| Erros | RFC 9457 (`application/problem+json`) |
| Idempotência | `Idempotency-Key` obrigatório em `POST` que mexe em dinheiro ou reservas |
| Correlação | `X-Request-Id` aceite e ecoado; gerado se ausente |
| Paginação | Cursor (`?cursor=&limit=`), máximo 100 |
| Datas | ISO 8601 em UTC; a UI converte para `Africa/Luanda` |
| Dinheiro | `{ amountMinor: number, currency: "AOA" }` — nunca decimal |
| Versionamento | Sem prefixo de versão na fase 1 (API interna). Mudança incompatível = nova rota |

### Formato de erro

```json
{
  "type": "https://versaodigitallda.com/errors/booking-slot-unavailable",
  "title": "Horário indisponível",
  "status": 409,
  "detail": "O horário selecionado já não está disponível.",
  "instance": "/api/bookings",
  "requestId": "req_01J8X…"
}
```

Sem stack traces. Sem nomes de tabelas. Sem detalhes internos em produção.

### Códigos usados

`200` OK · `201` Criado · `202` Aceite (processamento assíncrono) · `400` Entrada inválida ·
`401` Não autenticado · `403` Sem permissão · `404` Não encontrado (**também** quando existe
mas não é do utilizador — não revelar existência) · `409` Conflito de estado ·
`422` Regra de negócio violada · `429` Rate limit · `500` Erro interno · `503` Dependência
indisponível

---

## 2. Reservas

### `GET /api/bookings/availability`
Público · cache 60 s · rate limit 60/min

```
?serviceId=svc_…&from=2026-09-01&to=2026-09-30
→ 200 { "slots": [{ "start": "…Z", "end": "…Z", "resourceIds": ["res_…"] }] }
```

### `POST /api/bookings`
Público (convidado) ou autenticado · **`Idempotency-Key` obrigatório** · rate limit 5/h por IP

```json
{
  "serviceId": "svc_…",
  "start": "2026-09-15T09:00:00Z",
  "items": [{ "serviceId": "svc_…", "quantity": 1 }],
  "guest": { "name": "…", "email": "…", "phone": "+244…" },
  "notes": "…",
  "turnstileToken": "…"
}
→ 201 {
  "id": "bkg_…", "reference": "VD-2026-00123", "status": "PENDING",
  "total": { "amountMinor": 15000000, "currency": "AOA" },
  "deposit": { "amountMinor": 7500000, "currency": "AOA" },
  "holdExpiresAt": "2026-08-05T15:02:00Z"
}
```

**O montante é sempre recalculado no servidor.** Qualquer valor enviado pelo cliente é ignorado.
`409` se o slot foi tomado entretanto.

### `POST /api/bookings/{id}/cancel`
Autenticado · aplica a política de cancelamento vigente · gera nota de crédito se devido

---

## 3. Pagamentos

### `POST /api/payments/stripe/intent`
Sessão ou token de reserva · `Idempotency-Key` obrigatório

```json
{ "bookingId": "bkg_…", "amountType": "DEPOSIT" }
→ 200 { "clientSecret": "pi_…_secret_…", "paymentId": "pay_…" }
```

### `POST /api/payments/stripe/webhook`
Assinatura Stripe · corpo **cru** · dedupe por `event.id`
Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`,
`charge.dispute.created`

### `POST /api/payments/emis/frame-token`
Sessão ou token de reserva · `Idempotency-Key` obrigatório

```json
{ "bookingId": "bkg_…", "method": "MULTICAIXA_EXPRESS", "amountType": "DEPOSIT" }
→ 200 { "frameUrl": "https://pagamentonline.emis.co.ao/…", "paymentId": "pay_…",
        "reference": "…", "expiresAt": "…Z" }
```

Nunca devolve credenciais nem o token de comerciante.

### `POST /api/payments/emis/callback`
Allowlist de IP (WAF + aplicação) · payload bruto registado antes de interpretar ·
**re-consulta obrigatória ao GPO** · devolve sempre `200` após registar, para o provedor não
repetir indefinidamente.

### `POST /api/cron/reconcile-payments`
`Authorization: Bearer ${CRON_SECRET}` · a cada 5 min · verifica pendentes < 24 h
(referências até `expiresAt`)

---

## 4. Ficheiros

### `POST /api/files/presign`
Sessão + verificação de posse do `Deliverable`

```json
{ "deliverableId": "dlv_…", "fileName": "sessao-001.cr3",
  "mimeType": "image/x-canon-cr3", "sizeBytes": 32000000 }
→ 200 { "uploadUrl": "https://…r2…?X-Amz-Signature=…",
        "storageKey": "org_…/dlv_…/f_…", "expiresAt": "…Z" }
```

Rejeita: tipo não permitido · tamanho acima do limite · sem posse.

### `POST /api/files/confirm`
Confirma checksum SHA-256, cria `FileObject`, escreve `AuditLog`.

### `GET /api/files/{id}/download`
Verificação de posse → URL assinada (TTL 5 min) → `302` → escreve `FileAccessLog`.

---

## 5. CRM e marketing

### `POST /api/crm/leads`
Público · honeypot + Turnstile · rate limit 3/h por IP

```json
{ "name": "…", "email": "…", "phone": "+244…", "subject": "…", "message": "…",
  "utm": { "source": "instagram", "medium": "social", "campaign": "verao-2026" },
  "turnstileToken": "…" }
→ 201 { "id": "led_…" }
```

Resposta idêntica em caso de duplicado — não revela se o e-mail já existe.

### `POST /api/marketing/track`
Público · regista `ConversionEvent` · sem PII no payload.

---

## 6. Sistema

### `GET /api/health`
Público · verifica BD, R2 e GPO · `200` saudável, `503` degradado
```json
{ "status": "healthy", "version": "a1b2c3d", "checks": {...}, "timestamp": "…Z" }
```

---

## 7. Server Actions vs. Route Handlers

| Usar | Quando |
|---|---|
| **Server Action** | Formulário interno do portal ou admin, com sessão, sem consumidor externo |
| **Route Handler** | Webhooks, callbacks, cron, endpoints públicos, tudo o que precisa de `Idempotency-Key` explícito ou de ser chamado por terceiros |

Server Actions verificam origem automaticamente; ainda assim, autorização e validação Zod
aplicam-se na mesma.
