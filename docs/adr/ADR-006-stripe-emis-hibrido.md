# ADR-006 — Pagamentos híbridos: Stripe + EMIS GPO

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Security Architect, Backend Lead, Finance stakeholder
- **Relacionado:** [ADR-001](ADR-001-stack.md), [ADR-003](ADR-003-prisma-postgresql.md)

---

## Contexto

O sistema tem de cobrar em dois mundos com garantias muito diferentes:

- **Stripe** — webhooks assinados, entrega fiável com retry, estados bem definidos.
- **EMIS GPO** (Multicaixa Express, referência, cartão local) — integração por iframe/API,
  callback cuja entrega **não** pode ser assumida como garantida nem como autêntica.

Uma reserva confirmada por engano é receita perdida e um cliente insatisfeito; um pagamento
capturado sem reserva confirmada é uma disputa. Ambos são inaceitáveis.

---

## Decisão

### 1. Ledger append-only como fonte de verdade contabilística

`LedgerEntry` nunca é atualizada nem apagada. Correções são novas entradas de sinal contrário.
O estado de `Payment` e `Invoice` é derivado e reconciliável a partir do ledger.
Um job diário verifica que `soma(ledger) == estado(payments)` e alerta em caso de divergência.

### 2. Nenhum estado de dinheiro muda por confiança num payload externo

Regra absoluta: **callback é apenas um gatilho, nunca uma fonte de verdade.**

```
callback recebido → validar origem → registar PaymentProviderEvent (bruto, imutável)
                 → RE-CONSULTAR o estado no provedor
                 → aplicar transição com base na resposta da consulta
```

Isto neutraliza spoofing, replay e payloads truncados de uma só vez.

### 3. Reconciliação por polling é obrigatória, não opcional

Cron a cada 5 minutos consulta todos os `Payment` em `INITIATED`/`PENDING` com idade < 24 h.
Se o callback nunca chegar, o polling resolve. Se chegar duas vezes, a idempotência resolve.
Os dois caminhos convergem no **mesmo** verificador — não há dois códigos a decidir o mesmo.

### 4. Idempotência em três níveis

| Nível | Mecanismo |
|---|---|
| Pedido do cliente | Header `Idempotency-Key` + `UNIQUE(endpoint, idempotencyKey)`; repetição devolve a resposta original |
| Evento do provedor | `UNIQUE(provider, providerEventId)`; evento repetido é ignorado silenciosamente |
| Transição de estado | Transições implementadas como máquina de estados; aplicar `CAPTURED` a um pagamento já `CAPTURED` é *no-op*, não erro |

### 5. Dinheiro em inteiros

`amountMinor: Int` + `currency: String` (ISO-4217). AOA e USD nunca somados sem conversão
explícita com `fxRate` registado no momento da transação. `Float` proibido por lint e por
revisão de schema.

### 6. Confirmação de reserva é consequência, não causa

`Booking.CONFIRMED` só acontece a partir de `PaymentCaptured` (evento de domínio) ou de
override manual por `FINANCE_MANAGER` com justificação obrigatória registada em `AuditLog`.

### 7. Sem dados de cartão no nosso sistema

Nunca tocamos em PAN, CVV ou dados de cartão. Stripe usa Elements/Checkout; EMIS usa iframe
alojado pelo provedor. O âmbito PCI-DSS mantém-se em SAQ-A.

---

## Fluxo EMIS GPO (referência de implementação)

> A integração GPO suporta MCX Express, pagamento por referência e cartão, por iframe
> (integração simples) ou API (integração completa). As credenciais — token de frame e
> POS/merchant ID — são emitidas pelo banco adquirente. **Os campos exatos devem ser
> confirmados contra a documentação entregue pelo banco antes da implementação**, porque
> variam por adquirente e por versão.

```
1. POST interno /api/payments/emis/frame-token
   ├─ recalcula o montante no servidor (nunca aceita valor do cliente)
   ├─ cria Payment(INITIATED, provider=EMIS, reference=<gerada>)
   └─ pede frameToken ao GPO com: reference, amount, callbackUrl, modos ativos

2. Renderiza o iframe do GPO com o token devolvido
   ├─ CSP com frame-src limitado ao domínio do GPO
   └─ timeout de sessão de pagamento alinhado com holdExpiresAt da reserva

3. Cliente confirma na app Multicaixa Express (ou QR Code)

4. Convergência:
   ├─ callback GPO  → /api/payments/emis/callback
   └─ cron polling  → /api/payments/emis/reconcile
        ambos → verificarPagamento(paymentId)  [idempotente]

5. verificarPagamento:
   ├─ consulta estado no GPO
   ├─ ACCEPTED  → Payment=CAPTURED + LedgerEntry + evento PaymentCaptured
   ├─ REJECTED  → Payment=FAILED + notificação com alternativa de pagamento
   └─ PENDING   → mantém; nova tentativa no próximo ciclo
```

**Defesas no endpoint de callback:** allowlist de IP na Cloudflare, validação de assinatura/HMAC
quando disponível, rejeição de referências desconhecidas, rate limiting, e registo do payload
bruto em `PaymentProviderEvent` antes de qualquer processamento.

---

## Fluxo Stripe

```
POST /api/payments/stripe/intent → PaymentIntent (amount recalculado no servidor)
  → Stripe Elements no browser
  → webhook assinado (verificação com STRIPE_WEBHOOK_SECRET)
  → dedupe por event.id → verificarPagamento(paymentId) [mesmo verificador]
```

Eventos tratados: `payment_intent.succeeded`, `payment_intent.payment_failed`,
`charge.refunded`, `charge.dispute.created`.

---

## Consequências

**Positivas**
- Sistema correto mesmo com callbacks perdidos, duplicados ou forjados.
- Auditoria financeira completa e reproduzível a partir do ledger.
- Adicionar um terceiro provedor (ex.: AppyPay, gateway bancário) é escrever um adapter que
  implementa o port `PaymentProvider` — sem tocar em domínio.

**Negativas / custos aceites**
- Polling gera chamadas extra ao GPO. Mitigado com backoff progressivo e janela de 24 h.
- Mais código do que "confiar no webhook". É o custo mínimo de lidar com dinheiro real.
- Reembolsos EMIS podem exigir processo manual junto do banco; o sistema regista o pedido
  e o estado, mesmo quando a execução é offline.

**Testes obrigatórios antes de go-live**
- [ ] Callback duplicado não duplica ledger.
- [ ] Callback forjado com referência válida mas estado falso não confirma reserva.
- [ ] Callback perdido: reserva confirma via polling dentro de 5 minutos.
- [ ] Dupla submissão do formulário com a mesma `Idempotency-Key` cria um só pagamento.
- [ ] Hold expira e liberta o slot quando o pagamento não acontece.
- [ ] Reembolso parcial deixa `soma(ledger)` correta.
