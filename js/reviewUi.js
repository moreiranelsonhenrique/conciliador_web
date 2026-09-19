/**
 * Lógica pura da UI de revisão humana (sem DOM).
 * Gera HTML dos botões de ação e do formulário de correção manual.
 * main.js é responsável por eventos e escrita no DOM.
 */

/**
 * Escapa texto para uso seguro em HTML.
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
 * Formata Date como dd/mm/aaaa usando métodos UTC.
 */
function formatDateBR(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

/**
 * Formata valor monetário curto para exibição em options.
 * Valor inválido vira "(inválido)".
 */
function formatShortMoney(value) {
  if (value == null) return '(inválido)';
  try {
    const num = Number(value);
    if (Number.isNaN(num)) return '(inválido)';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return '(inválido)';
  }
}

/**
 * Gera o HTML dos botões de ação para um ReviewableResult.
 * Retorna string vazia para estados que não têm ações disponíveis.
 *
 * @param {Object} rv  ReviewableResult
 * @returns {string}  HTML dos botões
 */
export function renderActionButtons(rv) {
  if (!rv || !rv.result) return '';

  const aId = escapeHtml(rv.a_id);
  const review = rv.human_decision;
  const hasLink = rv.has_link;
  const isBatch = rv.is_batch;

  // Rejeitado: única ação é desfazer (restaurar vínculo original)
  if (review === 'REJECTED') {
    const canUndo = (rv.original_b_id != null) ||
                    (Array.isArray(rv.original_batch_ids) && rv.original_batch_ids.length > 0);
    if (!canUndo) return '';
    return (
      `<button class="btn-action btn-undo" data-action="undo-reject" data-a-id="${aId}">` +
      `↩️ Desfazer rejeição</button>`
    );
  }

  const buttons = [];

  // Confirmar: disponível se tem vínculo e ainda não está confirmado
  if (hasLink && review !== 'CONFIRMED') {
    buttons.push(
      `<button class="btn-action btn-confirm" data-action="confirm" data-a-id="${aId}">` +
      `✅ Confirmar</button>`
    );
  }

  // Rejeitar: disponível se tem vínculo
  if (hasLink) {
    buttons.push(
      `<button class="btn-action btn-reject" data-action="reject" data-a-id="${aId}">` +
      `❌ Rejeitar</button>`
    );
  }

  // Corrigir: apenas para 1:1 (não para lotes)
  if (!isBatch) {
    // "Corrigir" se já tem vínculo; "Conciliar manualmente" se não tem
    const label = hasLink ? '🔧 Corrigir vínculo' : '🔧 Conciliar manualmente';
    buttons.push(
      `<button class="btn-action btn-correct" data-action="correct" data-a-id="${aId}">` +
      `${label}</button>`
    );
  }

  return buttons.join('');
}

/**
 * Gera o HTML do formulário de correção manual (select de Bs disponíveis + ações).
 *
 * @param {Object} rv  ReviewableResult
 * @param {Array<Object>} availableBs  Registros B disponíveis (do registry)
 * @returns {string}  HTML do formulário
 */
export function renderCorrectForm(rv, availableBs) {
  if (!rv || !rv.result) return '';
  const aId = escapeHtml(rv.a_id);
  const list = Array.isArray(availableBs) ? availableBs : [];

  let options = '<option value="">(selecione um registro B)</option>';
  for (const b of list) {
    const linha = b.original_row != null ? `L${b.original_row}` : '?';
    const data = formatDateBR(b.date) || '(sem data)';
    const desc = b.description_original ? String(b.description_original).slice(0, 40) : '(sem descrição)';
    const valor = formatShortMoney(b.value);
    const label = `${linha} · ${data} · ${desc} · R$ ${valor}`;
    options += `<option value="${escapeHtml(b.id)}">${escapeHtml(label)}</option>`;
  }

  return (
    `<div class="correct-form" data-a-id="${aId}">` +
    `<label>Selecione o registro B para vincular:</label>` +
    `<select data-role="correct-b">${options}</select>` +
    `<div class="correct-form-actions">` +
    `<button class="btn-action btn-apply" data-action="apply-correct" data-a-id="${aId}">Aplicar</button>` +
    `<button class="btn-action btn-cancel" data-action="cancel-correct" data-a-id="${aId}">Cancelar</button>` +
    `</div>` +
    `<p class="hint">O vínculo original será preservado para auditoria.</p>` +
    `</div>`
  );
}