# 💰 Conciliador Financeiro Inteligente — V6 Web

**Versão 100% no navegador, sem backend, privacidade total.**

Os dados dos seus arquivos **nunca saem do seu computador**. Todo o processamento acontece no navegador.

## 🎯 O que faz

Concilia extratos bancários (Arquivo A) com controle financeiro (Arquivo B):

- Detecta automaticamente colunas (Data, Valor, Descrição, D/C)
- Cruza registros por valor, data e similaridade textual
- Detecta conciliações em lote (1:N)
- Permite revisão humana: confirmar, rejeitar, corrigir
- Exporta Excel com todos os detalhes

## 🚀 Stack

| Tecnologia | Para que |
|---|---|
| HTML + CSS + JavaScript | Interface |
| [decimal.js](https://github.com/MikeMcl/decimal.js/) | Precisão financeira (nunca usa float) |
| [PapaParse](https://www.papaparse.com/) | Leitura de CSV |
| [Vite](https://vite.dev/) | Dev server e build |
| [Vitest](https://vitest.dev/) | Testes automatizados |

## 📦 Instalação

```bash
git clone <seu-repo>
cd conciliador_web
npm install
npm run dev

Abra http://localhost:5173 no navegador.

🧪 Testes

npm test

📄 Estrutura

conciliador_web/
├── index.html          # Página principal
├── css/
│   └── style.css       # Estilos
├── js/
│   ├── money.js        # Formatação monetária (R$ 1.234,56)
│   └── reader.js       # Leitura de CSV
├── tests/
│   ├── sanity.test.js  # Teste de sanidade
│   ├── money.test.js   # Testes de formatação
│   └── reader.test.js  # Testes de leitura
└── samples/            # Arquivos de exemplo (a criar)

📊 Status
Setup inicial (Node + Vite + Vitest)
Precisão decimal (decimal.js + formatBRL)
Leitura de CSV (PapaParse)
Leitura de Excel (SheetJS)
Leitura de OFX (parser próprio)
Mapeamento automático de colunas
Motor de conciliação (1:1 e 1:N)
Interface de revisão humana
Exportação Excel

👨‍💼 Autor
Nelson Henrique Moreira
GitHub: moreiranelsonhenrique
LinkedIn: moreiranh