# Validação Ponta a Ponta — Conciliador V6 Web

Data: 19/09/2026
Status: Em validação manual

---

## Metodologia

Cada cenário foi testado manualmente seguindo o fluxo:
1. Carregar arquivos A e B
2. Analisar (verificar mapeamento)
3. Conciliar (verificar resultados)
4. Comparar com o esperado

---

## Resultados

### V1 — Matching básico 1:1
**Arquivos:** `samples/v1_banco.csv` + `samples/v1_financeiro.csv`
**Esperado:** 3 resultados CONCILIADO
**Status:** ✅ PASSOU

---

### V2 — Detecção de cabeçalho
**Arquivos:** `samples/v2_banco.csv` + `samples/v2_financeiro.csv`
**Esperado:** Cabeçalho detectado na linha 4, 2 resultados CONCILIADO
**Status:** ✅ PASSOU

---

### V3 — OFX + normalização
**Arquivos:** `samples/v3_extrato.ofx` + `samples/v3_financeiro.csv`
**Esperado:** OFX lido corretamente, 2 resultados CONCILIADO
**Status:** ✅ PASSOU

---

### V4 — Conciliação em lote 1:N
**Arquivos:** `samples/v4_banco.csv` + `samples/v4_financeiro.csv`
**Esperado:** 1 resultado CONCILIADO como lote com 3 itens
**Status:** ✅ PASSOU

---

### V5 — Divergência de data
**Arquivos:** `samples/v5_banco.csv` + `samples/v5_financeiro.csv`
**Esperado:** 1 resultado DIVERGÊNCIA (tolerância 2 dias)
**Teste adicional:** Com tolerância 5 dias → CONCILIADO
**Status:** ✅ PASSOU

---

### V6 — Ambiguidade
**Arquivos:** `samples/v6_banco.csv` + `samples/v6_financeiro.csv`
**Esperado:** 1 resultado POSSÍVEL CORRESPONDÊNCIA
**Status:** ✅ PASSOU

---

### V7 — Registros ausentes
**Arquivos:** `samples/v7_banco.csv` + `samples/v7_financeiro.csv`
**Esperado:** 1 CONCILIADO + 1 NÃO ENCONTRADO
**Status:** ✅ PASSOU

---

### V8 — Valor inválido
**Arquivos:** `samples/v8_banco.csv` + `samples/v8_financeiro.csv`
**Esperado:** 1 CONCILIADO + 1 NÃO ENCONTRADO com alerta "Valor inválido"
**Status:** ✅ PASSOU

---

### V9 — Cenário misto
**Arquivos:** `samples/v9_banco.csv` + `samples/v9_financeiro.csv`
**Esperado:** Mix de CONCILIADO + LOTE + NÃO ENCONTRADO + alerta
**Status:** ✅ PASSOU
---

## Resultados
V1 Matching básico 1:1 — ✅ PASSOU (3 CONCILIADO)
V2 Detecção de cabeçalho — ✅ PASSOU (cabeçalho na linha 4, 2 CONCILIADO)
V3 OFX + normalização — ✅ PASSOU (2 CONCILIADO)
V4 Lote 1:N — ✅ PASSOU (1 lote com 3 itens)
V5 Divergência de data — ✅ PASSOU (DIVERGÊNCIA com tolerância 2; CONCILIADO com tolerância 5)
V6 Ambiguidade — ✅ PASSOU (POSSÍVEL CORRESPONDÊNCIA)
V7 Registros ausentes — ✅ PASSOU (1 CONCILIADO + 1 NÃO ENCONTRADO)
V8 Valor inválido — ✅ PASSOU (alerta "Valor inválido", nunca zero)
V9 Cenário misto — ✅ PASSOU

## Teste de estresse (30 dias)
Arquivos: extrato_desafio_30dias_ofx + lancamentos_sistema_30dias_hard.xlsx.
Totais idênticos aos da versão Streamlit (R$ 60.260,64 movimentados).
Diferenças documentadas e tratadas: lotes agora nascem POSSÍVEIS (paridade Streamlit);
ambiguidade do lote de -R$ 5.000 detectada com alerta; sobras de B exibidas e exportadas.