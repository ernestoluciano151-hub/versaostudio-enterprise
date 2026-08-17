# Arquitetura — VersaoStudio Enterprise

**Documento canónico de arquitetura da Fase 0.**
Detalhe complementar (rotas completas, contratos de API, testes) em
[`../architecture/system-architecture.md`](../architecture/system-architecture.md).

---

## 1. Decisão estrutural

**Monólito modular Next.js**, uma base de código, uma base de dados PostgreSQL, três contextos
de interface e fronteiras de módulo impostas em CI.

Justificação completa em [`ADR-002`](../adr/ADR-002-monolito-modular.md). Em resumo: uma
empresa, uma equipa pequena, domínios que partilham constantemente as mesmas entidades, e
transações financeiras que beneficiam de `BEGIN...COMMIT` em vez de sagas distribuídas.

---

## 2. Vista de contexto

```mermaid
graph TB
    subgraph Utilizadores
        V[Visitante]
        C[Cliente]
        S[Equipa / Staff]
    end

    subgraph "VersaoStudio Enterprise (Vercel)"
        PUB["Website público<br/>SSG · ISR · SEO"]
        POR["Portal do cliente<br/>autenticado"]
        ADM["Back-office<br/>RBAC + MFA"]
        API["API Routes<br/>+ Server Actions"]
    end

    subgraph "Serviços externos"
        PG[(PostgreSQL)]
        R2[Cloudflare R2]
        ST[Stripe]
        EM[EMIS GPO]
        RS[Resend]
        WA[WhatsApp Business]
        SE[Sentry]
    end

    V --> PUB
    C --> POR
    S --> ADM
    PUB --> API
    POR --> API
    ADM --> API

    API --> PG
    API --> R2
    API --> ST
    API --> EM
    API --> RS
    API --> WA
    API --> SE
```

---

## 3. Camadas (Clean Architecture)

```mermaid
graph TD
    A["app/ — rotas, RSC, server actions"] --> B["application/ — use cases"]
    B --> C["domain/ — entidades, invariantes, ports"]
    D["infra/ — Prisma, Stripe, EMIS, R2, Resend"] --> C
    D -.implementa os ports.-> C
    A --> D

    style C fill:#FDF6E8,stroke:#966D1F,stroke-width:3px
    style D fill:#F2F0EC,stroke:#7D776A
```

**Regra de dependência:** as setas apontam sempre para o domínio. `domain/` não importa
Prisma, Next, React nem SDKs externos. Verificado por `eslint-plugin-boundaries` — a violação
parte o build, não gera um aviso.

---

## 4. Módulos e fronteiras

```mermaid
graph LR
    subgraph "src/modules"
        ID[identity]
        CRM[crm]
        BK[booking]
        BL[billing]
        DL[delivery]
        MK[marketing]
        PR[projects]
        CT[content]
        NT[notifications]
        AU[audit]
    end

    CRM -->|eventos| BK
    BK -->|BookingConfirmed| BL
    BL -->|PaymentCaptured| BK
    BK -->|ProductionCompleted| DL
    MK -->|LeadCreated| CRM
    PR -->|MilestoneReached| BL
    BK & BL & DL & PR --> NT
    BK & BL & DL & ID --> AU
```

Comunicação entre módulos: **apenas** através do `index.ts` público ou de eventos de domínio
persistidos no outbox (`DomainEvent`). Nenhum módulo lê tabelas de outro.

---

## 5. Contextos de interface

```mermaid
graph TB
    subgraph "app/(public) — indexável, SSG/ISR"
        P1["/"]
        P2["/servicos/[slug]"]
        P3["/pacotes · /portfolio · /blog"]
        P4["/agendar · /contacto"]
    end
    subgraph "app/(client)/cliente — noindex, autenticado"
        C1["/cliente — dashboard"]
        C2["/cliente/reservas · pagamentos · faturas"]
        C3["/cliente/entregas · documentos"]
    end
    subgraph "app/(admin)/admin — noindex, RBAC + MFA"
        A1["/admin — KPIs"]
        A2["/admin/crm · agenda · producao"]
        A3["/admin/financeiro · marketing · projetos"]
        A4["/admin/conteudo · auditoria · definicoes"]
    end
```

---

## 6. Fluxo de dados — reserva com pagamento EMIS

O fluxo mais crítico do sistema. Detalhe e defesas em
[`ADR-006`](../adr/ADR-006-stripe-emis-hibrido.md).

```mermaid
sequenceDiagram
    autonumber
    actor Cli as Cliente
    participant App as VersaoStudio
    participant DB as PostgreSQL
    participant GPO as EMIS GPO
    participant Cron as Cron (5 min)

    Cli->>App: Escolhe serviço e horário
    App->>DB: Booking(PENDING, hold 30 min)
    Cli->>App: Escolhe Multicaixa Express
    App->>App: Recalcula montante no servidor
    App->>DB: Payment(INITIATED)
    App->>GPO: Pedido de frameToken
    GPO-->>App: token
    App-->>Cli: iframe do gateway
    Cli->>GPO: Confirma na app MCX

    par Callback
        GPO-->>App: callback
        App->>DB: PaymentProviderEvent (payload bruto)
    and Reconciliação
        Cron->>App: verifica pendentes
    end

    App->>GPO: RE-CONSULTA o estado (fonte de verdade)
    GPO-->>App: ACCEPTED
    App->>DB: Payment=CAPTURED + LedgerEntry + DomainEvent
    App->>DB: Booking=CONFIRMED
    App-->>Cli: E-mail + WhatsApp de confirmação
```

**Invariante:** o callback é um gatilho, nunca uma fonte de verdade. Callback e cron convergem
no mesmo verificador idempotente.

---

## 7. Máquinas de estado

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PENDING: submetida
    PENDING --> CONFIRMED: pagamento capturado
    PENDING --> EXPIRED: hold expira
    PENDING --> CANCELLED: cancelada
    CONFIRMED --> IN_PRODUCTION
    IN_PRODUCTION --> DELIVERED
    DELIVERED --> CLOSED
    CONFIRMED --> CANCELLED
    CANCELLED --> REFUNDED
    EXPIRED --> [*]
    CLOSED --> [*]
```

```mermaid
stateDiagram-v2
    [*] --> INITIATED
    INITIATED --> PENDING
    INITIATED --> FAILED
    PENDING --> CAPTURED
    PENDING --> FAILED
    PENDING --> EXPIRED
    CAPTURED --> PARTIALLY_REFUNDED
    CAPTURED --> REFUNDED
    CAPTURED --> DISPUTED
    PARTIALLY_REFUNDED --> REFUNDED
```

---

## 8. Integrações

```mermaid
graph LR
    subgraph "domain/ports"
        PP[PaymentProvider]
        FS[FileStorage]
        ES[EmailSender]
        MS[MessageSender]
    end
    subgraph "infra/adapters"
        SA[StripeAdapter]
        EA[EmisAdapter]
        RA[R2Adapter]
        RE[ResendAdapter]
        WA[WhatsAppAdapter]
    end
    SA --> PP
    EA --> PP
    RA --> FS
    RE --> ES
    WA --> MS
```

| Integração | Papel | Contrato | Modo de falha |
|---|---|---|---|
| **Stripe** | Cartões internacionais | Webhook assinado + dedupe por `event.id` | Degradação: só EMIS disponível |
| **EMIS GPO** | Multicaixa Express, referência, cartão local | iframe + callback + **polling obrigatório** | Callback perdido → resolvido pelo cron |
| **Cloudflare R2** | Entregas e assets | URLs pré-assinadas, upload direto do browser | Upload falha → retoma; app nunca faz proxy de bytes |
| **Resend** | E-mail transacional | API REST, fila com retry | Fila persiste; retry com backoff |
| **WhatsApp Business** | Notificações no canal dominante | API | Fallback para e-mail |
| **Sentry** | Erros, traces, replay | SDK | Falha silenciosa; nunca bloqueia o pedido |

**Anti-corruption layer:** nenhum SDK externo aparece em `domain/` ou `application/`. Trocar
de provedor de e-mail é trocar um adapter.

---

## 9. Fluxo de ficheiros

```mermaid
sequenceDiagram
    participant B as Browser
    participant App as VersaoStudio
    participant R2 as Cloudflare R2

    B->>App: POST /api/files/presign
    App->>App: Verifica posse + tipo + tamanho
    App-->>B: URL pré-assinada (TTL 15 min)
    B->>R2: PUT direto (sem passar pela app)
    B->>App: Confirma checksum
    App->>App: FileObject + AuditLog

    Note over B,R2: Download: verificação de posse → URL assinada 5 min → FileAccessLog
```

A aplicação nunca transporta bytes de vídeo. Isto mantém o serverless dentro dos limites de
tempo e memória, e o custo previsível.

---

## 10. Deployment

```mermaid
graph LR
    DEV[Local] -->|PR| CI[CI: typecheck, lint, test, build, e2e]
    CI -->|verde| PRE[Preview Vercel]
    PRE -->|aprovação| PROD[Produção Vercel]
    PROD --> CF[Cloudflare DNS/WAF/CDN]
    CF --> USR[Utilizadores]
    PROD -.migrações aprovadas.-> DB[(PostgreSQL + PITR)]
```

Migrações expand/contract, sempre retrocompatíveis. Rollback = redeploy do build anterior.
Nunca `DROP` no mesmo deploy que remove o uso da coluna.

---

## 11. Restrições que moldaram estas decisões

| Restrição | Consequência arquitetural |
|---|---|
| Rede angolana instável | RSC, payload mínimo, uploads retomáveis, estado otimista |
| Callback EMIS não garantido | Polling obrigatório; callback é apenas gatilho |
| AOA + moedas estrangeiras | Inteiros na menor unidade + `currency`; nunca `Float` |
| Vídeo 4K e RAW | Upload direto para R2; retenção com purga automática |
| Equipa pequena | Monólito modular; convenções impostas por CI |
| SEO existente é ativo | 301s testados em E2E; migração faseada e reversível |
| Lei n.º 22/11 (proteção de dados) | Minimização, retenção definida, trilho de auditoria |

---

## 12. Critérios de aceite da arquitetura

- [ ] `domain/` compila sem qualquer dependência de infraestrutura
- [ ] Violação de fronteira entre módulos parte o build
- [ ] Todos os endpoints de dinheiro são idempotentes e testados com pedidos repetidos
- [ ] Nenhuma query de cliente sem filtro de posse (verificado por teste)
- [ ] Os 5 URLs antigos respondem 301 para o destino correto
- [ ] Sentry recebe erros de servidor e browser com `release` e sourcemaps
- [ ] Reserva confirma em < 5 min mesmo com o callback do gateway perdido
