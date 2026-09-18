/**
 * Controla a disponibilidade de registros B para correção manual.
 * Evita que um mesmo B seja vinculado a dois A simultaneamente.
 */
export class BRegistry {
  constructor(recordsB = []) {
    this.records = new Map(recordsB.map((b) => [b.id, b]));
    this.occupiedBy = new Map(); // b_id -> a_id
  }

  occupy(bId, aId) {
    if (this.occupiedBy.has(bId)) {
      throw new Error(`B '${bId}' já está ocupado por A '${this.occupiedBy.get(bId)}'`);
    }
    this.occupiedBy.set(bId, aId);
  }

  release(bId) {
    this.occupiedBy.delete(bId);
  }

  releaseMany(bIds) {
    bIds.forEach((id) => this.release(id));
  }

  isAvailable(bId) {
    return !this.occupiedBy.has(bId);
  }

  getAvailableIds() {
    const all = Array.from(this.records.keys());
    return all.filter((id) => this.isAvailable(id));
  }

  get(bId) {
    return this.records.get(bId) || null;
  }
}

/**
 * Encapsula um resultado da conciliação e permite ações humanas.
 *
 * Estados de human_decision:
 * - PENDING: ainda não revisado
 * - CONFIRMED: usuário confirmou o vínculo atual
 * - REJECTED: usuário rejeitou o vínculo
 *
 * Estados de match_origin:
 * - AUTO: vínculo gerado pelo sistema
 * - MANUAL: vínculo corrigido manualmente pelo usuário
 */
export class ReviewableResult {
  /**
   * @param {Object} result  Resultado do reconcile (engine.js)
   */
  constructor(result) {
    this.result = result;
    this.human_decision = 'PENDING';
    this.match_origin = result.b || result.batch_items ? 'AUTO' : 'NONE';

    // Preserva vínculo original para auditoria
    this.original_b_id = result.b ? result.b.id : null;
    this.original_batch_ids = result.batch_items
      ? result.batch_items.map((b) => b.id)
      : [];

    // Vínculo atual (pode ser alterado via correção manual)
    this.current_b_id = result.b ? result.b.id : null;
    this.current_batch_ids = result.batch_items
      ? result.batch_items.map((b) => b.id)
      : [];
  }

  get a_id() {
    return this.result.a.id;
  }

  get is_batch() {
    return Array.isArray(this.result.batch_items) && this.result.batch_items.length > 0;
  }

  get has_link() {
    return this.current_b_id !== null || this.current_batch_ids.length > 0;
  }

  /**
   * Confirma o vínculo atual.
   */
  confirm() {
    if (!this.has_link) {
      throw new Error(`Não há vínculo ativo para confirmar em A '${this.a_id}'`);
    }
    this.human_decision = 'CONFIRMED';
    this.result.human_decision = 'CONFIRMED';
  }

  /**
   * Rejeita o vínculo atual.
   * Libera os registros B no registry (se fornecido).
   *
   * @param {BRegistry} [registry]
   */
  reject(registry) {
    if (!this.has_link) {
      throw new Error(`Não há vínculo ativo para rejeitar em A '${this.a_id}'`);
    }

    if (registry) {
      if (this.current_batch_ids.length > 0) {
        registry.releaseMany(this.current_batch_ids);
      } else if (this.current_b_id) {
        registry.release(this.current_b_id);
      }
    }

    this.current_b_id = null;
    this.current_batch_ids = [];
    this.human_decision = 'REJECTED';
    this.result.human_decision = 'REJECTED';
  }

  /**
   * Corrige manualmente o vínculo 1:1 (troca o B atual por outro).
   * Não aplicável a lotes nesta fase.
   *
   * @param {string} newBId  ID do novo registro B
   * @param {BRegistry} registry
   * @returns {Object}  Novo vínculo { b_id, status }
   */
  applyManualMatch(newBId, registry) {
    if (this.is_batch) {
      throw new Error('Correção manual de lote não é suportada nesta fase');
    }

    if (!registry) {
      throw new Error('registry é obrigatório para correção manual');
    }

    if (!registry.get(newBId)) {
      throw new Error(`B '${newBId}' não existe no registry`);
    }

    if (!registry.isAvailable(newBId)) {
      throw new Error(
        `B '${newBId}' já está vinculado a outro registro A. ` +
        `Rejeite o vínculo correspondente primeiro.`
      );
    }

    // Libera o B anterior
    if (this.current_b_id) {
      registry.release(this.current_b_id);
    }

    // Ocupa o novo B
    registry.occupy(newBId, this.a_id);

    this.current_b_id = newBId;
    this.match_origin = 'MANUAL';
    this.human_decision = 'PENDING'; // usuário ainda precisa confirmar
    this.result.human_decision = 'PENDING';

    return { b_id: newBId, status: 'APPLIED' };
  }
}

/**
 * Converte resultados do reconcile em ReviewableResults e inicializa o registry.
 *
 * @param {Array<Object>} results  Resultados do reconcile
 * @param {Array<Object>} recordsB  Registros B completos
 * @returns {{ reviewables: Array<ReviewableResult>, registry: BRegistry }}
 */
export function createReviewableResults(results, recordsB) {
  const registry = new BRegistry(recordsB);
  const reviewables = (results || []).map((r) => new ReviewableResult(r));

  // Ocupa os B já vinculados
  for (const rv of reviewables) {
    if (rv.current_batch_ids.length > 0) {
      rv.current_batch_ids.forEach((id) => {
        if (registry.isAvailable(id)) registry.occupy(id, rv.a_id);
      });
    } else if (rv.current_b_id) {
      if (registry.isAvailable(rv.current_b_id)) {
        registry.occupy(rv.current_b_id, rv.a_id);
      }
    }
  }

  return { reviewables, registry };
}