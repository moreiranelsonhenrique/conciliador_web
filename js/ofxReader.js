/**
 * Leitura de arquivos OFX (formato padrão de extratos bancários brasileiros).
 * Microentrega 30: colunas com nomes amigáveis em português, porque os códigos
 * crus do OFX (TRNTYPE, DTPOSTED, TRNAMT...) confundem o usuário no mapeamento.
 */

/**
 * Faz o parse de um texto OFX (formato SGML ou XML) e retorna uma lista de
 * transações com colunas amigáveis:
 * Data, Valor, Descrição, Observação, Tipo, ID Transação.
 *
 * @param {string} ofxText  Texto bruto do arquivo OFX
 * @returns {Array<Object>}  Array de objetos com colunas amigáveis
 */
export function parseOFXString(ofxText) {
  if (typeof ofxText !== 'string') {
    throw new TypeError('parseOFXString espera uma string como primeiro argumento.');
  }
  const transactions = [];
  // Extrai todos os blocos STMTTRN (funciona para SGML e XML)
  const trnBlocks = ofxText.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];
  for (const block of trnBlocks) {
    const name = extractTag(block, 'NAME');
    const memo = extractTag(block, 'MEMO');
    transactions.push({
      'Data': formatOfxDate(extractTag(block, 'DTPOSTED')),
      'Valor': extractTag(block, 'TRNAMT'),
      // Alguns bancos não enviam NAME; nesse caso o MEMO é a descrição útil
      'Descrição': name || memo,
      'Observação': memo,
      'Tipo': extractTag(block, 'TRNTYPE'),
      'ID Transação': extractTag(block, 'FITID'),
    });
  }
  return transactions;
}

/**
 * Converte DTPOSTED (YYYYMMDDHHMMSS...) para dd/mm/yyyy.
 * @param {string} dtposted
 * @returns {string}  Data formatada ou string vazia
 */
function formatOfxDate(dtposted) {
  if (!dtposted || dtposted.length < 8) return '';
  const year = dtposted.substring(0, 4);
  const month = dtposted.substring(4, 6);
  const day = dtposted.substring(6, 8);
  return `${day}/${month}/${year}`;
}

/**
 * Extrai o conteúdo de uma tag OFX.
 * Funciona tanto para formato SGML (tag sem fechamento) quanto XML (tag fechada).
 *
 * @param {string} block  Bloco de texto onde procurar
 * @param {string} tagName  Nome da tag (ex: 'TRNTYPE')
 * @returns {string}  Conteúdo da tag ou string vazia
 */
function extractTag(block, tagName) {
  // Tenta formato XML primeiro: <TAG>valor</TAG>
  const xmlRegex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const xmlMatch = block.match(xmlRegex);
  if (xmlMatch) {
    return xmlMatch[1].trim();
  }
  // Formato SGML: <TAG>valor (sem tag de fechamento)
  const sgmlRegex = new RegExp(`<${tagName}>([^<\\r\\n]*)`, 'i');
  const sgmlMatch = block.match(sgmlRegex);
  if (sgmlMatch) {
    return sgmlMatch[1].trim();
  }
  return '';
}