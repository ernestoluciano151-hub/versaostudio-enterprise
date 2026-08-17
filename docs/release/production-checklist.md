# 09 — Checklist de produção (go-live)

Nada entra em produção com uma caixa por assinalar. Cada linha tem um responsável e uma
verificação — "acho que está" não conta.

---

## 1. Segurança

### Autenticação e autorização
- [ ] Palavras-passe com argon2id (nunca MD5/SHA sem KDF)
- [ ] MFA obrigatório e testado para todos os papéis de `/admin`
- [ ] Sessões em BD com expiração e revogação; logout invalida do lado do servidor
- [ ] Rate limiting em login (5/min por IP, 10/h por conta) e bloqueio progressivo
- [ ] Recuperação de palavra-passe com token de uso único, TTL 30 min, revogado após uso
- [ ] RBAC testado para **todos** os papéis — teste automático que tenta aceder e falha
- [ ] Verificação de posse em toda a query de cliente (teste automático de IDOR)
- [ ] Convites expiram e não são reutilizáveis

### Aplicação
- [ ] Zod em todas as fronteiras (body, query, params, variáveis de ambiente)
- [ ] Zero `any` no código; `tsc --noEmit` limpo em modo strict
- [ ] Sem SQL cru não parametrizado
- [ ] CSRF: Server Actions com origem verificada; cookies `SameSite=Lax` + `Secure` + `HttpOnly`
- [ ] Cabeçalhos: CSP com nonce, HSTS (`max-age=31536000; includeSubDomains; preload`),
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy` restritiva
- [ ] `frame-src` limitado ao domínio do GPO
- [ ] Rate limiting em formulários públicos + Cloudflare Turnstile
- [ ] Mensagens de erro sem stack trace nem detalhes internos em produção

### Ficheiros
- [ ] Bucket R2 privado; sem acesso público direto
- [ ] URLs pré-assinadas com TTL ≤ 15 min (upload) e ≤ 5 min (download)
- [ ] Validação de tipo por *magic bytes*, não por extensão nem `Content-Type`
- [ ] Limite de tamanho por tipo de ficheiro
- [ ] Nomes de ficheiro gerados; nome original guardado apenas como metadado
- [ ] Todo o download regista `FileAccessLog`

### Pagamentos
- [ ] Assinatura do webhook Stripe verificada com o corpo cru
- [ ] Callback EMIS com allowlist de IP na WAF **e** na aplicação
- [ ] Nenhum estado alterado sem re-consulta ao provedor
- [ ] Idempotência testada com pedidos repetidos e concorrentes
- [ ] Montantes sempre recalculados no servidor
- [ ] Cron de reconciliação ativo e monitorizado
- [ ] Zero dados de cartão no nosso sistema (confirmado por revisão de código)

### Segredos e dependências
- [ ] Nenhum segredo no repositório (verificado com `gitleaks` em CI e no histórico)
- [ ] Nenhum segredo em `NEXT_PUBLIC_*`
- [ ] Segredos de produção só nas variáveis de ambiente do Vercel, com acesso restrito
- [ ] Rotação de segredos documentada e testada uma vez
- [ ] `npm audit` sem vulnerabilidades altas ou críticas
- [ ] Dependabot ativo

---

## 2. Dados

- [ ] Migrações revistas e testadas em cópia de produção
- [ ] Migrações retrocompatíveis (expand/contract; sem `DROP` no mesmo deploy)
- [ ] Backups automáticos diários + PITR ativo
- [ ] **Restauro testado numa base limpa** (um backup nunca testado não é um backup)
- [ ] Constraint de exclusão contra sobreposição de reservas ativa e testada
- [ ] `UPDATE`/`DELETE` revogados em `LedgerEntry` e `AuditLog` ao nível da BD
- [ ] Índices verificados com `EXPLAIN ANALYZE` nas queries mais usadas
- [ ] Pool de conexões dimensionado para o limite do serverless
- [ ] Seed de produção: organização, papéis, serviços, tabela de preços, templates

---

## 3. Legal e conformidade

- [ ] Política de privacidade publicada, em português, específica (não um modelo genérico)
- [ ] Termos e condições com política de cancelamento e reembolso alinhada com [estratégia de pagamentos §7](../operations/payments-strategy.md)
- [ ] Banner de cookies com consentimento real (nada não essencial antes do consentimento)
- [ ] Base legal do tratamento de dados documentada (Lei n.º 22/11 — Proteção de Dados, Angola)
- [ ] Prazos de retenção definidos e automatizados (`Deliverable.purgeAt`)
- [ ] Processo de pedido de acesso/apagamento operacional (`DataRequest`)
- [ ] Termo de cedência de direitos de imagem para sessões fotográficas
- [ ] Numeração de faturas conforme requisitos da AGT; série e sequência sem saltos
- [ ] Taxa de IVA correta (14 %) e isenções aplicáveis validadas com o contabilista

---

## 4. Técnico

- [ ] Build de produção sem erros nem avisos
- [ ] Lighthouse: performance ≥ 90, SEO 100, acessibilidade ≥ 95, boas práticas ≥ 95
- [ ] Bundle inicial < 100 KB gzip nas rotas públicas
- [ ] Todas as imagens em AVIF/WebP com dimensões declaradas
- [ ] Fontes com `display: swap` e subset
- [ ] Página 404 e 500 personalizadas e úteis
- [ ] Modo de manutenção testado
- [ ] `/api/health` a responder corretamente
- [ ] Cron jobs registados e a executar (reconciliação, expiração de holds, purga, lembretes)
- [ ] Testado em Chrome, Safari, Firefox, Edge + Android e iOS reais
- [ ] Testado em ligação lenta simulada (3G) — o mercado é este

---

## 5. SEO

- [ ] Os 5 URLs antigos respondem 301 para o destino correto (teste E2E verde)
- [ ] Sitemap dinâmico a gerar e submetido ao Search Console
- [ ] `robots.txt` correto; `/admin`, `/cliente` e `/api` bloqueados
- [ ] Canónicos absolutos e com `www` em todas as páginas
- [ ] JSON-LD válido no Rich Results Test (Organization, LocalBusiness, Service, FAQ)
- [ ] `og:image` a resolver — **o bug atual do site tem de estar corrigido**
- [ ] Sem `noindex` acidental em produção (verificação automática antes do deploy)
- [ ] Search Console e GA4 (ou Plausible) ligados e a receber dados

---

## 6. Observabilidade

- [ ] Sentry a receber erros de servidor e de browser, com `release` e sourcemaps
- [ ] Scrubbing de PII verificado com um evento de teste real
- [ ] Logs estruturados com `requestId` e `correlationId`
- [ ] Todos os alertas P1/P2 configurados **e testados a disparar**
- [ ] Monitor de uptime externo ativo
- [ ] Dashboards a mostrar dados reais
- [ ] Runbooks escritos e acessíveis

---

## 7. Operação

- [ ] Rollback testado (redeploy do build anterior) e cronometrado
- [ ] Preview deployments a funcionar em cada PR
- [ ] Ambiente de staging com dados anonimizados
- [ ] Documentação de operação escrita
- [ ] Equipa formada no back-office antes do lançamento
- [ ] Templates de notificação revistos (texto e ortografia) — o cliente lê isto
- [ ] Número de WhatsApp de suporte definido e com horário publicado
- [ ] Plano de comunicação de incidentes

---

## 8. Negócio

- [ ] Tabela de preços carregada e validada pela gestão
- [ ] Serviços, categorias e prazos de entrega corretos
- [ ] Conta EMIS GPO ativa em **produção** (não sandbox) e testada com valor real
- [ ] Conta Stripe ativa, verificada e com payout configurado
- [ ] Um pagamento real de ponta a ponta em cada provedor, com reembolso testado
- [ ] Faturas conferidas pelo contabilista
- [ ] Política de cancelamento publicada e igual à implementada no código

---

## 9. Ensaio final (24 h antes)

- [ ] Reserva completa em produção com pagamento real MCX Express
- [ ] Reserva com pagamento por referência
- [ ] Reserva com cartão internacional (Stripe)
- [ ] Reembolso completo e parcial
- [ ] Upload e download de entrega, com verificação do registo de auditoria
- [ ] Cliente vê apenas os seus dados (tentativa de IDOR falha)
- [ ] E-mails e WhatsApp chegam com o conteúdo correto
- [ ] Restauro de backup verificado
- [ ] Rollback executado e revertido

---

## 10. Assinaturas

| Área | Responsável | Data | Assinatura |
|---|---|---|---|
| Segurança | | | |
| Backend / Dados | | | |
| Frontend / SEO | | | |
| QA | | | |
| Operação | | | |
| Negócio | | | |

**Nenhum go-live sem as seis assinaturas.**
