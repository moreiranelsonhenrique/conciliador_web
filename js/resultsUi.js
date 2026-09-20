/**
 * Lógica pura de exibição dos resultados da conciliação (sem DOM).
 * main.js fica responsável apenas por eventos e escrita no DOM.
 */
import Decimal from 'decimal.js';
import { formatBRL } from './money.js';

/** Lista fixa de status exibidos no resumo financeiro. */
export const RESUMO_STATUSES = [
  'CONCILIADO',
  'POSSÍVEL CORRESPONDÊNCIA',
  'DIVERGÊNCIA',
  'NÃO ENCONTRADO',
];

/** Rótulos dos status para badges. */
export const STATUS_LABELS = {
  CONCILIADO: '🟢 CONCILIADO',
  'POSSÍVEL CORRESPONDÊNCIA': '🟡 POSSÍVEL CORRESPONDÊNCIA',
  DIVERGÊNCIA: '⚠️ DIVERGÊNCIA',
  'NÃO ENCONTRADO': '❌ NÃO ENCONTRADO',
};

/**
 * Escapa texto para uso seguro em HTML.
 * @param {*} value
 * @returns {string}
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
 * Formata Date como dd/mm/aaaa usando métodos UTC (convenção do projeto).
 * @param {Date|null} d
 * @returns {string}
 */
export function formatDateBR(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

/**
 * Formata valor monetário; valor inválido/ausente vira texto explícito
 * (nunca zero).
 * @param {*} value  Decimal ou null
 * @returns {string}
 */
export function formatMoneyOrInvalid(value) {
  if (value == null) return '(valor inválido)';
  return formatBRL(value);
}

/**
 * Classe CSS do badge de status.
 * @param {string} status
 * @returns {string}
 */
export function statusSlug(status) {
  if (status === 'CONCILIADO') return 'conciliado';
  if (status === 'POSSÍVEL CORRESPONDÊNCIA') return 'possivel';
  if (status === 'DIVERGÊNCIA') return 'divergencia';
  return 'nao-encontrado';
}

/**
 * Situação unificada para exibição (status automático + origem + revisão).
 * @param {Object} rv  ReviewableResult
 * @returns {string}
 */
export function situationLabel(rv) {
  const review = rv.human_decision;
  if (review === 'REJECTED') {
    return rv.is_batch ? '🚫 Lote rejeitado' : '🚫 Sugestão rejeitada';
  }
  if (!rv.has_link) return '❌ Não encontrado';
  if (rv.is_batch) {
    return review === 'CONFIRMED'
      ? '✅ Lote automático · Confirmado'
      : '🔗 Lote automático · Pendente';
  }
  if (rv.match_origin === 'MANUAL') {
    return review === 'CONFIRMED'
      ? '🔧 Conciliado manual · Confirmado'
      : '🔧 Conciliado manual · Pendente';
  }
  const status = rv.result.status;
  if (status === 'CONCILIADO') {
    return review === 'CONFIRMED'
      ? '✅ Conciliado automático · Confirmado'
      : '🟢 Conciliado automático · Pendente';
  }
  if (status === 'POSSÍVEL CORRESPONDÊNCIA') {
    return review === 'CONFIRMED' ? '✅ Possível · Confirmado' : '🟡 Possível · Pendente';
  }
  if (status === 'DIVERGÊNCIA') {
    return review === 'CONFIRMED' ? '⚠️ Divergência aceita' : '⚠️ Divergência · Pendente';
  }
  return `${status} · ${review}`;
}

/**
 * Monta as linhas do resumo financeiro por status, com somas em Decimal.
 * Entradas/Saídas usam a direção do registro A; direção INDEFINIDO entra
 * apenas no total movimentado.
 *
 * @param {Array<Object>} reviewables  ReviewableResult[]
 * @returns {{ rows: Array<Object>, total: Object }}
 */
export function buildSummaryRows(reviewables) {
  const list = Array.isArray(reviewables) ? reviewables : [];
  const rows = [];
  const total = {
    qtd: 0,
    entradas: new Decimal(0),
    saidas: new Decimal(0),
    movimentado: new Decimal(0),
  };
  for (const status of RESUMO_STATUSES) {
    let qtd = 0;
    let entradas = new Decimal(0);
    let saidas = new Decimal(0);
    let indefinido = new Decimal(0);
    for (const rv of list) {
      if (!rv || !rv.result || rv.result.status !== status) continue;
      qtd += 1;
      const a = rv.result.a;
      if (!a || a.value == null) continue;
      const abs = a.value.abs();
      if (a.direction === 'ENTRADA') entradas = entradas.plus(abs);
      else if (a.direction === 'SAIDA') saidas = saidas.plus(abs);
      else indefinido = indefinido.plus(abs);
    }
    const movimentado = entradas.plus(saidas).plus(indefinido);
    rows.push({ status, qtd, entradas, saidas, movimentado });
    total.qtd += qtd;
    total.entradas = total.entradas.plus(entradas);
    total.saidas = total.saidas.plus(saidas);
    total.movimentado = total.movimentado.plus(movimentado);
  }
  return { rows, total };
}

/**
 * Gera o HTML da tabela de resumo financeiro.
 * @param {{ rows: Array<Object>, total: Object }} summary
 * @returns {string}
 */
export function renderSummaryTable(summary) {
  const rowLabels = {
    CONCILIADO: '🟢 Conciliados',
    'POSSÍVEL CORRESPONDÊNCIA': '🟡 Possíveis',
    DIVERGÊNCIA: '⚠️ Divergências',
    'NÃO ENCONTRADO': '❌ Não encontrados',
  };
  let html =
    '<table class="resumo-table"><thead><tr>' +
    '<th>Status</th><th>Qtd</th><th>Entradas (R$)</th><th>Saídas (R$)</th><th>Total Movimentado (R$)</th>' +
    '</tr></thead><tbody>';
  for (const row of summary.rows) {
    html +=
      `<tr><td>${rowLabels[row.status] || row.status}</td><td>${row.qtd}</td>` +
      `<td>${formatBRL(row.entradas)}</td><td>${formatBRL(row.saidas)}</td>` +
      `<td>${formatBRL(row.movimentado)}</td></tr>`;
  }
  const t = summary.total;
  html +=
    `<tr class="total-row"><td>TOTAL GERAL</td><td>${t.qtd}</td>` +
    `<td>${formatBRL(t.entradas)}</td><td>${formatBRL(t.saidas)}</td>` +
    `<td>${formatBRL(t.movimentado)}</td></tr>`;
  html += '</tbody></table>';
  return html;
}

/**
 * Gera o HTML da barra de filtros (status, revisão, busca).
 * @returns {string}
 */
export function renderFiltersBar() {
  return (
    '<label>Status ' +
    '<select id="filtro-status">' +
    '<option value="Todos">Todos</option>' +
    '<option value="CONCILIADO">Conciliados</option>' +
    '<option value="POSSÍVEL CORRESPONDÊNCIA">Possíveis</option>' +
    '<option value="DIVERGÊNCIA">Divergências</option>' +
    '<option value="NÃO ENCONTRADO">Não encontrados</option>' +
    '</select></label>' +
    '<label>Revisão ' +
    '<select id="filtro-revisao">' +
    '<option value="Todos">Todos</option>' +
    '<option value="PENDING">Pendentes</option>' +
    '<option value="CONFIRMED">Confirmados</option>' +
    '<option value="REJECTED">Rejeitados</option>' +
    '</select></label>' +
    '<label>De ' +
    '<input type="date" id="filtro-data-de"></label>' +
    '<label>Até ' +
    '<input type="date" id="filtro-data-ate"></label>' +
    '<label>Valor mín (R$) ' +
    '<input type="number" id="filtro-valor-min" step="0.01" min="0" placeholder="0,00"></label>' +
    '<label>Valor máx (R$) ' +
    '<input type="number" id="filtro-valor-max" step="0.01" min="0" placeholder="sem limite"></label>' +
    '<input type="search" id="filtro-busca" placeholder="Buscar descrição...">' +
    '<span id="filtro-contagem" class="hint"></span>'
  );
}

/**
 * Converte data de filtro (input type="date" → 'YYYY-MM-DD') em chave
 * numérica AAAAMMDD. Retorna null para valor vazio/inválido.
 * Comparação por chave de dia (não por timestamp): registro com hora
 * diferente de 00:00 UTC continua casando com o próprio dia (M40B).
 * @param {*} value
 * @returns {number|null}
 */
function parseFilterDateKey(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value == null ? '' : value).trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year * 10000 + month * 100 + day;
}

/**
 * Chave de dia AAAAMMDD de um Date, pelos métodos UTC — mesma convenção
 * de formatDateBR: o dia exibido no cartão é o dia usado no filtro.
 * @param {Date} d
 * @returns {number}
 */
function dateKeyUTC(d) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/**
 * Interpreta valor de filtro como Decimal finito.
 * Retorna null para valor vazio/inválido (o filtro é ignorado).
 * @param {*} value
 * @returns {Decimal|null}
 */
function parseFilterDecimal(value) {
  if (value == null || value === '') return null;
  try {
    const d = new Decimal(String(value).replace(',', '.'));
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/**
 * Aplica filtros (status, revisão, busca textual, período e faixa de valor)
 * sobre os resultados.
 * - A busca procura na descrição do A e na descrição do vínculo atual (via registry).
 * - Período (dateFrom/dateTo) filtra pela DATA do registro A, inclusivo,
 *   comparando o dia-calendário em UTC (independe da hora do registro);
 *   registro sem data fica de fora quando o filtro está ativo.
 * - Faixa de valor (valueMin/valueMax) compara com o VALOR ABSOLUTO do registro A;
 *   valores de filtro inválidos são ignorados.
 *
 * @param {Array<Object>} reviewables  ReviewableResult[]
 * @param {Object} registry  BRegistry
 * @param {{ status?: string, review?: string, search?: string }} filters
 * @returns {Array<Object>}
 */
export function applyFilters(reviewables, registry, filters = {}) {
  let list = Array.isArray(reviewables) ? reviewables : [];
  const status = filters.status || 'Todos';
  const review = filters.review || 'Todos';
  const term = String(filters.search || '').toLowerCase().trim();

  if (status !== 'Todos') {
    list = list.filter((rv) => rv.result && rv.result.status === status);
  }
  if (review !== 'Todos') {
    list = list.filter((rv) => rv.human_decision === review);
  }
  if (term) {
    list = list.filter((rv) => {
      const descA = (rv.result.a.description_original || '').toLowerCase();
      if (descA.includes(term)) return true;
      const ids = rv.is_batch
        ? rv.current_batch_ids
        : rv.current_b_id
          ? [rv.current_b_id]
          : [];
      for (const id of ids) {
        const b = registry ? registry.get(id) : null;
        if (b && (b.description_original || '').toLowerCase().includes(term)) return true;
      }
      return false;
    });
  }
  // Microentrega 40 (ajuste M40B): período por CHAVE DE DIA (AAAAMMDD em UTC),
  // inclusivo nas duas pontas. Comparar timestamps quebrava De=Até no mesmo dia
  // quando a data do registro tem hora diferente de 00:00 UTC.
  const fromKey = parseFilterDateKey(filters.dateFrom);
  const toKey = parseFilterDateKey(filters.dateTo);
  if (fromKey != null || toKey != null) {
    list = list.filter((rv) => {
      const d = rv && rv.result && rv.result.a ? rv.result.a.date : null;
      if (!(d instanceof Date) || isNaN(d.getTime())) return false;
      const key = dateKeyUTC(d);
      if (fromKey != null && key < fromKey) return false;
      if (toKey != null && key > toKey) return false;
      return true;
    });
  }

  // Microentrega 40: faixa de valor (valor absoluto do registro A)
  const min = parseFilterDecimal(filters.valueMin);
  const max = parseFilterDecimal(filters.valueMax);
  if (min != null || max != null) {
    list = list.filter((rv) => {
      const v = rv && rv.result && rv.result.a ? rv.result.a.value : null;
      if (v == null) return false;
      let dv;
      try {
        dv = new Decimal(v).abs();
      } catch {
        return false;
      }
      if (min != null && dv.lt(min)) return false;
      if (max != null && dv.gt(max)) return false;
      return true;
    });
  }

  return list;
}

/**
 * Gera o HTML de um bloco de dados de um registro (A ou B).
 * @param {string} title
 * @param {Object} rec
 * @returns {string}
 */
function renderRecordBlock(title, rec) {
  return (
    `<div><h4>${title}</h4>` +
    '<dl class="result-body">' +
    `<dt>Linha</dt><dd>${rec.original_row}</dd>` +
    `<dt>Data</dt><dd>${formatDateBR(rec.date) || '(sem data)'}</dd>` +
    `<dt>Descrição</dt><dd>${escapeHtml(rec.description_original || '(sem descrição)')}</dd>` +
    `<dt>Valor</dt><dd>${formatMoneyOrInvalid(rec.value)}</dd>` +
    `<dt>Direção</dt><dd>${rec.direction}</dd>` +
    '</dl></div>'
  );
}

/**
 * Gera o HTML dos itens de um lote (inline), com soma e conferência.
 * @param {Object} rv  ReviewableResult
 * @param {Array<Object>} items  Registros B do lote
 * @param {boolean} showCheck  Se true, exibe a conferência soma x valor A
 * @returns {string}
 */
function renderBatchBlock(rv, items, showCheck = true) {
  const list = Array.isArray(items) ? items : [];
  let soma = new Decimal(0);
  let rowsHtml = '';
  for (const bi of list) {
    if (bi.value != null) soma = soma.plus(bi.value.abs());
    rowsHtml +=
      `<tr><td>${bi.original_row}</td>` +
      `<td>${formatDateBR(bi.date) || ''}</td>` +
      `<td>${escapeHtml(bi.description_original || '(sem descrição)')}</td>` +
      `<td>${formatMoneyOrInvalid(bi.value)}</td>` +
      `<td>${bi.direction}</td></tr>`;
  }
  let checkHtml = '';
  const a = rv.result.a;
  if (showCheck && a.value != null) {
    const valorA = a.value.abs();
    const diferenca = valorA.minus(soma);
    checkHtml = diferenca.abs().lte('0.01')
      ? `<p>✅ Soma dos itens (${formatBRL(soma)}) confere com o valor A (${formatBRL(valorA)}).</p>`
      : `<p>⚠️ Diferença de ${formatBRL(diferenca.abs())} entre valor A (${formatBRL(valorA)}) e soma dos itens (${formatBRL(soma)}).</p>`;
  }
  return (
    `<div class="lote-items"><h4>📋 Itens do lote (${list.length})</h4>` +
    '<table><thead><tr><th>Linha B</th><th>Data</th><th>Descrição</th><th>Valor</th><th>Dir</th></tr></thead>' +
    `<tbody>${rowsHtml}</tbody></table>` +
    checkHtml +
    '</div>'
  );
}

/**
 * Gera o HTML completo do cartão de um resultado (função pura).
 * Lotes já vêm expandidos (details open).
 *
 * @param {Object} rv  ReviewableResult
 * @param {Object} registry  BRegistry
 * @returns {string}
 */
export function renderResultCard(rv, registry) {
  const result = rv.result;
  const a = result.a;
  const slug = statusSlug(result.status);

  let html = `<article class="result-card" data-a-id="${escapeHtml(a.id)}">`;

  // Cabeçalho: status + situação unificada
  html += '<div class="result-header">';
  html += `<span class="result-status ${slug}">${STATUS_LABELS[result.status] || result.status}</span>`;
  html += '</div>';

  // Linha-resumo do registro A
  html +=
    `<p><strong>Linha A ${a.original_row}</strong> · ` +
    `${formatDateBR(a.date) || '(sem data)'} · ` +
    `${escapeHtml(a.description_original || '(sem descrição)')} · ` +
    `${formatMoneyOrInvalid(a.value)} · ${a.direction}</p>`;

  // Detalhes expansíveis (lotes já vêm abertos)
  html += `<details><summary>Detalhes e vínculo</summary>`;
  html += renderRecordBlock('Registro A (Banco/Extrato)', a);

  // Vínculo atual
  if (rv.is_batch && rv.current_batch_ids.length > 0) {
    html += renderBatchBlock(rv, result.batch_items, true);
  } else if (rv.human_decision === 'REJECTED') {
    html += `<p><em>${rv.is_batch ? 'Lote rejeitado' : 'Vínculo rejeitado'} pelo usuário.</em></p>`;
    if (rv.is_batch && Array.isArray(result.batch_items) && result.batch_items.length > 0) {
      html += renderBatchBlock(rv, result.batch_items, false);
    } else if (rv.original_b_id) {
      const ob = registry ? registry.get(rv.original_b_id) : null;
      if (ob) html += renderRecordBlock('Vínculo original (auditoria)', ob);
    }
  } else if (rv.current_b_id) {
    const b = registry ? registry.get(rv.current_b_id) : null;
    html += b
      ? renderRecordBlock('Registro B vinculado (Financeiro)', b)
      : '<p>(registro B não encontrado)</p>';
  } else {
    html += '<p><em>Nenhum registro B vinculado.</em></p>';
  }

  // Justificativa, scores e alertas
  if (result.justification) {
    html += `<p><small>Justificativa: ${escapeHtml(result.justification)}</small></p>`;
  }
  if (result.score_details) {
    const sd = result.score_details;
    html += `<p><small>Score: ${sd.total} (valor ${sd.value} · data ${sd.date} · texto ${sd.text})</small></p>`;
  }
  if (Array.isArray(result.alerts) && result.alerts.length > 0) {
    html += `<p><small>⚠️ ${result.alerts.map(escapeHtml).join('; ')}</small></p>`;
  }

  html += '</details>';

  // Container das ações (preenchido pela Microentrega 23)
  html += `<div class="result-actions" data-a-id="${escapeHtml(a.id)}"></div>`;

  html += '</article>';
  return html;
}

// ---------------------------------------------------------------------------
// Sobras do Arquivo B (registros B sem correspondente) — Microentrega 25
// ---------------------------------------------------------------------------

/**
 * Extrai o resultado puro de um item (aceita ReviewableResult ou resultado).
 * @param {*} item
 * @returns {Object|null}
 */
function extractResult(item) {
  if (!item || typeof item !== 'object') return null;
  return item.result || item;
}

/**
 * Retorna os registros do Arquivo B que não estão vinculados a nenhum
 * resultado (vínculo atual: 1:1 ou lote). Aceita ReviewableResult[] ou
 * resultados puros — sempre reflete a SITUAÇÃO ATUAL da conciliação.
 *
 * @param {Array<Object>} results  ReviewableResult[] ou resultados do reconcile
 * @param {Array<Object>} recordsB  Todos os registros B
 * @returns {Array<Object>}  Registros B não vinculados
 */
export function findUnmatchedB(results, recordsB) {
  // Se results não é array válido, não há como determinar sobras
  if (!Array.isArray(results)) {
    return [];
  }
  const list = results;
  const recs = Array.isArray(recordsB) ? recordsB : [];
  const used = new Set();
  for (const item of list) {
    const rv = item && item.result ? item : null;
    if (rv) {
      // ReviewableResult: usa o vínculo ATUAL (reflete rejeições/correções)
      if (rv.current_b_id) used.add(rv.current_b_id);
      if (Array.isArray(rv.current_batch_ids)) {
        for (const id of rv.current_batch_ids) used.add(id);
      }
      continue;
    }
    // Resultado puro
    const result = extractResult(item);
    if (!result) continue;
    if (result.b && result.b.id) used.add(result.b.id);
    if (Array.isArray(result.batch_items)) {
      for (const bi of result.batch_items) {
        if (bi && bi.id) used.add(bi.id);
      }
    }
  }
  return recs.filter((b) => b && !used.has(b.id));
}

/**
 * Gera o HTML da seção de sobras do Arquivo B.
 * Retorna string vazia quando não há sobras.
 *
 * @param {Array<Object>} unmatchedB  Registros B não vinculados
 * @returns {string}
 */
export function renderUnmatchedBTable(unmatchedB) {
  const list = Array.isArray(unmatchedB) ? unmatchedB : [];
  if (list.length === 0) return '';
  let html = `<details class="unmatched-b">`;
  html += `<summary>📄 Registros B sem correspondente no Arquivo A (${list.length}) — clique para expandir</summary>`;
  html += '<p class="hint">Estes registros existem no Financeiro mas não foram vinculados a nenhum lançamento do extrato. Verifique se falta algo no Arquivo A.</p>';
  html += '<table><thead><tr><th>Linha B</th><th>Data</th><th>Descrição</th><th>Valor</th><th>Dir</th></tr></thead><tbody>';
  for (const b of list) {
    html +=
      `<tr><td>${b.original_row != null ? b.original_row : ''}</td>` +
      `<td>${formatDateBR(b.date) || '(sem data)'}</td>` +
      `<td>${escapeHtml(b.description_original || '(sem descrição)')}</td>` +
      `<td>${formatMoneyOrInvalid(b.value)}</td>` +
      `<td>${b.direction || ''}</td></tr>`;
  }
  html += '</tbody></table></details>';
  return html;
}

// ---------------------------------------------------------------------------
// Pendências no resumo (Microentrega 42 — item registrado na M40)
// ---------------------------------------------------------------------------
/**
 * Soma registros por direção (valores absolutos). INDEFINIDO entra só no movimentado.
 * @param {Array<Object>} records
 * @returns {Object} { qtd, entradas, saidas, movimentado }
 */
function sumByDirection(records) {
  let qtd = 0;
  let entradas = new Decimal(0);
  let saidas = new Decimal(0);
  let indefinido = new Decimal(0);
  for (const rec of Array.isArray(records) ? records : []) {
    if (!rec) continue;
    qtd += 1;
    if (rec.value == null) continue;
    const abs = rec.value.abs();
    if (rec.direction === 'ENTRADA') entradas = entradas.plus(abs);
    else if (rec.direction === 'SAIDA') saidas = saidas.plus(abs);
    else indefinido = indefinido.plus(abs);
  }
  return { qtd, entradas, saidas, movimentado: entradas.plus(saidas).plus(indefinido) };
}

/**
 * Monta as pendências atuais (dinâmicas):
 * - Banco (A): registros A sem vínculo atual (não encontrados, rejeitados sem novo vínculo).
 * - Financeiro (B): sobras (registros B sem vínculo, situação atual).
 * @param {Array<Object>} reviewables  ReviewableResult[]
 * @param {Array<Object>} recordsB  Todos os registros B
 * @returns {{ banco: Object, financeiro: Object }}
 */
export function buildPendingRows(reviewables, recordsB) {
  const list = Array.isArray(reviewables) ? reviewables : [];
  const pendA = list
    .filter((rv) => rv && rv.result && !rv.has_link)
    .map((rv) => rv.result.a)
    .filter(Boolean);
  const sobrasB = findUnmatchedB(list, recordsB);
  return {
    banco: sumByDirection(pendA),
    financeiro: sumByDirection(sobrasB),
  };
}

/**
 * Gera o HTML do bloco de pendências. INFORMATIVO: os valores já estão
 * contados nas linhas de status/sobras e NÃO somam no TOTAL GERAL.
 * Retorna string vazia quando não há pendências.
 * @param {{ banco: Object, financeiro: Object }} pending
 * @returns {string}
 */
export function renderPendingTable(pending) {
  if (!pending || !pending.banco || !pending.financeiro) return '';
  if (pending.banco.qtd === 0 && pending.financeiro.qtd === 0) return '';
  const row = (label, p) =>
    `<tr><td>${label}</td><td>${p.qtd}</td>` +
    `<td>${formatBRL(p.entradas)}</td><td>${formatBRL(p.saidas)}</td>` +
    `<td>${formatBRL(p.movimentado)}</td></tr>`;
  let html = '<div class="pendencias">';
  html += '<table class="resumo-table"><thead><tr>';
  html += '<th>Pendências (informativo)</th><th>Qtd</th><th>Entradas (R$)</th><th>Saídas (R$)</th><th>Total Movimentado (R$)</th>';
  html += '</tr></thead><tbody>';
  html += row('⬜ Pendências — Banco (A)', pending.banco);
  html += row('⬜ Pendências — Financeiro (B)', pending.financeiro);
  html += '</tbody></table>';
  html += '<p class="hint">Informativo: estes valores já estão contados nas linhas de status e nas sobras — não somam no TOTAL GERAL.</p>';
  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// Período (Microentrega 42 — D3)
// ---------------------------------------------------------------------------
/**
 * Detecta o período (min/max de datas válidas) de uma lista de registros.
 * @param {Array<Object>} records
 * @returns {{ de: Date|null, ate: Date|null }}
 */
export function detectPeriodo(records) {
  let de = null;
  let ate = null;
  for (const rec of Array.isArray(records) ? records : []) {
    const d = rec && rec.date;
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (de == null || d.getTime() < de.getTime()) de = d;
    if (ate == null || d.getTime() > ate.getTime()) ate = d;
  }
  return { de, ate };
}

/**
 * União de dois períodos (menor início, maior fim).
 * @param {Object} pa
 * @param {Object} pb
 * @returns {{ de: Date|null, ate: Date|null }}
 */
export function unionPeriodo(pa, pb) {
  const a = pa || {};
  const b = pb || {};
  let de = null;
  let ate = null;
  for (const d of [a.de, b.de]) {
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (de == null || d.getTime() < de.getTime()) de = d;
  }
  for (const d of [a.ate, b.ate]) {
    if (!(d instanceof Date) || isNaN(d.getTime())) continue;
    if (ate == null || d.getTime() > ate.getTime()) ate = d;
  }
  return { de, ate };
}

/**
 * Converte Date para valor de input[type=date] (YYYY-MM-DD, via UTC).
 * @param {Date|null} d
 * @returns {string}
 */
function dateToInputValue(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Painel de período (D3): período detectado por lado, alerta se os lados
 * divergirem e período editável para a capa do relatório.
 * @param {Object} periodoA  { de, ate } do Banco (A)
 * @param {Object} periodoB  { de, ate } do Financeiro (B)
 * @param {Object} uniao  { de, ate } pré-preenchimento dos inputs editáveis
 * @returns {string}
 */
export function renderPeriodInfo(periodoA, periodoB, uniao) {
  const pa = periodoA || { de: null, ate: null };
  const pb = periodoB || { de: null, ate: null };
  const u = uniao || { de: null, ate: null };
  const fmt = (d) => formatDateBR(d) || '(sem data)';
  const divergente = fmt(pa.de) !== fmt(pb.de) || fmt(pa.ate) !== fmt(pb.ate);
  let html = '<div class="periodo-info">';
  html +=
    `<p><strong>📅 Período detectado</strong> — ` +
    `Banco (A): ${fmt(pa.de)} a ${fmt(pa.ate)} · ` +
    `Financeiro (B): ${fmt(pb.de)} a ${fmt(pb.ate)}</p>`;
  if (divergente) {
    html += '<div class="periodo-alerta">⚠️ Os períodos divergem entre os lados — confirme se os arquivos cobrem o mesmo intervalo.</div>';
  }
  html +=
    '<p>Período do relatório (editável): ' +
    `<label>De <input type="date" id="periodo-de" value="${dateToInputValue(u.de)}"></label> ` +
    `<label>Até <input type="date" id="periodo-ate" value="${dateToInputValue(u.ate)}"></label></p>`;
  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// Diagnóstico de saldos (Microentrega 42 — D2)
// ---------------------------------------------------------------------------
/**
 * Painel de diagnóstico de saldos (saída de checkSides).
 * Saldos finais calculado/informado são SOMENTE LEITURA (D2): aparecem só aqui.
 * @param {Object} diag  { A, B, crossDifference } — saída de checkSides
 * @returns {string}
 */
export function renderDiagnosticoSaldos(diag) {
  if (!diag || !diag.A || !diag.B) return '';
  const fmt = (v) => (v == null ? '—' : formatBRL(v));
  const verdict = (side) => {
    if (side.ok == null) return '<td class="diagnostico-neutro">— (sem saldo informado)</td>';
    if (side.ok) return '<td class="diagnostico-ok">✅ Dentro da tolerância</td>';
    return `<td class="diagnostico-falha">❌ Diferença de ${formatBRL(side.difference.abs())}</td>`;
  };
  const row = (label, side) =>
    `<tr><td>${label}</td>` +
    `<td>${fmt(side.initial)}</td>` +
    `<td>${fmt(side.entradas)}</td>` +
    `<td>${fmt(side.saidas)}</td>` +
    `<td>${fmt(side.computedFinal)}</td>` +
    `<td>${fmt(side.reportedFinal)}</td>` +
    `<td>${fmt(side.difference)}</td>` +
    verdict(side) +
    '</tr>';
  let html = '<div class="diagnostico-saldos">';
  html += '<h3>🩺 Diagnóstico de Saldos (informado × calculado)</h3>';
  html += '<table><thead><tr>' +
    '<th>Lado</th><th>Saldo inicial</th><th>Entradas</th><th>Saídas</th>' +
    '<th>Final calculado</th><th>Final informado</th><th>Diferença</th><th>Resultado</th>' +
    '</tr></thead><tbody>';
  html += row('Banco (A)', diag.A);
  html += row('Financeiro (B)', diag.B);
  html += '</tbody></table>';
  html += `<p>Diferença entre lados (calculado B − calculado A): <strong>${fmt(diag.crossDifference)}</strong></p>`;
  if (diag.A.ok === false || diag.B.ok === false) {
    html += '<p class="diagnostico-falha">⚠️ Arquivo não fecha internamente: possíveis linhas faltando/sobrando ou erro de mapeamento. A conciliação segue mesmo assim.</p>';
  }
  if (diag.A.valorInvalidoQtd > 0 || diag.B.valorInvalidoQtd > 0) {
    html +=
      `<p class="hint">ℹ️ Registros com valor inválido não entram no cálculo: ` +
      `${diag.A.valorInvalidoQtd} no Banco (A), ${diag.B.valorInvalidoQtd} no Financeiro (B).</p>`;
  }
  html += '</div>';
  return html;
}