import Decimal from 'decimal.js';
import { totalScore } from './scorer.js';

/**
 * Gera todos os candidatos a match entre registros A e B.
 *
 * @param {Array<Object>} recordsA  Registros do arquivo A
 * @param {Array<Object>} recordsB  Registros do arquivo B
 * @returns {Array<Object>}  Array de candidatos { a, b, score }
 */
export function generateCandidates(recordsA, recordsB, config = {}) {
  if (!Array.isArray(recordsA) || !Array.isArray(recordsB)) {
    return [];
  }

  const candidates = [];

  for (const a of recordsA) {
    for (const b of recordsB) {
      // Pula registros com valor inválido ou ausente
      if (a.value == null || b.value == null) continue;

      const score = totalScore(
        {
          valueA: a.value,
          valueB: b.value,
          dateA: a.date,
          dateB: b.date,
          textA: a.description_original,
          textB: b.description_original,
        },
        config
      );

      if (score.total > 0) {
        candidates.push({
          a_id: a.id,
          b_id: b.id,
          score: score.total,
          score_details: score,
        });
      }
    }
  }

  return candidates;
}

/**
 * Encontra matches 1:1 (um A para um B) usando estratégia greedy.
 * Para cada registro A, seleciona o melhor candidato B disponível.
 *
 * @param {Array<Object>} candidates  Candidatos gerados por generateCandidates
 * @param {Object} [config]
 * @param {number} [config.minScore=50]  Score mínimo para considerar match
 * @param {number} [config.ambiguityThreshold=5]  Diferença mínima entre 1º e 2º melhor candidato
 * @returns {Array<Object>}  Matches encontrados { a_id, b_id, score, status, justification }
 */
export function findMatches1to1(candidates, config = {}) {
  const minScore = config.minScore ?? 50;
  const ambiguityThreshold = config.ambiguityThreshold ?? 5;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  // Agrupa candidatos por a_id
  const byA = new Map();
  for (const c of candidates) {
    if (!byA.has(c.a_id)) {
      byA.set(c.a_id, []);
    }
    byA.get(c.a_id).push(c);
  }

  // Ordena cada grupo por score decrescente
  for (const [aId, cands] of byA) {
    cands.sort((a, b) => b.score - a.score);
  }

  const matches = [];
  const usedB = new Set();

  // Para cada A, tenta encontrar o melhor B disponível
  for (const [aId, cands] of byA) {
    if (cands.length === 0) continue;

    const best = cands[0];

    // Verifica se atinge score mínimo
    if (best.score < minScore) continue;

    // Verifica se o B já foi usado
    if (usedB.has(best.b_id)) {
      // Tenta o próximo melhor
      let found = false;
      for (let i = 1; i < cands.length; i++) {
        if (!usedB.has(cands[i].b_id) && cands[i].score >= minScore) {
          usedB.add(cands[i].b_id);
          matches.push({
            a_id: aId,
            b_id: cands[i].b_id,
            score: cands[i].score,
            score_details: cands[i].score_details,
            status: 'CONCILIADO',
            justification: `Match com score ${cands[i].score}`,
          });
          found = true;
          break;
        }
      }
      continue;
    }

    // Verifica ambiguidade (2º melhor candidato muito próximo do 1º)
    let status = 'CONCILIADO';
    let justification = `Match com score ${best.score}`;

    if (cands.length > 1) {
      const diff = best.score - cands[1].score;
      if (diff < ambiguityThreshold) {
        status = 'POSSÍVEL CORRESPONDÊNCIA';
        justification = `Ambiguidade: diferença de ${diff} pontos entre 1º e 2º candidato`;
      }
    }

    usedB.add(best.b_id);
    matches.push({
      a_id: aId,
      b_id: best.b_id,
      score: best.score,
      score_details: best.score_details,
      status,
      justification,
    });
  }

  return matches;
}

/**
 * Detecta lotes 1:N (um A corresponde à soma de múltiplos B).
 * Usa busca limitada para evitar explosão combinatória.
 *
 * @param {Array<Object>} recordsA  Registros A
 * @param {Array<Object>} recordsB  Registros B
 * @param {Object} [config]
 * @param {number} [config.maxBatchSize=5]  Máximo de itens B por lote
 * @param {string} [config.valueTolerance='0.01']  Tolerância de valor
 * @param {number} [config.dateToleranceDays=30]  Tolerância de data (todos os B devem estar próximos de A)
 * @returns {Array<Object>}  Lotes encontrados { a_id, b_ids, status, justification }
 */
export function findBatchMatches(recordsA, recordsB, config = {}) {
  const maxBatchSize = config.maxBatchSize ?? 5;
  const valueTolerance = new Decimal(config.valueTolerance ?? '0.01');
  const dateToleranceDays = config.dateToleranceDays ?? 30;

  if (!Array.isArray(recordsA) || !Array.isArray(recordsB)) {
    return [];
  }

  const matches = [];
  const usedB = new Set();

  for (const a of recordsA) {
    if (a.value == null) continue;

    const targetValue = a.value.abs();

    // Filtra B candidatos (data próxima e valor menor que A)
    const bCandidates = recordsB.filter((b) => {
      if (b.value == null) return false;
      if (usedB.has(b.id)) return false;
      if (b.value.abs().gte(targetValue)) return false; // B deve ser menor que A

      // Verifica data
      if (a.date && b.date) {
        const diffMs = Math.abs(a.date.getTime() - b.date.getTime());
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > dateToleranceDays) return false;
      }

      return true;
    });

    if (bCandidates.length === 0) continue;

    // Busca combinações que somam ao valor de A
    const batchSize = Math.min(maxBatchSize, bCandidates.length);
    const found = findCombination(bCandidates, targetValue, valueTolerance, batchSize);

    if (found) {
      const bIds = found.map((b) => b.id);
      bIds.forEach((id) => usedB.add(id));

      matches.push({
        a_id: a.id,
        b_ids: bIds,
        status: 'CONCILIADO',
        justification: `Lote com ${bIds.length} itens somando ${targetValue.toFixed(2)}`,
      });
    }
  }

  return matches;
}

/**
 * Busca recursiva por combinação de itens que somam ao valor alvo.
 * Limitado a maxItems para evitar explosão combinatória.
 *
 * @param {Array<Object>} items  Itens disponíveis
 * @param {Decimal} target  Valor alvo
 * @param {Decimal} tolerance  Tolerância
 * @param {number} maxItems  Máximo de itens na combinação
 * @returns {Array<Object>|null}  Combinação encontrada ou null
 */
function findCombination(items, target, tolerance, maxItems) {
  // Tenta combinações de tamanho 2 até maxItems
  for (let size = 2; size <= maxItems; size++) {
    const result = findCombinationOfSize(items, target, tolerance, size, 0, []);
    if (result) return result;
  }
  return null;
}

function findCombinationOfSize(items, target, tolerance, size, startIdx, current) {
  if (current.length === size) {
    const sum = current.reduce((acc, item) => acc.plus(item.value.abs()), new Decimal(0));
    if (sum.minus(target).abs().lte(tolerance)) {
      return current;
    }
    return null;
  }

  for (let i = startIdx; i < items.length; i++) {
    current.push(items[i]);
    const result = findCombinationOfSize(items, target, tolerance, size, i + 1, current);
    if (result) return result;
    current.pop();
  }

  return null;
}