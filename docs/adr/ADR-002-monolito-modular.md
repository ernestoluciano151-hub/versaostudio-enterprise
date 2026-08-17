# ADR-002 — Monólito modular para SaaS + Agência + Portal

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Chief Software Architect, Backend Lead, DevOps Lead

---

## Contexto

O VersaoDigital OS reúne domínios que em empresas maiores costumam ser produtos separados:
gestão de estúdio, CRM, ERP financeiro, portal do cliente, CMS/SEO, gestão de campanhas de
marketing e gestão de projetos de desenvolvimento.

A tentação é separar isto em serviços. A realidade operacional é outra: uma empresa,
uma equipa pequena, um orçamento de infraestrutura contido, e domínios que partilham
constantemente as mesmas entidades (`Client` aparece em reservas, faturas, entregas,
campanhas e projetos).

---

## Decisão

**Monólito modular**: uma aplicação Next.js, uma base de dados PostgreSQL, módulos separados
por fronteiras de código verificadas em CI.

### Modularização imposta, não sugerida

```
src/
  modules/
    identity/      crm/         booking/      billing/
    delivery/      marketing/   projects/     content/
    notifications/ audit/
```

Cada módulo expõe apenas o seu `index.ts` (API pública). Regras aplicadas por
`eslint-plugin-boundaries`:

1. Um módulo **não** importa ficheiros internos de outro módulo — só o `index.ts`.
2. Um módulo **não** acede a tabelas de outro módulo diretamente; pede ao módulo dono.
3. Comunicação assíncrona entre módulos faz-se por **eventos de domínio** (outbox), não por
   chamadas encadeadas.
4. `domain/` de qualquer módulo não importa Prisma, Next, React ou SDKs.

Violação destas regras **parte o build**. Sem exceções por conveniência.

---

## Alternativas consideradas

| Alternativa | Avaliação |
|---|---|
| **Microserviços** | Rejeitado. Introduz consistência eventual, tracing distribuído, versionamento de contratos e N pipelines — custos reais e imediatos, para benefícios (escala independente, isolamento de equipas) que não existem nesta escala. Transações financeiras cross-service exigiriam sagas para resolver um problema que hoje é um `BEGIN...COMMIT`. |
| **Múltiplas aplicações separadas** (site + portal + admin) | Rejeitado. Triplica autenticação, deploy e código partilhado. Route groups do Next dão o mesmo isolamento de UI sem o custo. |
| **Monólito sem modularização** | Rejeitado. Sem fronteiras impostas, o acoplamento aparece em semanas e a extração futura torna-se impossível. |
| **Multi-tenant desde o dia 1** | Adiado, não rejeitado. O schema já inclui `organizationId` em todas as tabelas relevantes, o que mantém a porta aberta para vender o SaaS a outros estúdios sem migração destrutiva. Row-Level Security será ativado na fase em que houver o primeiro tenant externo. |

---

## Consequências

**Positivas**
- Transações ACID atravessam domínios sem sagas: confirmar reserva + criar ledger + marcar
  fatura acontece numa única transação.
- Um deploy, um rollback, um conjunto de logs — operável por uma pessoa.
- Refactor cross-domain é uma operação de compilador, não uma negociação de contratos.
- Custo de infraestrutura previsível e baixo.

**Negativas / custos aceites**
- Escala vertical: toda a aplicação escala em conjunto. Aceitável — o gargalo previsível é
  a base de dados, resolvível com réplicas de leitura.
- Um bug grave pode afetar todos os domínios. Mitigado com feature flags, testes e canary
  via preview deployments.
- Disciplina de fronteiras depende de CI. Se o CI for contornado, a arquitetura degrada.

**Caminho de saída (se um dia for necessário)**
Módulos com fronteiras limpas e comunicação por eventos são extraíveis: publica-se o outbox
num broker, o módulo passa a serviço, e os ports mantêm-se. A decisão de hoje não fecha portas.

---

## Critérios de revisão

Reavaliar este ADR se ocorrer **qualquer** um dos seguintes:
- Mais de 8 programadores em paralelo no mesmo repositório.
- Um módulo com perfil de carga radicalmente diferente (ex.: processamento de vídeo pesado).
- Necessidade de residência de dados distinta por país para um módulo específico.
