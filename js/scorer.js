import Decimal from 'decimal.js';

/**
 * Tokeniza um texto para comparação: minúsculas, sem acentos, sem pontuação.
 * @param {string} text
 * @returns {Array<string>}
 */
function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Calcula similaridade entre dois textos usando Jaccard (interseção / união de tokens).
 * @param {string} textA
 * @param {string} textB
 * @returns {number}  Similaridade entre 0 e 1
 */
export function textSimilarity(textA, textB) {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersectionSize++;
  }

  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Score de valor: 50 pontos se a diferença absoluta estiver dentro da tolerância.
 * Usa Decimal para precisão financeira.
 *
 * @param {*} valueA  Valor do registro A
 * @param {*} valueB  Valor do registro B
 * @param {string|number} [tolerance='0.01']  Tolerância em unidades monetárias
 * @returns {number}  50 ou 0
 */
export function scoreValue(valueA, valueB, tolerance = '0.01') {
  if (valueA == null || valueB == null) return 0;

  try {
    const a = new Decimal(valueA).abs();
    const b = new Decimal(valueB).abs();
    const diff = a.minus(b).abs();

    if (diff.lte(new Decimal(tolerance))) {
      return 50;
    }
    return 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Score de data: 20 pontos se a diferença em dias estiver dentro da tolerância.
 *
 * @param {string|Date} dateA  Data do registro A (formato ISO ou Date)
 * @param {string|Date} dateB  Data do registro B (formato ISO ou Date)
 * @param {number} [toleranceDays=0]  Tolerância em dias
 * @returns {number}  20 ou 0
 */
export function scoreDate(dateA, dateB, toleranceDays = 0) {
  if (!dateA || !dateB) return 0;

  const dA = dateA instanceof Date ? dateA : new Date(dateA);
  const dB = dateB instanceof Date ? dateB : new Date(dateB);

  if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return 0;

  const diffMs = Math.abs(dA.getTime() - dB.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= toleranceDays) {
    return 20;
  }
  return 0;
}

/**
 * Score de texto: até 30 pontos, proporcional à similaridade.
 * Se a similaridade for menor que minSimilarity, retorna 0.
 *
 * @param {string} textA  Descrição do registro A
 * @param {string} textB  Descrição do registro B
 * @param {number} [minSimilarity=0.6]  Similaridade mínima (0 a 1)
 * @returns {number}  0 a 30
 */
export function scoreText(textA, textB, minSimilarity = 0.6) {
  if (!textA || !textB) return 0;

  const sim = textSimilarity(textA, textB);

  if (sim >= minSimilarity) {
    return Math.round(30 * sim);
  }
  return 0;
}

/**
 * Calcula o score total de um candidato a match.
 *
 * @param {Object} params
 * @param {*} params.valueA
 * @param {*} params.valueB
 * @param {string|Date} params.dateA
 * @param {string|Date} params.dateB
 * @param {string} params.textA
 * @param {string} params.textB
 * @param {Object} [config]
 * @param {string|number} [config.valueTolerance='0.01']
 * @param {number} [config.dateToleranceDays=0]
 * @param {number} [config.minTextSimilarity=0.6]
 * @returns {Object}  { total, value, date, text }
 */
export function totalScore(params, config = {}) {
  const valueTolerance = config.valueTolerance ?? '0.01';
  const dateToleranceDays = config.dateToleranceDays ?? 0;
  const minTextSimilarity = config.minTextSimilarity ?? 0.6;

  const sv = scoreValue(params.valueA, params.valueB, valueTolerance);
  const sd = scoreDate(params.dateA, params.dateB, dateToleranceDays);
  const st = scoreText(params.textA, params.textB, minTextSimilarity);

  return {
    total: sv + sd + st,
    value: sv,
    date: sd,
    text: st,
  };
}