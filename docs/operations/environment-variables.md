# 11 — Variáveis de ambiente e gestão de segredos

Ficheiro de referência: [`.env.example`](../../.env.example)

---

## 1. Regra fundamental

**Tudo o que tem prefixo `NEXT_PUBLIC_` fica visível no browser.** Não é uma configuração de
privacidade — é código-fonte enviado ao cliente. Chaves secretas com esse prefixo estão
comprometidas no momento do deploy.

| Tipo | Prefixo | Exemplo |
|---|---|---|
| Público (browser) | `NEXT_PUBLIC_` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Secreto (servidor) | sem prefixo | `STRIPE_SECRET_KEY`, `EMIS_GPO_FRAME_TOKEN` |

---

## 2. Validação no arranque

A aplicação **não arranca** com configuração inválida. Falhar cedo e alto é preferível a
descobrir a meio de um pagamento que uma variável estava em falta.

```ts
// lib/env.ts
import { z } from 'zod';

const server = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  EMIS_GPO_BASE_URL: z.string().url(),
  EMIS_GPO_FRAME_TOKEN: z.string().min(1),
  EMIS_GPO_POS_ID: z.string().min(1),
  EMIS_ALLOWED_IPS: z.string().transform((s) => s.split(',').map((x) => x.trim())),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().startsWith('re_'),
  CRON_SECRET: z.string().min(32),
  DEFAULT_VAT_RATE_BPS: z.coerce.number().int().min(0).max(10_000),
});

const client = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
});

const parsed = server.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:',
    parsed.error.flatten().fieldErrors);
  throw new Error('Configuração inválida — a aplicação não arranca.');
}
export const env = parsed.data;
```

Regra adicional em produção: se `FEATURE_EMIS_ENABLED=true`, todas as variáveis `EMIS_*`
tornam-se obrigatórias. Um flag ligado com credenciais em falta é um erro de arranque.

---

## 3. Ambientes

| Variável | Local | Preview | Produção |
|---|---|---|---|
| `DATABASE_URL` | Postgres em Docker | BD de preview (dados anonimizados) | Postgres gerido com PITR |
| `STRIPE_*` | Chaves de teste | Chaves de teste | **Chaves live** |
| `EMIS_GPO_*` | Sandbox/mock | Sandbox | **Produção do adquirente** |
| `R2_BUCKET_NAME` | `versaostudio-dev` | `versaostudio-preview` | `versaostudio` |
| `SENTRY_DSN` | vazio | preenchido | preenchido |
| `LOG_LEVEL` | `debug` | `debug` | `info` |
| `FEATURE_MAINTENANCE_MODE` | `false` | `false` | comutável |

**Nunca** apontar preview para a base de dados de produção. Um `DELETE` sem `WHERE` num
ambiente de teste não deve poder destruir dados reais.

---

## 4. Rotação de segredos

| Segredo | Periodicidade | Procedimento |
|---|---|---|
| `AUTH_SECRET` | 6 meses ou após incidente | Rodar invalida todas as sessões — avisar utilizadores |
| `STRIPE_SECRET_KEY` | Após incidente | Criar chave nova no dashboard, atualizar, revogar antiga |
| `STRIPE_WEBHOOK_SECRET` | Ao recriar o endpoint | Aceitar ambas durante a transição |
| `EMIS_GPO_FRAME_TOKEN` | Conforme o adquirente | Pedir ao banco; testar em sandbox antes |
| `R2_*` | 12 meses | Criar novo par, atualizar, revogar |
| `CRON_SECRET` | 6 meses | Atualizar no Vercel e nas definições de cron |
| `MFA_ENCRYPTION_KEY` | **Nunca sem migração** | Rodar exige re-encriptar todos os segredos MFA |

**Após qualquer suspeita de exposição:** rodar imediatamente, sem esperar pelo calendário.

---

## 5. Se um segredo for exposto

1. **Revogar primeiro, investigar depois.** A chave antiga deixa de servir em minutos.
2. Emitir nova credencial e fazer deploy.
3. Verificar registos de uso no provedor (Stripe, banco, Cloudflare) à procura de atividade
   não autorizada.
4. Se estava no Git: reescrever o histórico (`git filter-repo`) **e** assumir que continua
   comprometida — o histórico pode ter sido clonado.
5. Registar o incidente em `AuditLog` e escrever um post-mortem.

---

## 6. Prevenção

- `.env*` no `.gitignore` (exceto `.env.example`)
- `gitleaks` em CI e como pre-commit hook
- Revisão de PR verifica variáveis novas em `.env.example` e em `lib/env.ts`
- Nenhum segredo em Slack, WhatsApp ou e-mail — usar o cofre do Vercel ou 1Password
- Acesso às variáveis de produção limitado ao mínimo de pessoas, com registo

---

## 7. Notas por serviço

**EMIS GPO** — o `frameToken` de produção é emitido pelo banco adquirente após validação do
comerciante. **Pedir na Fase 0 do roadmap**, não quando o código estiver pronto: o prazo de
emissão é a dependência externa mais provável de atrasar o projeto. Os nomes exatos dos
parâmetros variam por adquirente — confirmar contra a documentação recebida.

**Stripe** — testar o webhook localmente com `stripe listen --forward-to
localhost:3000/api/payments/stripe/webhook`. O `whsec_` do CLI é diferente do de produção.

**R2** — dois buckets: privado para entregas de clientes, público apenas para ativos do site
(logótipos, imagens de marketing). Nunca misturar.

**Resend** — verificar o domínio com SPF, DKIM e DMARC antes do lançamento. Sem isso, os
e-mails de confirmação vão para spam e o cliente pensa que a reserva falhou.
