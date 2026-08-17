# Business Bible — Versão Digital LDA

Fonte única das regras de negócio que o software implementa. Quando o código e este documento
divergirem, um dos dois está errado — e é preciso decidir qual, não ignorar a divergência.

**Documentos relacionados:** [estratégia SEO](seo-strategy.md) ·
[conteúdo e copywriting](content-copywriting.md) ·
[pagamentos](../operations/payments-strategy.md)

---

## 1. A empresa

| | |
|---|---|
| Denominação | Versão Digital LDA |
| Morada | Rua N2, Casa N55, Bairro Cassenda, Luanda, Angola |
| Telefone / WhatsApp | +244 939 183 513 |
| E-mail | geral@versaodigitallda.com |
| Site | www.versaodigitallda.com |
| Horário | Segunda a sexta, 08h–18h · WhatsApp fora de horas |
| Redes | [Instagram](https://www.instagram.com/versaodigitallda) · [Facebook](https://www.facebook.com/share/18ZgsbAdVi/) · [TikTok](https://www.tiktok.com/@verso.digital.lda) |
| Moeda | AOA · IVA 14 % |
| Fuso | Africa/Luanda |

> **A completar antes da Fase 2:** NIF, regime fiscal aplicável, série e numeração de faturas
> validadas com o contabilista, e confirmação das taxas e isenções de IVA aplicáveis a cada
> linha de serviço.

---

## 2. Catálogo de serviços

| Categoria | Serviço | Modelo | Reserva? | Prazo de entrega |
|---|---|---|---|---|
| Audiovisual | Fotografia profissional | Por sessão | ✅ | 5 dias |
| Audiovisual | Video clips e produção | Por projeto | ✅ | A definir por projeto |
| Audiovisual | Vídeos institucionais | Por projeto | ✅ | A definir |
| Identidade visual | Design e branding | Por projeto | ❌ | A definir |
| Pós-produção | Edição de vídeo | Por projeto ou avença | ❌ | A definir |
| Presença online | Gestão de redes sociais | Avença mensal | ❌ | Contínuo |
| Marketing | Estratégia e campanhas | Avença ou projeto | ❌ | Contínuo |
| Desenvolvimento | Sites e plataformas SaaS | Projeto + manutenção | ❌ | Por milestone |

**Subcategorias de fotografia** (cada uma com página própria, por terem intenção de pesquisa
distinta): corporativa · eventos · casamentos · produto · retrato/artística.

> **Decisão pendente:** prazos de entrega concretos para vídeo, design e edição. Sem prazos,
> não há promessa verificável — e a promessa verificável é um dos quatro pilares de mensagem.

---

## 3. Pacotes de Marketing 360°

| | Essencial | Profissional | Premium |
|---|---|---|---|
| Redes geridas | 1 | 2 | 3+ |
| Posts/mês | 12 | 20 | Ilimitado |
| Stories | 4/semana | Diários | Diários |
| Sessões fotográficas | 1/mês | 2/mês | Produção mensal |
| Vídeo | — | 1 curto/mês | Produção audiovisual |
| Estratégia de conteúdo | — | ✅ | 360° completa |
| Campanha paga | — | — | Incluída |
| Relatório | Mensal | Quinzenal | Semanal |
| Suporte | WhatsApp | Prioritário | Reunião semanal |
| **Preço** | **A Negociar** | **A Negociar** | **A Negociar** |

> **Recomendação em aberto:** substituir "A Negociar" por "a partir de X AOA/mês".
> Preço oculto faz o visitante sair para pedir orçamento a outro, e atrai pedidos de quem não
> tem orçamento. Um valor de partida qualifica os dois lados. Ver
> [content-copywriting §5](content-copywriting.md).

---

## 4. Regras de reserva

| Regra | Valor | Implementação |
|---|---|---|
| Depósito para confirmar | 50 % | `PriceListItem.depositPercent` |
| Hold do slot (MCX Express) | 30 min | `Booking.holdExpiresAt` |
| Hold do slot (referência) | 3 dias | `EMISPaymentReference.expiresAt` |
| Remanescente | Até 24 h antes da sessão | Lembretes a 72 h e 24 h |
| Confirmação | Só após pagamento verificado | Evento `PaymentCaptured` |
| Sobreposição de recursos | Proibida | Constraint de exclusão em PostgreSQL |
| Reserva sem conta | Permitida | `Booking.guestEmail` + token assinado |

### Política de cancelamento

| Antecedência | Reembolso |
|---|---|
| > 7 dias | 100 % do depósito |
| 2–7 dias | 50 % |
| < 48 h | 0 %, com crédito de 50 % válido 6 meses |
| Não comparência | 0 % |
| Cancelamento pela Versão Digital | 100 % + reagendamento prioritário |

**Esta política tem de estar publicada nos termos e condições exatamente como está
implementada no código.** Divergência entre o publicado e o executado é risco legal.

---

## 5. Regras de faturação

| Regra | Detalhe |
|---|---|
| Moeda base | AOA; USD/EUR apenas para clientes fora de Angola, com `fxRate` registado |
| IVA | 14 % (`DEFAULT_VAT_RATE_BPS=1400`) |
| Numeração | Série `VD2026`, sequencial **sem saltos** |
| Emissão | Automática na confirmação da reserva |
| Recibo | Automático na captura do pagamento |
| Nota de crédito | Gerada em cancelamento com reembolso devido |
| Avenças | Faturadas no dia 1; suspensão de serviço ao 10.º dia de atraso |
| Projetos SaaS | 40 % adjudicação · 40 % UAT · 20 % go-live |
| Ledger | Append-only; reconciliado diariamente |

---

## 6. Entregas

| Regra | Valor |
|---|---|
| Fotografia | Galeria digital privada, até 5 dias |
| Revisões incluídas | 2 (`Deliverable.maxRevisions`) |
| Revisão adicional | Orçamentada à parte |
| Publicação | Só com fatura paga, ou override auditado |
| Acesso | Portal do cliente; link com validade |
| Retenção | Definida por contrato (`purgeAt`); purga automática e registada |
| Direitos de imagem | Termo de cedência assinado antes da publicação em portfólio |

---

## 7. Regras de marketing

- Toda a campanha tem objetivo mensurável e orçamento antes de sair de `DRAFT`.
- Todo o lead tem origem rastreável (`LeadSource` + UTM), mesmo que seja `direct`.
- Post publicado é imutável; edições criam nova versão.
- **Nenhuma afirmação de resultado de cliente é publicada sem número verificável e autorização
  escrita.** Sem prova, descreve-se o que se fez, não o que se alcançou.

---

## 8. Regras de conteúdo do site

- Alterar o slug de uma página publicada gera automaticamente um 301.
- Nenhuma página pública sem `title`, `description` e canónico.
- Toda a publicação cria uma `PageVersion` — rollback em um clique.
- Conteúdo gerado com apoio de IA é sempre revisto por uma pessoa antes de publicar.
- Zero imagens de stock. Um estúdio de fotografia ilustra-se com o próprio trabalho.

---

## 9. Glossário

| Termo | Significa |
|---|---|
| **Reserva** (`Booking`) | Compromisso de data e serviço; ocupa recursos |
| **Sessão** (`ProductionJob`) | Execução operacional de uma reserva |
| **Hold** | Bloqueio temporário do slot enquanto se aguarda pagamento |
| **Entrega** (`Deliverable`) | Conjunto de ficheiros finais para o cliente |
| **Depósito** | Percentagem paga antecipadamente para confirmar |
| **Ledger** | Registo contabilístico imutável de movimentos |
| **Reconciliação** | Verificação periódica do estado real dos pagamentos junto do provedor |
| **Avença** | Contrato mensal recorrente |
| **Milestone** | Etapa de projeto que desencadeia faturação |

---

## 10. Decisões de negócio pendentes

| # | Decisão | Bloqueia | Prazo |
|---|---|---|---|
| 1 | Expor preços ou manter "A Negociar" | Copy da Fase 1 | Antes da Fase 1 |
| 2 | Prazos de entrega de vídeo, design e edição | Páginas de serviço e SLA | Antes da Fase 1 |
| 3 | NIF, série de faturação e validação fiscal | Fase 2 (faturação) | Antes da Fase 2 |
| 4 | Banco adquirente e credenciais EMIS GPO | **Fase 2 inteira** | **Iniciar já** |
| 5 | Política de retenção de ficheiros por tipo de contrato | Fase 3 | Antes da Fase 3 |
| 6 | Valores das avenças e limites de cada pacote | Fase 2 | Antes da Fase 2 |
| 7 | **Gestão de despesas** — modelo `Expense`/`Supplier` não existe no schema. Sem ele não há margem real por serviço, só receita. | Fase 5 (ERP) | Antes da Fase 5 |
