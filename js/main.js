// Conciliador Financeiro V6 — orquestração da interface.
// Microentrega 21: upload -> analisar -> revisão de mapeamento.
// Microentrega 22: conciliar -> painel de resultados (cartões, lotes inline, filtros).
// Microentrega 23: ações de revisão (confirmar/rejeitar/corrigir).
// Microentrega 25: sobras do Arquivo B (UI + exportação) + exportar.

import * as XLSX from './vendor/xlsx.mjs';
import { readFile } from './uploader.js';
import { inferMapping } from './mapper.js';
import { loadMapping, saveMapping } from './storage.js';
import { renderMappingSelects, validateMapping, normalizeConfig } from './mappingUi.js';
import { buildRecords } from './records.js';
import { reconcile } from './engine.js';
import { createReviewableResults } from './review.js';
import {
  buildSummaryRows,
  renderSummaryTable,
  renderFiltersBar,
  applyFilters,
  renderResultCard,
  findUnmatchedB,
  renderUnmatchedBTable,
} from './resultsUi.js';
import { renderActionButtons, renderCorrectForm } from './reviewUi.js';
import { exportToExcel, downloadExcel } from './exporter.js';

// ---------------------------------------------------------------------------
// Estado global da sessão
// ---------------------------------------------------------------------------
const state = {
  fileA: null,
  fileB: null,
  mappingA: null,
  mappingB: null,
  config: null,
  recordsA: null,
  recordsB: null,
  reviewables: null,
  registry: null,
  unmatchedB: null,
  correctingAId: null, // a_id do cartão em modo de correção
};

// ---------------------------------------------------------------------------
// Elementos do DOM
// ---------------------------------------------------------------------------
const elFileA = document.getElementById('file-a');
const elFileB = document.getElementById('file-b');
const elStatusA = document.getElementById('status-a');
const elStatusB = document.getElementById('status-b');
const elBtnAnalisar = document.getElementById('btn-analisar');
const elSectionMapeamento = document.getElementById('section-mapeamento');
const elSectionResultados = document.getElementById('section-resultados');
const elMappingA = document.getElementById('mapping-a');
const elMappingB = document.getElementById('mapping-b');
const elBtnConciliar = document.getElementById('btn-conciliar');
const elMensagem = document.getElementById('mensagem-global');
const elValueTol = document.getElementById('value-tol');
const elDateTol = document.getElementById('date-tol');
const elTextTol = document.getElementById('text-tol');
const elResumo = document.getElementById('resumo-financeiro');
const elFiltros = document.getElementById('filtros');
const elSobrasB = document.getElementById('sobras-b');
const elLista = document.getElementById('lista-resultados');
const elBtnExportar = document.getElementById('btn-exportar');

// ---------------------------------------------------------------------------
// Helpers de DOM
// ---------------------------------------------------------------------------
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function showMessage(message, type) {
  elMensagem.textContent = message;
  elMensagem.classList.remove('hidden', 'success', 'error', 'warning');
  elMensagem.classList.add(type);
}

function clearMessage() {
  elMensagem.textContent = '';
  elMensagem.classList.add('hidden');
  elMensagem.classList.remove('success', 'error', 'warning');
}

function updateBtnAnalisar() {
  elBtnAnalisar.disabled = !(state.fileA && state.fileB);
}

function updateBtnConciliar() {
  const okA = Boolean(state.fileA) && validateMapping(state.mappingA).valid;
  const okB = Boolean(state.fileB) && validateMapping(state.mappingB).valid;
  elBtnConciliar.disabled = !(okA && okB);
}

function renderMappingPanel(container, columns, mapping) {
  const { issues } = validateMapping(mapping);
  const issuesHtml = issues
    .map((msg) => `<div class="mapping-issue">⚠️ ${msg}</div>`)
    .join('');
  container.innerHTML = issuesHtml + renderMappingSelects(columns, mapping, container.id);
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------
async function handleFileChange(input, statusEl, which) {
  const file = input.files && input.files[0];
  statusEl.className = 'file-status';
  statusEl.textContent = '';
  clearMessage();
  hide(elSectionMapeamento);
  hide(elSectionResultados);
  state.recordsA = null;
  state.recordsB = null;
  state.reviewables = null;
  state.registry = null;
  state.unmatchedB = null;
  state.correctingAId = null;
  elBtnExportar.disabled = true;

  if (!file) {
    if (which === 'A') state.fileA = null;
    else state.fileB = null;
    updateBtnAnalisar();
    return;
  }

  statusEl.textContent = '⏳ Lendo arquivo...';
  try {
    const data = await readFile(file);
    const entry = { name: file.name, ...data };
    if (which === 'A') state.fileA = entry;
    else state.fileB = entry;
    statusEl.className = 'file-status loaded';
    statusEl.textContent =
      `✅ ${file.name} — ${data.rows.length} linha(s), ` +
      `cabeçalho na linha ${data.headerRowIndex + 1}`;
  } catch (err) {
    if (which === 'A') state.fileA = null;
    else state.fileB = null;
    statusEl.className = 'file-status error';
    statusEl.textContent = `❌ Falha ao ler ${file.name}`;
    showMessage(`Erro ao ler ${file.name}: ${err.message}`, 'error');
  }
  updateBtnAnalisar();
}

elFileA.addEventListener('change', () => handleFileChange(elFileA, elStatusA, 'A'));
elFileB.addEventListener('change', () => handleFileChange(elFileB, elStatusB, 'B'));

// ---------------------------------------------------------------------------
// Analisar -> revisão de mapeamento
// ---------------------------------------------------------------------------
elBtnAnalisar.addEventListener('click', () => {
  if (!state.fileA || !state.fileB) return;
  clearMessage();
  // Microentrega 39: mapeamento lembrado (por layout) tem prioridade;
  // sem lembrança, inferência automática. Selects seguem editáveis (D7).
  state.mappingA = loadMapping('A', state.fileA.columns) || inferMapping(state.fileA.columns);
  state.mappingB = loadMapping('B', state.fileB.columns) || inferMapping(state.fileB.columns);
  state.config = null;
  renderMappingPanel(elMappingA, state.fileA.columns, state.mappingA);
  renderMappingPanel(elMappingB, state.fileB.columns, state.mappingB);
  hide(elSectionResultados);
  show(elSectionMapeamento);
  updateBtnConciliar();
});

elMappingA.addEventListener('change', (e) => {
  const select = e.target.closest('select[data-role]');
  if (!select || !state.fileA) return;
  state.mappingA[select.dataset.role] = select.value || null;
  renderMappingPanel(elMappingA, state.fileA.columns, state.mappingA);
  updateBtnConciliar();
});

elMappingB.addEventListener('change', (e) => {
  const select = e.target.closest('select[data-role]');
  if (!select || !state.fileB) return;
  state.mappingB[select.dataset.role] = select.value || null;
  renderMappingPanel(elMappingB, state.fileB.columns, state.mappingB);
  updateBtnConciliar();
});

// ---------------------------------------------------------------------------
// Conciliar -> painel de resultados
// ---------------------------------------------------------------------------
elBtnConciliar.addEventListener('click', () => {
  if (!state.fileA || !state.fileB) return;
  if (!validateMapping(state.mappingA).valid || !validateMapping(state.mappingB).valid) return;

  try {
    state.config = normalizeConfig({
      valueTolerance: elValueTol.value,
      dateToleranceDays: elDateTol.value,
      minTextSimilarityPercent: elTextTol.value,
    });
  } catch (err) {
    showMessage(err.message, 'error');
    return;
  }

  // Microentrega 39: persiste o mapeamento efetivamente usado (por layout)
  saveMapping('A', state.fileA.columns, state.mappingA);
  saveMapping('B', state.fileB.columns, state.mappingB);
  state.recordsA = buildRecords(state.fileA.rows, state.mappingA, { source: 'A' });
  state.recordsB = buildRecords(state.fileB.rows, state.mappingB, { source: 'B' });

  const results = reconcile(state.recordsA, state.recordsB, state.config);
  const { reviewables, registry } = createReviewableResults(results, state.recordsB);
  state.reviewables = reviewables;
  state.registry = registry;
  state.unmatchedB = findUnmatchedB(reviewables, state.recordsB);
  state.correctingAId = null;

  elFiltros.innerHTML = renderFiltersBar();
  renderResultados();
  elBtnExportar.disabled = reviewables.length === 0;

  const counts = {
    CONCILIADO: 0,
    'POSSÍVEL CORRESPONDÊNCIA': 0,
    DIVERGÊNCIA: 0,
    'NÃO ENCONTRADO': 0,
  };
  for (const rv of reviewables) counts[rv.result.status] = (counts[rv.result.status] || 0) + 1;
  const sobrasTxt = state.unmatchedB.length > 0
    ? ` Sobras no Arquivo B: ${state.unmatchedB.length}.`
    : '';
  showMessage(
    `Conciliação concluída: ${reviewables.length} resultado(s) — ` +
      `${counts.CONCILIADO} conciliado(s), ${counts['POSSÍVEL CORRESPONDÊNCIA']} possível(is), ` +
      `${counts.DIVERGÊNCIA} divergência(s), ${counts['NÃO ENCONTRADO']} não encontrado(s).` +
      sobrasTxt +
      ` Use os botões em cada cartão para confirmar, rejeitar ou corrigir.`,
    'success'
  );
  show(elSectionResultados);
  elSectionResultados.scrollIntoView({ behavior: 'smooth' });
});

// ---------------------------------------------------------------------------
// Renderização do painel de resultados
// ---------------------------------------------------------------------------
function renderResultados() {
  if (!state.reviewables) return;
  const summary = buildSummaryRows(state.reviewables);
  elResumo.innerHTML = renderSummaryTable(summary);
  renderUnmatchedBSection();
  renderLista();
}

function renderUnmatchedBSection() {
  const list = findUnmatchedB(state.reviewables, state.recordsB);
  state.unmatchedB = list;
  const html = renderUnmatchedBTable(list);
  if (html) {
    elSobrasB.innerHTML = html;
    show(elSobrasB);
  } else {
    elSobrasB.innerHTML = '';
    hide(elSobrasB);
  }
}

function renderLista() {
  if (!state.reviewables) return;
  const filters = {
    status: document.getElementById('filtro-status')?.value || 'Todos',
    review: document.getElementById('filtro-revisao')?.value || 'Todos',
    search: document.getElementById('filtro-busca')?.value || '',
    // Microentrega 40: filtros avançados (período + faixa de valor)
    dateFrom: document.getElementById('filtro-data-de')?.value || '',
    dateTo: document.getElementById('filtro-data-ate')?.value || '',
    valueMin: document.getElementById('filtro-valor-min')?.value || '',
    valueMax: document.getElementById('filtro-valor-max')?.value || '',
  };
  const list = applyFilters(state.reviewables, state.registry, filters);
  if (list.length === 0) {
    elLista.innerHTML = '<p class="hint">Nenhum resultado com os filtros atuais.</p>';
  } else {
    elLista.innerHTML = list
      .map((rv) => {
        const card = renderResultCard(rv, state.registry);
        const actionsHtml = renderActionButtons(rv);
        return card.replace(
          /(<div class="result-actions"[^>]*>)(<\/div>)/,
          `$1${actionsHtml}$2`
        );
      })
      .join('');
  }
  const contagem = document.getElementById('filtro-contagem');
  if (contagem) {
    contagem.textContent = `Exibindo ${list.length} de ${state.reviewables.length} resultados.`;
  }
}

elFiltros.addEventListener('change', renderLista);
elFiltros.addEventListener('input', (e) => {
  const id = e.target && e.target.id;
  // Busca e faixa de valor filtram ao digitar; datas e selects filtram no change
  if (id === 'filtro-busca' || id === 'filtro-valor-min' || id === 'filtro-valor-max') {
    renderLista();
  }
});

// ---------------------------------------------------------------------------
// Revisão humana — delegação de eventos em #lista-resultados
// ---------------------------------------------------------------------------
function findReviewable(aId) {
  return (state.reviewables || []).find((rv) => rv.a_id === aId);
}

elLista.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const aId = btn.dataset.aId;
  const rv = findReviewable(aId);
  if (!rv) return;

  try {
    if (action === 'confirm') {
      rv.confirm();
      state.correctingAId = null;
      renderResultados();
    } else if (action === 'reject') {
      rv.reject(state.registry);
      state.correctingAId = null;
      renderResultados();
    } else if (action === 'correct') {
      state.correctingAId = aId;
      renderCorrectMode(rv);
    } else if (action === 'cancel-correct') {
      state.correctingAId = null;
      renderResultados();
    } else if (action === 'apply-correct') {
      const select = elLista.querySelector(
        `.correct-form[data-a-id="${CSS.escape(aId)}"] select[data-role="correct-b"]`
      );
      const newBId = select ? select.value : '';
      if (!newBId) {
        showMessage('Selecione um registro B antes de aplicar.', 'warning');
        return;
      }
      rv.applyManualMatch(newBId, state.registry);
      // Se veio de rejeição, volta para PENDING (vínculo novo, decisão nova)
      if (rv.human_decision === 'REJECTED') {
      rv.human_decision = 'PENDING';
      rv.result.human_decision = 'PENDING';
      }
      state.correctingAId = null;
      renderResultados();
      showMessage('Vínculo manual aplicado. Confirme para finalizar a revisão.', 'success');
    } else if (action === 'undo-reject') {
      undoReject(rv);
      state.correctingAId = null;
      renderResultados();
    }
  } catch (err) {
    showMessage(`Erro na ação: ${err.message}`, 'error');
  }
});

// Busca no formulário de conciliação manual (re-renderiza o select filtrado)
elLista.addEventListener('input', (e) => {
  const input = e.target;
  if (!input || input.dataset.role !== 'correct-search') return;
  const form = input.closest('.correct-form');
  if (!form) return;
  const aId = form.dataset.aId;
  const rv = findReviewable(aId);
  if (!rv) return;
  renderCorrectMode(rv, input.value);
  // Mantém o foco no campo de busca após o re-render
  const novo = elLista.querySelector(
    `.correct-form[data-a-id="${CSS.escape(aId)}"] [data-role="correct-search"]`
  );
  if (novo) {
    novo.focus();
    const len = novo.value.length;
    novo.setSelectionRange(len, len);
  }
});

/**
 * Restaura o vínculo original de um resultado rejeitado.
 * Reocupa os B originais no registry (falha se algum estiver ocupado).
 */
function undoReject(rv) {
  if (rv.human_decision !== 'REJECTED') {
    throw new Error('Só é possível desfazer rejeição de resultados rejeitados.');
  }
  const reg = state.registry;
  if (Array.isArray(rv.original_batch_ids) && rv.original_batch_ids.length > 0) {
    for (const bId of rv.original_batch_ids) {
      if (!reg.isAvailable(bId)) {
        throw new Error(
          `Não é possível desfazer: um dos itens do lote original (B ${bId}) ` +
          `já está vinculado a outro resultado.`
        );
      }
    }
    for (const bId of rv.original_batch_ids) reg.occupy(bId, rv.a_id);
    rv.current_batch_ids = [...rv.original_batch_ids];
    rv.match_origin = 'AUTO';
  } else if (rv.original_b_id) {
    if (!reg.isAvailable(rv.original_b_id)) {
      throw new Error(
        `Não é possível desfazer: o registro B original (${rv.original_b_id}) ` +
        `já está vinculado a outro resultado.`
      );
    }
    reg.occupy(rv.original_b_id, rv.a_id);
    rv.current_b_id = rv.original_b_id;
    rv.match_origin = 'AUTO';
  }
  rv.human_decision = 'PENDING';
  rv.result.human_decision = 'PENDING';
}

/**
 * Substitui as ações de um cartão pelo formulário de correção.
 */
function renderCorrectMode(rv, filterTerm = '') {
  const card = elLista.querySelector(
    `.result-card[data-a-id="${CSS.escape(rv.a_id)}"]`
  );
  if (!card) return;
  const actionsContainer = card.querySelector('.result-actions');
  if (!actionsContainer) return;
  const availableIds = state.registry.getAvailableIds();
  const availableBs = availableIds
    .map((id) => state.registry.get(id))
    .filter(Boolean);
  actionsContainer.innerHTML = renderCorrectForm(rv, availableBs, filterTerm);
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------
elBtnExportar.addEventListener('click', () => {
  if (!state.reviewables || state.reviewables.length === 0) return;
  try {
    const output = exportToExcel(state.reviewables, {
      fileName: 'conciliacao_v6',
      sheetName: 'Conciliação',
      unmatchedB: state.reviewables,
      recordsB: state.recordsB,
    });
    // Sobras são incluídas na aba principal. Se preferir aba separada no futuro,
    // basta mover as linhas para outra sheet via XLSX.utils.
    if (output.blob) {
      downloadExcel(output.blob, output.fileName);
      showMessage(`Arquivo ${output.fileName} baixado.`, 'success');
    } else {
      showMessage('Não foi possível gerar o arquivo neste ambiente.', 'error');
    }
  } catch (err) {
    showMessage(`Erro ao exportar: ${err.message}`, 'error');
  }
});

elBtnExportar.disabled = true;