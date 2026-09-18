import {
  generateCandidates,
  findMatches1to1,
  findBatchMatches,
} from './matcher.js';
import {
  classifyMatch1to1,
  classifyBatchMatch,
  classifyNotFound,
} from './classifier.js';

/**
 * Executa a conciliação completa entre registros A e B.
 *
 * Fluxo:
 * 1. Gera todos os candidatos com score
 * 2. Encontra matches 1:1 (greedy, melhor score)
 * 3. Para A não matcheados, tenta matching 1:N (lotes)
 * 4. Classifica cada resultado (CONCILIADO, POSSÍVEL, NÃO ENCONTRADO)
 * 5. Retorna lista estruturada
 *
 * @param {Array<Object>} recordsA  Registros do arquivo A
 * @param {Array<Object>} recordsB  Registros do arquivo B
 * @param {Object} [config]
 * @param {string} [config.valueTolerance='0.01']
 * @param {number} [config.dateToleranceDays=2]
 * @param {number} [config.minScore=50]
 * @param {number} [config.ambiguityThreshold=5]
 * @param {number} [config.maxBatchSize=5]
 * @returns {Array<Object>}  Lista de resultados { a, b, batch_items, status, justification, score_total, score_details, alerts }
 */
export function reconcile(recordsA, recordsB, config = {}) {
  if (!Array.isArray(recordsA) || !Array.isArray(recordsB)) {
    return [];
  }

  const cfg = {
    valueTolerance: config.valueTolerance ?? '0.01',
    dateToleranceDays: config.dateToleranceDays ?? 2,
    minScore: config.minScore ?? 50,
    ambiguityThreshold: config.ambiguityThreshold ?? 5,
    maxBatchSize: config.maxBatchSize ?? 5,
  };

  // Índices para lookup rápido
  const aById = new Map(recordsA.map((a) => [a.id, a]));
  const bById = new Map(recordsB.map((b) => [b.id, b]));

  // 1. Gera candidatos
  const candidates = generateCandidates(recordsA, recordsB, cfg);

  // 2. Encontra matches 1:1
  const matches1to1 = findMatches1to1(candidates, cfg);
  const matchedAIds = new Set(matches1to1.map((m) => m.a_id));
  const matchedBIds = new Set(matches1to1.map((m) => m.b_id));

  // 3. Para A não matcheados, tenta matching 1:N
  const unmatchedA = recordsA.filter((a) => !matchedAIds.has(a.id));
  const availableB = recordsB.filter((b) => !matchedBIds.has(b.id));
  const batchMatches = findBatchMatches(unmatchedA, availableB, cfg);

  batchMatches.forEach((bm) => {
    matchedAIds.add(bm.a_id);
    bm.b_ids.forEach((id) => matchedBIds.add(id));
  });

  // 4. Monta lista de resultados
  const results = [];

  // 4.1. Matches 1:1 (com classificação)
  for (const m of matches1to1) {
    const a = aById.get(m.a_id);
    const b = bById.get(m.b_id);
    const aCandidates = candidates.filter((c) => c.a_id === m.a_id);
    const classification = classifyMatch1to1(m, aCandidates, cfg);

    results.push({
      a,
      b,
      batch_items: null,
      status: classification.status,
      justification: classification.justification,
      alerts: classification.alerts || [],
      score_total: m.score,
      score_details: m.score_details,
      human_decision: 'PENDING',
    });
  }

  // 4.2. Matches 1:N (lotes)
  for (const bm of batchMatches) {
    const a = aById.get(bm.a_id);
    const batchItems = (bm.b_ids || []).map((id) => bById.get(id)).filter(Boolean);
    const classification = classifyBatchMatch(bm, a, batchItems);

    results.push({
      a,
      b: null,
      batch_items: batchItems,
      status: classification.status,
      justification: classification.justification,
      alerts: classification.alerts || [],
      score_total: null,
      score_details: null,
      human_decision: 'PENDING',
    });
  }

  // 4.3. Registros A não encontrados
  for (const a of recordsA) {
    if (matchedAIds.has(a.id)) continue;
    const classification = classifyNotFound(a);
    results.push({
      a,
      b: null,
      batch_items: null,
      status: classification.status,
      justification: classification.justification,
      alerts: classification.alerts || [],
      score_total: null,
      score_details: null,
      human_decision: 'PENDING',
    });
  }

  // Ordena: matcheados primeiro (por score desc), não encontrados por último
  results.sort((r1, r2) => {
    const s1 = r1.status === 'NÃO ENCONTRADO' ? 1 : 0;
    const s2 = r2.status === 'NÃO ENCONTRADO' ? 1 : 0;
    if (s1 !== s2) return s1 - s2;
    const sc1 = r1.score_total ?? 0;
    const sc2 = r2.score_total ?? 0;
    return sc2 - sc1;
  });

  return results;
}