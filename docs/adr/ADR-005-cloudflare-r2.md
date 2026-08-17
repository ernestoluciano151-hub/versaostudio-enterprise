# ADR-005 — Armazenamento de ficheiros: Cloudflare R2

- **Estado:** Aceite
- **Data:** 2026-08-05
- **Decisores:** Backend Lead, DevOps Lead, Fundador (custo)

---

## Contexto

O produto principal da Versão Digital são ficheiros pesados:

| Tipo | Tamanho típico | Volume mensal estimado |
|---|---|---|
| Fotografia RAW | 25–50 MB/foto | 200–800 fotos por sessão |
| Fotografia entregue (JPEG) | 5–15 MB | 50–200 por sessão |
| Vídeo bruto 4K | 2–8 GB/projeto | 5–15 projetos |
| Vídeo final | 200 MB–2 GB | 5–15 |
| Ficheiros de design (PSD, AI) | 50–500 MB | 10–30 |

Estimativa conservadora: **300 GB a 1 TB de armazenamento acumulado no primeiro ano**, com
tráfego de saída (download por clientes) de dimensão comparável ao volume entregue.

Em armazenamento de objetos, o custo dominante não é guardar — é **entregar**. Cada cliente
que descarrega a sua galeria gera egress. Cada revisão gera egress outra vez.

---

## Decisão

**Cloudflare R2**, com dois buckets:

| Bucket | Conteúdo | Acesso |
|---|---|---|
| `versaostudio` | Entregas de clientes, originais, documentos | **Privado.** Apenas URLs pré-assinadas |
| `versaostudio-public` | Logótipos, imagens de marketing, OG images | Público, servido pelo CDN |

### Padrão de acesso

```
Upload:   browser → POST /api/files/presign → URL pré-assinada (TTL 15 min)
                  → PUT direto do browser para o R2
                  → confirmação de checksum → FileObject + AuditLog

Download: browser → GET /api/files/[id]/download
                  → verificação de posse (organizationId + clientId)
                  → URL assinada (TTL 5 min) → redirect
                  → FileAccessLog (quem, quando, IP, bytes)
```

**A aplicação nunca transporta bytes.** Um upload de 4 GB através de uma função serverless
excede tempo, memória e paciência. O browser fala diretamente com o R2; a aplicação apenas
autoriza e regista.

---

## Alternativas consideradas

| Alternativa | Egress | Avaliação |
|---|---|---|
| **AWS S3** | ~0,09 USD/GB | Padrão da indústria, ecossistema completo. **Rejeitado pelo egress**: 500 GB de downloads num mês custam ~45 USD só de saída, e o valor cresce com o sucesso. Custo imprevisível para um negócio de conteúdo pesado. |
| **Cloudflare R2** | **0 USD** | Armazenamento a ~0,015 USD/GB/mês, **egress gratuito**, API compatível com S3. |
| **Backblaze B2** | Gratuito até 3× o armazenamento | Barato e competente, mas ecossistema e integração com CDN menos maduros; sem a integração nativa com a Cloudflare que já usamos para DNS/WAF. |
| **Supabase Storage** | Limitado por plano | Cómodo, mas acopla mais uma camada ao mesmo fornecedor e os limites de tamanho de ficheiro são apertados para vídeo. |
| **Google Drive / Dropbox** | — | O que a empresa usa hoje. Sem API adequada a controlo de acesso por cliente, sem auditoria de downloads, sem integração com faturação. É exatamente o problema a resolver. |
| **WeTransfer** | — | Estado atual de facto para entregas. Links expiram, sem rastreio, sem posse. |

**O egress gratuito é a decisão.** Com S3, um cliente que descarregue três vezes a mesma
galeria de 20 GB custa dinheiro de cada vez. Com R2, custa zero. Num negócio cujo produto é
entregar ficheiros grandes, isto muda a economia unitária.

---

## Consequências

**Positivas**
- Custo de armazenamento previsível e linear; downloads não penalizam a margem.
- API S3-compatível: o adapter usa o SDK da AWS; migrar para S3 seria trocar o endpoint.
- Integração natural com a Cloudflare que já serve DNS, WAF e CDN do domínio.
- Uploads e downloads diretos mantêm as funções serverless dentro dos limites.

**Negativas / custos aceites**
- Ecossistema menor que o S3: sem Glacier, sem lifecycle policies tão ricas, sem eventos
  nativos tão completos. Retenção implementada por nós (`Deliverable.purgeAt` + cron).
- Sem transcodificação nativa de vídeo. Se for preciso gerar pré-visualizações, será um
  serviço à parte (Cloudflare Stream ou processamento local antes do upload).
- Consistência: R2 é *strongly consistent* para leituras após escrita, mas o adapter não deve
  assumir semânticas exclusivas do S3.
- Dependência de mais um serviço Cloudflare — concentração de fornecedor. Aceite: a API
  compatível com S3 mantém a saída barata.

---

## Regras que decorrem desta decisão

1. **Bucket privado por omissão.** Nada de acesso público direto a entregas de clientes.
2. URLs pré-assinadas: 15 min para upload, 5 min para download. Nunca mais.
3. Verificação de tipo por **magic bytes**, não por extensão nem `Content-Type` enviado.
4. Limite de tamanho por tipo de ficheiro, imposto no `presign`, não só no browser.
5. Nome do ficheiro no storage é gerado (`storageKey`); o nome original é apenas metadado.
6. Todo o download escreve `FileAccessLog`. Sem exceções.
7. Checksum SHA-256 verificado após upload; divergência invalida o ficheiro.
8. Retenção contratual em `Deliverable.purgeAt`; a purga é executada por cron e **registada
   em auditoria**.
9. Custo de armazenamento monitorizado com alerta — é a rubrica que cresce silenciosamente.

---

## Critérios de revisão

Reavaliar se: for necessária transcodificação de vídeo em escala · o armazenamento ultrapassar
5 TB (renegociar ou repensar retenção) · surgir requisito de residência de dados em Angola.
