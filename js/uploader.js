import { parseCSVRows, parseExcelRows } from './reader.js';
import { parseOFXString } from './ofxReader.js';
import { detectHeader } from './headerDetection.js';

/**
 * Detecta o tipo de arquivo baseado na extensão.
 *
 * @param {string} fileName  Nome do arquivo (ex: "extrato.csv")
 * @returns {'csv'|'xlsx'|'ofx'|'unknown'}
 */
export function detectFileType(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return 'unknown';
  }

  const ext = fileName.split('.').pop().toLowerCase();

  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'ofx') return 'ofx';

  return 'unknown';
}

/**
 * Converte linhas cruas + índice do cabeçalho em objetos.
 *
 * @param {Array<Array>} rawRows  Linhas cruas
 * @param {number} headerIndex  Índice da linha de cabeçalho
 * @returns {{ rows: Array<Object>, columns: Array<string> }}
 */
function buildObjects(rawRows, headerIndex) {
  const header = rawRows[headerIndex] || [];
  const columns = header.map((h, i) =>
    h == null || String(h).trim() === '' ? `coluna_${i}` : String(h).trim()
  );

  const dataRows = rawRows.slice(headerIndex + 1);
  const rows = dataRows.map((r) => {
    const obj = {};
    columns.forEach((c, i) => {
      obj[c] = r[i] == null ? '' : r[i];
    });
    return obj;
  });

  return { rows, columns };
}

/**
 * Lê um arquivo do navegador e retorna os dados estruturados.
 * Detecta automaticamente a linha de cabeçalho (CSV e Excel).
 *
 * @param {File} file  Objeto File do input[type=file]
 * @returns {Promise<{ rows: Array, columns: Array<string>, type: string, headerRowIndex: number }>}
 */
export async function readFile(file) {
  if (!file || !(file instanceof File)) {
    throw new TypeError('readFile espera um objeto File');
  }

  const type = detectFileType(file.name);

  if (type === 'unknown') {
    throw new Error(`Tipo de arquivo não suportado: ${file.name}`);
  }

  if (type === 'csv') {
    const text = await file.text();
    const rawRows = parseCSVRows(text);
    if (rawRows.length === 0) {
      return { rows: [], columns: [], type, headerRowIndex: 0 };
    }
    const headerRowIndex = detectHeader(rawRows);
    const { rows, columns } = buildObjects(rawRows, headerRowIndex);
    return { rows, columns, type, headerRowIndex };
  }

  if (type === 'xlsx') {
    const buffer = await file.arrayBuffer();
    const rawRows = parseExcelRows(buffer);
    if (rawRows.length === 0) {
      return { rows: [], columns: [], type, headerRowIndex: 0 };
    }
    const headerRowIndex = detectHeader(rawRows);
    const { rows, columns } = buildObjects(rawRows, headerRowIndex);
    return { rows, columns, type, headerRowIndex };
  }

  if (type === 'ofx') {
    const text = await file.text();
    const rows = parseOFXString(text);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns, type, headerRowIndex: 0 };
  }

  throw new Error(`Tipo não implementado: ${type}`);
}