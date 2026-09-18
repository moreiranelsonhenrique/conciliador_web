/**
 * Lógica pura da revisão de mapeamento de colunas (sem DOM).
 * main.js fica responsável apenas por eventos e escrita no DOM.
 */
import Decimal from 'decimal.js';

/** Papéis exibidos na revisão de mapeamento. date e value são obrigatórios. */
const ROLES = [
  { key: 'date', label: 'Data', required: true },
  { key: 'value', label: 'Valor', required: true },
  { key: 'description', label: 'Descrição', required: false },
  { key: 'dc', label: 'D/C', required: false },
  { key: 'type', label: 'Tipo', required: false },
];

/**
 * Escapa texto para uso seguro em HTML.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Valida um mapeamento. date e value são papéis obrigatórios.
 *
 * @param {Object|null} mapping  { date, value, description, dc, type }
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validateMapping(mapping) {
  const map = mapping && typeof mapping === 'object' ? mapping : {};
  const issues = [];
  if (!map.date) {
    issues.push('O papel "Data" é obrigatório. Selecione a coluna que contém as datas.');
  }
  if (!map.value) {
    issues.push('O papel "Valor" é obrigatório. Selecione a coluna que contém os valores.');
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Gera o HTML dos selects de mapeamento (função pura: retorna string).
 *
 * @param {Array<string>} columns  Nomes de colunas do arquivo
 * @param {Object|null} mapping    Mapeamento atual { date, value, description, dc, type }
 * @param {string} idPrefix        Prefixo dos IDs dos selects (ex: "mapping-a")
 * @returns {string} HTML com uma .mapping-row por papel
 */
export function renderMappingSelects(columns, mapping, idPrefix) {
  const cols = Array.isArray(columns) ? columns : [];
  const map = mapping && typeof mapping === 'object' ? mapping : {};
  const prefix = idPrefix || 'mapping';
  let html = '';
  for (const role of ROLES) {
    const current = map[role.key] || null;
    let options = `<option value=""${current === null ? ' selected' : ''}>(não mapear)</option>`;
    for (const col of cols) {
      const sel = current !== null && String(col) === String(current) ? ' selected' : '';
      options += `<option value="${escapeHtml(col)}"${sel}>${escapeHtml(col)}</option>`;
    }
    html +=
      `<div class="mapping-row">` +
      `<label for="${prefix}-${role.key}">${role.label}${role.required ? ' *' : ''}</label>` +
      `<select id="${prefix}-${role.key}" data-role="${role.key}">${options}</select>` +
      `</div>`;
  }
  return html;
}

/**
 * Normaliza as configurações vindas da UI para o formato do motor.
 * - valueTolerance: saída em string (usada com Decimal; nunca float).
 * - dateToleranceDays: inteiro >= 0.
 * - minTextSimilarityPercent: UI em porcentagem (0-100) -> fração (0-1)
 *   no campo de saída `minTextSimilarity`, que é o que scorer.totalScore lê.
 *
 * Valores ausentes/vazios recebem padrão (0.01 / 2 dias / 60%).
 * Valores não numéricos lançam erro (mensagem amigável).
 *
 * @param {Object} raw  { valueTolerance, dateToleranceDays, minTextSimilarityPercent }
 * @returns {{ valueTolerance: string, dateToleranceDays: number, minTextSimilarity: number }}
 */
export function normalizeConfig(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};

  // Tolerância de valor (R$)
  const vtRaw = r.valueTolerance == null || r.valueTolerance === '' ? '0.01' : r.valueTolerance;
  let vt;
  try {
    vt = new Decimal(vtRaw);
  } catch (e) {
    throw new Error(`Tolerância de valor inválida: ${vtRaw}`);
  }
  if (vt.isNegative()) {
    throw new Error('Tolerância de valor não pode ser negativa');
  }

  // Tolerância de data (dias)
  const dtRaw = r.dateToleranceDays == null || r.dateToleranceDays === '' ? 2 : r.dateToleranceDays;
  const days = Number(dtRaw);
  if (!Number.isFinite(days) || days < 0) {
    throw new Error(`Tolerância de data inválida: ${dtRaw}`);
  }

  // Similaridade mínima de texto: porcentagem (0-100) -> fração (0-1)
  const pctRaw =
    r.minTextSimilarityPercent == null || r.minTextSimilarityPercent === ''
      ? 60
      : r.minTextSimilarityPercent;
  const pct = Number(pctRaw);
  if (!Number.isFinite(pct)) {
    throw new Error(`Similaridade mínima inválida: ${pctRaw}`);
  }
  const clamped = Math.min(100, Math.max(0, pct));
  const minTextSimilarity = new Decimal(clamped).div(100).toNumber();

  return {
    valueTolerance: vt.toFixed(),
    dateToleranceDays: Math.floor(days),
    minTextSimilarity,
  };
}