/**
 * Persistência de mapeamento de colunas (Microentrega 39).
 * Módulo puro: o storage é injetado (localStorage real no navegador;
 * fake nos testes). Sem botão "esquecer layouts" (D7): o mapeamento
 * lembrado é sempre sugestão e os selects permanecem editáveis.
 *
 * Chave por layout: lado + hash das colunas. O mesmo arquivo
 * (mesmas colunas, mesma ordem) lembra o mapeamento; um layout
 * diferente cai na inferência automática normal.
 */

const KEY_PREFIX = 'conciliador_web.mapping';

/**
 * Retorna o storage padrão (localStorage do navegador) ou null.
 * @returns {Storage|null}
 */
function getDefaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage indisponível (privacidade, segurança, etc.)
  }
  return null;
}

/**
 * Valida o lado ('A' ou 'B').
 * @param {*} side
 * @returns {string|null}
 */
function normalizeSide(side) {
  const s = String(side || '').toUpperCase();
  return s === 'A' || s === 'B' ? s : null;
}

/**
 * Hash (djb2) do layout de colunas — identifica o "desenho" do arquivo.
 * Nomes e ordem das colunas compõem o layout.
 * @param {Array<string>} columns
 * @returns {string}
 */
export function layoutHash(columns) {
  const cols = Array.isArray(columns) ? columns : [];
  const str = cols.map((c) => String(c ?? '').trim()).join('|');
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Chave no storage para o mapeamento de um lado + layout.
 * @param {string} side  'A' ou 'B'
 * @param {Array<string>} columns
 * @returns {string|null}
 */
export function storageKey(side, columns) {
  const s = normalizeSide(side);
  if (!s) return null;
  return `${KEY_PREFIX}.${s}.${layoutHash(columns)}`;
}

/**
 * Carrega o mapeamento lembrado para o lado + layout.
 * Retorna null quando: sem storage, nada salvo, dados corrompidos
 * ou mapeamento apontando para coluna que não existe no layout.
 * @param {string} side  'A' ou 'B'
 * @param {Array<string>} columns  Colunas atuais do arquivo
 * @param {Storage} [storage]  Storage injetado (padrão: localStorage)
 * @returns {Object|null}  { date, value, description, dc, type }
 */
export function loadMapping(side, columns, storage) {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return null;
  const key = storageKey(side, columns);
  if (!key) return null;
  let raw = null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const mapping = parsed && typeof parsed === 'object' ? parsed.mapping : null;
  if (!mapping || typeof mapping !== 'object') return null;
  // Defesa: toda coluna referenciada precisa existir no layout atual
  const known = new Set((Array.isArray(columns) ? columns : []).map((c) => String(c)));
  const out = { date: null, value: null, description: null, dc: null, type: null, balance: null };
  for (const role of Object.keys(out)) {
    const col = mapping[role];
    if (col == null || col === '') {
      out[role] = null;
      continue;
    }
    if (!known.has(String(col))) return null;
    out[role] = String(col);
  }
  return out;
}

/**
 * Salva o mapeamento usado para o lado + layout.
 * @param {string} side  'A' ou 'B'
 * @param {Array<string>} columns  Colunas do arquivo
 * @param {Object} mapping  { date, value, description, dc, type }
 * @param {Storage} [storage]  Storage injetado (padrão: localStorage)
 * @returns {boolean}  true se salvou
 */
export function saveMapping(side, columns, mapping, storage) {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return false;
  const key = storageKey(side, columns);
  if (!key || !mapping || typeof mapping !== 'object') return false;
  const payload = {
    columns: Array.isArray(columns) ? columns : [],
    mapping: {
      date: mapping.date || null,
      value: mapping.value || null,
      description: mapping.description || null,
      dc: mapping.dc || null,
      type: mapping.type || null,
      balance: mapping.balance || null,
    },
    savedAt: new Date().toISOString(),
  };
  try {
    store.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}