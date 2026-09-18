// Conciliador Financeiro V6 — orquestração da interface.
// Microentrega 21: upload -> analisar -> revisão de mapeamento.
// Microentrega 22 (próxima): conciliar -> painel de resultados.

import { readFile } from './uploader.js';
import { inferMapping } from './mapper.js';
import { renderMappingSelects, validateMapping, normalizeConfig } from './mappingUi.js';

// ---------------------------------------------------------------------------
// Estado global da sessão (a Microentrega 22 reutiliza sem reler arquivos)
// ---------------------------------------------------------------------------
const state = {
  fileA: null,     // { name, rows, columns, type, headerRowIndex }
  fileB: null,     // idem
  mappingA: null,  // { date, value, description, dc, type }
  mappingB: null,  // idem
  config: null,    // saída de normalizeConfig (pronto para engine.reconcile)
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

// ---------------------------------------------------------------------------
// Helpers de DOM
// ---------------------------------------------------------------------------
function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

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

/**
 * Redesenha um painel de mapeamento: avisos de pendência + selects.
 */
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
  // Arquivo novo invalida análise/mapeamento anteriores
  hide(elSectionMapeamento);
  hide(elSectionResultados);

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

  state.mappingA = inferMapping(state.fileA.columns);
  state.mappingB = inferMapping(state.fileB.columns);
  state.config = null;

  renderMappingPanel(elMappingA, state.fileA.columns, state.mappingA);
  renderMappingPanel(elMappingB, state.fileB.columns, state.mappingB);

  hide(elSectionResultados);
  show(elSectionMapeamento);
  updateBtnConciliar();
});

// Delegação de eventos: mudança nos selects de mapeamento
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
// Conciliar (apenas valida e guarda config por enquanto;
// a chamada ao engine.reconcile entra na Microentrega 22)
// ---------------------------------------------------------------------------
elBtnConciliar.addEventListener('click', () => {
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
  showMessage('Configurações validadas. A conciliação será ligada na Microentrega 22.', 'warning');
});