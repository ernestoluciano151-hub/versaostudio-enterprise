# Quality Gate — VersaoStudio Enterprise

**Princípio:** o portão é automático. Um humano pode aprovar código; não pode aprovar a
passagem de um portão que falhou. Contornar o CI para "desbloquear" um merge é a forma mais
rápida de destruir a arquitetura descrita nos ADRs.

---

## 1. Portões de CI (por ordem de execução)

| # | Portão | Comando | Bloqueia | Tempo alvo |
|---|---|---|---|---|
| 1 | Typecheck | `tsc --noEmit` | ✅ | < 60 s |
| 2 | Lint | `eslint .` (inclui `boundaries`) | ✅ | < 45 s |
| 3 | Formatação | `prettier --check` | ✅ | < 15 s |
| 4 | Testes unitários | `vitest run --coverage` | ✅ | < 2 min |
| 5 | Testes de integração | `vitest run --project=integration` | ✅ | < 4 min |
| 6 | Build | `next build` | ✅ | < 3 min |
| 7 | E2E | `playwright test` | ✅ | < 8 min |
| 8 | Lighthouse CI | rotas públicas | ✅ | < 3 min |
| 9 | Segurança | `npm audit` + `gitleaks` + ZAP baseline | ✅ | < 2 min |
| 10 | Migrações | verificação de retrocompatibilidade | ✅ | < 30 s |

**Orçamento total do pipeline: 25 minutos.** Acima disto, as pessoas começam a contornar.

---

## 2. Limiares de cobertura

| Camada | Mínimo | Justificação |
|---|---|---|
| `modules/*/domain/**` | **90 %** | Lógica pura: preços, disponibilidade, transições de estado. Sem desculpa. |
| `modules/billing/**` | **95 %** | É dinheiro. |
| `modules/*/application/**` | 80 % | Use cases |
| `lib/money/**` | **100 %** | Aritmética monetária. Um erro aqui é um erro em todas as faturas. |
| `modules/*/infra/**` | 60 % | Coberto sobretudo por testes de integração |
| `components/**` | 50 % | Coberto por E2E e regressão visual |
| **Global** | **75 %** | — |

A cobertura **não pode descer** entre PRs. Descida = falha, mesmo acima do mínimo.

Cobertura é um indicador, não um objetivo. 100 % de cobertura com asserções fracas é pior do
que 80 % com testes que verificam comportamento real.

---

## 3. Testes obrigatórios por tipo de mudança

| Mudança | Testes exigidos |
|---|---|
| Regra de domínio | Unitário, incluindo casos-limite e de erro |
| Endpoint de pagamento | Integração + idempotência (pedido repetido e concorrente) + E2E |
| Nova rota do portal | E2E de RBAC + tentativa de IDOR que **tem de falhar** |
| Migração de schema | Integração contra Postgres real + verificação de retrocompatibilidade |
| Página pública | Lighthouse + metadados + JSON-LD válido |
| Alteração de slug | Teste de 301 |
| Correção de bug | **Teste que falha antes da correção** (obrigatório, sem exceção) |
| Componente de UI | Teste de acessibilidade (`axe-core`) |

---

## 4. Definition of Done

Uma tarefa só está concluída quando **todas** estas afirmações são verdadeiras:

- [ ] Código escrito e a passar em todos os portões de CI
- [ ] Testes escritos ao nível exigido para o tipo de mudança
- [ ] Cobertura mantida ou aumentada
- [ ] Sem `any`, sem `@ts-ignore`, sem `eslint-disable` não justificado em comentário
- [ ] Validação Zod em toda a entrada nova
- [ ] Verificação de posse em toda a query nova de dados de cliente
- [ ] `AuditLog` escrito se a operação toca em dinheiro, cliente ou ficheiros
- [ ] Erros tratados e observáveis (Sentry + log estruturado com `correlationId`)
- [ ] Documentação atualizada (ADR se for decisão estrutural)
- [ ] Variáveis de ambiente novas em `.env.example` **e** em `lib/env.ts`
- [ ] Testado em mobile real e em ligação lenta simulada
- [ ] Acessibilidade verificada (teclado, contraste, leitor de ecrã em fluxos críticos)
- [ ] Português de Angola correto em todo o texto visível
- [ ] Plano de rollback conhecido (e não trivial de esquecer: migração retrocompatível?)
- [ ] Revisto por outra pessoa, ou — se a equipa for de um — revisto pelo próprio 24 h depois,
      com checklist na mão

---

## 5. Política de Pull Request

### Regras

| Regra | Valor |
|---|---|
| Tamanho alvo | < 400 linhas alteradas |
| Tamanho máximo | 800 linhas (acima disto, dividir) |
| Aprovações necessárias | 1 (2 para `modules/billing` e `security`) |
| CI verde | Obrigatório, sem exceção |
| Branch atualizada com `main` | Obrigatório |
| Commits | Conventional Commits |
| Merge | Squash, com mensagem descritiva |

### Modelo de descrição

```markdown
## O que muda
<uma frase>

## Porquê
<problema que resolve; ligação à tarefa do roadmap>

## Como testar
1. …

## Riscos
<o que pode correr mal; plano de rollback>

## Checklist
- [ ] Testes escritos
- [ ] Documentação atualizada
- [ ] Sem segredos no diff
- [ ] Migração retrocompatível (ou N/A)
- [ ] Testado em mobile
```

### O que o revisor procura, por ordem

1. **Segurança** — falta verificação de posse? entrada não validada? segredo exposto?
2. **Correção de dinheiro** — montante do cliente? `Float`? falta idempotência?
3. **Fronteiras** — `domain/` a importar infraestrutura? módulo a ler tabela de outro?
4. **Testes** — testam comportamento ou apenas repetem a implementação?
5. **Observabilidade** — se isto falhar às 3 da manhã, dá para perceber porquê?
6. **Legibilidade** — daqui a seis meses, isto ainda se entende?

**O revisor não é um linter humano.** Formatação e estilo são do CI. A revisão é para o que
as máquinas não veem.

---

## 6. Portões específicos

### Fronteiras de módulo

```
eslint-plugin-boundaries
  domain      → apenas domain
  application → domain, application
  infra       → domain, application, lib
  ui          → domain (tipos), lib
  app         → application, ui, lib
```

Violação = erro de lint = build parte. Não é aviso.

### Lighthouse (rotas públicas)

| Métrica | Mínimo |
|---|---|
| Performance | 90 |
| Acessibilidade | 95 |
| Boas práticas | 95 |
| SEO | **100** |

### Migrações

Verificação automática: nenhum `DROP COLUMN` ou `DROP TABLE` no mesmo PR que remove o uso.
Expand/contract em dois deploys separados.

---

## 7. Exceções

Uma exceção a um portão exige, no PR:

1. Justificação escrita
2. Aprovação do responsável do projeto
3. Tarefa criada para remover a exceção, com prazo
4. Comentário no código a referir a tarefa

```ts
// eslint-disable-next-line boundaries/element-types
// EXCEÇÃO #142 — remover até 2026-09-30. Justificação: …
```

Exceções sem prazo tornam-se permanentes. Exceções permanentes tornam-se a arquitetura real.

---

## 8. Relatório de conclusão de fase

Nenhuma fase do roadmap é dada por concluída sem um relatório com:

1. **O que foi entregue** — funcionalidades, ficheiros, endpoints
2. **Testes executados** — resultados reais, não intenções; cobertura por camada
3. **Documentos criados ou atualizados** — com ligações
4. **ADRs novos** — decisões tomadas durante a fase
5. **Riscos remanescentes** — o que ficou por resolver e porquê
6. **Métricas** — desempenho, cobertura, dívida técnica assumida
7. **Pedido explícito de aprovação** para avançar

Sem os sete pontos, a fase não avança.

---

## 9. Dívida técnica

Registada em `docs/governance/tech-debt.md` com: descrição, motivo pelo qual foi assumida,
custo estimado de correção, e risco se não for corrigida.

**Regra:** dívida assumida conscientemente e registada é uma decisão de engenharia. Dívida
acumulada em silêncio é uma falha de processo.

Revisão da lista uma vez por fase. Se crescer duas fases seguidas, a fase seguinte inclui um
sprint de pagamento de dívida.
