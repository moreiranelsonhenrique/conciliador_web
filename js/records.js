import Decimal from 'decimal.js';
import { normalizeDirectionText, directionFromSign } from './direction.js';

/**
 * Tenta converter um texto de data em objeto Date.
 * Aceita formatos: dd/mm/yyyy, yyyy-mm-dd, yyyy-mm-dd HH:MM:SS, dd/mm/yyyy HH:MM:SS.
 * Valida que o mês e dia são válidos (não faz rollover silencioso).
 *
 * @param {*} value
 * @returns {{ date: Date|null, original: string, status: string, message: string }}
 */
export function parseDate(value) {
  const original = value == null ? '' : String(value).trim();

  if (!original) {
    return { date: null, original, status: 'MISSING', message: 'Data ausente' };
  }

  // Tenta formatos conhecidos
  const patterns = [
    { 
      regex: /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/, 
      build: (m) => {
        const day = +m[1];
        const month = +m[2];
        const year = +m[3];
        const d = new Date(year, month - 1, day);
        // Valida que não houve rollover (ex: 32/13/2026)
        if (d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year) {
          return null;
        }
        return d;
      }
    },
    { 
      regex: /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/, 
      build: (m) => {
        const year = +m[1];
        const month = +m[2];
        const day = +m[3];
        const d = new Date(year, month - 1, day);
        // Valida que não houve rollover
        if (d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year) {
          return null;
        }
        return d;
      }
    },
  ];

  for (const p of patterns) {
    const m = original.match(p.regex);
    if (m) {
      const d = p.build(m);
      if (d && !isNaN(d.getTime())) {
        return { date: d, original, status: 'OK', message: '' };
      }
    }
  }

  return { date: null, original, status: 'INVALID', message: `Data inválida: ${original}` };
}

/**
 * Tenta converter um texto de valor em Decimal.
 * Aceita formatos: 1234.56 (internacional) e 1.234,56 (brasileiro).
 * Detecta formato brasileiro pela presença de vírgula como separador decimal.
 *
 * @param {*} value
 * @returns {{ value: Decimal|null, original: string, status: string, message: string }}
 */
export function parseValue(value) {
  const original = value == null ? '' : String(value).trim();

  if (!original) {
    return { value: null, original, status: 'MISSING', message: 'Valor ausente' };
  }

  // Detecta formato brasileiro: usa vírgula como decimal
  const hasComma = original.includes(',');
  const hasDot = original.includes('.');
  let normalized;

  if (hasComma && (!hasDot || original.lastIndexOf(',') > original.lastIndexOf('.'))) {
    normalized = original.replace(/\./g, '').replace(',', '.');
  } else if (hasDot && !hasComma) {
    normalized = original;
  } else if (hasComma && hasDot && original.lastIndexOf('.') > original.lastIndexOf(',')) {
    normalized = original.replace(/,/g, '');
  } else {
    normalized = original.replace(/[^\d.,-]/g, '');
  }

  normalized = normalized.replace(/\s/g, '').replace(/[R$\u00a3\u20ac]/g, '');

  try {
    const dec = new Decimal(normalized);
    return { value: dec, original, status: 'OK', message: '' };
  } catch (e) {
    return { value: null, original, status: 'INVALID', message: `Valor inválido: ${original}` };
  }
}

/**
 * Gera ID único para um registro, usando fonte + linha original.
 * @param {string} source "A" ou "B"
 * @param {number} rowIndex Índice da linha (0-based)
 * @returns {string}
 */
export function generateId(source, rowIndex) {
  return `${source}${rowIndex}`;
}

/**
 * Determina a direção final de um registro aplicando o modo configurado.
 *
 * Modos:
 * - TIPO_DOMINANTE (padrão): usa D/C ou Tipo. Sinal só é usado se ambos ausentes E valor for negativo.
 * - STRICT_CONFLICT: se D/C e sinal do valor contradizem, retorna INDEFINIDO.
 *
 * @param {Object} params
 * @param {string} params.dcValue  Valor da coluna D/C
 * @param {string} params.typeValue  Valor da coluna Tipo
 * @param {*} params.signValue  Valor numérico (para inferir por sinal, usado em OFX)
 * @param {string} [params.mode='TIPO_DOMINANTE']
 * @returns {{ direction: string, message: string }}
 */
export function determineDirection({ dcValue, typeValue, signValue, mode = 'TIPO_DOMINANTE' }) {
  const fromDC = normalizeDirectionText(dcValue);
  const fromType = normalizeDirectionText(typeValue);
  const fromSign = signValue != null ? directionFromSign(signValue) : 'INDEFINIDO';

  // Modo TIPO_DOMINANTE: prioriza Tipo, depois D/C, depois sinal (apenas se negativo)
  if (mode === 'TIPO_DOMINANTE') {
    if (fromType !== 'INDEFINIDO') {
      return { direction: fromType, message: '' };
    }
    if (fromDC !== 'INDEFINIDO') {
      return { direction: fromDC, message: '' };
    }
    // Para CSV/Excel genérico, só usa sinal se for explicitamente negativo (saída)
    // Valores positivos sem D/C nem Tipo ficam INDEFINIDO (não podemos inferir entrada)
    if (fromSign === 'SAIDA') {
      return { direction: 'SAIDA', message: '' };
    }
    return { direction: 'INDEFINIDO', message: '' };
  }

  // Modo STRICT_CONFLICT: se há contradição entre D/C e sinal, marca INDEFINIDO
  if (mode === 'STRICT_CONFLICT') {
    const candidates = [fromDC, fromType, fromSign].filter((d) => d !== 'INDEFINIDO');
    if (candidates.length === 0) {
      return { direction: 'INDEFINIDO', message: '' };
    }
    const first = candidates[0];
    const allSame = candidates.every((d) => d === first);
    if (allSame) {
      return { direction: first, message: '' };
    }
    return {
      direction: 'INDEFINIDO',
      message: `Conflito de direção: D/C=${fromDC}, Tipo=${fromType}, Sinal=${fromSign}`,
    };
  }

  return { direction: 'INDEFINIDO', message: `Modo desconhecido: ${mode}` };
}

/**
 * Constrói InternalRecords a partir de linhas brutas + mapeamento.
 *
 * @param {Array<Object>} rows  Linhas (output do parseCSVString/parseExcel)
 * @param {Object} mapping  { date, value, description, dc, type } — nomes de colunas
 * @param {Object} options
 * @param {string} options.source  "A" ou "B"
 * @param {string} [options.directionMode='TIPO_DOMINANTE']
 * @returns {Array<Object>}  Array de InternalRecord normalizados
 */
export function buildRecords(rows, mapping, options = {}) {
  const { source = 'A', directionMode = 'TIPO_DOMINANTE' } = options;

  if (!Array.isArray(rows)) return [];
  if (!mapping || typeof mapping !== 'object') return [];

  return rows.map((row, idx) => {
    const id = generateId(source, idx);

    const dateRaw = mapping.date ? row[mapping.date] : null;
    const valueRaw = mapping.value ? row[mapping.value] : null;
    const descRaw = mapping.description ? row[mapping.description] : null;
    const dcRaw = mapping.dc ? row[mapping.dc] : null;
    const typeRaw = mapping.type ? row[mapping.type] : null;

    const dateInfo = parseDate(dateRaw);
    const valueInfo = parseValue(valueRaw);

    const descriptionOriginal = descRaw == null ? '' : String(descRaw).trim();
    const descriptionNormalized = descriptionOriginal
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const { direction, message: dirMessage } = determineDirection({
      dcValue: dcRaw,
      typeValue: typeRaw,
      signValue: valueInfo.value,
      mode: directionMode,
    });

    const alerts = [];
    if (dateInfo.message) alerts.push(dateInfo.message);
    if (valueInfo.message) alerts.push(valueInfo.message);
    if (dirMessage) alerts.push(dirMessage);

    return {
      id,
      source,
      original_row: idx + 1,
      raw: row,
      value_original: valueInfo.original,
      value: valueInfo.value,
      value_status: valueInfo.status,
      value_message: valueInfo.message,
      date_original: dateInfo.original,
      date: dateInfo.date,
      date_status: dateInfo.status,
      date_message: dateInfo.message,
      description_original: descriptionOriginal,
      description_normalized: descriptionNormalized,
      direction,
      direction_message: dirMessage,
      alerts,
    };
  });
}