# 12 — Plano de migração do site atual

**Objetivo:** passar de um site estático em GitHub Pages para a nova plataforma sem
interrupção de serviço, sem perda de SEO e com possibilidade de reverter a qualquer momento.

---

## 1. Ponto de partida (auditado em 2026-08-05)

| Item | Estado atual |
|---|---|
| Repositório | `ernestoluciano151-hub/versaodigitallda.com` (público, `main`) |
| Hosting | GitHub Pages + CNAME `www.versaodigitallda.com` |
| CDN/DNS | Cloudflare |
| Stack | HTML/CSS/JS vanilla, sem build |
| Páginas | 5 (`index`, `fotografia`, `videoclips`, `design`, `edicao-video`) |
| Assets | `assets/css/pages.css`, `assets/js/index.js`, `assets/js/pages.js` |
| Backend | Nenhum |
| Formulário | Sem destino verificável |
| Último commit | `2fcb820` — "SEO & accessibility audit" |

**Problemas conhecidos a corrigir:**
1. `og:image` aponta para `/assets/img/og-cover.jpg` — **a pasta não existe no repositório**.
   Todas as partilhas em redes sociais aparecem sem imagem.
2. `index.html` tem CSS embutido enquanto as sub-páginas usam `pages.css` — estilos duplicados.
3. `index.js` e `pages.js` repetem quase o mesmo código com IDs diferentes.
4. Sem dados estruturados, sem página de portfólio, sem blog.

---

## 2. Estratégia: coexistência, não substituição abrupta

O site novo é construído em paralelo. O antigo continua a servir tráfego até ao momento do
corte, e **fica intacto durante 60 dias** depois dele, como plano de reversão.

```
Hoje         GitHub Pages ──▶ www.versaodigitallda.com          (produção)
Fases 0–1    Vercel        ──▶ staging.versaodigitallda.com     (noindex, protegido)
Corte        Vercel        ──▶ www.versaodigitallda.com          (produção)
             GitHub Pages  ──▶ legacy.versaodigitallda.com       (intacto, 60 dias)
```

---

## 3. Passo 1 — Correções imediatas no site atual (2 dias, antes de tudo)

Não faz sentido esperar 5 meses para corrigir bugs que custam leads hoje.

- [ ] Criar `assets/img/og-cover.jpg` (1200×630) e commitar — **resolve o bug mais visível**
- [ ] Adicionar JSON-LD `Organization` + `LocalBusiness` ao `index.html`
- [ ] Ligar o formulário de contacto a um destino real (Formspree ou similar) até o backend
      existir, para não perder leads no entretanto
- [ ] Verificar que o Search Console está ligado e a recolher dados
- [ ] Registar o baseline: impressões, cliques, posições e páginas de entrada dos últimos 90 dias

**Porquê primeiro:** o baseline é impossível de reconstruir depois. E cada semana com o
`og:image` partido é partilha desperdiçada.

---

## 4. Passo 2 — Baseline (1 semana, em paralelo)

Documentar em `docs/baseline-seo-2026-08.md`:

- Export completo do Search Console (queries, páginas, países, dispositivos)
- Posições das 20 keywords principais
- Core Web Vitals de campo (CrUX)
- Tráfego e origens dos últimos 90 dias
- Backlinks conhecidos
- Volume atual de leads por canal (WhatsApp vs. formulário)

Sem estes números, é impossível saber se a migração correu bem ou mal.

---

## 5. Passo 3 — Construção paralela (Fases 0–1 do roadmap)

Site novo em `staging.versaodigitallda.com`:

- `X-Robots-Tag: noindex` em todas as respostas
- Proteção por palavra-passe (Vercel Password Protection)
- Conteúdo real, não *lorem ipsum* — o objetivo é comparar

**Regra de paridade:** nenhuma página nova entra em produção com menos conteúdo útil que a
antiga. Um redesenho bonito com menos texto é uma perda de SEO disfarçada de melhoria.

| Página antiga | Página nova | Requisito mínimo |
|---|---|---|
| `/fotografia.html` | `/servicos/fotografia` | ≥ conteúdo atual + FAQ + preços + portfólio |
| `/videoclips.html` | `/servicos/videoclipes` | idem |
| `/design.html` | `/servicos/design-branding` | idem |
| `/edicao-video.html` | `/servicos/edicao-video` | idem |
| `/` | `/` | copy novo + prova social + 8 serviços |

---

## 6. Passo 4 — Ensaio de corte (2 dias)

Executar em staging, com resultados registados:

- [ ] Os 4 redirects `.html` → nova rota devolvem 301 (teste E2E)
- [ ] Nenhuma cadeia de redirects (301 → 301)
- [ ] Todas as páginas devolvem 200
- [ ] JSON-LD válido no Rich Results Test
- [ ] Sitemap dinâmico gera os URLs corretos
- [ ] `robots.txt` bloqueia `/admin`, `/cliente`, `/api`
- [ ] Lighthouse ≥ 90/100/95 em todas as páginas públicas
- [ ] Canónicos absolutos com `www`
- [ ] `og:image` a resolver (verificado no Facebook Sharing Debugger)
- [ ] Formulário cria `Lead` com UTM
- [ ] Testado em 3G simulado e em telemóvel real

---

## 7. Passo 5 — Corte (1 dia, terça a quinta, fora de horas)

> Nunca à sexta-feira. Nunca antes de um feriado.

**T-24 h**
- [ ] Backup completo do repositório atual (tag `pre-migration-2026-XX`)
- [ ] Baixar TTL do DNS na Cloudflare para 300 s
- [ ] Congelar alterações de conteúdo
- [ ] Avisar a equipa

**T-0 (janela de ~2 h)**
1. Remover `noindex` do site novo
2. Apontar `www.versaodigitallda.com` para o Vercel na Cloudflare
3. Criar `legacy.versaodigitallda.com` a apontar para o GitHub Pages (com `noindex`)
4. Verificar propagação a partir de várias redes
5. Testar os 4 redirects em produção, um a um, manualmente
6. Submeter o novo sitemap no Search Console
7. Pedir indexação das 5 páginas principais
8. Confirmar que Sentry e analytics recebem dados
9. Fazer uma reserva de teste de ponta a ponta (se a Fase 2 já estiver ativa)

**T+2 h**
- [ ] Todas as páginas a 200
- [ ] Todos os 301 corretos
- [ ] Sem picos de erro no Sentry
- [ ] Web Vitals dentro do orçamento
- [ ] Restaurar TTL do DNS para 3600 s

---

## 8. Passo 6 — Vigilância (4 semanas)

**Dias 1–7 — verificação diária**
- Search Console: erros de rastreio, cobertura, 404
- Logs de 404 → criar redirect ou página
- Sentry: erros novos
- Leads a chegar (comparar com o baseline)

**Semanas 2–4 — verificação semanal**
- Posições vs. baseline
- Impressões e cliques orgânicos
- Core Web Vitals de campo
- `Redirect.hitCount` — quais estão realmente a ser usados

---

## 9. Critérios de reversão

Reverter (apontar o DNS de volta para o GitHub Pages) se ocorrer **qualquer** um:

- Queda > 25 % em impressões orgânicas durante 7 dias consecutivos
- Erros 5xx acima de 1 % dos pedidos durante mais de 1 hora
- Fluxo de pagamento com falhas não resolúveis em 2 horas
- Perda de dados de qualquer tipo

Reverter é uma mudança de DNS — questão de minutos, porque o site antigo se manteve intacto.
Depois da reversão: post-mortem escrito antes de qualquer nova tentativa.

---

## 10. Encerramento (60 dias depois)

- [ ] Tráfego orgânico ≥ 100 % do baseline durante 30 dias consecutivos
- [ ] Todos os redirects com tráfego residual documentados (mantêm-se indefinidamente)
- [ ] `legacy.versaodigitallda.com` desativado
- [ ] Repositório antigo arquivado no GitHub (não apagado)
- [ ] Post-mortem da migração escrito: o que correu bem, o que não correu, o que se aprendeu
