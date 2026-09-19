# ROADMAP V6.1 — Ciclo 2 do Conciliador Web
Data: 20/09/2026
Status: Decisões aprovadas pelo dono. Execução começa na M36 (em nova conversa).
Base: app publicado em https://moreiranelsonhenrique.github.io/conciliador_web/ (M1–M34, 296 testes).

---

## 1. Decisões aprovadas (D1–D7)

### D1 — Régua conservadora no 1:1
CONCILIADO automático exige score de texto > 0 (similaridade >= "Similaridade Texto Mínima" da configuração). Caso contrário → POSSÍVEL CORRESPONDÊNCIA.
PORQUÊ: um único controle visível; protege contra matches só por valor+data (pagamentos repetidos de mesmo valor); direção segura (mais revisão humana, nunca menos).

### D2 — Controle de saldos (com contraponto aceito)
- Toggle "Deseja controlar saldos?" na seção de configurações.
- Sistema tenta mapear coluna de saldo (papel opcional "Saldo"); se existir, pré-preenche saldo inicial por lado (primeiro saldo do arquivo) e lê o saldo final informado (último saldo / LEDGERBAL) SOMENTE LEITURA.
- Campos editáveis na interface: saldo inicial A, saldo inicial B, tolerância do check.
- Saldo final calculado (inicial + entradas − saídas) e saldo final informado NUNCA são editáveis e NÃO são campos de interface: aparecem apenas no painel de diagnóstico e na capa do export.
- Cross-check informado × calculado detecta arquivo com linhas faltando/sobrando antes de conciliar.

### D3 — Período
Período detectado (min/max de datas por lado) exibido com alerta de divergência entre lados; período editável alimenta a capa do export.

### D4 — Edição de lotes item a item
ADIADA para V6.1 (ciclo futuro). Lotes continuam confirmação/rejeição inteiros.

### D5 — PDF
EXTINTO. Formatos aceitos permanecem CSV, XLSX, XLS, OFX; mensagem de erro lista os formatos.

### D6 — Confiança de lote nas abas analíticas
Em branco ("—") + legenda: "Confiança (0–100) aplica-se a matches 1:1 (score do motor); lotes não possuem score e estão sempre sujeitos a confirmação."
PORQUÊ: confiança é medição; inventar número viola "nunca inventar" e distorce priorização de revisão.

### D7 — Botão "esquecer layouts lembrados"
NÃO haverá. Mapeamento lembrado é sugestão; os selects do mapeamento permanecem editáveis sempre.

---

## 2. Escopo do Ciclo 2 (M36–M45)

| # | Entrega | Detalhes |
|---|---|---|
| M36 | CSS visual | h3 do upload alinhado à esquerda com o input; tabela de resumo: Status à esquerda, Qtd centrado (título+células), Entradas/Saídas/Total à direita (título+células) |
| M37 | Fluxo de revisão | Remove "Corrigir vínculo" de cartões vinculados; "Conciliar manualmente" (form com busca) apenas sem vínculo (após rejeição ou não encontrado) |
| M38 | P1 (D1) | classifier: CONCILIADO automático só com texto > 0; senão POSSÍVEL; testes existentes alterados com justificativa |
| M39 | Persistência de mapeamento | js/storage.js (hash do layout + localStorage); sem botão esquecer (D7) |
| M40 | Filtros avançados | Período de/até + valor mín/máx (Decimal) em applyFilters/renderFiltersBar |
| M41 | Saldos núcleo | papel "Saldo" no mapper; js/balanceCheck.js puro (saldo calculado, informado × calculado, diferença por lado, amarração); testes |
| M42 | Saldos UI | toggle, campos empresa/banco/ag-conta, tolerância, saldos iniciais editáveis, painel de diagnóstico, período com alerta e editável |
| M43 | Export capa | Aba RESUMO_CONCILIACAO: cabeçalho (empresa/banco/ag-cta/período), CHECK DE SALDOS, RESUMO CONCILIAÇÃO, AMARRAÇÃO |
| M44 | Export analíticas | Abas FINANCEIRO e BANCO: uma linha por registro do lado, com STATUS por lado, CHAVE_CONCILIACAO, CONFIANCA_PCT (D6), REF_LINHA_MATCH, saldo se houver |
| M45 | Docs + publicação | HANDOFF/SPEC/ARQUITETURA/README/VALIDACAO atualizados; push re-deploya |

### Definições da capa (M43)
- Conciliados: soma das diferenças dos vínculos com diferença = 0 (R$ 0,00 por definição).
- Conciliados com diferença: soma das diferenças dos vínculos com 0 < |diferença| <= tolerância (e divergências aceitas).
- Pendentes — Banco (A): soma dos registros A sem vínculo atual.
- Pendentes — Financeiro (B): soma dos registros B sem vínculo (sobras).
- Identidade da amarração: diferença diagnóstica = diferença explicada + variação não explicada; variação não explicada deve fechar em R$ 0,00. Convenção de sinais fixada na M43 com teste que replica os números da imagem de inspiração (RESUMO_CONCILIACAO).
- Formatação: estrutura/blocos apenas — SheetJS comunitário não grava cores/negrito (limitação conhecida).

### Definições das analíticas (M44)
- STATUS por lado: CONCILIADO, CONCILIADO_DIFERENCA, PENDENTE_EXTRATO (lado A sem vínculo), PENDENTE_RAZAO (lado B sem vínculo).
- CHAVE_CONCILIACAO: DOC_CONTIDO_NO_HISTORICO (1:1 texto), SUMARIZACAO_LOTE_SEQUENCIAL (lote), MANUAL (correção), DIF_CENTAVOS_DOC_FUZZY (diferença <= tolerância).
- Imagens de inspiração (não copiar): RESUMO_CONCILIACAO, RAZAO_CONTABIL, EXTRATO_BANCARIO.

---

## 3. Fora do escopo do Ciclo 2
- PDF (D5).
- Edição de lotes item a item (D4 — V6.1).
- Botão esquecer layouts (D7).
- Cores/formatação rica no Excel (limitação SheetJS comunitário).

## 4. Critérios de aceite do ciclo
1. Fluxos M36–M45 funcionando no navegador e no build publicado.
2. Testes novos passando; testes existentes alterados apenas com justificativa.
3. Export com 4 abas (capa, conciliação, financeiro, banco) abrindo no Excel com células tipadas.
4. Diagnóstico detecta: descompasso interno por lado (informado ≠ calculado), divergência entre lados, variação não explicada ≠ 0.
5. Nenhum número inventado (D6); nenhum auto-CONCILIADO sem texto (D1).

## 5. Riscos
- SheetJS comunitário: capa sem cores — "formatado" significa estrutura.
- Arquivos sem coluna de saldo: fluxo manual continua disponível.
- Abas analíticas vivem apenas no export (sem tabela nova na UI).