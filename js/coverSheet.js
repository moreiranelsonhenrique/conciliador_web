/**
 * Construtor puro da capa RESUMO_CONCILIACAO do export (Microentrega 43 — M43).
 *
 * Estrutura da capa (blocos):
 *   1. CONCILIAÇÃO BANCÁRIA — Empresa, Banco, Ag/Cta, Período
 *   2. CHECK DE SALDOS      — saldos inicial/final por lado e diferença
 *   3. RESUMO CONCILIAÇÃO   — conciliados, conciliados com diferença,
 *                             pendências por lado, divergência de valor
 *   4. AMARRAÇÃO            — diferença explicada × diagnóstica × não explicada
 *
 * Convenção de sinais fixada na M43 (replica a imagem de inspiração):
 *   diferença_diagnóstica = saldo_final_financeiro − saldo_final_banco
 *   diferença_explicada   = pendências_financeiro − pendências_banco
 *                             − conciliados_com_diferença
 *   variação_não_explicada = diferença_diagnóstica − diferença_explicada
 *   (deve fechar em R$ 0,00 quando tudo está contabilizado)
 *
 * Limitação: SheetJS comunitário não aplica cores/negrito. A formatação
 * aqui é estrutura + strings em R$ (com sinal visível), não tipografia rica.
 */
import Decimal from 'decimal.js';
import { formatBRL } from './money.js';
import { formatDateBR, findUnmatchedB } from './resultsUi.js';

/**
 * Valor com sinal contábil do registro:
 * - ENTRADA:  +|valor|
 * - SAIDA:    −|valor|
 * - INDEFINIDO: sinal do próprio valor
 */
function signedValue(rec) {
  if (!rec || rec.value == null) return new Decimal(0);
  let dv;
  try { dv = new Decimal(rec.value); } catch { return new Decimal(0); }
  if (!dv.isFinite()) return new Decimal(0);
  const abs = dv.abs();
  if (rec.direction === 'ENTRADA') return abs;
  if (rec.direction === 'SAIDA') return abs.neg();
  return dv;
}

/**
 * Soma absoluta de itens B de um lote (tolerante a inválidos).
 */
function sumBatch(items) {
  let s = new Decimal(0);
  for (const bi of Array.isArray(items) ? items : []) {
    if (!bi || bi.value == null) continue;
    try {
      const d = new Decimal(bi.value);
      if (d.isFinite()) s = s.plus(d.abs());
    } catch { /* ignora */ }
  }
  return s;
}

/**
 * Diferença absoluta entre A e B (ou soma de B em lote), em Decimal.
 */
function diffAbs(rv) {
  const a = rv && rv.result && rv.result.a;
  if (!a || a.value == null) return null;
  let av;
  try { av = new Decimal(a.value).abs(); } catch { return null; }
  if (rv.is_batch) {
    return sumBatch(rv.result.batch_items || []).minus(av).abs();
  }
  const b = rv.result.b;
  if (!b || b.value == null) return null;
  let bv;
  try { bv = new Decimal(b.value).abs(); } catch { return null; }
  return av.minus(bv).abs();
}

/**
 * Calcula o RESUMO CONCILIAÇÃO da capa a partir de reviewables + recordsB.
 *
 * @param {Array<Object>} reviewables
 * @param {Array<Object>} recordsB
 * @param {string|number|Decimal} tolerance
 * @returns {Object}
 *   conciliados: Decimal (sempre 0,00 por definição)
 *   conciliadosComDiferenca: soma das |diferenças| aceitas (CONFIRMED) dentro da tolerância
 *   pendenciasBanco: soma com sinal dos registros A sem vínculo atual
 *   pendenciasFinanceiro: soma com sinal das sobras de B
 *   divergenciaValor: soma das |diferenças| de DIVERGÊNCIA não aceita
 */
export function computeCoverSummary(reviewables, recordsB, tolerance) {
  const list = Array.isArray(reviewables) ? reviewables : [];
  const bList = Array.isArray(recordsB) ? recordsB : [];
  let tol;
  try { tol = new Decimal(tolerance).abs(); } catch { tol = new Decimal('0.01'); }

  let conciliadosComDiferenca = new Decimal(0);
  let pendenciasBanco = new Decimal(0);
  let divergenciaValor = new Decimal(0);

  for (const rv of list) {
    if (!rv || !rv.result) continue;
    const a = rv.result.a;

    // Pendências de A (sem vínculo atual)
    if (!rv.has_link) {
      if (a) pendenciasBanco = pendenciasBanco.plus(signedValue(a));
      continue;
    }

    const status = rv.result.status;
    const decision = rv.human_decision;
    const diff = diffAbs(rv);

    // Conciliados com diferença: vínculo com status CONCILIADO e 0 < |diff| <= tolerância
    // (captura matches que o motor aceitou com pequena diferença, independente de revisão humana)
    if (status === 'CONCILIADO' && diff != null) {
      if (diff.gt(0) && diff.lte(tol)) {
        conciliadosComDiferenca = conciliadosComDiferenca.plus(diff);
      }
    }

    // Divergência de valor: status DIVERGÊNCIA ainda não confirmado
    if (status === 'DIVERGÊNCIA' && decision !== 'CONFIRMED' && diff != null) {
      divergenciaValor = divergenciaValor.plus(diff);
    }
  }

  const sobrasB = findUnmatchedB(list, bList);
  let pendenciasFinanceiro = new Decimal(0);
  for (const b of sobrasB) {
    pendenciasFinanceiro = pendenciasFinanceiro.plus(signedValue(b));
  }

  return {
    conciliados: new Decimal(0),
    conciliadosComDiferenca,
    pendenciasBanco,
    pendenciasFinanceiro,
    divergenciaValor,
  };
}

/**
 * Calcula a AMARRAÇÃO da capa (convenção fixada na M43).
 *
 * @param {Object|null} diag  Saída de checkSides ({ A, B, crossDifference })
 * @param {Object} summary    Saída de computeCoverSummary
 * @returns {Object} { explicada, diagnostica, naoExplicada, disponivel }
 */
export function computeTying(diag, summary) {
  const zero = new Decimal(0);
  const s = summary || {
    pendenciasBanco: zero,
    pendenciasFinanceiro: zero,
    conciliadosComDiferenca: zero,
  };
  const explicada = s.pendenciasFinanceiro
    .minus(s.pendenciasBanco)
    .minus(s.conciliadosComDiferenca);

  if (
    !diag || !diag.A || !diag.B ||
    diag.A.reportedFinal == null || diag.B.reportedFinal == null
  ) {
    return { explicada, diagnostica: zero, naoExplicada: zero, disponivel: false };
  }
  const diagnostica = diag.B.reportedFinal.minus(diag.A.reportedFinal);
  return {
    explicada,
    diagnostica,
    naoExplicada: diagnostica.minus(explicada),
    disponivel: true,
  };
}

/**
 * Formata Decimal como string R$ com sinal explícito.
 * Nunca retorna 'R$ 0,00' para null/inválido: retorna '—'.
 */
function fmt(v) {
  if (v == null) return '—';
  try {
    const d = v instanceof Decimal ? v : new Decimal(v);
    if (!d.isFinite()) return '—';
    const abs = formatBRL(d.abs());
    return d.isNegative() ? `-${abs}` : abs;
  } catch {
    return '—';
  }
}

/**
 * Monta as linhas da capa RESUMO_CONCILIACAO como array de arrays
 * (pronto para XLSX.utils.aoa_to_sheet).
 *
 * @param {Object} opts
 * @returns {{ rows: Array<Array>, summary: Object, tying: Object }}
 */
export function buildCoverSheet(opts = {}) {
  const {
    empresa = '',
    banco = '',
    agConta = '',
    periodoDe = null,
    periodoAte = null,
    diagnostico = null,
    reviewables = [],
    recordsB = [],
    tolerance = '0.01',
  } = opts;

  const summary = computeCoverSummary(reviewables, recordsB, tolerance);
  const tying = computeTying(diagnostico, summary);

  const rows = [];

  // ---- 1. CONCILIAÇÃO BANCÁRIA (cabeçalho) ----
  rows.push(['CONCILIAÇÃO BANCÁRIA', '', '']);
  rows.push(['Empresa:', empresa || '(não informado)', '']);
  rows.push(['Banco:', banco || '(não informado)', '']);
  rows.push(['Ag/Cta:', agConta || '(não informado)', '']);
  rows.push([
    'Período:',
    `${formatDateBR(periodoDe) || '—'} a ${formatDateBR(periodoAte) || '—'}`,
    '',
  ]);
  rows.push(['', '', '']);

  // ---- 2. CHECK DE SALDOS ----
  rows.push(['CHECK DE SALDOS', '', '']);
  if (diagnostico && diagnostico.A && diagnostico.B) {
    rows.push(['Saldo inicial financeiro', fmt(diagnostico.B.initial), '']);
    rows.push(['Saldo inicial banco', fmt(diagnostico.A.initial), '']);
    rows.push(['Saldo final financeiro', fmt(diagnostico.B.reportedFinal), '']);
    rows.push(['Saldo final banco', fmt(diagnostico.A.reportedFinal), '']);
    const diffSaldo =
      diagnostico.B.reportedFinal != null && diagnostico.A.reportedFinal != null
        ? diagnostico.B.reportedFinal.minus(diagnostico.A.reportedFinal)
        : null;
    rows.push(['Diferença', fmt(diffSaldo), '']);
  } else {
    rows.push(['(controle de saldos não habilitado — sem dados informados)', '', '']);
  }
  rows.push(['', '', '']);

  // ---- 3. RESUMO CONCILIAÇÃO (CRUZAMENTOS -/+) ----
  rows.push(['RESUMO CONCILIAÇÃO (CRUZAMENTOS -/+)', '', '']);
  rows.push(['Conciliados', fmt(summary.conciliados), '']);
  rows.push(['Conciliados com diferença', fmt(summary.conciliadosComDiferenca), '']);
  rows.push(['Pendências banco', fmt(summary.pendenciasBanco), '']);
  rows.push(['Pendências financeiro', fmt(summary.pendenciasFinanceiro), '']);
  rows.push(['Divergência de valor', fmt(summary.divergenciaValor), '']);
  rows.push(['', '', '']);

  // ---- 4. AMARRAÇÃO ----
  rows.push(['AMARRAÇÃO', '', '']);
  if (tying.disponivel) {
    rows.push(['Diferença explicada', fmt(tying.explicada), '']);
    rows.push(['Diferença diagnóstico', fmt(tying.diagnostica), '']);
    rows.push(['Variação não explicada', fmt(tying.naoExplicada), '']);
  } else {
    rows.push(['(sem saldos informados — amarração indisponível)', '', '']);
    rows.push(['Diferença explicada', fmt(tying.explicada), '']);
  }

  return { rows, summary, tying };
}