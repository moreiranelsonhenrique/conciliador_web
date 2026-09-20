/**
 * Lógica pura da UI de revisão humana (sem DOM).
 * Gera HTML dos botões de ação e do formulário de conciliação manual.
 * main.js é responsável por eventos e escrita no DOM.
 *
 * Microentrega 37 (Ciclo 2):
 * - "Corrigir vínculo" deixa de existir em cartões com vínculo.
 * - "Conciliar manualmente" aparece apenas sem vínculo:
 *   após rejeição (1:1) ou quando nada foi encontrado.
 * - Formulário ganha busca para filtrar registros B disponíveis.
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
 *
 * Política da Microentrega 37:
 * - Com vínculo: Confirmar (se pendente) + Rejeitar. SEM "Corrigir vínculo".
 * - Rejeitado (1:1): Desfazer rejeição (se havia vínculo original)
 *   + Conciliar manualmente.
 * - Rejeitado (lote): apenas Desfazer rejeição (edição de lotes é V6.1 — D4).
 * - Sem vínculo (não encontrado, 1:1): Conciliar manualmente.
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

  const manualButton =
    `<button class="btn-action btn-correct" data-action="correct" data-a-id="${aId}">` +
    `🔧 Conciliar manualmente</button>`;

  // Rejeitado
  if (review === 'REJECTED') {
    const buttons = [];
    const canUndo = (rv.original_b_id != null) ||
                    (Array.isArray(rv.original_batch_ids) && rv.original_batch_ids.length > 0);
    if (canUndo) {
      buttons.push(
        `<button class="btn-action btn-undo" data-action="undo-reject" data-a-id="${aId}">` +
        `↩️ Desfazer rejeição</button>`
      );
    }
    // Ajuste manual só para 1:1 (lotes: confirmação/rejeição inteiras — D4)
    if (!isBatch) buttons.push(manualButton);
    return buttons.join('');
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
  // Conciliar manualmente: apenas 1:1 e apenas SEM vínculo
  if (!isBatch && !hasLink) {
    buttons.push(manualButton);
  }
  return buttons.join('');
}

/**
 * Filtra registros B disponíveis por termo de busca
 * (linha, data dd/mm/aaaa, descrição ou valor).
 * Termo vazio retorna todos.
 *
 * @param {Array<Object>} availableBs  Registros B disponíveis
 * @param {string} term  Termo de busca
 * @returns {Array<Object>}  Registros que casam com o termo
 */
export function filterAvailableBs(availableBs, term) {
  const list = Array.isArray(availableBs) ? availableBs : [];
  const t = String(term == null ? '' : term).toLowerCase().trim();
  if (!t) return list;
  return list.filter((b) => {
    if (!b) return false;
    const linha = b.original_row != null ? String(b.original_row) : '';
    const data = formatDateBR(b.date);
    const desc = String(b.description_original || '').toLowerCase();
    const valor = formatShortMoney(b.value).toLowerCase();
    return linha.includes(t) || data.includes(t) || desc.includes(t) || valor.includes(t);
  });
}

/**
 * Gera o HTML do formulário de conciliação manual
 * (busca + select de Bs disponíveis + ações).
 *
 * @param {Object} rv  ReviewableResult
 * @param {Array<Object>} availableBs  Registros B disponíveis (do registry)
 * @param {string} [filterTerm]  Termo de busca para filtrar as opções
 * @returns {string}  HTML do formulário
 */
export function renderCorrectForm(rv, availableBs, filterTerm = '') {
  if (!rv || !rv.result) return '';
  const aId = escapeHtml(rv.a_id);
  const term = String(filterTerm == null ? '' : filterTerm);
  const all = Array.isArray(availableBs) ? availableBs : [];
  const list = filterAvailableBs(all, term);

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
    `<input type="search" data-role="correct-search" placeholder="Buscar por linha, data, descrição ou valor..." value="${escapeHtml(term)}">` +
    `<select data-role="correct-b" size="8">${options}</select>` +
    `<p class="hint">${list.length} de ${all.length} registro(s) disponível(is).</p>` +
    `<div class="correct-form-actions">` +
    `<button class="btn-action btn-apply" data-action="apply-correct" data-a-id="${aId}">Aplicar</button>` +
    `<button class="btn-action btn-cancel" data-action="cancel-correct" data-a-id="${aId}">Cancelar</button>` +
    `</div>` +
    `<p class="hint">O vínculo original será preservado para auditoria.</p>` +
    `</div>`
  );
}