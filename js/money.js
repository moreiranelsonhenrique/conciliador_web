import Decimal from 'decimal.js';

// Arredondamento HALF_EVEN (banker's rounding), igual ao padrão do Decimal do Python.
Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

/**
 * Formata um valor como moeda brasileira: "R$ 1.234,56".
 * Mantém o sinal para valores negativos.
 * @param {Decimal|string|number} value
 * @returns {string}
 */
export function formatBRL(value) {
  const dec = new Decimal(value);
  const fixed = dec.toFixed(2);
  const isNegative = fixed.startsWith('-');
  const absStr = isNegative ? fixed.slice(1) : fixed;
  const [intPart, decPart] = absStr.split('.');
  const intWithDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const signal = isNegative ? '-' : '';
  return `R$ ${signal}${intWithDots},${decPart}`;
}