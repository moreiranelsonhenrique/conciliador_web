# ROADMAP V6.2 — Ciclo 3 (Relatório como artefato principal)

Data: 24/09/2026
Status: aprovado, pronto para execução
Dependências: Ciclo 2 (M36–M45) concluído com 405 testes

---

## 1. Motivação

Durante testes manuais dos samples V10 e revisão crítica do modelo, identificamos três pontos estruturais:

1. **Revisão obrigatória na UI é teatro.** O usuário corporativo baixa o relatório e concilia no ERP/Excel. Os botões Confirmar/Rejeitar/Corrigir dentro da ferramenta criam sensação de controle que não existe — e pior, não persistem entre sessões.
2. **O relatório é o artefato auditado.** Todo o valor deve estar ali: conciliações justificadas, pendências com motivo, prova final com resíduo zero.
3. **A assertividade teórica do motor é boa, mas escondemos incerteza.** Lote ambíguo vira "POSSÍVEL" e exige confirmação; 1:1 com diferença de centavo fica pendente de decisão. Isso transfere o ônus para o usuário onde o motor poderia fechar automaticamente.

## 2. Novo contrato da ferramenta

> **Tudo que foi conciliado automaticamente atende critérios declarados.**
> **Tudo que não atende está em Pendências, com o motivo escrito.**

### Critérios de conciliação automática

**1:1 vira CONCILIADO somente se:**
1. Score ≥ mínimo configurado; **e**
2. Similaridade de texto ≥ "Similaridade Texto Mínima" (D1 — protege contra pagamentos repetidos de mesmo valor/data); **e**
3. Sem ambiguidade (nenhum 2º candidato próximo); **e**
4. Valor e data dentro das tolerâncias configuradas.

**1:1 com valor dentro da tolerância mas ≠ 0:** vira `CONCILIADO_COM_DIFERENCA` (centavos, como no vídeo de referência).

**Lote 1:N:**
- Soma dentro da tolerância **e combinação única** (verificada por `findAllCombinations`) → **CONCILIADO automático**, método `LOTE`.
- Soma fecha mas há 2+ combinações → **PENDENTE** com motivo "N combinações possíveis" e alternativas listadas.

**Qualquer critério falhou:** pendência com motivo exato (texto fraco / 2 candidatos / valor fora / data fora / sem par / lote ambíguo).

### Status canônicos do relatório
- `CONCILIADO`
- `CONCILIADO_COM_DIFERENCA`
- `PENDENTE_EXTRATO` (lado A sem par)
- `PENDENTE_RAZAO` (lado B sem par / sobra)

Toda pendência recebe coluna **MOTIVO** com texto explicativo.

## 3. O que muda / o que não muda

**Não muda:**
- Motor de matching (scoring 50/20/30, 1:1 greedy, lotes com `findAllCombinations`)
- D1 (régua de texto mínima)
- D2 (saldos com contraponto — saldo final nunca editável)
- D3 (período detectado + alerta de divergência)
- D7 (persistência de mapeamento sem botão "esquecer")
- Núcleo `balanceCheck.js` + amarração + PROVA FINAL
- Mapeamento lembrado por hash de layout
- Células tipadas do export
- CI/CD + publicação

**Muda:**
- Camada de revisão (`review.js`, `reviewUi.js`) aposentada — não há mais gate do export
- Status DIVERGÊNCIA absorvido: fora de tolerância = pendência com motivo
- Status POSSÍVEL removido: substituído por pendência ou CONCILIADO com diferença
- Lote único auto-concilia (era sempre POSSÍVEL antes)
- UI vira inspeção somente leitura com filtros e busca — sem botões de ação
- Coluna MOTIVO em toda pendência (analíticas + capa)

## 4. Decisões do Ciclo 3

- **D8** — Sem revisão obrigatória antes do relatório. Export gera direto após conciliar.
- **D9** — Lote único auto-concilia; lote ambíguo vira pendência com alternativas listadas.
- **D10** — Status canônico (4 estados) + toda pendência com coluna MOTIVO.

## 5. Plano de execução (M46–M50)

| # | Entrega | Escopo | Testes |
|---|---|---|---|
| M46 | Documentação do Ciclo 3 | ROADMAP_V6_2.md + atualização do HANDOFF | — |
| M47 | Motor reclassificado | `classifier.js` e `engine.js` com novo modelo; testes rebaselineados | novos testes + ajustes |
| M48 | UI sem gate + inspeção | `main.js`, `resultsUi.js`, `index.html`: remove botões de ação, adiciona busca/filtros de inspeção | testes de UI |
| M49 | Export novo modelo | `exporter.js` + novas abas com MOTIVO; aposenta colunas Origem/Decisão | testes de export |
| M50 | Aposentadoria de review | remove `review.js`, `reviewUi.js`, referências; HANDOFF atualizado; publicação | regressão completa |

## 6. Regressão esperada

**Testes que devem ser rebaselineados (com justificativa documentada):**
- `tests/classifier.test.js` — testes de DIVERGÊNCIA/POSSÍVEL viram testes de PENDENTE/CONCILIADO_COM_DIFERENCA
- `tests/engine.test.js` — testes de lote POSSÍVEL viram testes de lote CONCILIADO
- `tests/review.test.js` e `tests/reviewUi.test.js` — aposentados no M50
- `tests/exporter.test.js` — ajustes de colunas (remove Origem/Decisão, adiciona MOTIVO)

**Testes que permanecem intactos:**
- Todo o núcleo (`balanceCheck`, `coverSheet`, `mapper`, `records`, `scorer`, `matcher`, `reader`, `ofxReader`, `direction`, `money`, `headerDetection`, `storage`, `sanity`)

## 7. Validação ponta a ponta esperada

Após M50, o fluxo será:
1. Upload A + B → Analisar → Conciliar
2. Tela mostra: resumo financeiro, diagnóstico de saldos (se habilitado), lista de resultados **somente leitura** com busca e filtros
3. Botão "Exportar" gera Excel com:
   - Aba CAPA (saldos + PROVA FINAL com resíduo)
   - Aba CRUZAMENTOS (ID_CONCILIACAO + campos dos dois lados)
   - Aba BANCO / RAZAO analítica com STATUS e MOTIVO
   - Aba FINANCEIRO / EXTRATO analítica com STATUS e MOTIVO
   - Abas de lote (quando houver)
   - Sobras (como PENDENTE_RAZAO com motivo "sem par")
4. Usuário leva o relatório para o ERP, corrige na origem, regenera o extrato, reprocessa na ferramenta.

## 8. Critério de conclusão do Ciclo 3

- [x] Documentação atualizada (M46)
- [ ] Motor reclassificado com testes verdes (M47)
- [ ] UI sem gate de revisão (M48)
- [ ] Export com colunas MOTIVO (M49)
- [ ] `review.js` e `reviewUi.js` removidos (M50)
- [ ] Validação manual ponta a ponta (samples V1–V16) passando
- [ ] `npm test` verde após rebaseline
- [ ] HANDOFF.md atualizado com estado final
- [ ] Publicação verde no GitHub Pages