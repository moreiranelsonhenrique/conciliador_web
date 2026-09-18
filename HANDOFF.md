# HANDOFF — Conciliador Financeiro V6 Web

Atualizado em: 19/09/2026
Propósito: orientar novas sessões de trabalho (humanas ou IA) sem precisar ler histórico de conversas.

---

## 1. O que é o projeto

- Conciliador bancário 100% no navegador (sem backend), para publicação no GitHub Pages.
- Migração da versão Python/Streamlit (pasta irmã `conciliador_financeiro`) para JavaScript.
- Privacidade: os arquivos nunca saem do navegador do usuário.

## 2. Estado atual

- Microentregas 1 a 20 (web) concluídas.
- Testes: 185 passando (`npm test`).
- Git local: tudo commitado (branch master).
- Interface: HTML/CSS prontos e funcionais visualmente; `js/main.js` ainda é placeholder.

## 3. Como rodar

npm install
npm test          # Vitest
npm run dev       # Vite → http://localhost:5173
npm run build     # build de produção (pasta dist/)

## 4. Módulos prontos (js/)

| Arquivo | Exporta | Função |
|---|---|---|
| money.js | formatBRL(value) | Formatação R$ com decimal.js (HALF_EVEN) |
| reader.js | parseCSVString, parseCSVRows, parseExcel, parseExcelRows | Leitura CSV/Excel |
| ofxReader.js | parseOFXString(text) | Leitura OFX (SGML/XML) |
| headerDetection.js | detectHeader(rawRows, max=10) | Detecta linha de cabeçalho |
| mapper.js | inferMapping(columns) | Sugere mapeamento {date, value, description, dc, type} |
| direction.js | normalizeDirectionText(v), directionFromSign(v) | Direção ENTRADA/SAIDA/INDEFINIDO |
| records.js | parseDate, parseValue, generateId, determineDirection, buildRecords | Normalização e validação de registros |
| scorer.js | textSimilarity, scoreValue, scoreDate, scoreText, totalScore | Scores 50 (valor) / 20 (data) / 30 (texto) |
| matcher.js | generateCandidates, findMatches1to1, findBatchMatches | Matching 1:1 e 1:N |
| classifier.js | classifyMatch1to1, classifyBatchMatch, classifyNotFound | Status final |
| engine.js | reconcile(recordsA, recordsB, config) | Orquestração da conciliação |
| review.js | BRegistry, ReviewableResult, createReviewableResults | Revisão humana (confirmar/rejeitar/corrigir) |
| exporter.js | exportToExcel(results, opts), downloadExcel(blob, name) | Exportação Excel |
| uploader.js | detectFileType(name), readFile(file) | Upload com detecção de cabeçalho |

## 5. Roadmap restante

- Microentrega 21: main.js — upload → analisar → revisão de mapeamento (ligar o DOM)
- Microentrega 22: main.js — conciliar + painel de resultados (cartões, lotes inline)
- Microentrega 23: main.js — ações de revisão (confirmar/rejeitar/corrigir) + exportar
- Microentrega 24: samples de teste manual + validação ponta a ponta (cenários V1–V9 adaptados)
- Microentrega 25: atualização final da documentação + build de produção
- Microentrega 26: publicação no GitHub Pages

## 6. Convenções

- Microentregas: um passo focado por entrega, sempre com teste e commit.
- Dinheiro: decimal.js (nunca float).
- Datas: `new Date('2026-09-15')` é midnight UTC → usar getUTC* para formatar.
- Similaridade de texto: Jaccard sobre tokens; mínimo 0.6 para pontuar.
- Status: CONCILIADO, POSSÍVEL CORRESPONDÊNCIA, DIVERGÊNCIA, NÃO ENCONTRADO.
- Decisão humana: PENDING/CONFIRMED/REJECTED; origem do vínculo: AUTO/MANUAL/NONE.
- Commits: mensagens convencionais em português ("feat:", "fix:", "docs:").
- Confirmação de microentrega pelo dono: "Microentrega N (web) OK. npm test: X passed. Commit feito: sim."

## 7. Armadilhas já resolvidas (não regredir)

- SheetJS: usar `js/vendor/xlsx.mjs` (oficial 0.20.3). O pacote npm `xlsx` (0.18.5) tem vulnerabilidade alta — NÃO instalar.
- CSS: o arquivo precisa estar em `css/style.css` (linkado no index.html). Já ficou na raiz uma vez e quebrou o visual.
- parseDate valida dia/mês reais (não aceita 32/13/2026 por rollover do JS).
- determineDirection (TIPO_DOMINANTE): só usa sinal se negativo; valor positivo sem D/C/Tipo = INDEFINIDO.
- findMatches1to1: não reutiliza B já matcheado; ambiguidade (diferença < threshold) vira POSSÍVEL.
- Testes de data no exporter usam UTC por causa de timezone.

## 8. Referência de negócio (versão Streamlit)

- Pasta irmã `conciliador_financeiro`: app.py, VALIDACAO.md (cenários V1–V11), PARECER_TECNICO_V5-0.md.
- Os cenários V1–V9 servirão de base para a validação ponta a ponta da versão web.