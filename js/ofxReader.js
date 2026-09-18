/**
 * Faz o parse de um texto OFX (formato SGML ou XML) e retorna uma lista de transações.
 *
 * OFX é o formato padrão de extratos bancários brasileiros.
 * Cada transação (STMTTRN) contém: TRNTYPE, DTPOSTED, TRNAMT, FITID, NAME, MEMO.
 *
 * @param {string} ofxText  Texto bruto do arquivo OFX
 * @returns {Array<Object>}  Array de objetos com campos normalizados
 */
export function parseOFXString(ofxText) {
  if (typeof ofxText !== 'string') {
    throw new TypeError('parseOFXString espera uma string como primeiro argumento.');
  }

  const transactions = [];

  // Extrai todos os blocos STMTTRN (funciona para SGML e XML)
  const trnBlocks = ofxText.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];

  for (const block of trnBlocks) {
    const trn = {};

    // Extrai cada campo do bloco
    trn.TRNTYPE = extractTag(block, 'TRNTYPE');
    trn.DTPOSTED = extractTag(block, 'DTPOSTED');
    trn.TRNAMT = extractTag(block, 'TRNAMT');
    trn.FITID = extractTag(block, 'FITID');
    trn.NAME = extractTag(block, 'NAME');
    trn.MEMO = extractTag(block, 'MEMO');

    // Converte TRNAMT para número com sinal
    // OFX usa sinal direto: negativo = débito/saída, positivo = crédito/entrada
    if (trn.TRNAMT) {
      trn.TRNAMT_NUM = parseFloat(trn.TRNAMT);
    }

    // Converte DTPOSTED de YYYYMMDDHHMMSS para formato legível
    if (trn.DTPOSTED && trn.DTPOSTED.length >= 8) {
      const year = trn.DTPOSTED.substring(0, 4);
      const month = trn.DTPOSTED.substring(4, 6);
      const day = trn.DTPOSTED.substring(6, 8);
      trn.DTPOSTED_FORMATTED = `${year}-${month}-${day}`;
    }

    // Determina direção baseada no sinal de TRNAMT
    if (trn.TRNAMT_NUM < 0) {
      trn.DIRECTION = 'D'; // Débito/Saída
    } else if (trn.TRNAMT_NUM > 0) {
      trn.DIRECTION = 'C'; // Crédito/Entrada
    } else {
      trn.DIRECTION = '';
    }

    transactions.push(trn);
  }

  return transactions;
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
  // O valor termina na próxima tag ou fim da linha
  const sgmlRegex = new RegExp(`<${tagName}>([^<\\r\\n]*)`, 'i');
  const sgmlMatch = block.match(sgmlRegex);
  if (sgmlMatch) {
    return sgmlMatch[1].trim();
  }

  return '';
}