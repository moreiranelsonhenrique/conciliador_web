import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseBalanceValue,
  extractReportedBalances,
  computeSideBalance,
  checkSides,
  tyingIdentity,
} from '../js/balanceCheck.js';
import { inferMapping } from '../js/mapper.js';

/** Registro mínimo no formato do records.js (value Decimal|null + direction). */
const rec = (value, direction = 'SAIDA') => ({
  value: value == null ? null : new Decimal(value),
  direction,
});

describe('parseBalanceValue', () => {
  it('aceita formato BR com milhar e decimal (positivo e negativo)', () => {
    expect(parseBalanceValue('1.234,56').toFixed(2)).toBe('1234.56');
    expect(parseBalanceValue('-1.234,56').toFixed(2)).toBe('-1234.56');
  });

  it('aceita formato ponto, número e Decimal', () => {
    expect(parseBalanceValue('1234.56').toFixed(2)).toBe('1234.56');
    expect(parseBalanceValue(1234.56).toFixed(2)).toBe('1234.56');
    expect(parseBalanceValue(new Decimal('99.9')).toFixed(1)).toBe('99.9');
  });

  it('aceita negativo contábil entre parênteses', () => {
    expect(parseBalanceValue('(1.234,56)').toFixed(2)).toBe('-1234.56');
  });

  it('aceita prefixo R$', () => {
    expect(parseBalanceValue('R$ 100,00').toFixed(2)).toBe('100.00');
  });

  it('retorna null para vazio/inválido (nunca zero, nunca lança)', () => {
    expect(parseBalanceValue(null)).toBeNull();
    expect(parseBalanceValue('')).toBeNull();
    expect(parseBalanceValue('abc')).toBeNull();
    expect(parseBalanceValue('R$')).toBeNull();
    expect(parseBalanceValue(NaN)).toBeNull();
  });
});

describe('extractReportedBalances', () => {
  const rows = [
    { Data: '01/09/2026', Saldo: '1.000,00' },
    { Data: '02/09/2026', Saldo: '900,00' },
    { Data: '03/09/2026', Saldo: '1.200,00' },
  ];

  it('primeiro e último saldo válidos, na ordem do arquivo', () => {
    const { first, last } = extractReportedBalances(rows, 'Saldo');
    expect(first.toFixed(2)).toBe('1000.00');
    expect(last.toFixed(2)).toBe('1200.00');
  });

  it('pula células inválidas sem descartar a linha', () => {
    const rows2 = [
      { Saldo: 'N/A' },
      { Saldo: '500,00' },
      { Saldo: '' },
      { Saldo: '700,00' },
    ];
    const { first, last } = extractReportedBalances(rows2, 'Saldo');
    expect(first.toFixed(2)).toBe('500.00');
    expect(last.toFixed(2)).toBe('700.00');
  });

  it('coluna ausente ou sem valores válidos → null (não inventa)', () => {
    expect(extractReportedBalances(rows, 'Inexistente')).toEqual({ first: null, last: null });
    expect(extractReportedBalances([{ Saldo: 'x' }], 'Saldo')).toEqual({ first: null, last: null });
    expect(extractReportedBalances(rows, null)).toEqual({ first: null, last: null });
  });
});

describe('computeSideBalance', () => {
  it('calculado = inicial + entradas − saídas', () => {
    const records = [rec('100.00', 'ENTRADA'), rec('30.00', 'SAIDA')];
    const r = computeSideBalance(records, '1000.00');
    expect(r.entradas.toFixed(2)).toBe('100.00');
    expect(r.saidas.toFixed(2)).toBe('30.00');
    expect(r.computedFinal.toFixed(2)).toBe('1070.00');
  });

  it('precisão decimal (sem float): 0.1 + 0.2', () => {
    const records = [rec('0.10', 'ENTRADA'), rec('0.20', 'ENTRADA')];
    const r = computeSideBalance(records, '0');
    expect(r.computedFinal.toFixed(2)).toBe('0.30');
  });

  it('INDEFINIDO entra pelo próprio sinal e é reportado', () => {
    const records = [rec('50.00', 'INDEFINIDO'), rec('-20.00', 'INDEFINIDO')];
    const r = computeSideBalance(records, '100.00');
    expect(r.indefinidoQtd).toBe(2);
    expect(r.computedFinal.toFixed(2)).toBe('130.00'); // 100 + 50 − 20
  });

  it('valor inválido não entra na soma e é contado (nunca vira zero)', () => {
    const records = [rec(null), rec('10.00', 'ENTRADA')];
    const r = computeSideBalance(records, '100.00');
    expect(r.valorInvalidoQtd).toBe(1);
    expect(r.computedFinal.toFixed(2)).toBe('110.00');
  });

  it('sem saldo inicial válido não há saldo calculado (não inventa)', () => {
    const r = computeSideBalance([rec('10.00', 'ENTRADA')], null);
    expect(r.computedFinal).toBeNull();
    expect(r.entradas.toFixed(2)).toBe('10.00');
  });

  it('saldo inicial inválido também vira null', () => {
    const r = computeSideBalance([], 'abc');
    expect(r.initial).toBeNull();
    expect(r.computedFinal).toBeNull();
  });
});

describe('checkSides', () => {
  const recordsA = [rec('100.00', 'SAIDA')];

  it('informado × calculado dentro da tolerância → ok true', () => {
    const { A } = checkSides({
      recordsA,
      initialA: '1000.00',
      reportedFinalA: '900.00',
      recordsB: [],
      tolerance: '0.01',
    });
    expect(A.computedFinal.toFixed(2)).toBe('900.00');
    expect(A.difference.toFixed(2)).toBe('0.00');
    expect(A.ok).toBe(true);
  });

  it('fora da tolerância → ok false com diferença', () => {
    const { A } = checkSides({
      recordsA,
      initialA: '1000.00',
      reportedFinalA: '899.00',
      recordsB: [],
      tolerance: '0.01',
    });
    expect(A.ok).toBe(false);
    expect(A.difference.toFixed(2)).toBe('-1.00');
  });

  it('sem saldo informado → ok null (não inventa veredito)', () => {
    const { A } = checkSides({
      recordsA,
      initialA: '1000.00',
      reportedFinalA: null,
      recordsB: [],
    });
    expect(A.ok).toBeNull();
    expect(A.difference).toBeNull();
  });

  it('crossDifference = calculado B − calculado A (null se faltar base)', () => {
    const ok = checkSides({
      recordsA: [rec('300.00', 'SAIDA')],
      initialA: '1000.00',
      recordsB: [rec('100.00', 'SAIDA')],
      initialB: '1000.00',
    });
    expect(ok.crossDifference.toFixed(2)).toBe('200.00'); // 900 − 700
    const semBase = checkSides({
      recordsA: [rec('300.00', 'SAIDA')],
      initialA: null,
      recordsB: [],
    });
    expect(semBase.crossDifference).toBeNull();
  });
});

describe('tyingIdentity', () => {
  it('variação não explicada = diagnóstica − explicada', () => {
    expect(tyingIdentity('-119515.37', '-119515.37').toFixed(2)).toBe('0.00');
    expect(tyingIdentity('100.00', '40.00').toFixed(2)).toBe('60.00');
  });

  it('parte ausente → null (não inventa)', () => {
    expect(tyingIdentity(null, '10')).toBeNull();
    expect(tyingIdentity('10', undefined)).toBeNull();
  });
});

describe('inferMapping — papel Saldo (M41)', () => {
  it('infere coluna de saldo em português', () => {
    const m = inferMapping(['Data', 'Histórico', 'Valor', 'Saldo']);
    expect(m.balance).toBe('Saldo');
    expect(m.date).toBe('Data');
    expect(m.value).toBe('Valor');
    expect(m.description).toBe('Histórico');
  });

  it('infere balance em inglês', () => {
    expect(inferMapping(['Date', 'Amount', 'Balance']).balance).toBe('Balance');
  });

  it('sem coluna de saldo → balance null (papel opcional)', () => {
    expect(inferMapping(['Data', 'Valor']).balance).toBeNull();
  });

  it('saldo não rouba coluna de outro papel nem vice-versa', () => {
    const m = inferMapping(['Data', 'Valor', 'Saldo']);
    expect(m.value).toBe('Valor');
    expect(m.balance).toBe('Saldo');
  });
});