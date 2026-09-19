import * as XLSX from './vendor/xlsx.mjs';
import { findUnmatchedB, formatDateBR as formatDateBRUi, formatMoneyOrInvalid } from './resultsUi.js';

/**
 * Formata uma data Date para string dd/mm/yyyy.
 * @param {Date|null} d
 * @returns {string}
 */
function formatDateBR(d) {
  if (!d || isNaN(d.getTime())) return '';
  // Usa métodos UTC para evitar problemas de timezone
  // (datas criadas com new Date('2026-09-15') são midnight UTC)
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata um valor Decimal para string brasileira.
 * @param {*} v
 * @returns {string}
 */
function formatValueBR(v) {
  if (v == null) return '';
  const num = Number(v);
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Tradução dos códigos internos para português na exportação
const ORIGEM_PT = { AUTO: 'Automático', MANUAL: 'Manual', NONE: 'Nenhum' };
const DECISAO_PT = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', REJECTED: 'Rejeitado' };

function translateOrigem(v) {
  return ORIGEM_PT[v] || v || '';
}

function translateDecisao(v) {
  return DECISAO_PT[v] || v || '';
}

// Formatos de célula do Excel
const MONEY_FORMAT = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy';

// Colunas que viram célula numérica de moeda / data
const MONEY_COLUMNS = new Set(['Valor A', 'Valor B', 'valor_a', 'valor_b']);
const DATE_COLUMNS = new Set(['Data A', 'Data B', 'data_b']);

/**
 * Converte string numérica BR ("1.500,00" / "-1.500,00") em número.
 * Uso exclusivo de exibição (célula do Excel); decisões usam Decimal.
 */
function parseBRNumber(str) {
  if (str == null || str === '') return null;
  const cleaned = String(str).replace(/\./g, '').replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Converte "dd/mm/yyyy" em serial de data do Excel (dias desde 1899-12-30),
 * calculado via UTC para não sofrer efeito de timezone.
 */
function dateSerialFromBR(str) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(str || '').trim());
  if (!m) return null;
  const days = Math.round(Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86400000);
  return days + 25569;
}

/**
 * Decide o tipo de célula de cada valor na planilha.
 */
function toCell(header, value) {
  if (MONEY_COLUMNS.has(header)) {
    const num = parseBRNumber(value);
    if (num !== null) return { t: 'n', v: num, z: MONEY_FORMAT };
    return { t: 's', v: value == null ? '' : String(value) };
  }
  if (DATE_COLUMNS.has(header)) {
    const serial = dateSerialFromBR(value);
    if (serial !== null) return { t: 'n', v: serial, z: DATE_FORMAT };
    return { t: 's', v: value == null ? '' : String(value) };
  }
  if (typeof value === 'number') return { t: 'n', v: value };
  return { t: 's', v: value == null ? '' : String(value) };
}

/**
 * União ordenada das chaves de todas as linhas (cabecalho da planilha).
 */
function collectHeaders(rows) {
  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers;
}

/**
 * Constrói a linha de exportação para um resultado de conciliação.
 *
 * @param {Object} result  Resultado do reconcile ou ReviewableResult.result
 * @param {Object} [reviewable]  ReviewableResult opcional (para vínculos corrigidos)
 * @returns {Object}  Linha da exportação
 */
function buildExportRow(result, reviewable = null) {
  const a = result.a || {};
  const b = result.b || {};
  const isBatch = Array.isArray(result.batch_items) && result.batch_items.length > 0;

  // Determina o vínculo atual (pode ter sido corrigido manualmente)
  let linhaB = '';
  let dataB = '';
  let descB = '';
  let valorB = '';

  if (isBatch) {
    linhaB = `LOTE (${result.batch_items.length} itens)`;
    descB = result.batch_items
      .map((bi) => `[L${bi.original_row}] ${bi.description_original}`)
      .join('; ');
    const soma = result.batch_items.reduce(
      (acc, bi) => (bi.value ? acc + Number(bi.value) : acc),
      0
    );
    valorB = formatValueBR(soma);
  } else if (b && b.id) {
    linhaB = b.original_row;
    dataB = formatDateBR(b.date);
    descB = b.description_original || '';
    valorB = formatValueBR(b.value);
  }

  return {
    // Registro A
    'Linha A': a.original_row ?? '',
    'Data A': formatDateBR(a.date),
    'Descrição A': a.description_original || '',
    'Valor A': formatValueBR(a.value),
    'Dir A': a.direction || '',

    // Registro B (ou lote)
    'Linha B': linhaB,
    'Data B': dataB,
    'Descrição B': descB,
    'Valor B': valorB,

    // Status e revisão
    'Status': result.status || '',
    'Justificativa': result.justification || '',
    'Origem Vínculo': translateOrigem(reviewable ? reviewable.match_origin : 'AUTO'),
    'Decisão Humana': translateDecisao(result.human_decision || 'PENDING'),

    // Vínculo original (para auditoria em caso de correção)
    'Linha B Original': reviewable && reviewable.original_b_id !== reviewable.current_b_id
      ? result.b?.original_row ?? ''
      : '',

    // Alertas
    'Alertas': (result.alerts || []).join('; '),
  };
}

/**
 * Gera o arquivo Excel de exportação a partir dos resultados da conciliação.
 *
 * @param {Array<Object>} results  Resultados do reconcile ou array de ReviewableResult
 * @param {Object} [options]
 * @param {string} [options.fileName]  Nome do arquivo (sem extensão)
 * @param {string} [options.sheetName]  Nome da aba
 * @returns {Object}  { fileName, workbook, blob }
 */
/**
 * Constrói as linhas da aba Detalhe_dos_Lotes (uma linha por item de lote).
 * Espelha a aba "Detalhe_dos_Lotes" da versão Streamlit, para comparação lado a lado.
 *
 * @param {Array<Object>} results  Resultados (puros ou ReviewableResult)
 * @returns {Array<Object>}  Linhas de detalhe de lote
 */
function buildBatchDetailRows(results) {
  const detailRows = [];
  for (const item of results || []) {
    const result = item && item.result ? item.result : item;
    if (!result || !Array.isArray(result.batch_items) || result.batch_items.length === 0) {
      continue;
    }
    const a = result.a || {};
    const loteId = `LOTE-A${a.original_row ?? ''}`;
    const items = result.batch_items;
    for (let i = 0; i < items.length; i++) {
      const bi = items[i];
      detailRows.push({
        'id_lote': loteId,
        'linha_a': a.original_row ?? '',
        'descricao_a': a.description_original || '',
        'valor_a': i === 0 ? formatValueBR(a.value) : '',
        'linha_b': bi.original_row ?? '',
        'data_b': formatDateBR(bi.date),
        'descricao_b': bi.description_original || '',
        'valor_b': formatValueBR(bi.value),
        'direcao_b': bi.direction || '',
      });
    }
  }
  return detailRows;
}
export function exportToExcel(results, options = {}) {
  const fileName = options.fileName || 'conciliacao_resultado';
  const sheetName = options.sheetName || 'Conciliação';
  if (!Array.isArray(results)) {
    throw new TypeError('exportToExcel espera um array de resultados');
  }

  // Normaliza: aceita tanto resultados puros quanto ReviewableResults
  const rows = results.map((item) => {
    if (item && item.result) {
      // É um ReviewableResult
      return buildExportRow(item.result, item);
    }
    // É um resultado puro
    return buildExportRow(item, null);
  });

  // --- Microentrega 25: sobras do Arquivo B (registros B sem vínculo atual) ---
  const unmatchedSource = Array.isArray(options.unmatchedB) ? options.unmatchedB : results;
  const unmatched = findUnmatchedB(unmatchedSource, options.recordsB || []);
  for (const b of unmatched) {
    rows.push({
      'Linha A': '',
      'Data A': '',
      'Descrição A': '',
      'Valor A': '',
      'Dir A': '',
      'Linha B': b.original_row != null ? b.original_row : '',
      'Data B': formatDateBRUi(b.date),
      'Descrição B': b.description_original || '',
      'Valor B': b.value != null ? formatMoneyOrInvalid(b.value) : '',
      'Dir B': b.direction || '',
      'Status': 'NÃO ENCONTRADO (SOBRA EM B)',
      'Justificativa': 'Registro presente apenas no Arquivo B (sem vínculo)',
      'Origem Vínculo': 'Nenhum',
      'Decisão Humana': '',
      'Linha B Original': '',
      'Alertas': '',
    });
  }

  // Cria worksheet com células tipadas (moeda e data reais, não texto)
  const headers = collectHeaders(rows);
  const matrix = rows.length === 0
    ? []
    : [
        headers.map((h) => ({ t: 's', v: h })),
        ...rows.map((row) => headers.map((h) => toCell(h, row[h]))),
      ];
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const colWidths = headers.map((key) => ({ wch: Math.max(key.length + 2, 12) }));
  ws['!cols'] = colWidths;

  // Cria workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Microentrega B: aba Detalhe_dos_Lotes (uma linha por item de lote)
  const batchDetailRows = buildBatchDetailRows(results);
  if (batchDetailRows.length > 0) {
    const loteHeaders = collectHeaders(batchDetailRows);
    const loteMatrix = [
      loteHeaders.map((h) => ({ t: 's', v: h })),
      ...batchDetailRows.map((row) => loteHeaders.map((h) => toCell(h, row[h]))),
    ];
    const wsLotes = XLSX.utils.aoa_to_sheet(loteMatrix);
    const loteColWidths = loteHeaders.map((key) => ({ wch: Math.max(key.length + 2, 12) }));
    wsLotes['!cols'] = loteColWidths;
    XLSX.utils.book_append_sheet(wb, wsLotes, 'Detalhe_dos_Lotes');
  }

  // Gera blob para download (funciona no navegador)
  let blob = null;
  if (typeof Blob !== 'undefined') {
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  return {
    fileName: `${fileName}.xlsx`,
    workbook: wb,
    blob,
    rows,
    batchDetailRows,
  };
}

/**
 * Dispara o download do arquivo Excel no navegador.
 *
 * @param {Blob} blob  Blob do arquivo
 * @param {string} fileName  Nome do arquivo com extensão
 */
export function downloadExcel(blob, fileName) {
  if (typeof document === 'undefined') {
    throw new Error('downloadExcel só funciona no navegador');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}