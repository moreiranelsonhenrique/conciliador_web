/**
 * Núcleo puro do controle de saldos (Microentrega 41 — decisão D2).
 * Sem DOM: recebe dados e devolve valores/vereditos em Decimal.
 *
 * Regras do projeto respeitadas aqui:
 * - Dinheiro sempre com decimal.js (nunca float).
 * - Valor inválido nunca vira zero: é contado e reportado.
 * - Sem dado informado, nada é inventado: campos viram null.
 * - A convenção de sinais da capa (M43) NÃO é fixada neste módulo;
 *   tyingIdentity é aritmética pura (diagnóstica − explicada).
 */
import Decimal from 'decimal.js';

/**
 * Interpreta um valor de saldo vindo de célula bruta (coluna do arquivo
 * ou digitação do usuário).
 * Aceita: Decimal, número, "1234.56", "1.234,56", "-1234.56", "(1234,56)", "R$ 100,00".
 * Limitação documentada: "1.234" (só ponto) é lido como decimal 1.234 —
 * em caso de dúvida, o usuário corrige no campo editável (D2).
 * Retorna null para vazio/inválido (nunca zero, nunca lança).
 *
 * @param {*} raw
 * @returns {Decimal|null}
 */
export function parseBalanceValue(raw) {
  if (raw == null) return null;
  if (raw instanceof Decimal) return raw.isFinite() ? raw : null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? new Decimal(raw) : null;
  let s = String(raw).trim();
  if (!s) return null;

  // Negativo contábil entre parênteses: (1.234,56)
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }
  // Remove símbolo de moeda e espaços
  s = s.replace(/R\$/gi, '').replace(/\s+/g, '');
  if (!s) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Os dois presentes: o último é o separador decimal
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); // BR 1.234,56
    else s = s.replace(/,/g, ''); // US 1,234.56
  } else if (lastComma > -1) {
    // Só vírgula: decimal se a parte final tem até 2 dígitos (BR), senão milhar
    const frac = s.slice(lastComma + 1);
    s = frac.length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot > -1) {
    // Só ponto com múltiplos pontos: separadores de milhar
    if (s.split('.').length > 2) s = s.replace(/\./g, '');
    // Ponto único: mantido como decimal (limitação documentada no JSDoc)
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  try {
    const d = new Decimal(s);
    if (!d.isFinite()) return null;
    return negative ? d.neg() : d;
  } catch {
    return null;
  }
}

/**
 * Lê os saldos informados (primeiro e último valores válidos) de uma coluna
 * mapeada, na ordem das linhas do arquivo. Valores inválidos são pulados
 * sem descartar a linha. Coluna ausente/sem valores válidos → null
 * (nunca inventa).
 *
 * @param {Array<Object>} rows  Linhas do arquivo (objetos por nome de coluna)
 * @param {string|null} balanceColumn  Nome da coluna de saldo mapeada
 * @returns {{ first: Decimal|null, last: Decimal|null }}
 */
export function extractReportedBalances(rows, balanceColumn) {
  const result = { first: null, last: null };
  if (!balanceColumn || !Array.isArray(rows)) return result;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const parsed = parseBalanceValue(row[balanceColumn]);
    if (parsed == null) continue;
    if (result.first == null) result.first = parsed;
    result.last = parsed;
  }
  return result;
}

/**
 * Calcula o saldo final de um lado: inicial + entradas − saídas.
 * - ENTRADA soma |valor|; SAIDA subtrai |valor|.
 * - INDEFINIDO entra pelo próprio sinal do valor e é contado (indefinidoQtd).
 * - Valor inválido não entra na soma e é contado (valorInvalidoQtd) — nunca vira zero.
 * - Sem saldo inicial válido, computedFinal é null (não há base de cálculo).
 *
 * @param {Array<Object>} records  Registros normalizados (records.js)
 * @param {*} initialBalance  Saldo inicial (Decimal, número ou string)
 * @returns {Object} { initial, entradas, saidas, indefinido, indefinidoQtd, valorInvalidoQtd, computedFinal }
 */
export function computeSideBalance(records, initialBalance) {
  const list = Array.isArray(records) ? records : [];
  const initial = parseBalanceValue(initialBalance);
  let entradas = new Decimal(0);
  let saidas = new Decimal(0);
  let indefinido = new Decimal(0);
  let indefinidoQtd = 0;
  let valorInvalidoQtd = 0;
  for (const rec of list) {
    if (!rec) continue;
    if (rec.value == null) {
      valorInvalidoQtd += 1;
      continue;
    }
    let dv;
    try {
      dv = new Decimal(rec.value);
    } catch {
      valorInvalidoQtd += 1;
      continue;
    }
    if (!dv.isFinite()) {
      valorInvalidoQtd += 1;
      continue;
    }
    const abs = dv.abs();
    if (rec.direction === 'ENTRADA') entradas = entradas.plus(abs);
    else if (rec.direction === 'SAIDA') saidas = saidas.plus(abs);
    else {
      indefinido = indefinido.plus(dv);
      indefinidoQtd += 1;
    }
  }
  const computedFinal =
    initial == null ? null : initial.plus(entradas).minus(saidas).plus(indefinido);
  return { initial, entradas, saidas, indefinido, indefinidoQtd, valorInvalidoQtd, computedFinal };
}

/**
 * Cross-check informado × calculado por lado, com tolerância.
 * Sem saldo informado (ou sem base de cálculo) → difference/ok = null:
 * nenhum veredito é inventado.
 *
 * crossDifference = calculado B − calculado A (mesma direção da imagem de
 * inspiração: Financeiro − Banco). A exibição/convenção final é fixada na M43.
 *
 * @param {Object} opts
 * @param {Array<Object>} [opts.recordsA]
 * @param {Array<Object>} [opts.recordsB]
 * @param {*} [opts.initialA]  Saldo inicial do lado A
 * @param {*} [opts.initialB]  Saldo inicial do lado B
 * @param {*} [opts.reportedFinalA]  Saldo final informado do lado A (arquivo)
 * @param {*} [opts.reportedFinalB]  Saldo final informado do lado B (arquivo)
 * @param {string|number} [opts.tolerance='0.01']
 * @returns {{ A: Object, B: Object, crossDifference: Decimal|null }}
 */
export function checkSides({
  recordsA = [],
  recordsB = [],
  initialA = null,
  initialB = null,
  reportedFinalA = null,
  reportedFinalB = null,
  tolerance = '0.01',
} = {}) {
  let tol;
  try {
    tol = new Decimal(tolerance).abs();
  } catch {
    tol = new Decimal('0.01');
  }

  const buildCheck = (records, initialRaw, reportedRaw) => {
    const side = computeSideBalance(records, initialRaw);
    const reported = parseBalanceValue(reportedRaw);
    if (reported == null || side.computedFinal == null) {
      return { ...side, reportedFinal: reported, difference: null, ok: null };
    }
    const difference = reported.minus(side.computedFinal);
    return { ...side, reportedFinal: reported, difference, ok: difference.abs().lte(tol) };
  };

  const A = buildCheck(recordsA, initialA, reportedFinalA);
  const B = buildCheck(recordsB, initialB, reportedFinalB);
  const crossDifference =
    A.computedFinal != null && B.computedFinal != null
      ? B.computedFinal.minus(A.computedFinal)
      : null;

  return { A, B, crossDifference };
}

/**
 * Aritmética pura da amarração:
 * variação não explicada = diferença diagnóstica − diferença explicada.
 * O que compõe "diagnóstica" e "explicada" (e os sinais da capa) é fixado
 * na M43. Parte ausente → null (nunca inventa).
 *
 * @param {*} diagnosticDifference
 * @param {*} explainedDifference
 * @returns {Decimal|null}
 */
export function tyingIdentity(diagnosticDifference, explainedDifference) {
  const diag = parseBalanceValue(diagnosticDifference);
  const expl = parseBalanceValue(explainedDifference);
  if (diag == null || expl == null) return null;
  return diag.minus(expl);
}