# Especificação Funcional — Conciliador V6 Web

**Data:** 18/09/2026  
**Status:** Em construção  
**Referência:** Baseado na SPEC_V6.md do projeto Streamlit, adaptada para ambiente web client-side.

---

## 1. Objetivo

Construir uma versão web do Conciliador Financeiro que:

1. Rode 100% no navegador (sem backend)
2. Garanta privacidade total (dados nunca saem do computador do usuário)
3. Permita publicação gratuita 24/7 no GitHub Pages
4. Mantenha a mesma lógica de negócio da versão Python/Streamlit

---

## 2. Premissas Técnicas

### 2.1 Stack

- **Frontend puro:** HTML + CSS + JavaScript (sem frameworks pesados)
- **Precisão financeira:** decimal.js (nunca float)
- **Leitura de arquivos:** PapaParse (CSV), SheetJS (Excel), parser próprio (OFX)
- **Testes:** Vitest
- **Build:** Vite
- **Hospedagem:** GitHub Pages (estático, gratuito, 24/7)

### 2.2 Privacidade

Todos os arquivos são processados **localmente no navegador**. Nenhum dado é enviado para servidores externos.

### 2.3 Persistência

Nesta versão inicial:

- **Mapeamento de colunas:** salva no `localStorage` do navegador (por layout de arquivo)
- **Decisões humanas:** apenas na sessão atual (não persistem após fechar/recarregar)

---

## 3. Fluxo de Uso

1. **Upload:** Usuário carrega Arquivo A e Arquivo B (CSV, XLSX, OFX)
2. **Análise:** Sistema detecta automaticamente colunas (Data, Valor, Descrição, D/C)
3. **Revisão de mapeamento:** Usuário pode ajustar se a detecção estiver errada
4. **Configurações:** Tolerâncias de valor, data e texto
5. **Conciliação:** Sistema cruza registros e classifica (CONCILIADO, POSSÍVEL, DIVERGÊNCIA, NÃO ENCONTRADO)
6. **Revisão humana:** Usuário confirma, rejeita ou corrige cada resultado
7. **Exportação:** Gera Excel com todos os detalhes

---

## 4. Regras de Negócio

### 4.1 Princípios

- **Correção > Confiabilidade > Rastreabilidade > Simplicidade**
- Nunca inventar correspondência (na dúvida → POSSÍVEL)
- Nunca converter valor inválido em zero
- Nunca descartar linha silenciosamente
- Nunca usar float para decisões financeiras

### 4.2 Scoring

Cada candidato a match recebe um score ponderado:

- **Valor:** 50 pontos (dentro da tolerância)
- **Data:** 20 pontos (dentro da tolerância de dias)
- **Texto:** 30 pontos (similaridade % acima do mínimo)

**Score total máximo:** 100 pontos

### 4.3 Classificação de Status

- **CONCILIADO:** Score alto, sem ambiguidade
- **POSSÍVEL:** Score médio ou ambiguidade (múltiplos candidatos)
- **DIVERGÊNCIA:** Match encontrado mas fora de tolerância
- **NÃO ENCONTRADO:** Nenhum candidato acima do threshold

### 4.4 Conciliação em Lote (1:N)

Quando um registro A tem valor que corresponde à soma de múltiplos registros B:

- Sistema detecta combinações possíveis (limitado a N itens por segurança)
- Se a soma bater dentro da tolerância, marca como POSSÍVEL LOTE
- Usuário confirma ou rejeita o lote inteiro (não edita item a item nesta fase)

---

## 5. Ações Humanas

Para cada resultado, o usuário pode:

### 5.1 Confirmar

- Marca o vínculo como aceito
- Estado: `CONFIRMED`

### 5.2 Rejeitar

- Remove o vínculo atual
- Libera o registro B para outros matches
- Estado: `REJECTED`

### 5.3 Corrigir (apenas 1:1)

- Usuário seleciona um novo registro B disponível
- Sistema valida se está dentro da tolerância
- Se fora, exige confirmação explícita
- Vínculo original é preservado para auditoria

### 5.4 Lotes

- Apenas confirmar ou rejeitar o lote inteiro
- Não é possível editar itens individualmente nesta fase

---

## 6. Exportação

### 6.1 Formato

- Uma única aba no Excel
- Uma linha por registro A

### 6.2 Campos Exportados

**Registro A:**
- linha_a, data_a, descricao_a, valor_a, direcao_a

**Status:**
- status_automatico, justificativa_automatica

**Vínculo Original (para auditoria):**
- linha_b_original, data_b_original, descricao_b_original, valor_b_original, direcao_b_original

**Vínculo Atual:**
- linha_b_atual, data_b_atual, descricao_b_atual, valor_b_atual, direcao_b_atual

**Situação Final:**
- origem_vinculo (AUTO/MANUAL/NONE)
- revisao (PENDING/CONFIRMED/REJECTED)
- situacao_final (exibição unificada)
- alertas

**Lote (se aplicável):**
- lote_id, lote_qtd_itens, lote_soma_b, lote_diferenca, lote_itens_resumo

---

## 7. Roadmap de Implementação

### Fase 1 — Fundação (atual)

- [x] Setup (Node + Vite + Vitest)
- [x] Precisão decimal (formatBRL)
- [x] Leitura de CSV
- [ ] Leitura de Excel (SheetJS)
- [ ] Leitura de OFX
- [ ] Detecção de cabeçalho

### Fase 2 — Mapeamento

- [ ] Inferência automática de colunas
- [ ] Interface de revisão de mapeamento
- [ ] Persistência de mapeamento (localStorage)

### Fase 3 — Motor de Conciliação

- [ ] Normalização de direção (PT/EN)
- [ ] Scoring (valor, data, texto)
- [ ] Matching 1:1
- [ ] Matching 1:N (lotes)
- [ ] Classificação de status

### Fase 4 — Interface de Revisão

- [ ] Painel de cartões (substitui tabela larga)
- [ ] Ações: confirmar, rejeitar, corrigir
- [ ] Lotes inline (expansíveis)
- [ ] Filtros e busca

### Fase 5 — Exportação

- [ ] Geração de Excel (SheetJS)
- [ ] Todos os campos visíveis + ocultos

### Fase 6 — Publicação

- [ ] Build para GitHub Pages
- [ ] Deploy automático
- [ ] Documentação final

---

## 8. Diferenças em Relação à Versão Streamlit

| Aspecto | Streamlit (V5) | Web (V6) |
|---|---|---|
| Execução | Servidor Python | Navegador (client-side) |
| Privacidade | Arquivos sobem para o servidor | Dados nunca saem do navegador |
| Persistência | Decisões em disco (versionadas) | Apenas mapeamento (localStorage) |
| Hospedagem | Streamlit Cloud (dorme após inatividade) | GitHub Pages (24/7) |
| Stack | Python + Streamlit | HTML + JS + Vite |
| Testes | pytest (204 testes) | Vitest (a construir) |

---

## 9. Referências

- Projeto Streamlit (V5): `conciliador_financeiro/` (pasta irmã)
- Validação ponta a ponta: `VALIDACAO.md` (projeto Streamlit)
- Parecer técnico: `PARECER_TECNICO_V5-0.md` (projeto Streamlit)