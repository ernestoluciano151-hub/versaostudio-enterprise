# ADR-001 — Stack tecnológica

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Chief Software Architect, Backend Lead, Frontend Lead, DevOps Lead
- **Substitui:** —

---

## Contexto

A Versão Digital opera hoje um site estático (HTML/CSS/JS vanilla no GitHub Pages) sem backend,
base de dados, autenticação ou pipeline de build. Pretende-se construir um SaaS enterprise que
suporte operação real, receita real e clientes reais, com equipa de engenharia pequena e
mercado-alvo em Angola (conectividade variável, pagamentos locais via Multicaixa).

Critérios de decisão, por ordem de peso:
1. Segurança e auditabilidade do dinheiro.
2. Produtividade de uma equipa pequena.
3. Desempenho percebido em redes lentas.
4. Custo operacional previsível.
5. Empregabilidade da stack no mercado (contratar/substituir).

---

## Decisão

| Camada | Escolha | Justificação |
|---|---|---|
| Framework | **Next.js 15/16 (App Router)** | React Server Components reduzem JS enviado — decisivo em rede fraca. Um só runtime para site público SEO, portal e API. |
| UI | **React 19** | Server Actions e `useOptimistic` simplificam formulários resilientes. |
| Linguagem | **TypeScript `strict`** | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. `any` proibido por lint. |
| Estilos | **Tailwind CSS** | Design tokens partilhados com a identidade atual; sem CSS morto. |
| Componentes | **shadcn/ui** | Código no repositório (não dependência opaca), acessível por omissão, personalizável para a marca. |
| ORM | **Prisma** | Migrações versionadas, tipos gerados, SSoT do modelo de dados. |
| Base de dados | **PostgreSQL** | Transações ACID (obrigatório para dinheiro), `tstzrange` + `btree_gist` para exclusão de sobreposição de reservas, JSONB para metadados. |
| Auth | **NextAuth v5 (Auth.js)** | Sessões em BD, sem custo por utilizador ativo, controlo total sobre RBAC e dados de utilizador (relevante para proteção de dados local). |
| Pagamentos internacionais | **Stripe** | Cartões internacionais, webhooks assinados, reembolsos. |
| Pagamentos locais | **EMIS GPO** | Multicaixa Express e referência — indispensável no mercado angolano. |
| Armazenamento | **Cloudflare R2** | Sem taxa de egress (crítico para vídeo), S3-compatível, URLs pré-assinadas. |
| Validação | **Zod** | Um só esquema para runtime + tipos; validação na fronteira. |
| E-mail | **Resend** | API simples, domínio próprio, bom entregabilidade. |
| Erros/APM | **Sentry** | Erros de servidor e browser, traces, replay com máscara de PII. |
| Testes unitários | **Vitest** | Rápido, compatível com ESM/TS. |
| Testes E2E | **Playwright** | Fluxos de pagamento e RBAC; regressão SEO. |
| Hosting | **Vercel** | Previews por PR, edge, cron jobs, integração nativa com Next. |
| CDN/DNS/WAF | **Cloudflare** | Já em uso; WAF, rate limiting, Turnstile anti-bot. |

---

## Alternativas consideradas

| Alternativa | Porque foi rejeitada |
|---|---|
| Clerk em vez de NextAuth | Custo por MAU cresce com o negócio; dados de utilizador fora do controlo da empresa; RBAC custom mais rígido. Reavaliar se o custo de manter auth exceder o custo do serviço. |
| Supabase (BD + auth + storage) | Bom para arrancar, mas acopla três camadas a um fornecedor; egress de vídeo caro; menos controlo sobre o schema financeiro. |
| Drizzle em vez de Prisma | Mais leve e SQL-first, porém menos maduro em migrações e tooling para equipa pequena. |
| Remix / SvelteKit | Boas alternativas técnicas; menor ecossistema e menor disponibilidade de talento para React/Next no mercado. |
| S3 em vez de R2 | Egress de vídeo torna o custo imprevisível. |
| MongoDB | Sem garantias transacionais adequadas ao ledger financeiro. |

---

## Consequências

**Positivas**
- Um só repositório, um só deploy, tipos partilhados de ponta a ponta.
- RSC reduz drasticamente o JavaScript enviado ao cliente angolano.
- Postgres permite impor invariantes críticas na própria base de dados.

**Negativas / custos aceites**
- Acoplamento a Vercel para cron e edge — mitigado por manter a app como Node standard,
  containerizável se necessário.
- Prisma acrescenta uma camada de abstração; para queries analíticas pesadas usa-se SQL cru
  parametrizado, isolado em `infra/db/queries/`.
- NextAuth v5 exige mais trabalho inicial de RBAC do que Clerk.

**Regras que decorrem desta decisão**
- Nenhum campo monetário como `Float`. Sempre `Int` (menor unidade) + `currency`.
- Nenhuma dependência nova sem justificação escrita no PR (peso, manutenção, licença).
- Versões fixadas com lockfile; atualizações via Dependabot com CI verde obrigatório.
