# 04 — Estratégia de pagamentos: Stripe + EMIS GPO

Complementa [ADR-006](../adr/ADR-006-stripe-emis-hibrido.md) com o detalhe de implementação.

---

## 1. Matriz de métodos

| Método | Provedor | Moeda | Público-alvo | Confirmação |
|---|---|---|---|---|
| Multicaixa Express | EMIS GPO | AOA | Clientes em Angola (dominante) | Callback + polling |
| Referência Multicaixa | EMIS GPO | AOA | Empresas, pagamento diferido | Polling (pode demorar dias) |
| Cartão local | EMIS GPO | AOA | Cartões emitidos em Angola | Callback + polling |
| Cartão internacional | Stripe | USD/EUR | Clientes na diáspora e estrangeiros | Webhook assinado |
| Transferência bancária | Manual | AOA/USD | Contratos grandes, projetos SaaS | Conciliação manual auditada |
| Numerário | Manual | AOA | Presencial | Registo com dupla confirmação |

Regra de apresentação: em Angola, **Multicaixa Express aparece primeiro**. Stripe só é
mostrado quando o país de faturação não é AO ou a moeda escolhida não é AOA.

---

## 2. Máquina de estados de `Payment`

```
                 ┌──────────┐
  criar ────────▶│INITIATED │
                 └────┬─────┘
        redirect/iframe│
                 ┌────▼─────┐   provedor confirma    ┌──────────┐
                 │ PENDING  │───────────────────────▶│ CAPTURED │
                 └──┬────┬──┘                        └────┬─────┘
      timeout/hold  │    │ provedor recusa                │ reembolso
                 ┌──▼──┐ └──────────▶┌────────┐      ┌────▼──────────────┐
                 │EXPIRED│            │ FAILED │      │PARTIALLY_REFUNDED │
                 └──────┘            └────────┘      └────┬──────────────┘
                                                          ▼
                                                     ┌──────────┐
                                                     │ REFUNDED │
                                                     └──────────┘
```

Transições permitidas (tudo o resto é rejeitado e alertado):

```ts
const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  INITIATED: ['PENDING', 'CAPTURED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PENDING:   ['CAPTURED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  CAPTURED:  ['PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED'],
  PARTIALLY_REFUNDED: ['REFUNDED', 'DISPUTED'],
  FAILED: [], EXPIRED: [], CANCELLED: [], REFUNDED: [], DISPUTED: ['REFUNDED'],
};
// Aplicar o estado atual a si próprio é no-op (idempotência), não erro.
```

---

## 3. O verificador único

Todo o caminho — callback EMIS, webhook Stripe, cron de reconciliação, botão manual no admin —
termina na **mesma** função. Não existem duas implementações da regra.

```ts
// modules/billing/application/verify-payment.ts
export async function verifyPayment(paymentId: string, ctx: Ctx) {
  return db.$transaction(async (tx) => {
    // 1. Lock pessimista — impede corrida entre callback e cron
    const payment = await tx.$queryRaw`
      SELECT * FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;

    // 2. Estados terminais não se reprocessam
    if (isTerminal(payment.status)) return { changed: false, payment };

    // 3. Fonte de verdade: o provedor, consultado agora
    const provider = providerFor(payment.provider);       // port
    const remote = await provider.getPaymentStatus(payment.providerRef);

    // 4. Transição validada
    const next = mapRemoteStatus(remote.status);
    if (!canTransition(payment.status, next)) {
      await audit(tx, 'payment.invalid_transition', payment, { next, remote });
      throw new InvalidTransitionError(payment.status, next);
    }
    if (next === payment.status) return { changed: false, payment };

    // 5. Aplicar + ledger append-only + evento de domínio, na mesma transação
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: next, capturedAt: next === 'CAPTURED' ? new Date() : undefined,
              providerStatus: remote.status, netMinor: remote.netMinor ?? payment.amountMinor },
    });

    if (next === 'CAPTURED') {
      await tx.ledgerEntry.create({ data: {
        organizationId: payment.organizationId, entryType: 'PAYMENT_RECEIVED',
        direction: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency,
        paymentId, invoiceId: payment.invoiceId, description: `Pagamento ${payment.provider}`,
      }});
      if (remote.feeMinor) {
        await tx.ledgerEntry.create({ data: { /* FEE_CHARGED, DEBIT */ } });
      }
      await tx.domainEvent.create({ data: {
        organizationId: payment.organizationId, eventType: 'PaymentCaptured',
        aggregateType: 'Payment', aggregateId: paymentId,
        payload: { bookingId: payment.bookingId, amountMinor: payment.amountMinor },
      }});
    }

    await audit(tx, 'payment.status_changed', payment, updated);
    return { changed: true, payment: updated };
  }, { isolationLevel: 'Serializable' });
}
```

O handler de `PaymentCaptured` — e só ele — confirma a reserva e emite recibo. A confirmação
de reserva nunca é escrita dentro do fluxo de pagamento.

---

## 4. EMIS GPO — notas de integração

> **Antes de implementar:** obter do banco adquirente a documentação GPO em vigor, o
> `frameToken` de produção, o POS/merchant ID e o formato exato do callback. Os campos variam
> por adquirente e por versão da plataforma. O que segue é o desenho de integração, não uma
> transcrição da especificação.

**Modos suportados pelo GPO:** MCX Express (incluindo confirmação por QR Code na opção
"COMPRAS" da app), pagamento por referência e pagamento com dados de cartão.
**Formas de integração:** Webframe (iframe, integração simples) ou API (integração completa).
Adotamos **iframe** na fase 1 — mantém o âmbito PCI em SAQ-A e reduz superfície de risco.

### Sequência

```
POST /api/payments/emis/frame-token
  ├─ auth: sessão do cliente OU token de reserva assinado (reservas de convidado)
  ├─ Idempotency-Key obrigatório
  ├─ recalcula montante a partir de Booking + PriceList  ← nunca do body
  ├─ cria Payment(INITIATED) + EMISPaymentReference(reference, expiresAt)
  ├─ chama o GPO para obter o token do frame
  └─ devolve { frameUrl, expiresAt } — nunca devolve credenciais
```

**CSP para o iframe** (só o domínio do gateway):

```
frame-src 'self' https://pagamentonline.emis.co.ao;
```

### Endpoint de callback — defesas obrigatórias

```ts
// app/api/payments/emis/callback/route.ts
export async function POST(req: Request) {
  const raw = await req.text();
  const ip = req.headers.get('cf-connecting-ip');

  // 1. Allowlist de IP (também aplicada na WAF Cloudflare)
  if (!EMIS_ALLOWED_IPS.includes(ip)) return problem(403, 'forbidden');

  // 2. Registar o payload BRUTO antes de qualquer interpretação
  const event = await db.paymentProviderEvent.create({
    data: { provider: 'EMIS', providerEventId: extractId(raw) ?? hash(raw),
            eventType: 'callback', payload: safeJson(raw), sourceIp: ip },
  }).catch(uniqueViolation => null);       // duplicado -> já registado, ignorar
  if (!event) return ok();                  // 200 para o provedor não repetir eternamente

  // 3. Resolver a referência; desconhecida = ignorar silenciosamente + alerta
  const ref = await db.eMISPaymentReference.findUnique({
    where: { reference: parsed.reference }, select: { paymentId: true },
  });
  if (!ref) { alert('emis.unknown_reference', { ip }); return ok(); }

  // 4. NÃO confiar no estado recebido — re-consultar
  await verifyPayment(ref.paymentId, { actorType: 'WEBHOOK' });
  return ok();
}
```

### Reconciliação (cron a cada 5 minutos)

```ts
// app/api/cron/reconcile-payments/route.ts  — protegido por CRON_SECRET
const pending = await db.payment.findMany({
  where: { provider: 'EMIS', status: { in: ['INITIATED', 'PENDING'] },
           initiatedAt: { gte: subHours(new Date(), 24) } },
  take: 200, orderBy: { initiatedAt: 'asc' },
});
for (const p of pending) {
  await verifyPayment(p.id, { actorType: 'CRON' }).catch(captureException);
}
// Backoff: <10 min -> cada ciclo; 10-60 min -> 3/3 ciclos; >1 h -> 1×/hora; >24 h -> EXPIRED
```

Pagamentos por **referência** têm janela mais longa (até 3 dias); o job usa `expiresAt`
do `EMISPaymentReference` em vez da janela de 24 h.

---

## 5. Stripe

```
POST /api/payments/stripe/intent
  ├─ montante recalculado no servidor
  ├─ metadata: { bookingId, organizationId, invoiceId }
  ├─ idempotencyKey passado ao SDK Stripe
  └─ devolve clientSecret

POST /api/payments/stripe/webhook
  ├─ stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  ├─ dedupe: UNIQUE(provider, providerEventId=event.id)
  └─ verifyPayment(paymentId)     ← mesmo verificador
```

Eventos tratados: `payment_intent.succeeded`, `payment_intent.payment_failed`,
`charge.refunded`, `charge.dispute.created` (→ `DISPUTED` + alerta imediato).

**Importante:** o webhook precisa do corpo **cru**. Em route handlers do Next, ler com
`await req.text()`; nunca `req.json()` antes da verificação de assinatura.

---

## 6. Aritmética monetária

```ts
// lib/money/money.ts
export type Money = { amountMinor: number; currency: 'AOA' | 'USD' | 'EUR' };

export const add = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
};

// IVA Angola: 14 % — taxRate em basis points, arredondamento half-up explícito
export const applyTax = (base: Money, bps: number): Money => ({
  amountMinor: Math.round((base.amountMinor * bps) / 10_000),
  currency: base.currency,
});

export const formatAOA = (m: Money) =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency: m.currency })
    .format(m.amountMinor / 100);
```

Proibido por lint: `Float`/`Number` para dinheiro fora deste módulo, somar moedas diferentes,
arredondar implicitamente.

---

## 7. Regras de negócio de cobrança

| Regra | Implementação |
|---|---|
| Depósito para confirmar reserva | `PriceListItem.depositPercent` (50 % por omissão) |
| Hold do slot | 30 min para MCX Express; 3 dias para referência |
| Remanescente | Devido até 24 h antes da sessão; lembrete automático a 72 h e 24 h |
| Cancelamento > 7 dias | Reembolso de 100 % do depósito |
| Cancelamento 2–7 dias | Reembolso de 50 % |
| Cancelamento < 48 h | Sem reembolso; crédito de 50 % válido 6 meses |
| Não comparência | Sem reembolso |
| Pacotes mensais | Faturação no dia 1; suspensão de serviço ao 10.º dia de atraso |
| Projetos SaaS | 40 % adjudicação / 40 % UAT / 20 % go-live, via `Milestone` |

Todas estas regras vivem em `modules/billing/domain/policies/` — testadas unitariamente,
sem I/O, e alteráveis por configuração da organização.

---

## 8. Runbook — divergência de pagamento

**Sintoma:** cliente diz que pagou, sistema mostra `PENDING`.

1. `/admin/financeiro/pagamentos/{id}` → ver `PaymentProviderEvent` (chegou callback?).
2. Botão **"Reconsultar no provedor"** → executa `verifyPayment` manualmente.
3. Se o GPO confirma `ACCEPTED`: o estado corrige-se sozinho; investigar por que o callback
   falhou (log + IP de origem + WAF).
4. Se o GPO diz `REJECTED` mas o cliente tem comprovativo: escalar ao banco adquirente com
   `reference` e `transactionId`; **não** confirmar manualmente antes da confirmação bancária.
5. Override manual (último recurso): exige papel `FINANCE_MANAGER`, justificação escrita
   obrigatória, e fica registado em `AuditLog` com severidade `CRITICAL`.

**Alertas configurados:** taxa de sucesso EMIS < 85 % em 1 h · > 10 pagamentos `PENDING` há
> 30 min · qualquer `payment.invalid_transition` · divergência ledger/pagamentos no job diário.

---

## Fontes

- [Gateway de Pagamentos Online — MULTICAIXA](https://multicaixa.ao/pt/oferta/canais/comerciantes/gateway-de-pagamentos-online/)
- [Portal GPO — EMIS](https://pagamentonline.emis.co.ao/online-payment-gateway/portal/)
- [EMIS anuncia plataforma para pagamentos em lojas virtuais — Menos Fios](https://www.menosfios.com/emis-anuncia-aplicativo-para-pagamentos-em-lojas-virtuais/)
- [Gateway de Pagamentos Online — BNI](https://www.bni.ao/pt/empresas/servicos/gateway-de-pagamentos-online/)
