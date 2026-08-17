# 01 — Arquitetura do VersaoStudio Enterprise

**Estado:** aprovada para Sprint Foundation
**Autores:** Chief Software Architect + Security Architect + Backend Lead + Frontend Lead
**Última revisão:** 2026-08-05

---

## 1. Sumário executivo

O VersaoStudio Enterprise (VersaoDigital OS) é um **monólito modular** Next.js que serve três
públicos distintos a partir de uma única base de código e uma única base de dados:

1. **Website público** — captação, SEO e conversão (substitui o site estático atual).
2. **Portal do cliente** — reservas, pagamentos, entregas, faturas, documentos.
3. **Back-office** — CRM, ERP financeiro, agenda de produção, gestão de campanhas, analytics.

A escolha por monólito modular (em vez de microserviços) está justificada em
[ADR-002](../adr/ADR-002-monolito-modular.md): a operação é de uma empresa única, com equipa
pequena, e o custo de coordenação distribuída não é pago por nenhum benefício real nesta escala.
A modularidade é imposta por **fronteiras de código** (regras de dependência verificadas em CI),
não por fronteiras de rede.

---

## 2. Restrições que moldam a arquitetura

| Restrição | Implicação arquitetural |
|---|---|
| Mercado angolano — conectividade intermitente | Server Components + payload mínimo; formulários resilientes; upload retomável |
| Pagamentos locais via EMIS/Multicaixa, sem webhooks garantidos | Reconciliação por *polling* obrigatória; nunca confiar só em callback |
| Moeda AOA + clientes internacionais em USD/EUR | Valores em **inteiros na menor unidade** + código de moeda; nunca `float` |
| Equipa pequena | Monólito modular; convenções fortes; automatização em CI |
| Ficheiros audiovisuais pesados (vídeo 4K, RAW) | Upload direto para R2 via URL pré-assinada; a aplicação nunca faz proxy de bytes |
| SEO existente é um ativo | Preservação de URLs + 301s; ver [estratégia SEO](../business-bible/seo-strategy.md) |
| Dados pessoais de clientes (Lei 22/11 — Proteção de Dados, Angola) | Privacy by Design; minimização; retenção definida; trilho de auditoria |

---

## 3. Vista de alto nível

```
                          ┌──────────────────────────┐
   Visitante ────────────▶│  Website público (SSG/ISR)│──┐
                          └──────────────────────────┘  │
                          ┌──────────────────────────┐  │
   Cliente   ────────────▶│  Portal /cliente (RSC)   │──┤
                          └──────────────────────────┘  │
                          ┌──────────────────────────┐  │
   Staff     ────────────▶│  Back-office /admin (RSC)│──┤
                          └──────────────────────────┘  │
                                                        ▼
                                        ┌───────────────────────────────┐
                                        │   Camada de Aplicação         │
                                        │   (use cases / server actions)│
                                        └───────────────┬───────────────┘
                                                        │
                                        ┌───────────────▼───────────────┐
                                        │   Camada de Domínio           │
                                        │   (entidades, invariantes)    │
                                        └───────────────┬───────────────┘
                                                        │  ports
                                        ┌───────────────▼───────────────┐
                                        │   Infraestrutura (adapters)   │
                                        └──┬────┬────┬────┬────┬────┬───┘
                                           │    │    │    │    │    │
                              PostgreSQL ──┘    │    │    │    │    └── Sentry
                                    Stripe ─────┘    │    │    └─────── Resend
                                  EMIS GPO ──────────┘    └──────────── Cloudflare R2
```

### Regra de dependência (Clean Architecture)

```
infra ──▶ application ──▶ domain
  ▲                          │
  └──────── proibido ────────┘
```

- `domain/` não importa nada de `infra/`, `app/`, Prisma, Stripe, React ou Next.
- `application/` depende de `domain/` e de **interfaces** (ports), nunca de implementações.
- `infra/` implementa os ports e é a única camada que conhece SDKs externos.
- Verificado em CI com `eslint-plugin-boundaries` — violação parte o build.

---

## 4. Bounded contexts

| Contexto | Responsabilidade | Agregado raiz |
|---|---|---|
| **Identity & Access** | Utilizadores, papéis, sessões, permissões, convites | `User`, `Organization` |
| **CRM** | Leads, contactos, pipeline, propostas, atividades | `Lead`, `Client` |
| **Booking & Production** | Reservas, disponibilidade, agenda, ordens de produção | `Booking`, `ProductionJob` |
| **Billing & Payments** | Faturas, pagamentos, ledger, reconciliação, reembolsos | `Invoice`, `Payment` |
| **Delivery & Files** | Galerias, entregas, aprovações, downloads auditados | `Deliverable` |
| **Agency & Marketing** | Campanhas, plano de conteúdo, posts, leads atribuídos | `MarketingCampaign` |
| **SaaS Projects** | Projetos de desenvolvimento, sites de clientes, deploys, domínios | `SaaSProject` |
| **Content & SEO** | Páginas, blocos, versões, metadados, redirects | `SEOPage` |
| **Notifications** | E-mail, WhatsApp, eventos de comunicação | `NotificationEvent` |
| **Audit & Compliance** | Trilho de auditoria imutável, exportação e apagamento de dados | `AuditLog` |

Comunicação entre contextos: **eventos de domínio** persistidos em `DomainEvent`
(padrão outbox) e consumidos por handlers idempotentes. Nunca chamada direta a repositórios
de outro contexto.

---

## 5. Mapa de rotas

### 5.1 Público (`app/(public)`) — SSG/ISR, indexável

```
/                                  Homepage
/servicos                          Índice de serviços
/servicos/fotografia               (301 ← /fotografia.html)
/servicos/videoclipes              (301 ← /videoclips.html)
/servicos/design-branding          (301 ← /design.html)
/servicos/edicao-video             (301 ← /edicao-video.html)
/servicos/marketing-digital
/servicos/gestao-redes-sociais
/servicos/videos-institucionais
/servicos/desenvolvimento-saas
/pacotes
/portfolio            /portfolio/[slug]
/blog                 /blog/[slug]
/sobre  /contacto  /agendar
/politica-privacidade  /termos  /politica-cookies
/sitemap.xml  /robots.txt  /rss.xml  /opengraph-image
```

### 5.2 Cliente (`app/(client)/cliente`) — autenticado, `noindex`

```
/cliente                     Dashboard
/cliente/reservas            Lista + detalhe + pagamento antecipado
/cliente/pagamentos          Histórico, referências EMIS pendentes
/cliente/faturas             PDF + estado
/cliente/entregas            Galerias, aprovação, download
/cliente/documentos          Contratos, cedência de direitos de imagem
/cliente/projetos            Projetos de agência/SaaS em curso
/cliente/perfil
```

### 5.3 Admin (`app/(admin)/admin`) — RBAC, `noindex`

```
/admin                       KPIs executivos
/admin/crm                   Leads, pipeline, propostas
/admin/agenda                Calendário de produção e equipa
/admin/reservas              Gestão e confirmação
/admin/producao              Ordens de produção, checklist, equipamento
/admin/financeiro            Faturas, pagamentos, ledger, reconciliação EMIS
/admin/clientes
/admin/marketing             Campanhas, plano de conteúdo, posts
/admin/projetos              SaaS / sites de clientes, deploys, domínios
/admin/conteudo              CMS + SEO (páginas, versões, redirects)
/admin/ficheiros
/admin/analytics
/admin/definicoes            Utilizadores, papéis, preços, integrações
/admin/auditoria             Trilho de auditoria
```

### 5.4 API (`app/api`)

| Rota | Método | Auth | Notas |
|---|---|---|---|
| `/api/bookings` | POST | público + rate limit | Cria reserva `PENDING`; `Idempotency-Key` obrigatório |
| `/api/bookings/availability` | GET | público | Slots livres; cache 60 s |
| `/api/payments/stripe/intent` | POST | sessão | Cria PaymentIntent |
| `/api/payments/stripe/webhook` | POST | assinatura Stripe | Verificação de assinatura + dedupe por `event.id` |
| `/api/payments/emis/frame-token` | POST | sessão ou token de reserva | Gera `frameToken` GPO |
| `/api/payments/emis/callback` | POST | allowlist IP + HMAC + validação de referência | Nunca confiar sem re-consulta |
| `/api/payments/emis/reconcile` | POST | cron (Vercel Cron + segredo) | Polling de estado, fonte de verdade |
| `/api/files/presign` | POST | sessão + verificação de posse | URL pré-assinada R2, TTL 15 min |
| `/api/files/[id]/download` | GET | sessão + posse | Regista `FileAccessLog`, redirect assinado |
| `/api/crm/leads` | POST | público + honeypot + Turnstile | Origem e UTM registados |
| `/api/marketing/track` | POST | público | `ConversionEvent` |
| `/api/notifications/send` | POST | interno | Fila com retry |
| `/api/health` | GET | público | Liveness + versão do build |

**Regras transversais de API:** validação Zod à entrada *e* à saída; erros no formato
RFC 9457 (`application/problem+json`); rate limiting por IP e por utilizador;
`Idempotency-Key` obrigatório em todos os `POST` que mudam dinheiro ou reservas.

---

## 6. Fluxos críticos

### 6.1 Reserva com pagamento antecipado (EMIS)

```
1. Cliente escolhe serviço + slot            → GET /api/bookings/availability
2. Submete reserva                            → POST /api/bookings (Idempotency-Key)
   └─ Booking(status=PENDING, holdExpiresAt=now+30min)  [slot bloqueado]
3. Escolhe "Multicaixa Express"               → POST /api/payments/emis/frame-token
   └─ Payment(status=INITIATED, provider=EMIS, reference=...)
4. iframe GPO renderizado; cliente confirma na app MCX
5a. Callback EMIS  ─┐
5b. Cron reconcile ─┴─▶ ambos convergem para o mesmo verificador idempotente
6. Verificador re-consulta o estado no GPO (nunca confia no payload recebido)
7. Se ACCEPTED: Payment=CAPTURED → LedgerEntry → Booking=CONFIRMED → e-mail + WhatsApp
8. Se hold expirar sem pagamento: Booking=EXPIRED, slot libertado
```

**Invariante:** uma reserva só transita para `CONFIRMED` através de um `Payment` com estado
`CAPTURED` verificado junto do provedor, ou por override manual de um `FINANCE_MANAGER`
— que fica registado em `AuditLog` com justificação obrigatória.

### 6.2 Entrega de ficheiros

```
Produção conclui → cria Deliverable(DRAFT)
Upload: presign R2 → upload direto do browser → confirmação de checksum
Publicação: Deliverable(PUBLISHED) + notificação ao cliente
Download: verificação de posse → URL assinada (TTL 5 min) → FileAccessLog
Retenção: purga automática após N dias, definida por contrato
```

### 6.3 Lead → cliente

```
Formulário / campanha → Lead(NEW) + LeadSource + UTM
  → qualificação → Proposal → aceitação
  → conversão para Client + Booking/SaaSProject
  → ConversionEvent com atribuição à campanha
```

---

## 7. Segurança (Security by Design)

| Camada | Controlo |
|---|---|
| Autenticação | NextAuth v5, sessões em base de dados, MFA obrigatório para `/admin` |
| Autorização | RBAC + verificação de posse em **todas** as queries; `orgId`/`clientId` sempre no `where` |
| Entrada | Zod em toda a fronteira; sem `any`; sem SQL cru sem parametrização |
| Uploads | Tipo MIME por *magic bytes*, limite de tamanho, nomes gerados, bucket privado, sem execução |
| Pagamentos | Verificação de assinatura, idempotência, re-consulta ao provedor, ledger imutável |
| Segredos | Apenas em variáveis de ambiente; rotação documentada; nunca em `NEXT_PUBLIC_*` |
| Cabeçalhos | CSP com nonce, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Rate limiting | Por IP e por conta em auth, formulários e pagamentos |
| Auditoria | Toda a ação de escrita em dados financeiros, de cliente ou de ficheiros gera `AuditLog` |
| Dependências | Dependabot + `npm audit` a bloquear o merge em severidade alta |

**Modelo de ameaça resumido (OWASP Top 10 aplicado):**
IDOR no portal do cliente → verificação de posse obrigatória em repositório, não no controlador.
Manipulação de preço no cliente → preço **sempre** recalculado no servidor a partir de `PriceList`.
Replay de callback de pagamento → dedupe por `providerEventId` + `UNIQUE`.
Enumeração de ficheiros → IDs opacos (CUID2) + verificação de posse.

---

## 8. Observabilidade

Ver [observabilidade](../operations/observability.md). Resumo:
Sentry (erros + traces + replay com máscara de PII), logs estruturados JSON com `requestId`
e `correlationId` propagados, métricas de negócio (reservas criadas/confirmadas, taxa de sucesso
de pagamento por provedor, tempo até confirmação, falhas de reconciliação) e alertas acionáveis.

---

## 9. Testes (Testability by Design)

| Nível | Ferramenta | Alvo |
|---|---|---|
| Unitário | Vitest | Domínio puro: preços, disponibilidade, transições de estado. **Cobertura ≥ 90 %** |
| Integração | Vitest + Postgres em contentor | Repositórios, use cases, idempotência |
| Contrato | Vitest | Payloads Stripe/EMIS gravados (fixtures) |
| E2E | Playwright | Reserva→pagamento→confirmação; RBAC; download; formulários |
| SEO/regressão | Playwright + Lighthouse CI | Metadados, JSON-LD, 301s, Core Web Vitals |
| Segurança | ZAP baseline em CI | Cabeçalhos, XSS refletido, endpoints expostos |

Nenhum PR sem teste que falhe antes da correção quando corrige um bug.

---

## 10. Deployment

Vercel (produção + preview por PR) · PostgreSQL gerido com PITR · Cloudflare (DNS, WAF, cache)
· R2 para objetos · migrações Prisma aplicadas em passo dedicado com aprovação manual em produção
· *feature flags* para libertação progressiva · rollback = redeploy do build anterior + migrações
sempre retrocompatíveis (expand/contract, nunca `DROP` no mesmo deploy).

---

## 11. Riscos e mitigações

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Callback EMIS não chega ou chega duplicado | Alta | Alto | Reconciliação por polling como fonte de verdade + idempotência |
| Divergência entre estado de pagamento e reserva | Média | Alto | Ledger imutável + job de reconciliação diário + alerta |
| Perda de tráfego orgânico na migração | Média | Alto | 301s testados em E2E, migração faseada, monitorização no Search Console |
| Custo de armazenamento de vídeo a crescer | Alta | Médio | Política de retenção por contrato + classes de armazenamento + alertas de custo |
| Dependência de um só programador | Alta | Alto | ADRs, documentação, convenções, CI a impor regras |
| Indisponibilidade de rede em Luanda | Média | Médio | Estado otimista, retries, confirmações assíncronas por WhatsApp/e-mail |

---

## 12. Critérios de aceite da arquitetura

- [ ] `domain/` compila sem qualquer dependência de infraestrutura.
- [ ] Regras de fronteira verificadas em CI.
- [ ] Todos os endpoints de dinheiro são idempotentes e testados com pedidos repetidos.
- [ ] Nenhuma query de cliente sem filtro de posse (verificado por teste automático).
- [ ] Todos os 5 URLs antigos respondem 301 para o novo destino.
- [ ] Sentry recebe erros de servidor e de browser com `release` e `sourcemaps`.
