# HANDOFF — Conciliador Financeiro V6 Web
Atualizado em: 20/09/2026
Propósito: orientar novas sessões de trabalho (humanas ou IA) sem precisar ler histórico de conversas.

---

## 1. O que é o projeto
Conciliador bancário 100% no navegador (sem backend), para publicação no GitHub Pages.
Migração da versão Python/Streamlit (pasta irmã `conciliador_financeiro`) para JavaScript.
Privacidade: os arquivos nunca saem do navegador do usuário.

## 2. Estado atual
Microentregas 1 a 32 (web) concluídas.
Testes: 296 passando (`npm test`).
Git local: tudo commitado (branch master).
Interface: completa e funcional (upload → mapeamento → conciliação → revisão → exportação).
Build de produção: OK (`npm run build` + `npm run preview`).
Validação: cenários V1–V9 passaram; teste de estresse 30 dias executado (ver VALIDACAO_WEB.md).

## 3. Como rodar
npm install
npm test          # Vitest
npm run dev       # Vite → http://localhost:5173
npm run build     # build de produção (pasta dist/)
npm run preview   # serve o build localmente

## 4. Módulos prontos (js/)
| Arquivo | Exporta | Função |
|---|---|---|
| money.js | formatBRL(value) | Formatação R$ com decimal.js (HALF_EVEN) |
| reader.js | parseCSVString, parseCSVRows, parseExcel, parseExcelRows | Leitura CSV/Excel; delimitador auto-detectado |
| ofxReader.js | parseOFXString(text) | Leitura OFX; colunas amigáveis (Data, Valor, Descrição, Observação, Tipo, ID Transação); MEMO como fallback de Descrição |
| headerDetection.js | detectHeader(rawRows, max=10) | Detecta linha de cabeçalho |
| mapper.js | inferMapping(columns) | Sugere mapeamento {date, value, description, dc, type} |
| direction.js | normalizeDirectionText(v), directionFromSign(v) | Direção ENTRADA/SAIDA/INDEFINIDO |
| records.js | parseDate, parseValue, generateId, determineDirection, buildRecords | Normalização e validação de registros |
| scorer.js | textSimilarity, scoreValue, scoreDate, scoreText, totalScore | Scores 50 (valor) / 20 (data) / 30 (texto) |
| matcher.js | generateCandidates, findMatches1to1, findBatchMatches | Matching 1:1 e 1:N; lotes detectam ambiguidade (ambiguous/alternative_count) |
| classifier.js | classifyMatch1to1, classifyBatchMatch, classifyNotFound | Status final; DIVERGÊNCIA por tolerância violada; lote sempre POSSÍVEL |
| engine.js | reconcile(recordsA, recordsB, config) | Orquestração da conciliação |
| review.js | BRegistry, ReviewableResult, createReviewableResults | Revisão humana (confirmar/rejeitar/corrigir) |
| exporter.js | exportToExcel(results, opts), downloadExcel(blob, name) | Excel 2 abas (Conciliação + Detalhe_dos_Lotes) + sobras de B; células tipadas (moeda/data) |
| uploader.js | detectFileType(name), readFile(file) | Upload com detecção de cabeçalho |
| mappingUi.js | renderMappingSelects, validateMapping, normalizeConfig | Lógica pura da UI de mapeamento |
| resultsUi.js | buildSummaryRows, renderSummaryTable, renderFiltersBar, applyFilters, renderResultCard, findUnmatchedB, renderUnmatchedBTable | Lógica pura da UI de resultados + sobras de B |
| reviewUi.js | renderActionButtons, renderCorrectForm | Lógica pura da UI de revisão |
| main.js | (orquestração) | Liga o DOM aos módulos puros |

## 5. Roadmap restante
Microentrega 33: atualização final da documentação (esta).
Microentrega 34: publicação no GitHub Pages.
Opcional (P1): régua conservadora no 1:1 (exigir similaridade de texto mínima para 🟢, senão 🟡).
Opcional: persistência de mapeamento em localStorage.

## 6. Convenções
Microentregas: um passo focado por entrega, sempre com teste e commit.
Dinheiro: decimal.js (nunca float). Células do Excel recebem número apenas para exibição.
Datas: `new Date('2026-09-15')` é midnight UTC → usar getUTC* para formatar.
Similaridade de texto: Jaccard sobre tokens; mínimo 0.6 para pontuar.
Status: CONCILIADO, POSSÍVEL CORRESPONDÊNCIA, DIVERGÊNCIA, NÃO ENCONTRADO.
Decisão humana: PENDING/CONFIRMED/REJECTED; origem do vínculo: AUTO/MANUAL/NONE.
Commits: mensagens convencionais em português ("feat:", "fix:", "docs:").
Confirmação de microentrega pelo dono: "Microentrega N (web) OK. npm test: X passed. Commit feito: sim."

## 7. Armadilhas já resolvidas (não regredir)
SheetJS: usar `js/vendor/xlsx.mjs` (oficial 0.20.3). O pacote npm `xlsx` (0.18.5) tem vulnerabilidade alta — NÃO instalar.
Vite 8: NÃO configurar `minify: 'esbuild'` (esbuild não vem embutido; o padrão oxc funciona).
CSS: o arquivo precisa estar em `css/style.css` (linkado no index.html). Já ficou na raiz uma vez e quebrou o visual.
parseDate valida dia/mês reais (não aceita 32/13/2026 por rollover do JS).
determineDirection (TIPO_DOMINANTE): só usa sinal se negativo; valor positivo sem D/C/Tipo = INDEFINIDO.
findMatches1to1: não reutiliza B já matcheado; ambiguidade (diferença < threshold) vira POSSÍVEL; propaga score_details.
findBatchMatches: lote nunca é CONCILIADO automático (sempre POSSÍVEL + revisão humana); se houver 2+ combinações que somam o alvo, marca ambiguous e gera alerta.
classifier: valor ou data fora da tolerância em match 1:1 → DIVERGÊNCIA (não CONCILIADO).
reader: delimitador de CSV auto-detectado (não forçar vírgula).
exporter: formatDateBR usa UTC; células de valor/data são numéricas com formato (z); sobras de B viram linhas extras; origem/decisão traduzidas para português.
findUnmatchedB: retorna [] quando results não é array válido.
Testes de data no exporter usam UTC por causa de timezone.

## 8. Referência de negócio (versão Streamlit)
Pasta irmã `conciliador_financeiro`: app.py, VALIDACAO.md (cenários V1–V11), PARECER_TECNICO_V5-0.md.
Validação web: VALIDACAO_WEB.md (V1–V9) + arquivos de estresse `extrato_desafio_30dias_ofx` e `lancamentos_sistema_30dias_hard.xlsx`.