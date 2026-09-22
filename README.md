# 💰 Conciliador Financeiro Inteligente — V6 Web

**Versão 100% no navegador, sem backend, privacidade total.**

Os dados dos seus arquivos **nunca saem do seu computador**. Todo o processamento acontece no navegador.

**🌐 App online:** [moreiranelsonhenrique.github.io/conciliador_web](https://moreiranelsonhenrique.github.io/conciliador_web/)

## 🎯 O que faz

Concilia extratos bancários (Arquivo A) com controle financeiro (Arquivo B):

- ✅ Aceita CSV, XLSX, XLS e OFX, com detecção automática de cabeçalho e delimitador
- ✅ Mapeamento automático de colunas (Data, Valor, Descrição, D/C, Tipo, Saldo) com revisão manual
- ✅ **Persistência de mapeamento** por layout de arquivo (localStorage)
- ✅ Matching 1:1 com score ponderado (valor 50 / data 20 / texto 30) e tolerâncias configuráveis
- ✅ **Régua conservadora:** CONCILIADO automático só com similaridade de texto mínima
- ✅ Conciliação em lote (1:N) com itens exibidos inline e **detecção de ambiguidade**
- ✅ Status: CONCILIADO, POSSÍVEL CORRESPONDÊNCIA, DIVERGÊNCIA, NÃO ENCONTRADO
- ✅ Revisão humana: confirmar, rejeitar e conciliar manualmente (após rejeitar)
- ✅ Sobras do Arquivo B (registros sem correspondente) destacadas
- ✅ **Pendências dinâmicas** no resumo (Banco A / Financeiro B)
- ✅ **Filtros avançados:** período de/até + valor mínimo/máximo
- ✅ **Controle de saldos** (opcional): diagnóstico informado × calculado antes de conciliar
- ✅ **Período detectado** com alerta de divergência entre lados
- ✅ Exportação Excel com **4 abas**:
  - `RESUMO_CONCILIACAO` (capa com empresa/banco/ag-cta/período, CHECK DE SALDOS, RESUMO e AMARRAÇÃO)
  - `Conciliação` (vínculos + sobras)
  - `BANCO` (analítica do lado A)
  - `FINANCEIRO` (analítica do lado B)
- ✅ Moeda com formato brasileiro (negativo em vermelho) e datas filtráveis

## 🚀 Stack

| Tecnologia | Para que |
|---|---|
| HTML + CSS + JavaScript (ES modules) | Interface |
| [decimal.js](https://github.com/MikeMcl/decimal.js/) | Precisão financeira (nunca usa float) |
| [PapaParse](https://www.papaparse.com/) | Leitura de CSV |
| SheetJS 0.20.3 (vendor oficial) | Leitura e escrita de Excel |
| [Vite](https://vite.dev/) | Dev server e build |
| [Vitest](https://vitest.dev/) | Testes automatizados (**405 testes**) |

## 📦 Instalação

```bash
git clone <seu-repo>
cd conciliador_web
npm install
npm run dev

Abra http://localhost:5173 no navegador.

🧪 Testes
npm test

🏗️ Build de produção
npm run build
npm run preview

📄 Estrutura
conciliador_web/
├── index.html            # Página principal (SPA)
├── css/style.css         # Estilos
├── js/                   # Módulos de negócio, UI e orquestração
│   ├── vendor/xlsx.mjs   # SheetJS 0.20.3 oficial
│   ├── balanceCheck.js   # Núcleo do controle de saldos
│   ├── coverSheet.js     # Capa RESUMO_CONCILIACAO
│   ├── analyticalSheet.js # Abas BANCO e FINANCEIRO
│   ├── storage.js        # Persistência de mapeamento
│   └── ... (ver HANDOFF.md)
├── tests/                # Testes Vitest (22 arquivos)
├── samples/              # Arquivos de exemplo (cenários V1–V9)
├── HANDOFF.md            # Guia de continuidade do projeto
├── SPEC_V6_WEB.md        # Especificação funcional
├── ARQUITETURA.md        # Arquitetura técnica
├── ROADMAP_V6_1.md       # Decisões D1–D7 e plano do Ciclo 2
└── VALIDACAO_WEB.md      # Validação ponta a ponta (V1–V16)

📊 Status
Motor de conciliação completo e testado
Interface de revisão humana (cartões, lotes inline, filtros avançados)
Persistência de mapeamento (localStorage)
Régua conservadora (D1)
Controle de saldos com diagnóstico pré-conciliação
Exportação Excel completa (4 abas tipadas)
Validação ponta a ponta (V1–V16 + estresse 30 dias)
Publicação no GitHub Pages com CI/CD
🔄 Ciclo 2 (concluído)
Decisões D1–D7 implementadas (ver ROADMAP_V6_1.md):
D1 — Régua conservadora no 1:1
D2 — Controle de saldos com diagnóstico
D3 — Período detectado + alerta
D4 — Edição de lotes item a item (adiada)
D5 — PDF extinto
D6 — Confiança de lote em branco
D7 — Sem botão "esquecer layouts"
👨‍💼 Autor
Nelson Henrique Moreira
GitHub: moreiranelsonhenrique
LinkedIn: moreiranh
Portfólio: moreiranelsonhenrique.github.io