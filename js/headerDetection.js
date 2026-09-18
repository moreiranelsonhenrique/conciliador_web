/**
 * Dicionário de palavras-chave comuns em cabeçalhos de extratos financeiros.
 * Peso maior = mais provável de ser cabeçalho.
 */
const HEADER_KEYWORDS = {
  // Peso 3 — muito prováveis em cabeçalho
  data: 3,
  valor: 3,
  descricao: 3,
  historico: 3,
  date: 3,
  description: 3,
  amount: 3,

  // Peso 2 — prováveis
  tipo: 2,
  saldo: 2,
  documento: 2,
  natureza: 2,
  discriminacao: 2,
  balance: 2,
  memo: 2,
  movimento: 2,
  lancamento: 2,
  name: 2,
  'd/c': 2,
  dc: 2,

  // Peso 1 — possíveis (abreviações)
  dt: 1,
  vlr: 1,
  doc: 1,
  id: 1,
};

/**
 * Normaliza uma célula para comparação: minúsculas, sem acentos, só letras/números/barra/espaço.
 * @param {*} cell
 * @returns {string}
 */
function normalizeHeaderCell(cell) {
  if (cell == null) return '';
  return String(cell)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/ ]/g, '')
    .trim();
}

/**
 * Detecta qual linha de um conjunto de linhas cruas é o cabeçalho.
 *
 * Escaneia as primeiras `maxScanLines` linhas e atribui um score a cada uma
 * baseado em palavras-chave típicas de cabeçalho. Retorna o índice da linha
 * com maior score. Se nenhuma linha pontuar, retorna 0 (assume primeira linha).
 *
 * @param {Array<Array>} rawRows  Array de linhas, cada linha é um array de células
 * @param {number} [maxScanLines=10]  Máximo de linhas a escanear
 * @returns {number}  Índice da linha de cabeçalho detectada
 */
export function detectHeader(rawRows, maxScanLines = 10) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return 0;
  }

  const scanLimit = Math.min(rawRows.length, maxScanLines);
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < scanLimit; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    let score = 0;
    for (const cell of row) {
      const normalized = normalizeHeaderCell(cell);
      if (!normalized) continue;

      if (HEADER_KEYWORDS[normalized] !== undefined) {
        score += HEADER_KEYWORDS[normalized];
      } else {
        const words = normalized.split(/\s+/);
        for (const word of words) {
          if (HEADER_KEYWORDS[word] !== undefined) {
            score += HEADER_KEYWORDS[word];
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore <= 0) {
    return 0;
  }

  return bestIndex;
}