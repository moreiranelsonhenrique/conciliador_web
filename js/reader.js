import Papa from 'papaparse';

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
    dynamicTyping: false, // mantemos tudo como string; o pipeline faz a conversão
    transformHeader: (h) => h.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    // Não lançamos erro aqui; reportamos nos próprios registros (consistente com a V5).
    // Mas registramos no console para debugging.
    console.warn('Avisos do PapaParse:', result.errors);
  }

  return result.data;
}