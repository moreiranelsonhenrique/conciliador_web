import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { formatBRL } from '../js/money.js';

describe('formatBRL', () => {
  it('formata valor positivo com centavos', () => {
    expect(formatBRL(new Decimal('4500.50'))).toBe('R$ 4.500,50');
  });

  it('formata valor do resumo V1 (total movimentado)', () => {
    expect(formatBRL(new Decimal('6086.40'))).toBe('R$ 6.086,40');
  });

  it('formata zero', () => {
    expect(formatBRL(new Decimal('0'))).toBe('R$ 0,00');
  });

  it('formata valor negativo mantendo o sinal', () => {
    expect(formatBRL(new Decimal('-1500.00'))).toBe('R$ -1.500,00');
  });

  it('formata valor grande com milhares', () => {
    expect(formatBRL(new Decimal('1234567.89'))).toBe('R$ 1.234.567,89');
  });

  it('arredonda HALF_EVEN para baixo quando a casa anterior é par', () => {
    expect(formatBRL(new Decimal('10.005'))).toBe('R$ 10,00');
  });

  it('arredonda HALF_EVEN para cima quando a casa anterior é ímpar', () => {
    expect(formatBRL(new Decimal('10.015'))).toBe('R$ 10,02');
  });
});