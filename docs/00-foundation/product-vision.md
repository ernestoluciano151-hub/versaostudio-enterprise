# Visão de Produto — VersaoStudio Enterprise

---

## 1. Missão

Dar às marcas angolanas uma presença digital credível — da imagem à plataforma — com processo
transparente, prazos cumpridos e resultados mensuráveis.

## 2. Visão

Ser, em três anos, o parceiro digital de referência para empresas angolanas de média dimensão,
operando sobre uma plataforma própria que outros estúdios da região possam licenciar.

## 3. Problema

**Para os clientes.** Uma empresa angolana que precisa de fotografia, vídeo, identidade visual,
gestão de redes e um site trabalha hoje com quatro fornecedores diferentes, sem coerência de
marca entre eles, sem prazos fiáveis e sem forma de acompanhar o trabalho. Pagar exige
deslocação ou transferência manual. Receber ficheiros é uma sucessão de links do WeTransfer
que expiram.

**Para a Versão Digital.** A operação vive em WhatsApp, folhas de cálculo e memória. Reservas
sem registo central, faturas manuais, entregas por links temporários, sem visibilidade sobre
receita, ocupação ou origem dos clientes. Cada novo cliente aumenta o custo de coordenação
mais do que aumenta a margem.

## 4. Solução

Uma plataforma única que serve os dois lados:

- **Website público** que capta e converte, com conteúdo real e SEO próprio.
- **Portal do cliente** onde se reserva, paga com Multicaixa, acompanha e descarrega.
- **Back-office** que gere CRM, agenda, produção, faturação, campanhas e projetos.

O que torna isto viável em Angola, e não uma cópia de uma ferramenta estrangeira: pagamento
por Multicaixa Express integrado, WhatsApp como canal de notificação de primeira classe,
funcionamento em 3G, e faturação conforme as regras locais.

## 5. Proposta de valor

**Para o cliente final:** *"Reserva, paga e recebe o teu trabalho sem sair do telemóvel."*

**Para a Versão Digital:** *"Deixar de gerir o estúdio em WhatsApp e folhas de cálculo."*

**Para o mercado (fase futura):** *"O sistema operativo dos estúdios criativos angolanos."*

## 6. Personas

### Sofia — Gestora de marketing, empresa média em Luanda
32 anos, precisa de fotografia de produto e gestão de Instagram. Reporta a uma direção que
pede números. Trabalha em cima da hora.
**Precisa de:** orçamento rápido, prazo garantido, relatório mensal que possa apresentar.
**Frustra-a:** não saber em que ponto está o trabalho e ter de perguntar por WhatsApp.
**Ganha com:** portal com estado do projeto, entregas datadas, relatórios automáticos.

### Nuno — Artista musical independente
24 anos, quer um video clip. Orçamento apertado, decide depressa, vive no Instagram e TikTok.
**Precisa de:** preço claro, exemplos de trabalhos anteriores, pagar em prestações.
**Frustra-o:** "A Negociar" — não sabe se pode sequer pagar.
**Ganha com:** preços a partir de, portfólio visível, pagamento por Multicaixa Express e
depósito de 50 %.

### Dona Fernanda — Empresária, salão de beleza
45 anos, quer um site e presença nas redes. Pouco à vontade com tecnologia. WhatsApp é a sua
interface com o mundo.
**Precisa de:** falar com uma pessoa, perceber o que vai receber, pagar como já sabe pagar.
**Frustra-a:** formulários longos e jargão técnico.
**Ganha com:** WhatsApp em primeiro plano, referência Multicaixa, linguagem simples.

### Ernesto — Fundador da Versão Digital
Vende, produz, edita e fatura. O gargalo é ele próprio.
**Precisa de:** ver a semana toda num ecrã, saber quanto entrou e quanto falta receber, e
parar de repetir informação em cinco sítios.
**Ganha com:** agenda única, ledger reconciliado, faturas automáticas, entregas sem links
manuais.

### Marta — Produtora / editora (equipa)
Executa e entrega. Precisa de saber o que é seu, para quando, e onde estão os ficheiros.
**Ganha com:** ordens de produção com checklist, ficheiros no sítio, sem depender de perguntar.

## 7. Diferenciais

| Diferencial | Porque é defensável |
|---|---|
| **Amplitude real** — imagem, canais e software na mesma equipa | Agências não desenvolvem software; software houses não produzem vídeo. Copiar exige contratar duas equipas. |
| **Pagamento local nativo** | Multicaixa Express integrado no fluxo de reserva. Plataformas estrangeiras não o fazem. |
| **Construído para a rede angolana** | Server components, payload mínimo, resiliência a quebras. Uma ferramenta SaaS estrangeira assume banda larga. |
| **Plataforma própria** | A operação melhora com o produto; o produto melhora com a operação. Concorrentes com ferramentas alugadas não têm este ciclo. |
| **WhatsApp como canal de primeira classe** | Não é um botão — é o meio de notificação e confirmação. |

## 8. Modelo de negócio

### Receita de serviços (hoje)

| Linha | Modelo | Nota |
|---|---|---|
| Fotografia | Por sessão, depósito de 50 % | Volume alto, ticket médio |
| Vídeo e video clips | Por projeto, faturado por etapas | Ticket alto, ciclo longo |
| Design e branding | Por projeto | Ticket médio |
| Edição de vídeo | Por projeto ou avença | Escalável |
| Marketing 360° | Avença mensal (Essencial / Profissional / Premium) | **Receita recorrente — a mais valiosa** |
| Sites e SaaS | Projeto + manutenção mensal | Ticket mais alto, recorrência |

### Receita de plataforma (fase futura)

Licenciamento do VersaoStudio a outros estúdios angolanos, por subscrição mensal com limite
de reservas e armazenamento. O schema já é multi-tenant (`organizationId` em todas as tabelas
de negócio); falta a decisão comercial, não a técnica.

### Economia unitária a acompanhar

Custo de aquisição por canal · valor médio por cliente · taxa de recorrência das avenças ·
margem por linha de serviço · custo de armazenamento por cliente (vídeo é caro) · taxa de
sucesso de pagamento por método.

## 9. Métricas de sucesso

| Horizonte | Métrica | Alvo |
|---|---|---|
| Fase 1 | Tráfego orgânico vs. baseline | ≥ 100 % em 30 dias após o corte |
| Fase 1 | Leads registados com origem rastreável | 100 % |
| Fase 2 | Reservas pagas online | > 60 % das reservas |
| Fase 2 | Tempo até confirmação de reserva | < 15 min (mediana) |
| Fase 3 | Entregas descarregadas pelo portal | > 80 % |
| Fase 4 | Operação sem folhas de cálculo | 100 % |
| Ano 1 | Receita recorrente / receita total | > 40 % |

## 10. O que este produto **não** é

- Não é um marketplace de fotógrafos.
- Não é uma ferramenta de edição — integra-se com o fluxo de trabalho, não o substitui.
- Não é um construtor de sites para o cliente final.
- Não é software de contabilidade — emite faturas e mantém o ledger, mas o fecho contabilístico
  continua com o contabilista.
- Não é multi-país na fase 1. Angola primeiro, e bem.

## 11. Roadmap executivo

| Fase | Entrega visível para o negócio | Semanas |
|---|---|---|
| **0. Foundation** | Decisões tomadas, riscos identificados, fundação documentada | 2 |
| **1. Website + SEO** | Site novo com 8 serviços, portfólio e blog | 3 |
| **2. Booking + pagamentos** | Cliente reserva e paga por Multicaixa sem falar com ninguém | 4 |
| **3. Portal do cliente** | Cliente acompanha, descarrega e paga o remanescente | 2 |
| **4. CRM + ERP** | Operação sai das folhas de cálculo | 3 |
| **5. Marketing** | Cada lead com origem e custo conhecidos | 2 |
| **6. SaaS Projects** | Projetos de desenvolvimento geridos na plataforma | 2 |
| **7. Endurecimento** | Pronto para produção, auditado | 2 |
| **8+. Multi-tenant** | Licenciar a outros estúdios | A decidir |

**Primeiro kwanza recebido pela plataforma: fim da Fase 2 (~9 semanas).**

## 12. Riscos ao produto (não técnicos)

| Risco | Mitigação |
|---|---|
| Clientes não adotam o portal e continuam no WhatsApp | Notificações por WhatsApp com link direto; portal sem palavra-passe complexa |
| Preços públicos afastam clientes | Testar com "a partir de" antes de valores exatos |
| Falta de portfólio real trava a conversão | Produção de conteúdo próprio agendada na Fase 1 |
| Uma só pessoa a construir e a operar | Documentação e ADRs reduzem o custo de entrada de reforços |
| Multicaixa indisponível num pico | Referência e transferência como alternativas sempre visíveis |
