# 08 — Observabilidade

**Princípio:** um sistema que lida com dinheiro tem de ser explicável depois do facto. Se não
é possível responder a "o que aconteceu a este pagamento às 14h32?" em menos de dois minutos,
a observabilidade está incompleta.

---

## 1. Os quatro sinais

| Sinal | Ferramenta | Responde a |
|---|---|---|
| **Erros** | Sentry | O que rebentou, onde, para quem, com que frequência |
| **Traces** | Sentry Performance | Onde se perdeu o tempo neste pedido |
| **Logs** | JSON estruturado → Vercel/Better Stack | O que aconteceu, por que ordem |
| **Métricas de negócio** | Tabelas próprias + dashboard | O sistema está a gerar valor? |

Métricas de negócio contam tanto como as técnicas. Um sistema com 99,9 % de disponibilidade
e zero reservas confirmadas está avariado.

---

## 2. Sentry

```ts
// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.15 : 1.0,
  profilesSampleRate: 0.1,

  // PII NUNCA sai da nossa infraestrutura
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubPII(event); // e-mail, telefone, morada, NIF, tokens, referências de pagamento
  },
  beforeBreadcrumb(crumb) {
    if (crumb.category === 'http' && crumb.data?.url?.includes('emis')) {
      crumb.data.body = '[redacted]';
    }
    return crumb;
  },
  ignoreErrors: ['NEXT_NOT_FOUND', 'NEXT_REDIRECT', 'AbortError'],
});
```

**Session Replay** no portal do cliente com `maskAllText: true` e `blockAllMedia: true`.
Serve para perceber onde o utilizador se perde, não para ler os dados dele.

**Contexto obrigatório em cada evento:** `organizationId`, `userId` (hash), `requestId`,
`route`, `module`. Sem contexto, um erro é apenas ruído.

---

## 3. Logs estruturados

```ts
// lib/observability/logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['*.password', '*.passwordHash', '*.token', '*.frameToken', '*.mfaSecret',
            '*.email', '*.phone', '*.mobileNumber', 'req.headers.authorization',
            'req.headers.cookie', '*.taxId'],
    censor: '[redacted]',
  },
  formatters: { level: (label) => ({ level: label }) },
});
```

**Campos obrigatórios em todas as linhas:**

```json
{
  "level": "info", "time": "2026-08-05T14:32:11.204Z",
  "requestId": "req_01J...", "correlationId": "corr_01J...",
  "organizationId": "org_...", "userId": "usr_...",
  "module": "billing", "action": "payment.verify",
  "durationMs": 342, "msg": "Pagamento verificado"
}
```

`correlationId` propaga-se do pedido HTTP → use case → evento de domínio → handler → e-mail.
É o fio que permite reconstruir uma história completa a partir de um único identificador.

**Níveis:** `error` (ação humana necessária) · `warn` (anómalo mas recuperado) ·
`info` (eventos de negócio) · `debug` (só fora de produção).

**Nunca em log:** dados de cartão, `frameToken`, tokens de sessão, palavras-passe, payloads
completos de pagamento (só ids e estados).

---

## 4. Métricas de negócio

Calculadas a partir das tabelas de domínio e expostas em `/admin/analytics`.

### Operação

| Métrica | Fonte | Alvo |
|---|---|---|
| Reservas criadas / dia | `Booking` | Tendência crescente |
| Taxa de confirmação | `CONFIRMED / (CONFIRMED + EXPIRED + CANCELLED)` | > 70 % |
| Tempo mediano até confirmação | `confirmedAt - createdAt` | < 15 min (MCX) |
| Holds expirados / dia | `status = EXPIRED` | < 15 % das criadas |
| Ocupação de recursos | `BookingResource` vs. `AvailabilityRule` | > 60 % |
| Entregas dentro do prazo | `Deliverable.publishedAt` vs. `deliveryDays` | > 95 % |

### Financeiro

| Métrica | Alerta |
|---|---|
| Taxa de sucesso de pagamento por provedor | EMIS < 85 % em 1 h |
| Pagamentos `PENDING` > 30 min | > 10 em simultâneo |
| Falhas de reconciliação | Qualquer uma |
| Divergência ledger vs. pagamentos | Qualquer valor ≠ 0 |
| Faturas vencidas | > 15 % do valor em aberto |
| Receita: dia / semana / mês | Queda > 30 % semana-a-semana |

### Marketing

Leads por origem · custo por lead · taxa lead→cliente · conversões por campanha ·
tráfego orgânico vs. baseline pré-migração · posições das 20 keywords principais.

---

## 5. Health checks

```ts
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    db.$queryRaw`SELECT 1`,                 // base de dados
    r2.headBucket({ Bucket: BUCKET }),      // armazenamento
    fetch(EMIS_HEALTH_URL, { signal: AbortSignal.timeout(3000) }),
  ]);
  const status = checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded';
  return Response.json({
    status, version: process.env.VERCEL_GIT_COMMIT_SHA,
    checks: describe(checks), timestamp: new Date().toISOString(),
  }, { status: status === 'healthy' ? 200 : 503 });
}
```

Monitor externo (UptimeRobot/Better Stack) a cada 60 s a partir de duas regiões.

---

## 6. Alertas

**Regra de ouro:** um alerta que não exige ação é ruído, e ruído leva a que os alertas
verdadeiros sejam ignorados. Cada alerta abaixo tem uma ação definida.

| Alerta | Condição | Canal | Ação |
|---|---|---|---|
| **P1 — Pagamentos em baixo** | Taxa de sucesso < 50 % em 15 min | WhatsApp + e-mail | Runbook §04.8; contactar adquirente |
| **P1 — BD indisponível** | Health check falha 2× seguidas | WhatsApp + e-mail | Verificar provedor; ativar página de manutenção |
| **P1 — Transição inválida de pagamento** | Qualquer ocorrência | WhatsApp | Investigar imediatamente — indica bug ou ataque |
| **P2 — Reconciliação falhada** | Job de cron falha | E-mail | Executar manualmente; verificar credenciais GPO |
| **P2 — Divergência no ledger** | Job diário deteta ≠ 0 | E-mail | Auditar as transações do dia |
| **P2 — Taxa de erro elevada** | > 5 % dos pedidos em 10 min | E-mail | Sentry → identificar release |
| **P3 — Certificado a expirar** | < 14 dias | E-mail | Renovar |
| **P3 — Domínio de cliente a expirar** | < 30 dias (`DomainManagement`) | E-mail | Avisar cliente e renovar |
| **P3 — Core Web Vitals degradados** | LCP > 2,5 s em campo | E-mail semanal | Investigar regressão |

Sem paging noturno para P3. A fadiga de alertas é um risco operacional real.

---

## 7. SLOs

| Serviço | SLO | Janela |
|---|---|---|
| Website público | 99,9 % disponibilidade | 30 dias |
| Portal do cliente | 99,5 % | 30 dias |
| API de pagamentos | 99,9 % · p95 < 1,5 s | 30 dias |
| Confirmação de reserva | 99 % confirmadas < 5 min após pagamento | 30 dias |
| Entrega de e-mail | 98 % entregues < 2 min | 30 dias |

Orçamento de erro consumido acima de 50 % → congelar funcionalidades novas e estabilizar.

---

## 8. Auditoria como observabilidade

`AuditLog` responde a perguntas que os logs técnicos não respondem: *quem* mudou este estado
e *porquê*. É a primeira coisa a consultar numa disputa com cliente.

Escrita obrigatória em: confirmação/cancelamento de reserva, qualquer mudança de estado de
pagamento, override manual, emissão/anulação de fatura, reembolso, publicação/despublicação de
entrega, download de ficheiro, mudança de papel de utilizador, alteração de preços,
publicação de página.

Retenção: **7 anos** para registos financeiros; 2 anos para os restantes.

---

## 9. Dashboards

**Executivo** (`/admin`) — receita do mês, reservas confirmadas, pipeline, leads por origem,
faturas vencidas, próximas sessões.

**Operacional** (`/admin/analytics`) — taxa de sucesso de pagamento por provedor e por hora,
tempo até confirmação, holds expirados, ocupação por recurso, entregas em atraso.

**Técnico** (Sentry + Vercel) — taxa de erro por rota, p50/p95/p99, Web Vitals de campo,
consultas lentas, tamanho do bundle por rota.

---

## 10. Runbooks

Cada alerta P1/P2 tem runbook em `docs/runbooks/`:

- `pagamento-divergente.md` (resumido em [payments-strategy §8](payments-strategy.md))
- `base-de-dados-indisponivel.md`
- `reconciliacao-falhada.md`
- `pico-de-erros-apos-deploy.md`
- `quebra-de-trafego-organico.md`
- `pedido-de-apagamento-de-dados.md`

Formato fixo: sintoma → diagnóstico em passos → correção → prevenção → a quem escalar.
