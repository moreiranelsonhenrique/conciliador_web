/**
 * Construtor puro das abas analíticas do export (Microentrega 44 — M44).
 *
 * Aba BANCO (lado A): uma linha por registro A, com STATUS do lado A.
 * Aba FINANCEIRO (lado B): uma linha por registro B, com STATUS do lado B.
 *
 * STATUS por lado (conforme ROADMAP V6.1):
 *   - BANCO: CONCILIADO | CONCILIADO_DIFERENCA | PENDENTE_EXTRATO
 *   - FINANCEIRO: CONCILIADO | CONCILIADO_DIFERENCA | PENDENTE_RAZAO
 *
 * CHAVE_CONCILIACAO:
 *   - DOC_CONTIDO_NO_HISTORICO: 1:1 com score de texto > 0
 *   - SUMARIZACAO_LOTE_SEQUENCIAL: lote
 *   - MANUAL: vínculo manual (match_origin === 'MANUAL')
 *   - DIF_CENTAVOS_DOC_FUZZY: diferença <= tolerância
 *
 * CONFIANCA_PCT (regra D6):
 *   - 1:1: score_details.total (0-100)
 *   - Lote: em branco ("") — lotes não têm score; legenda documenta.
 *   - Sem vínculo: em branco ("")
 *
 * REF_LINHA_MATCH: linha(s) do outro lado (vírgula para lotes).
 * Saldo: lido da coluna mapeada no papel 'balance' (M41), quando existir.
 */
import Decimal from 'decimal.js';

/**
 * Normaliza um item para o formato esperado pelas funções de linha.
 * Aceita tanto ReviewableResult (com rv.result, rv.has_link, ...) quanto
 * resultado puro ({ a, b, status, batch_items, human_decision, ... }).
 * Mantém paridade com o exporter.js, que também aceita ambos os tipos.
 */
function toReviewableLike(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.result && typeof item.result === 'object' && item.result.a) {
    return item;
  }
  const result = item;
  const hasBatch = Array.isArray(result.batch_items) && result.batch_items.length > 0;
  const hasB = !!(result.b && result.b.id);
  return {
    result,
    has_link: hasB || hasBatch,
    human_decision: result.human_decision || 'PENDING',
    is_batch: hasBatch,
    match_origin: (hasB || hasBatch) ? 'AUTO' : 'NONE',
    current_b_id: hasB ? result.b.id : null,
    current_batch_ids: hasBatch ? result.batch_items.map((b) => b.id) : [],
  };
}
/**
 * Lê o saldo da linha original do arquivo, se houver coluna mapeada.
 * @param {Object} record  Registro normalizado (tem original_row)
 * @param {Array<Object>} fileRows  Linhas originais do arquivo
 * @param {Object} mapping  Mapeamento do lado (pode ter mapping.balance)
 * @returns {string}  Valor cru da célula ou ""
 */
function readBalance(record, fileRows, mapping) {
  if (!mapping || !mapping.balance || !Array.isArray(fileRows)) return '';
  const idx = (record.original_row || 0) - 1;
  if (idx < 0 || idx >= fileRows.length) return '';
  const row = fileRows[idx];
  if (!row) return '';
  const v = row[mapping.balance];
  return v == null ? '' : String(v);
}

/**
 * Calcula a diferença absoluta entre A e B(s) em Decimal.
 * Retorna null se não houver valores válidos.
 */
function computeAbsDiff(rv) {
  const a = rv && rv.result && rv.result.a;
  if (!a || a.value == null) return null;
  let av;
  try { av = new Decimal(a.value).abs(); } catch { return null; }
  if (rv.is_batch) {
    let soma = new Decimal(0);
    for (const bi of rv.current_batch_ids || []) {
      // Busca no result.batch_items (dados originais)
      const item = (rv.result.batch_items || []).find((x) => x && x.id === bi);
      if (item && item.value != null) {
        try { soma = soma.plus(new Decimal(item.value).abs()); } catch { /* ignora */ }
      }
    }
    return soma.minus(av).abs();
  }
  const b = rv.result.b;
  if (!b || b.value == null) return null;
  let bv;
  try { bv = new Decimal(b.value).abs(); } catch { return null; }
  return av.minus(bv).abs();
}

/**
 * Determina a CHAVE_CONCILIACAO de um reviewable vinculado.
 * @param {Object} rv  ReviewableResult com vínculo ativo
 * @param {number} tolerance  Tolerância de valor como número
 * @returns {string}
 */
function classifyKey(rv, tolerance) {
  if (!rv.has_link) return '';
  if (rv.match_origin === 'MANUAL') return 'MANUAL';
  if (rv.is_batch) return 'SUMARIZACAO_LOTE_SEQUENCIAL';

  // 1:1
  const scoreText =
    rv.result && rv.result.score_details && rv.result.score_details.text != null
      ? rv.result.score_details.text
      : 0;
  const diff = computeAbsDiff(rv);
  const tol = new Decimal(tolerance || '0.01');
  if (diff != null && diff.gt(0) && diff.lte(tol)) {
    return 'DIF_CENTAVOS_DOC_FUZZY';
  }
  if (scoreText > 0) return 'DOC_CONTIDO_NO_HISTORICO';
  return 'DOC_CONTIDO_NO_HISTORICO'; // fallback: 1:1 sempre recebe chave textual
}

/**
 * STATUS do lado BANCO (A).
 * - PENDENTE_EXTRATO: sem vínculo atual
 * - CONCILIADO_DIFERENCA: vínculo confirmado com 0 < diff <= tolerância
 * - CONCILIADO: vínculo confirmado com diff = 0
 * - Vínculos PENDING ainda não decididos ficam PENDENTE_EXTRATO (não auto-classifica).
 */
function statusA(rv, tolerance) {
  if (!rv || !rv.has_link || rv.human_decision !== 'CONFIRMED') {
    return 'PENDENTE_EXTRATO';
  }
  const diff = computeAbsDiff(rv);
  if (diff == null) return 'CONCILIADO';
  const tol = new Decimal(tolerance || '0.01');
  if (diff.gt(0) && diff.lte(tol)) return 'CONCILIADO_DIFERENCA';
  if (diff.isZero()) return 'CONCILIADO';
  return 'CONCILIADO'; // diferença > tolerância mas confirmado — usuário aceitou
}

/**
 * Linha da aba BANCO para um reviewable.
 */
function buildBankRow(rv, fileARows, mappingA, tolerance) {
  const a = rv.result.a;
  const status = statusA(rv, tolerance);
  const chave = status === 'PENDENTE_EXTRATO' ? '' : classifyKey(rv, tolerance);
  const confianca =
    status === 'PENDENTE_EXTRATO' || rv.is_batch
      ? ''
      : rv.result.score_details && rv.result.score_details.total != null
        ? String(rv.result.score_details.total)
        : '';
  let refLinha = '';
  if (status !== 'PENDENTE_EXTRADO' && rv.has_link) {
    if (rv.is_batch) {
      const linhas = (rv.current_batch_ids || [])
        .map((id) => {
          const bi = (rv.result.batch_items || []).find((x) => x && x.id === id);
          return bi ? String(bi.original_row) : '';
        })
        .filter(Boolean);
      refLinha = linhas.join(', ');
    } else if (rv.result.b) {
      refLinha = String(rv.result.b.original_row);
    }
  }
  return {
    Linha: a.original_row != null ? a.original_row : '',
    Data: a.date ? a.date.toISOString().slice(0, 10) : '',
    Descricao: a.description_original || '',
    Valor: a.value != null ? a.value.toString() : '',
    Direcao: a.direction || '',
    Saldo: readBalance(a, fileARows, mappingA),
    STATUS: status,
    CHAVE_CONCILIACAO: chave,
    CONFIANCA_PCT: confianca,
    REF_LINHA_MATCH: refLinha,
  };
}

/**
 * Linhas da aba BANCO (lado A).
 * @param {Array<Object>} reviewables
 * @param {Array<Object>} fileARows  Linhas originais do arquivo A
 * @param {Object} mappingA
 * @param {string|number} tolerance
 * @returns {Array<Object>}
 */
export function buildBankRows(reviewables, fileARows, mappingA, tolerance) {
  const list = Array.isArray(reviewables) ? reviewables : [];
  return list
    .map((raw) => toReviewableLike(raw))
    .filter(Boolean)
    .map((rv) => buildBankRow(rv, fileARows, mappingA, tolerance));
}

/**
 * Constrói mapa B.id -> { rv, isBatch } para consulta rápida.
 */
function buildBIndex(reviewables) {
  const index = new Map();
  const list = Array.isArray(reviewables) ? reviewables : [];
  for (const raw of list) {
    const rv = toReviewableLike(raw);
    if (!rv) continue;
    if (rv.current_b_id) {
      index.set(rv.current_b_id, { rv, isBatch: false });
    }
    for (const id of rv.current_batch_ids || []) {
      index.set(id, { rv, isBatch: true });
    }
  }
  return index;
}

/**
 * STATUS do lado FINANCEIRO (B).
 * - PENDENTE_RAZAO: B não vinculado a nenhum A
 * - CONCILIADO_DIFERENCA: vínculo confirmado com 0 < diff <= tolerância
 * - CONCILIADO: vínculo confirmado com diff = 0 (ou diferença aceita > tol)
 */
function statusB(rv, tolerance) {
  if (!rv) return 'PENDENTE_RAZAO';
  if (rv.human_decision !== 'CONFIRMED') return 'PENDENTE_RAZAO';
  const diff = computeAbsDiff(rv);
  if (diff == null) return 'CONCILIADO';
  const tol = new Decimal(tolerance || '0.01');
  if (diff.gt(0) && diff.lte(tol)) return 'CONCILIADO_DIFERENCA';
  if (diff.isZero()) return 'CONCILIADO';
  return 'CONCILIADO';
}

/**
 * Linha da aba FINANCEIRO para um registro B.
 */
function buildFinancialRow(b, bIndex, fileBRows, mappingB, tolerance) {
  const entry = bIndex.get(b.id);
  const rv = entry ? entry.rv : null;
  const isBatch = entry ? entry.isBatch : false;
  const status = statusB(rv, tolerance);
  let chave = '';
  let confianca = '';
  let refLinha = '';
  if (rv && status !== 'PENDENTE_RAZAO') {
    chave = classifyKey(rv, tolerance);
    if (!isBatch && rv.result.score_details && rv.result.score_details.total != null) {
      confianca = String(rv.result.score_details.total);
    }
    // Ref: linha do A
    refLinha = rv.result.a && rv.result.a.original_row != null
      ? String(rv.result.a.original_row)
      : '';
  }
  return {
    Linha: b.original_row != null ? b.original_row : '',
    Data: b.date ? b.date.toISOString().slice(0, 10) : '',
    Descricao: b.description_original || '',
    Valor: b.value != null ? b.value.toString() : '',
    Direcao: b.direction || '',
    Saldo: readBalance(b, fileBRows, mappingB),
    STATUS: status,
    CHAVE_CONCILIACAO: chave,
    CONFIANCA_PCT: confianca,
    REF_LINHA_MATCH: refLinha,
  };
}

/**
 * Linhas da aba FINANCEIRO (lado B). Inclui sobras (PENDENTE_RAZAO).
 * @param {Array<Object>} reviewables
 * @param {Array<Object>} recordsB  Registros B normalizados
 * @param {Array<Object>} fileBRows  Linhas originais do arquivo B
 * @param {Object} mappingB
 * @param {string|number} tolerance
 * @returns {Array<Object>}
 */
export function buildFinancialRows(reviewables, recordsB, fileBRows, mappingB, tolerance) {
  const bIndex = buildBIndex(reviewables);
  const list = Array.isArray(recordsB) ? recordsB : [];
  return list.map((b) => buildFinancialRow(b, bIndex, fileBRows, mappingB, tolerance));
}

/**
 * Legenda da confiança (D6) para ser incluída como nota nas abas analíticas.
 */
export const LEGENDA_CONFIANCA =
  'Confiança (0–100) aplica-se a matches 1:1 (score do motor); ' +
  'lotes não possuem score e estão sempre sujeitos a confirmação humana.';