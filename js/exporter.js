import * as XLSX from './vendor/xlsx.mjs';

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
    'Origem Vínculo': reviewable ? reviewable.match_origin : 'AUTO',
    'Decisão Humana': result.human_decision || 'PENDING',

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

  // Cria worksheet a partir dos dados
  const ws = XLSX.utils.json_to_sheet(rows);

  // Ajusta largura das colunas
  const colWidths = Object.keys(rows[0] || { 'Coluna': '' }).map((key) => ({
    wch: Math.max(key.length + 2, 12),
  }));
  ws['!cols'] = colWidths;

  // Cria workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

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