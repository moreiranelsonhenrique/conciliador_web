# Arquitetura Técnica — Conciliador V6 Web
Data: 23/09/2026

## 1. Visão Geral
Aplicação web client-side (SPA) para conciliação bancária. Processamento 100% no navegador, sem backend. Dados nunca saem do computador do usuário.

## 2. Stack Tecnológica
- **Frontend:** HTML5 + CSS3 + JavaScript (ES Modules)
- **Precisão financeira:** decimal.js
- **Leitura CSV:** PapaParse (delimitador auto-detectado)
- **Leitura Excel:** SheetJS 0.20.3 (via vendor, nunca npm)
- **Leitura OFX:** Parser próprio (SGML/XML)
- **Build:** Vite
- **Testes:** Vitest
- **Deploy:** GitHub Pages via GitHub Actions

## 3. Estrutura de Diretórios

conciliador_web/
├── index.html # Página principal (SPA)
├── css/
│ └── style.css # Estilos globais
├── js/
│ ├── vendor/
│ │ └── xlsx.mjs # SheetJS 0.20.3 (vendor oficial)
│ ├── money.js # Formatação R$ (decimal.js)
│ ├── reader.js # Leitura CSV/Excel
│ ├── ofxReader.js # Leitura OFX
│ ├── headerDetection.js # Detecção de cabeçalho
│ ├── mapper.js # Inferência de mapeamento (5 papéis + saldo)
│ ├── direction.js # Normalização ENTRADA/SAIDA/INDEFINIDO
│ ├── records.js # Normalização e validação
│ ├── scorer.js # Scoring (50/20/30)
│ ├── matcher.js # Matching 1:1 e 1:N
│ ├── classifier.js # Classificação final
│ ├── engine.js # Orquestração
│ ├── review.js # Revisão humana
│ ├── storage.js # Persistência de mapeamento
│ ├── balanceCheck.js # Controle de saldos (núcleo puro)
│ ├── coverSheet.js # Capa RESUMO_CONCILIACAO
│ ├── analyticalSheet.js # Abas BANCO e FINANCEIRO
│ ├── exporter.js # Exportação Excel
│ ├── uploader.js # Upload de arquivos
│ ├── mappingUi.js # UI de mapeamento (lógica pura)
│ ├── resultsUi.js # UI de resultados (lógica pura)
│ ├── reviewUi.js # UI de revisão (lógica pura)
│ └── main.js # Orquestração DOM
├── tests/ # Testes Vitest (22 arquivos)
├── samples/ # Arquivos de exemplo (V1–V9)
├── .github/
│ └── workflows/
│ └── deploy.yml # CI/CD GitHub Pages
├── HANDOFF.md # Guia de continuidade
├── SPEC_V6_WEB.md # Especificação funcional
├── ARQUITETURA.md # Este arquivo
├── ROADMAP_V6_1.md # Decisões e plano do Ciclo 2
└── VALIDACAO_WEB.md # Validação ponta a ponta


## 4. Módulos (Responsabilidades)
### 4.1 Módulos de negócio (puros, sem DOM)
- `money.js` — Formatação R$ com decimal.js (HALF_EVEN)
- `reader.js` — Leitura CSV (PapaParse) e Excel (SheetJS)
- `ofxReader.js` — Leitura OFX (parser próprio)
- `headerDetection.js` — Detecção automática de linha de cabeçalho
- `mapper.js` — Inferência de mapeamento (6 papéis: date, value, description, dc, type, balance)
- `direction.js` — Normalização de direção PT/EN → ENTRADA/SAIDA/INDEFINIDO
- `records.js` — Normalização e validação de registros
- `scorer.js` — Scoring ponderado (valor 50 / data 20 / texto 30)
- `matcher.js` — Matching 1:1 (greedy) e 1:N (lotes com ambiguidade)
- `classifier.js` — Classificação final (CONCILIADO, POSSÍVEL, DIVERGÊNCIA, NÃO ENCONTRADO)
- `engine.js` — Orquestração: candidatos → matches → lotes → classificação
- `review.js` — Estado de revisão humana (BRegistry, ReviewableResult)
- `storage.js` — Persistência de mapeamento em localStorage
- `balanceCheck.js` — Controle de saldos (saldo calculado, informado × calculado, amarração)
- `coverSheet.js` — Construtor da capa RESUMO_CONCILIACAO
- `analyticalSheet.js` — Construtores das abas BANCO e FINANCEIRO
- `exporter.js` — Exportação Excel (4 abas + sobras)

### 4.2 Módulos de UI (lógica pura, sem DOM)
- `mappingUi.js` — Gera HTML de selects + valida mapeamento + normaliza config
- `resultsUi.js` — Gera HTML de cartões, resumo, filtros, sobras, pendências, período, diagnóstico
- `reviewUi.js` — Gera HTML de botões de ação e formulário de correção

### 4.3 Orquestração (com DOM)
- `main.js` — Liga eventos do DOM aos módulos puros, gerencia estado global

## 5. Dependências
| Dependência | Versão | Uso |
|---|---|---|
| decimal.js | ^10.x | Precisão financeira |
| papaparse | ^5.x | Leitura de CSV |
| vitest | ^5.x | Testes |
| vite | ^8.x | Build e dev server |
| SheetJS | 0.20.3 (vendor) | Leitura e escrita de Excel via `js/vendor/xlsx.mjs` |

**Nota:** O pacote npm `xlsx` (0.18.5) tem vulnerabilidade alta — NÃO instalar. Usar sempre o vendor oficial.

## 6. Fluxo de Dados

Upload → Leitura (reader/ofxReader) → Detecção de cabeçalho → Mapeamento (mapper)
→ Normalização (records) → Scoring (scorer) → Matching (matcher)
→ Classificação (classifier) → Revisão (review) → Exportação (exporter + coverSheet + analyticalSheet)


## 7. Persistência
- **Mapeamento:** localStorage (chave = hash do layout de colunas)
- **Decisões humanas:** apenas na sessão (memória)
- **Arquivos:** nunca persistidos (privacidade)

## 8. Build e Deploy
### 8.1 Build Local
```bash
npm run build     # gera dist/
npm run preview   # serve o build localmente

Observação: Vite 8 usa minificador padrão (oxc). Não configurar minify: 'esbuild'.
8.2 Deploy Automático
GitHub Actions (.github/workflows/deploy.yml):
Checkout do código
Instala dependências
Roda testes (405 testes)
Build de produção
Upload do artefato (pasta dist/)
Deploy no GitHub Pages
Gatilho: push na branch main.
9. Segurança e Privacidade
Nenhum dado é enviado para servidores externos
Nenhum uso de analytics ou tracking
SheetJS carregado localmente (vendor)
CSP recomendada para GitHub Pages (default-src 'self')
10. Limitações Conhecidas
SheetJS comunitário: não aplica cores/negrito em células (estrutura apenas)
PDF: não suportado (formato não estruturado viola princípios)
Edição de lotes item a item: adiada para V6.1

