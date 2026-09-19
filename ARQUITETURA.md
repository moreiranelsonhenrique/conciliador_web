# Arquitetura Técnica — Conciliador V6 Web

**Data:** 18/09/2026  
**Stack:** HTML + CSS + JavaScript (ES modules) + Vite + Vitest

---

## 1. Visão Geral

Aplicação web estática (Single Page Application) que roda 100% no navegador.

**Sem backend. Sem banco de dados. Sem servidor.**

Todos os arquivos são processados localmente usando APIs do navegador (FileReader, localStorage).

---

## 2. Estrutura de Pastas

conciliador_web/
├── index.html # Página principal (SPA)
├── css/
│ └── style.css # Estilos globais
├── js/
│ ├── money.js # Formatação monetária (R$, precisão decimal)
│ ├── reader.js # Leitura de arquivos (CSV, Excel, OFX)
│ ├── mapper.js # Inferência automática de colunas (a criar)
│ ├── scorer.js # Cálculo de scores (a criar)
│ ├── matcher.js # Matching 1:1 e 1:N (a criar)
│ ├── review.js # Estado de revisão humana (a criar)
│ └── exporter.js # Exportação Excel (a criar)
├── tests/
│ ├── sanity.test.js # Teste de sanidade
│ ├── money.test.js # Testes de money.js
│ ├── reader.test.js # Testes de reader.js
│ └── ... # Testes dos outros módulos
├── samples/ # Arquivos de exemplo para teste manual
├── package.json # Dependências e scripts
├── vite.config.js # Configuração do Vite (a criar)
└── README.md # Visão geral do projeto


---

## 3. Fluxo de Dados

[Upload de Arquivos]
↓
[Leitura] → reader.js (parseCSVString, parseExcel, parseOFX)
↓
[Detecção de Cabeçalho] → header_detection.js (a criar)
↓
[Mapeamento de Colunas] → mapper.js (infer_mapping)
↓
[Revisão Humana do Mapeamento] → UI (ajuste manual se necessário)
↓
[Normalização] → records.js (build_records, normaliza direção PT/EN)
↓
[Conciliação] → engine.js (reconcile)
↓
[Scoring] → scorer.js (score_valor, score_data, score_texto)
↓
[Matching] → matcher.js (find_matches_1_to_1, find_batch_matches)
↓
[Classificação] → classifier.js (classify_status)
↓
[Revisão Humana] → review.js (confirm, reject, correct)
↓
[Exportação] → exporter.js (export_to_excel)


---

## 4. Módulos (Responsabilidades)

### 4.1 Módulos de negócio (puros, sem DOM)
- `money.js` — Formatação R$ com decimal.js (HALF_EVEN)
- `reader.js` — Leitura CSV (PapaParse) e Excel (SheetJS)
- `ofxReader.js` — Leitura OFX (parser próprio)
- `headerDetection.js` — Detecção automática de linha de cabeçalho
- `mapper.js` — Inferência de mapeamento de colunas
- `direction.js` — Normalização de direção PT/EN → ENTRADA/SAIDA/INDEFINIDO
- `records.js` — Normalização e validação de registros (parseDate, parseValue, buildRecords)
- `scorer.js` — Scoring ponderado (valor 50 / data 20 / texto 30)
- `matcher.js` — Matching 1:1 (greedy) e 1:N (lotes com busca combinatória limitada)
- `classifier.js` — Classificação final (CONCILIADO, POSSÍVEL, DIVERGÊNCIA, NÃO ENCONTRADO)
- `engine.js` — Orquestração: gera candidatos → matches 1:1 → lotes → classifica
- `review.js` — Estado de revisão humana (BRegistry, ReviewableResult)
- `exporter.js` — Exportação Excel (SheetJS) + sobras de B

### 4.2 Módulos de UI (lógica pura, sem DOM)
- `mappingUi.js` — Gera HTML de selects de mapeamento + valida mapeamento + normaliza config
- `resultsUi.js` — Gera HTML de cartões, tabela de resumo, filtros + findUnmatchedB (sobras de B)
- `reviewUi.js` — Gera HTML de botões de ação (confirmar/rejeitar/corrigir) e formulário de correção

### 4.3 Orquestração (com DOM)
- `main.js` — Liga eventos do DOM aos módulos puros, gerencia estado global da sessão

### 4.4 `records.js` (a criar)

- `buildRecords(rows, mapping)` → Array de objetos normalizados
- Normaliza direção (PT/EN → ENTRADA/SAÍDA)
- Valida valores e datas
- Similar ao `core/records.py`

### 4.5 `scorer.js` (a criar)

- `scoreValue(a, b, tolerance)` → 0 a 50
- `scoreDate(a, b, tolerance_days)` → 0 a 20
- `scoreText(a, b, min_similarity)` → 0 a 30
- Similar ao `core/scorer.py`

### 4.6 `matcher.js` (a criar)

- `generateCandidates(recordsA, recordsB)` → Array de candidatos
- `findMatches1to1(candidates, config)` → Array de matches
- `findBatchMatches(recordsA, recordsB, config)` → Array de lotes
- Similar ao `core/matcher.py`

### 4.7 `classifier.js` (a criar)

- `classifyStatus(match, candidates)` → "CONCILIADO" | "POSSÍVEL" | "DIVERGÊNCIA" | "NÃO ENCONTRADO"
- Similar ao `core/classifier.py`

### 4.8 `review.js` (a criar)

- Classe `ReviewableResult` (estado de revisão)
- Classe `BRegistry` (controle de disponibilidade de registros B)
- Métodos: `confirm()`, `reject()`, `applyManualMatch()`
- Similar ao `core/review.py`

### 4.9 `exporter.js` (a criar)

- `exportToExcel(results)` → Blob (arquivo .xlsx)
- Usa SheetJS para gerar o Excel
- Uma aba, uma linha por registro A

---

## 5. Dependências

| Pacote | Versão | Para que |
|---|---|---|
| `decimal.js` | ^10.4.3 | Precisão financeira |
| `papaparse` | ^5.4.1 | Leitura de CSV |
| SheetJS | 0.20.3 (vendor) | Leitura e escrita de Excel via `js/vendor/xlsx.mjs` (npm `xlsx` 0.18.5 tem vulnerabilidade alta — não usar) |
| `vite` | ^5.0.0 | Dev server e build |
| `vitest` | ^1.0.0 | Testes automatizados |

---

## 6. Convenções

### 6.1 Nomes de Arquivos

- Módulos: camelCase (`money.js`, `reader.js`)
- Testes: `<module>.test.js` (`money.test.js`)
- Styles: kebab-case (`style.css`)

### 6.2 Nomes de Funções

- camelCase: `formatBRL`, `parseCSVString`, `inferMapping`
- Verbos no início: `parse`, `infer`, `build`, `score`, `export`

### 6.3 Nomes de Variáveis

- camelCase: `recordsA`, `mappingResult`, `scoreTotal`

### 6.4 Comentários

- JSDoc para funções públicas:

```javascript
/**
 * Formata um valor como moeda brasileira.
 * @param {Decimal|string|number} value
 * @returns {string} "R$ 1.234,56"
 */
export function formatBRL(value) { ... }

7. Padrões de Teste
7.1 Estrutura de Teste

import { describe, it, expect } from 'vitest';
import { formatBRL } from '../js/money.js';

describe('formatBRL', () => {
  it('formata valor positivo', () => {
    expect(formatBRL('1500.00')).toBe('R$ 1.500,00');
  });
});

7.2 Cobertura Esperada
Todos os módulos devem ter testes unitários
Casos de borda: valores negativos, zero, strings vazias, null
Casos de erro: argumentos inválidos devem lançar exceções

7.3 Execução

npm test          # Roda todos os testes
npm test --watch  # Modo watch (reexecuta ao salvar)

8. Build e Deploy
8.1 Build Local
npm run build     # gera dist/
npm run preview   # serve o build localmente
Observação: Vite 8 usa minificador padrão (oxc). Não configurar `minify: 'esbuild'` — o esbuild não vem embutido no Vite 8.

8.2 Deploy no GitHub Pages
Push para o repositório GitHub
Ativar GitHub Pages nas configurações (branch main, pasta dist/)
Acessar: https://<username>.github.io/<repo-name>/

9. Limitações Conhecidas
9.1 Performance
Arquivos muito grandes (>10.000 linhas) podem travar o navegador
Mitigação: paginação ou processamento em Web Workers (futuro)

9.2 Persistência
Decisões humanas não persistem entre sessões
Mitigação: exportar Excel frequentemente

9.3 Compatibilidade
Funciona em navegadores modernos (Chrome, Firefox, Edge, Safari)
Não suporta Internet Explorer