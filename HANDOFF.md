# HANDOFF — Conciliador Financeiro V6 Web
Atualizado em: 20/09/2026
Propósito: orientar novas sessões de trabalho (humanas ou IA) sem precisar ler histórico de conversas.

---

## 1. O que é o projeto
Conciliador bancário 100% no navegador (sem backend), publicado no GitHub Pages.
Migração da versão Python/Streamlit (pasta irmã `conciliador_financeiro`) para JavaScript.
Privacidade: os arquivos nunca saem do navegador do usuário.

## 2. Estado atual
Microentregas 1 a 34 (web) concluídas.
Testes: 296 passando (`npm test`).
Git: branch `main` com remote; deploy automático via GitHub Actions (`.github/workflows/deploy.yml`) a cada push.
Publicado: https://moreiranelsonhenrique.github.io/conciliador_web/
Ciclo 2 aprovado: decisões D1–D7 e plano M36–M45 em `ROADMAP_V6_1.md`. Execução começa na M36, em nova conversa.

## 3. Como rodar
npm install
npm test          # Vitest
npm run dev       # Vite → http://localhost:5173
npm run build     # build de produção (dist/)
npm run preview   # serve o build localmente

## 4. Módulos prontos (js/)
| Arquivo | Exporta | Função |
|---|---|---|
| money.js | formatBRL(value) | Formatação R$ com decimal.js (HALF_EVEN) |
| reader.js | parseCSVString, parseCSVRows, parseExcel, parseExcelRows | Leitura CSV/Excel; delimitador auto-detectado |
| ofxReader.js | parseOFXString(text) | Leitura OFX com colunas amigáveis (Data, Valor, Descrição, Observação, Tipo, ID Transação) |
| headerDetection.js | detectHeader(rawRows, max=10) | Detecta linha de cabeçalho |
| mapper.js | inferMapping(columns) | Sugere mapeamento {date, value, description, dc, type} |
| direction.js | normalizeDirectionText(v), directionFromSign(v) | Direção ENTRADA/SAIDA/INDEFINIDO |
| records.js | parseDate, parseValue, generateId, determineDirection, buildRecords | Normalização e validação |
| scorer.js | textSimilarity, scoreValue, scoreDate, scoreText, totalScore | Scores 50 (valor) / 20 (data) / 30 (texto) |
| matcher.js | generateCandidates, findMatches1to1, findBatchMatches | Matching 1:1 e 1:N; ambiguidade de lote (ambiguous/alternative_count) |
| classifier.js | classifyMatch1to1, classifyBatchMatch, classifyNotFound | Status final; DIVERGÊNCIA por tolerância; lote sempre POSSÍVEL |
| engine.js | reconcile(recordsA, recordsB, config) | Orquestração da conciliação |
| review.js | BRegistry, ReviewableResult, createReviewableResults | Revisão humana (confirmar/rejeitar/corrigir) |
| exporter.js | exportToExcel(results, opts), downloadExcel(blob, name) | Excel 2 abas + sobras; células tipadas |
| uploader.js | detectFileType(name), readFile(file) | Upload com detecção de cabeçalho |
| mappingUi.js | renderMappingSelects, validateMapping, normalizeConfig | Lógica pura da UI de mapeamento |
| resultsUi.js | buildSummaryRows, renderSummaryTable, renderFiltersBar, applyFilters, renderResultCard, findUnmatchedB, renderUnmatchedBTable | Lógica pura da UI de resultados + sobras |
| reviewUi.js | renderActionButtons, renderCorrectForm | Lógica pura da UI de revisão |
| main.js | (orquestração) | Liga o DOM aos módulos |

## 5. Roadmap
Ciclo 2 (aprovado): M36–M45 — ver `ROADMAP_V6_1.md`.
V6.1 (futuro, fora do Ciclo 2): edição de lotes item a item.

## 6. Convenções
Microentregas: um passo focado por entrega, sempre com teste e commit.
Dinheiro: decimal.js (nunca float). Células do Excel recebem número apenas para exibição.
Datas: `new Date('2026-09-15')` é midnight UTC → usar getUTC* para formatar.
Similaridade de texto: Jaccard sobre tokens; mínimo configurável (%) para pontuar.
Status: CONCILIADO, POSSÍVEL CORRESPONDÊNCIA, DIVERGÊNCIA, NÃO ENCONTRADO.
Decisão humana: PENDING/CONFIRMED/REJECTED; origem do vínculo: AUTO/MANUAL/NONE.
Commits: mensagens convencionais em português ("feat:", "fix:", "docs:").
Confirmação de microentrega pelo dono: "Microentrega N (web) OK. npm test: X passed. Commit feito: sim."
Nunca afirmar que testes passaram sem execução real; o terminal do dono é a fonte da verdade.

## 7. Armadilhas já resolvidas (não regredir)
SheetJS: usar `js/vendor/xlsx.mjs` (oficial 0.20.3). O pacote npm `xlsx` (0.18.5) tem vulnerabilidade alta — NÃO instalar.
Vite 8: NÃO configurar `minify: 'esbuild'` (esbuild não vem embutido; o padrão oxc funciona).
CSS: o arquivo precisa estar em `css/style.css` (linkado no index.html).
CSV: delimitador auto-detectado pelo PapaParse (não forçar vírgula).
OFX: colunas amigáveis; MEMO como fallback de Descrição quando NAME ausente.
parseDate valida dia/mês reais (não aceita 32/13/2026 por rollover).
determineDirection (TIPO_DOMINANTE): só usa sinal se negativo; valor positivo sem D/C/Tipo = INDEFINIDO.
findMatches1to1: não reutiliza B já matcheado; ambiguidade (diferença < threshold) vira POSSÍVEL; propaga score_details.
findBatchMatches: lote nunca é CONCILIADO automático (sempre POSSÍVEL + revisão); 2+ combinações que somam o alvo → ambiguous + alerta.
classifier: match 1:1 com valor ou data fora da tolerância → DIVERGÊNCIA (não CONCILIADO).
Export: células tipadas (moeda com negativo vermelho, datas filtráveis); rótulos PT em Origem/Decisão; valor_a só na 1ª linha do lote; linhas de sobra "NÃO ENCONTRADO (SOBRA EM B)".
Sobras: <details> recolhido ao final da lista de resultados (antes do botão exportar).
Cartões: detalhes recolhidos por padrão; sem span `result-situacao`.
findUnmatchedB: retorna [] quando results não é array válido.
formatDateBR e datas do export usam getUTC* (timezone).
Decisões humanas vivem só na sessão; persistência de mapeamento entra na M39.

## 8. Referência de negócio (versão Streamlit)
Pasta irmã `conciliador_financeiro`: app.py, VALIDACAO.md, PARECER_TECNICO_V5-0.md.
Validação web: VALIDACAO_WEB.md (V1–V9) + estresse 30 dias (extrato_desafio_30dias_ofx, lancamentos_sistema_30dias_hard.xlsx).
Export Streamlit (conciliacao_final.xlsx) e imagens RESUMO_CONCILIACAO/RAZAO_CONTABIL/EXTRATO_BANCARIO: inspiração para M43/M44 (não copiar).