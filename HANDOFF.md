# HANDOFF — Conciliador Financeiro V6 Web
Atualizado em: 23/09/2026
Propósito: orientar novas sessões de trabalho (humanas ou IA) sem precisar ler histórico de conversas.

---

## 1. O que é o projeto
Conciliador bancário 100% no navegador (sem backend), publicado no GitHub Pages.
Migração da versão Python/Streamlit (pasta irmã `conciliador_financeiro`) para JavaScript.
Privacidade: os arquivos nunca saem do navegador do usuário.

## 2. Estado atual
**Ciclo 1 (M1–M34):** concluído. Motor, UI, revisão, exportação e publicação.
**Ciclo 2 (M36–M45):** concluído. Saldos, filtros avançados, persistência, capa e abas analíticas.

Testes: 405 passando (`npm test`).
Git: branch `main` com remote; deploy automático via GitHub Actions (`.github/workflows/deploy.yml`).
Publicado: https://moreiranelsonhenrique.github.io/conciliador_web/

## 3. Como rodar
```bash
npm install
npm test          # Vitest
npm run dev       # Vite → http://localhost:5173
npm run build     # build de produção (dist/)
npm run preview   # serve o build localmente

## 4. Módulos prontos (js/)
Arquivo
Exporta
Função
money.js
formatBRL(value)
Formatação R$ com decimal.js (HALF_EVEN)
reader.js
parseCSVString, parseCSVRows, parseExcel, parseExcelRows
Leitura CSV/Excel; delimitador auto-detectado
ofxReader.js
parseOFXString(text)
Leitura OFX com colunas amigáveis
headerDetection.js
detectHeader(rawRows, max=10)
Detecta linha de cabeçalho
mapper.js
inferMapping(columns)
Sugere mapeamento {date, value, description, dc, type, balance}
direction.js
normalizeDirectionText(v), directionFromSign(v)
Direção ENTRADA/SAIDA/INDEFINIDO
records.js
parseDate, parseValue, generateId, determineDirection, buildRecords
Normalização e validação
scorer.js
textSimilarity, scoreValue, scoreDate, scoreText, totalScore
Scores 50 (valor) / 20 (data) / 30 (texto)
matcher.js
generateCandidates, findMatches1to1, findBatchMatches
Matching 1:1 e 1:N; ambiguidade de lote
classifier.js
classifyMatch1to1, classifyBatchMatch, classifyNotFound
Status final; DIVERGÊNCIA por tolerância; lote sempre POSSÍVEL; 1:1 com régua conservadora (D1)
engine.js
reconcile(recordsA, recordsB, config)
Orquestração da conciliação
review.js
BRegistry, ReviewableResult, createReviewableResults
Revisão humana (confirmar/rejeitar/corrigir)
storage.js
hashLayout, saveMapping, loadMapping
Persistência de mapeamento em localStorage (M39)
balanceCheck.js
parseBalanceValue, extractReportedBalances, computeSideBalance, checkSides, tyingIdentity
Núcleo puro do controle de saldos (M41)
coverSheet.js
buildCoverSheet, computeCoverSummary, computeTying
Capa RESUMO_CONCILIACAO (M43)
analyticalSheet.js
buildBankRows, buildFinancialRows, LEGENDA_CONFIANCA
Abas analíticas BANCO e FINANCEIRO (M44)
exporter.js
exportToExcel(results, opts), downloadExcel(blob, name)
Excel 4 abas + sobras; células tipadas
uploader.js
detectFileType(name), readFile(file)
Upload com detecção de cabeçalho
mappingUi.js
renderMappingSelects, validateMapping, normalizeConfig
Lógica pura da UI de mapeamento
resultsUi.js
buildSummaryRows, renderSummaryTable, renderFiltersBar, applyFilters, renderResultCard, findUnmatchedB, renderUnmatchedBTable, buildPendingRows, renderPendingTable, detectPeriodo, unionPeriodo, renderPeriodInfo, renderDiagnosticoSaldos
UI de resultados + sobras + pendências dinâmicas + período + diagnóstico
reviewUi.js
renderActionButtons, renderCorrectForm
Lógica pura da UI de revisão
main.js
(orquestração)
Liga o DOM aos módulos

5. Decisões do Ciclo 2 (D1–D7)
D1 — Régua conservadora: CONCILIADO 1:1 só com texto ≥ mínimo da config; senão POSSÍVEL.
D2 — Saldos: toggle; pré-preenche saldo inicial via coluna "Saldo" (editável); saldos finais (calculado e informado) nunca editáveis, aparecem só no diagnóstico e capa.
D3 — Período detectado + alerta de divergência + período editável na capa.
D4 — Edição de lotes item a item: adiada (V6.1).
D5 — PDF: extinto.
D6 — Confiança de lote: em branco + legenda.
D7 — Sem botão "esquecer layouts"; selects sempre editáveis.
Detalhes completos em ROADMAP_V6_1.md.

## 5b. Decisões do Ciclo 3 (D8–D10) — aprovado 24/09/2026

- **D8** — Sem revisão obrigatória antes do relatório. Export gera direto após conciliar; UI vira inspeção somente leitura (sem botões de ação).
- **D9** — Lote único auto-concilia; lote ambíguo vira pendência com alternativas listadas (motivo escrito).
- **D10** — Status canônico: `CONCILIADO`, `CONCILIADO_COM_DIFERENCA`, `PENDENTE_EXTRATO`, `PENDENTE_RAZAO`. Toda pendência recebe coluna MOTIVO.

**Contrato da ferramenta (Ciclo 3):** tudo que foi conciliado automaticamente atende critérios declarados; tudo que não atende está em Pendências com o motivo escrito.

Detalhes completos em `ROADMAP_V6_2.md`.

6. Convenções
Microentregas: um passo focado por entrega, sempre com teste e commit.
Dinheiro: decimal.js (nunca float). Células do Excel recebem número apenas para exibição.
Datas: new Date('2026-09-15') é midnight UTC → usar getUTC* para formatar.
Similaridade de texto: Jaccard sobre tokens; mínimo configurável (%) para pontuar.
Status: CONCILIADO, POSSÍVEL CORRESPONDÊNCIA, DIVERGÊNCIA, NÃO ENCONTRADO.
Decisão humana: PENDING/CONFIRMED/REJECTED; origem do vínculo: AUTO/MANUAL/NONE.
Commits: mensagens convencionais em português ("feat:", "fix:", "docs:").
Confirmação de microentrega: "Microentrega N (web) OK. npm test: X passed. Commit feito: sim."
Nunca afirmar que testes passaram sem execução real; o terminal do dono é a fonte da verdade.

7. Armadilhas já resolvidas (não regredir)
SheetJS: usar js/vendor/xlsx.mjs (oficial 0.20.3). O pacote npm xlsx (0.18.5) tem vulnerabilidade alta — NÃO instalar.
Vite 8: NÃO configurar minify: 'esbuild' (esbuild não vem embutido; o padrão oxc funciona).
CSS: o arquivo precisa estar em css/style.css.
CSV: delimitador auto-detectado pelo PapaParse (não forçar vírgula).
OFX: colunas amigáveis; MEMO como fallback de Descrição quando NAME ausente.
parseDate valida dia/mês reais (não aceita 32/13/2026 por rollover).
determineDirection (TIPO_DOMINANTE): só usa sinal se negativo; valor positivo sem D/C/Tipo = INDEFINIDO.
findMatches1to1: não reutiliza B já matcheado; ambiguidade vira POSSÍVEL; propaga score_details.
findBatchMatches: lote nunca é CONCILIADO automático; 2+ combinações que somam o alvo → ambiguous + alerta.
classifier: match 1:1 com valor ou data fora da tolerância → DIVERGÊNCIA (não CONCILIADO).
Export: células tipadas; rótulos PT em Origem/Decisão; valor_a só na 1ª linha do lote; linhas de sobra "NÃO ENCONTRADO (SOBRA EM B)".
Sobras: <details> recolhido ao final da lista de resultados.
Cartões: detalhes recolhidos por padrão; sem span result-situacao.
findUnmatchedB: retorna [] quando results não é array válido.
formatDateBR e datas do export usam getUTC* (timezone).
analyticalSheet: tolera tanto ReviewableResult quanto resultado puro (paridade com exporter).
coverSheet: convenção de sinais fixada: diagnostica = saldo_final_B − saldo_final_A; explicada = pendências_B − pendências_A − conciliados_com_diferença; variação_não_explicada = diagnostica − explicada (deve fechar em 0,00).

8. Referência de negócio (versão Streamlit)
Pasta irmã conciliador_financeiro: app.py, VALIDACAO.md, PARECER_TECNICO_V5-0.md.
Validação web: VALIDACAO_WEB.md (V1–V16) + estresse 30 dias.
Export Streamlit e imagens RESUMO_CONCILIACAO/RAZAO_CONTABIL/EXTRATO_BANCARIO: inspiração para M43/M44.

9. Roadmap futuro (V6.1 — fora do Ciclo 2)
Edição de lotes item a item.
Régua própria para auto-conciliação (se usuário pedir ajuste fino além de D1).

