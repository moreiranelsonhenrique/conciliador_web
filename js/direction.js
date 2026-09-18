/**
 * Palavras que indicam ENTRADA (crédito).
 * Normalizadas: maiúsculas, sem acentos.
 */
const ENTRADA_EXACT = [
  'C', 'CR', 'CREDIT', 'CREDITO', 'ENTRADA', 'RECEITA', 'IN', 'INFLOW',
];
const ENTRADA_PARTIAL = [
  'CREDIT', 'CREDITO', 'ENTRADA', 'RECEITA', 'RECEBIMENTO', 'DEPOSIT', 'DEPOSITO',
];

/**
 * Palavras que indicam SAIDA (débito).
 * Normalizadas: maiúsculas, sem acentos.
 */
const SAIDA_EXACT = [
  'D', 'DR', 'DEBIT', 'DEBITO', 'SAIDA', 'DESPESA', 'OUT', 'OUTFLOW',
];
const SAIDA_PARTIAL = [
  'DEBIT', 'DEBITO', 'SAIDA', 'DESPESA', 'PAGAMENTO', 'PAGAR',
  'RETIRADA', 'SANGRIA', 'TRANSFERENCIA ENVIADA',
];

/**
 * Normaliza um texto de direção para ENTRADA, SAIDA ou INDEFINIDO.
 *
 * Exemplos de entrada: "C", "D", "Crédito", "Débito", "Entrada", "Saída",
 * "DEBIT", "CREDIT", "PAGAR", "RECEBIMENTO".
 *
 * @param {*} value  Valor da célula de direção
 * @returns {string}  'ENTRADA', 'SAIDA' ou 'INDEFINIDO'
 */
export function normalizeDirectionText(value) {
  if (value == null) return 'INDEFINIDO';

  const normalized = String(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!normalized) return 'INDEFINIDO';

  // Match exato primeiro
  if (ENTRADA_EXACT.includes(normalized)) return 'ENTRADA';
  if (SAIDA_EXACT.includes(normalized)) return 'SAIDA';

  // Match parcial (apenas palavras com 4+ chars para evitar falsos positivos)
  for (const p of ENTRADA_PARTIAL) {
    if (p.length >= 4 && normalized.includes(p)) return 'ENTRADA';
  }
  for (const p of SAIDA_PARTIAL) {
    if (p.length >= 4 && normalized.includes(p)) return 'SAIDA';
  }

  return 'INDEFINIDO';
}

/**
 * Determina direção baseada no sinal de um valor numérico.
 * Usado para OFX, onde TRNAMT já tem sinal (negativo = saída).
 *
 * @param {number|string} amount  Valor numérico
 * @returns {string}  'ENTRADA', 'SAIDA' ou 'INDEFINIDO'
 */
export function directionFromSign(amount) {
  if (amount == null) return 'INDEFINIDO';

  const num = Number(amount);
  if (isNaN(num)) return 'INDEFINIDO';

  if (num > 0) return 'ENTRADA';
  if (num < 0) return 'SAIDA';
  return 'INDEFINIDO';
}