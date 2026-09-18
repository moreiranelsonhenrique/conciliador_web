/**
 * Classifica um match 1:1 com base no score e ambiguidade.
 *
 * @param {Object} match  { a_id, b_id, score, score_details }
 * @param {Array<Object>} allCandidates  Todos os candidatos para este a_id
 * @param {Object} [config]
 * @param {number} [config.minScore=50]  Score mínimo para considerar match
 * @param {number} [config.ambiguityThreshold=5]  Diferença mínima entre 1º e 2º
 * @returns {Object}  { status, justification, alerts }
 */
export function classifyMatch1to1(match, allCandidates, config = {}) {
  const minScore = config.minScore ?? 50;
  const ambiguityThreshold = config.ambiguityThreshold ?? 5;

  if (!match || match.score == null) {
    return {
      status: 'NÃO ENCONTRADO',
      justification: 'Nenhum candidato válido',
      alerts: [],
    };
  }

  // Score abaixo do mínimo
  if (match.score < minScore) {
    return {
      status: 'NÃO ENCONTRADO',
      justification: `Score ${match.score} abaixo do mínimo (${minScore})`,
      alerts: [],
    };
  }

  // Verifica ambiguidade
  const sameCandidates = (allCandidates || []).filter(
    (c) => c.a_id === match.a_id && c.b_id !== match.b_id
  );
  sameCandidates.sort((a, b) => b.score - a.score);

  if (sameCandidates.length > 0) {
    const diff = match.score - sameCandidates[0].score;
    if (diff < ambiguityThreshold) {
      return {
        status: 'POSSÍVEL CORRESPONDÊNCIA',
        justification: `Ambiguidade: diferença de ${diff} pontos entre 1º e 2º candidato`,
        alerts: ['Múltiplos candidatos com score próximo'],
      };
    }
  }

  // Score alto, sem ambiguidade
  return {
    status: 'CONCILIADO',
    justification: `Match com score ${match.score}`,
    alerts: [],
  };
}

/**
 * Classifica um lote 1:N.
 *
 * @param {Object} batchMatch  { a_id, b_ids }
 * @param {Object} recordA  Registro A completo
 * @param {Array<Object>} recordsB  Registros B completos
 * @returns {Object}  { status, justification, alerts }
 */
export function classifyBatchMatch(batchMatch, recordA, recordsB) {
  if (!batchMatch || !batchMatch.b_ids || batchMatch.b_ids.length === 0) {
    return {
      status: 'NÃO ENCONTRADO',
      justification: 'Lote vazio',
      alerts: [],
    };
  }

  const batchItems = recordsB.filter((b) => batchMatch.b_ids.includes(b.id));

  if (batchItems.length === 0) {
    return {
      status: 'NÃO ENCONTRADO',
      justification: 'Itens do lote não encontrados',
      alerts: [],
    };
  }

  return {
    status: 'CONCILIADO',
    justification: `Lote com ${batchItems.length} itens`,
    alerts: [],
    batch_items: batchItems,
  };
}

/**
 * Marca um registro como não encontrado.
 *
 * @param {Object} record  Registro A ou B
 * @returns {Object}  { status, justification, alerts }
 */
export function classifyNotFound(record) {
  return {
    status: 'NÃO ENCONTRADO',
    justification: 'Sem correspondente encontrado',
    alerts: record.alerts || [],
  };
}