/**
 * Padrões de nomes de colunas para cada papel.
 * Todos os padrões estão normalizados (minúsculas, sem acentos).
 */
const COLUMN_PATTERNS = {
  date: [
    'data', 'dt', 'date', 'datad', 'data movimento', 'data lancamento',
    'dtposted', 'dtocor', 'data ocorrencia', 'data do lancamento',
  ],
  value: [
    'valor', 'vlr', 'amount', 'value', 'valor (r$)', 'valor r$',
    'trnamt', 'quantia', 'valor do lancamento',
  ],
  description: [
    'descricao', 'historico', 'memo', 'name', 'discriminacao',
    'complemento', 'description', 'detalhe', 'historico do lancamento',
  ],
  dc: [
    'd/c', 'dc', 'natureza', 'movimento', 'credito/debito',
  ],
  type: [
    'tipo', 'tipo lancamento', 'categoria', 'trntype', 'tipo movimento',
  ],
};

/**
 * Normaliza um nome de coluna para comparação.
 * @param {*} name
 * @returns {string}
 */
function normalizeColumnName(name) {
  if (name == null) return '';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Infere o mapeamento de colunas baseado nos nomes.
 *
 * @param {Array<string>} columns  Array de nomes de colunas
 * @returns {Object}  Mapeamento { date, value, description, dc, type }
 *                    Cada campo é o nome original da coluna ou null
 */
export function inferMapping(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return { date: null, value: null, description: null, dc: null, type: null };
  }

  const mapping = {
    date: null,
    value: null,
    description: null,
    dc: null,
    type: null,
  };

  const usedColumns = new Set();

  for (const [role, patterns] of Object.entries(COLUMN_PATTERNS)) {
    let bestMatch = null;
    let bestScore = 0;

    for (const col of columns) {
      if (usedColumns.has(col)) continue;

      const normalized = normalizeColumnName(col);
      if (!normalized) continue;

      let score = 0;

      // Match exato tem score mais alto
      if (patterns.includes(normalized)) {
        score = 3;
      } else {
        // Match parcial (contém ou está contido)
        for (const pattern of patterns) {
          if (normalized.includes(pattern) || pattern.includes(normalized)) {
            score = 2;
            break;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = col;
      }
    }

    if (bestMatch !== null) {
      mapping[role] = bestMatch;
      usedColumns.add(bestMatch);
    }
  }

  return mapping;
}