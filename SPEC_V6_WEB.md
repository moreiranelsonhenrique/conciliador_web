Especificação Funcional — Conciliador V6 Web
Data: 23/09/2026
Status: Ciclo 2 completo (M1–M45)
Referência: Baseado na SPEC_V6.md do projeto Streamlit, adaptada para ambiente web client-side.
1. Objetivo
Construir uma versão web do Conciliador Financeiro que:
Rode 100% no navegador (sem backend)
Garanta privacidade total (dados nunca saem do computador do usuário)
Permita publicação gratuita 24/7 no GitHub Pages
Mantenha a mesma lógica de negócio da versão Python/Streamlit
2. Premissas Técnicas
2.1 Stack
Frontend puro: HTML + CSS + JavaScript (sem frameworks pesados)
Precisão financeira: decimal.js (nunca float)
Leitura de arquivos: PapaParse (CSV), SheetJS (Excel), parser próprio (OFX)
Testes: Vitest
Build: Vite
Hospedagem: GitHub Pages (estático, gratuito, 24/7)
2.2 Privacidade
Todos os arquivos são processados localmente no navegador. Nenhum dado é enviado para servidores externos.
2.3 Persistência
Mapeamento de colunas: salva no localStorage do navegador (por hash do layout de arquivo)
Decisões humanas: apenas na sessão atual (não persistem após fechar/recarregar)
3. Fluxo de Uso
Upload: Usuário carrega Arquivo A e Arquivo B (CSV, XLSX, XLS, OFX)
Análise: Sistema detecta automaticamente colunas (Data, Valor, Descrição, D/C, Saldo opcional)
Revisão de mapeamento: Usuário pode ajustar; mapeamento é lembrado por layout
Configurações: Tolerâncias de valor, data e texto; opcionalmente controle de saldos
Diagnóstico de saldos (opcional): Cross-check informado × calculado antes de conciliar
Conciliação: Sistema cruza registros e classifica (CONCILIADO, POSSÍVEL, DIVERGÊNCIA, NÃO ENCONTRADO)
Revisão humana: Usuário confirma, rejeita ou corrige cada resultado
Exportação: Gera Excel com 4 abas (RESUMO_CONCILIACAO, Conciliação, BANCO, FINANCEIRO)
4. Regras de Negócio
4.1 Princípios
Correção > Confiabilidade > Rastreabilidade > Simplicidade
Nunca inventar correspondência (na dúvida → POSSÍVEL)
Nunca converter valor inválido em zero
Nunca descartar linha silenciosamente
Nunca usar float para decisões financeiras
4.2 Scoring
Cada candidato a match recebe um score ponderado:
Valor: 50 pontos (dentro da tolerância)
Data: 20 pontos (dentro da tolerância de dias)
Texto: 30 pontos (similaridade % acima do mínimo)
Score total máximo: 100 pontos
4.3 Classificação de Status
CONCILIADO: Score alto, sem ambiguidade, texto ≥ mínimo (D1)
POSSÍVEL: Score médio, ambiguidade, ou texto abaixo do mínimo (D1)
DIVERGÊNCIA: Match encontrado mas fora de tolerância
NÃO ENCONTRADO: Nenhum candidato acima do threshold
4.4 Conciliação em Lote (1:N)
Sempre classificado como POSSÍVEL (revisão humana obrigatória)
Detecta ambiguidade (múltiplas combinações) com alerta
Usuário confirma ou rejeita o lote inteiro (edição item a item adiada)
4.5 Controle de Saldos (opcional)
Toggle "Deseja controlar saldos?"
Saldo inicial editável (pré-preenchido se houver coluna "Saldo")
Saldo final calculado (inicial + entradas − saídas) e informado (do arquivo) — nunca editáveis
Cross-check informado × calculado detecta arquivo com linhas faltando/sobrando
Amarração: diferença explicada = diferença diagnóstica − variação não explicada
5. Ações Humanas
Confirmar: Marca vínculo como aceito (CONFIRMED)
Rejeitar: Remove vínculo atual, libera B (REJECTED)
Conciliar manualmente: Apenas após rejeição ou não encontrado; select com busca
6. Exportação
6.1 Formato
4 abas no Excel:
RESUMO_CONCILIACAO (capa): cabeçalho, CHECK DE SALDOS, RESUMO CONCILIAÇÃO, AMARRAÇÃO
Conciliação: uma linha por vínculo A + linhas de sobra B
BANCO: uma linha por registro A com STATUS, CHAVE, CONFIANCA, REF_LINHA_MATCH
FINANCEIRO: uma linha por registro B com STATUS, CHAVE, CONFIANCA, REF_LINHA_MATCH
6.2 Células tipadas
Valores: numéricos com formato de moeda (negativo vermelho)
Datas: serial Excel com formato dd/mm/yyyy (filtráveis)
Rótulos de Origem/Decisão em português
7. Roadmap de Implementação
Fase 1 — Fundação ✅
Setup (Node + Vite + Vitest)
Precisão decimal (formatBRL)
Leitura de CSV (delimitador auto-detectado)
Leitura de Excel (SheetJS 0.20.3 seguro via vendor)
Leitura de OFX (colunas amigáveis)
Detecção de cabeçalho
Fase 2 — Mapeamento ✅
Inferência automática de colunas
Interface de revisão de mapeamento (Data e Valor obrigatórios)
Persistência de mapeamento (localStorage, por hash de layout)
Fase 3 — Motor de Conciliação ✅
Normalização de direção (PT/EN)
Scoring (valor, data, texto)
Matching 1:1 (com ambiguidade → POSSÍVEL)
Matching 1:N (lotes com detecção de ambiguidade)
Classificação de status (inclui DIVERGÊNCIA por tolerância)
Régua conservadora D1 (CONCILIADO só com texto ≥ mínimo)
Fase 4 — Interface de Revisão ✅
Painel de cartões (substitui tabela larga)
Ações: confirmar, rejeitar, conciliar manualmente (após rejeitar)
Lotes inline (expansíveis, recolhidos por padrão)
Filtros básicos + avançados (período + valor)
Sobras do Arquivo B (recolhidas ao final)
Pendências dinâmicas no resumo
Fase 5 — Saldos ✅
Papel "Saldo" no mapper
balanceCheck.js puro (saldo calculado, informado × calculado, amarração)
UI de saldos (toggle, campos, diagnóstico, período)
Fase 6 — Exportação ✅
Geração de Excel (SheetJS)
Aba Conciliação + Detalhe_dos_Lotes + linhas de sobras de B
Células tipadas (moeda com negativo vermelho, datas filtráveis)
Aba capa RESUMO_CONCILIACAO (cabeçalho + CHECK DE SALDOS + RESUMO + AMARRAÇÃO)
Abas analíticas BANCO e FINANCEIRO (STATUS, CHAVE, CONFIANCA com regra D6)
Fase 7 — Publicação ✅
Build de produção (Vite)
Deploy no GitHub Pages (GitHub Actions)
Documentação final
8. Diferenças em Relação à Versão Streamlit
Aspecto
Streamlit (V5)
Web (V6)
Execução
Servidor Python
Navegador (client-side)
Privacidade
Arquivos sobem para o servidor
Dados nunca saem do navegador
Persistência
Decisões em disco (versionadas)
Mapeamento em localStorage
Hospedagem
Streamlit Cloud
GitHub Pages (24/7)
Stack
Python + Streamlit
HTML + JS + Vite
Testes
pytest (204 testes)
Vitest (405 testes)
9. Referências
Projeto Streamlit (V5): conciliador_financeiro/ (pasta irmã)
Validação ponta a ponta: VALIDACAO.md (projeto Streamlit)
Parecer técnico: PARECER_TECNICO_V5-0.md (projeto Streamlit)
10. Decisões e desvios documentados (pós-implementação)
Exportação com 4 abas: capa RESUMO_CONCILIACAO + Conciliação + BANCO + FINANCEIRO (além de Detalhe_dos_Lotes quando há lotes).
Lotes sempre POSSÍVEIS: exigem confirmação humana (paridade com Streamlit).
Ambiguidade de lote: 2+ combinações que somam o valor de A → alerta e revisão.
DIVERGÊNCIA automática: match 1:1 fora de tolerância.
Régua conservadora D1: CONCILIADO 1:1 só com texto ≥ mínimo.
Confiança de lote em branco (D6): nunca inventar número.
Saldos opcionais: toggle + diagnóstico pré-conciliação.
Persistência de mapeamento: por hash do layout, sem botão esquecer.
PDF extinto (D5): formatos aceitos: CSV, XLSX, XLS, OFX.