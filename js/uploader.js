import { parseCSVString } from './reader.js';
import { parseExcel } from './reader.js';
import { parseOFXString } from './ofxReader.js';

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
 * Lê um arquivo do navegador e retorna os dados estruturados.
 *
 * @param {File} file  Objeto File do input[type=file]
 * @returns {Promise<{ rows: Array, columns: Array<string>, type: string }>}
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
    const rows = parseCSVString(text);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns, type };
  }

  if (type === 'xlsx') {
    const buffer = await file.arrayBuffer();
    const rows = parseExcel(buffer);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns, type };
  }

  if (type === 'ofx') {
    const text = await file.text();
    const rows = parseOFXString(text);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns, type };
  }

  throw new Error(`Tipo não implementado: ${type}`);
}