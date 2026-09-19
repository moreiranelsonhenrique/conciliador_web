import Decimal from 'decimal.js';

/**
 * Classifica um match 1:1 com base no score, ambiguidade e tolerâncias.
 *
 * Ordem de decisão:
 * 1. Sem match ou score abaixo do mínimo → NÃO ENCONTRADO
 * 2. Ambiguidade (2º candidato próximo) → POSSÍVEL CORRESPONDÊNCIA
 * 3. Valor ou data fora da tolerância → DIVERGÊNCIA
 * 4. Caso contrário → CONCILIADO
 *
 * @param {Object} match  { a_id, b_id, score, score_details }
 * @param {Array<Object>} allCandidates  Todos os candidatos para este a_id
 * @param {Object} [config]
 * @param {number} [config.minScore=50]
 * @param {number} [config.ambiguityThreshold=5]
 * @param {number} [config.dateToleranceDays=2]
 * @param {string|number} [config.valueTolerance='0.01']
 * @param {Object|null} [recordA]  Registro A completo (para checar tolerâncias)
 * @param {Object|null} [recordB]  Registro B completo (para checar tolerâncias)
 * @returns {Object}  { status, justification, alerts }
 */
export function classifyMatch1to1(match, allCandidates, config = {}, recordA = null, recordB = null) {
  const minScore = config.minScore ?? 50;
  const ambiguityThreshold = config.ambiguityThreshold ?? 5;
  const dateToleranceDays = config.dateToleranceDays ?? 2;

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

  // Verifica ambiguidade (tem prioridade sobre divergência:
  // se não sabemos qual B é o certo, a dúvida é de identidade, não de tolerância)
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

  // Verifica tolerâncias (valor e data) → DIVERGÊNCIA
  const divergenceAlerts = [];

  // Valor fora da tolerância (comparação em valor absoluto, como no scorer)
  if (recordA && recordB && recordA.value != null && recordB.value != null) {
    let valDiff = null;
    try {
      valDiff = new Decimal(recordA.value).abs().minus(new Decimal(recordB.value).abs()).abs();
    } catch (e) {
      valDiff = null;
    }
    if (valDiff) {
      let tol;
      try {
        tol = new Decimal(config.valueTolerance ?? '0.01');
      } catch (e) {
        tol = new Decimal('0.01');
      }
      if (valDiff.gt(tol)) {
        divergenceAlerts.push(`Valor fora da tolerância: diferença de R$ ${valDiff.toFixed(2)}`);
      }
    }
  }

  // Data fora da tolerância (só se ambos os registros têm data válida)
  if (
    recordA && recordB &&
    recordA.date instanceof Date && recordB.date instanceof Date &&
    !isNaN(recordA.date.getTime()) && !isNaN(recordB.date.getTime())
  ) {
    const diffMs = Math.abs(recordA.date.getTime() - recordB.date.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > dateToleranceDays) {
      divergenceAlerts.push(
        `Data fora da tolerância: diferença de ${diffDays} dia(s) (tolerância: ${dateToleranceDays})`
      );
    }
  }

  if (divergenceAlerts.length > 0) {
    return {
      status: 'DIVERGÊNCIA',
      justification: divergenceAlerts.join('; '),
      alerts: divergenceAlerts,
    };
  }

  // Score alto, sem ambiguidade, dentro das tolerâncias
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
 * @returns {Object}  { status, justification, alerts, batch_items }
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
    status: 'POSSÍVEL CORRESPONDÊNCIA',
    justification: `Lote com ${batchItems.length} itens — revisão humana obrigatória`,
    alerts: ['Lote detectado: confirmação humana obrigatória'],
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