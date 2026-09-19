# 💰 Conciliador Financeiro Inteligente — V6 Web

**Versão 100% no navegador, sem backend, privacidade total.**
Os dados dos seus arquivos **nunca saem do seu computador**. Todo o processamento acontece no navegador.

## 🎯 O que faz
Concilia extratos bancários (Arquivo A) com controle financeiro (Arquivo B):
- Aceita CSV, XLSX, XLS e OFX, com detecção automática de cabeçalho e delimitador
- Mapeamento automático de colunas (Data, Valor, Descrição, D/C, Tipo) com revisão manual
- Matching 1:1 com score ponderado (valor 50 / data 20 / texto 30) e tolerâncias configuráveis
- Conciliação em lote (1:N) com itens exibidos inline e detecção de ambiguidade
- Status: CONCILIADO, POSSÍVEL CORRESPONDÊNCIA, DIVERGÊNCIA, NÃO ENCONTRADO
- Revisão humana: confirmar, rejeitar e corrigir vínculo (com auditoria do vínculo original)
- Sobras do Arquivo B (registros sem correspondente) destacadas
- Exportação Excel com 2 abas (Conciliação + Detalhe dos Lotes), moeda e datas formatadas

## 🚀 Stack
| Tecnologia | Para que |
|---|---|
| HTML + CSS + JavaScript (ES modules) | Interface |
| [decimal.js](https://github.com/MikeMcl/decimal.js/) | Precisão financeira (nunca usa float) |
| [PapaParse](https://www.papaparse.com/) | Leitura de CSV |
| SheetJS 0.20.3 (vendor oficial) | Leitura e escrita de Excel |
| [Vite](https://vite.dev/) | Dev server e build |
| [Vitest](https://vitest.dev/) | Testes automatizados (296 testes) |

## 📦 Instalação
```bash
git clone <seu-repo>
cd conciliador_web
npm install
npm run dev

Abra http://localhost:5173 no navegador.

npm test

🏗️ Build de produção

npm run build
npm run preview

📄 Estrutura
conciliador_web/
├── index.html # Página principal (SPA)
├── css/style.css # Estilos
├── js/ # Módulos de negócio, UI e orquestração (ver HANDOFF.md)
├── tests/ # Testes Vitest
├── samples/ # Arquivos de exemplo (cenários V1–V9)
├── HANDOFF.md # Guia de continuidade do projeto
├── SPEC_V6_WEB.md # Especificação funcional
├── ARQUITETURA.md # Arquitetura técnica
└── VALIDACAO_WEB.md # Validação ponta a ponta

📊 Status
Motor de conciliação completo e testado
Interface de revisão humana (cartões, lotes inline, filtros)
Exportação Excel completa
Validação ponta a ponta (V1–V9 + estresse 30 dias)
Publicação no GitHub Pages (próxima etapa)

👨💼 Autor
Nelson Henrique Moreira
GitHub: moreiranelsonhenrique
LinkedIn: moreiranh