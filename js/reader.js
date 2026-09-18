import Papa from 'papaparse';
import * as XLSX from './vendor/xlsx.mjs';

/**
 * Faz o parse de um texto CSV e retorna uma lista de registros.
 *
 * @param {string} csvText  Texto bruto do arquivo CSV
 * @param {object} [options]
 * @param {string} [options.delimiter=","]  Delimitador de colunas
 * @returns {Array<Object>}  Array de objetos onde cada chave é um nome de coluna
 */
export function parseCSVString(csvText, options = {}) {
  if (typeof csvText !== 'string') {
    throw new TypeError('parseCSVString espera uma string como primeiro argumento.');
  }

  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: options.delimiter || ',',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    console.warn('Avisos do PapaParse:', result.errors);
  }

  return result.data;
}

/**
 * Faz o parse de um arquivo Excel (XLSX/XLS) e retorna uma lista de registros.
 *
 * @param {ArrayBuffer|Buffer|Uint8Array} buffer  Conteúdo binário do arquivo
 * @param {object} [options]
 * @param {string} [options.sheetName]  Nome da aba a ler (padrão: primeira aba)
 * @returns {Array<Object>}  Array de objetos onde cada chave é um nome de coluna
 */
export function parseExcel(buffer, options = {}) {
  if (!buffer) {
    throw new TypeError('parseExcel espera um buffer como primeiro argumento.');
  }

  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName = options.sheetName || workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return [];
  }

  // raw: false retorna valores formatados como aparecem no Excel.
  // defval: '' garante que células vazias virem string vazia, não undefined.
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  return rows;
}