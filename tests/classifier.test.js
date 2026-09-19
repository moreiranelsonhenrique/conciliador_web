import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { classifyMatch1to1, classifyBatchMatch, classifyNotFound } from '../js/classifier.js';

describe('classifyMatch1to1', () => {
  it('classifica como CONCILIADO quando score alto e sem ambiguidade', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 95 };
    const candidates = [match];
    const result = classifyMatch1to1(match, candidates);
    expect(result.status).toBe('CONCILIADO');
    expect(result.justification).toContain('95');
  });

  it('classifica como POSSÍVEL quando há ambiguidade', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 90 };
    const candidates = [
      match,
      { a_id: 'A0', b_id: 'B1', score: 88 },
    ];
    const result = classifyMatch1to1(match, candidates, { ambiguityThreshold: 5 });
    expect(result.status).toBe('POSSÍVEL CORRESPONDÊNCIA');
    expect(result.justification).toContain('Ambiguidade');
    expect(result.alerts).toHaveLength(1);
  });

  it('classifica como NÃO ENCONTRADO quando score abaixo do mínimo', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 30 };
    const candidates = [match];
    const result = classifyMatch1to1(match, candidates, { minScore: 50 });
    expect(result.status).toBe('NÃO ENCONTRADO');
    expect(result.justification).toContain('abaixo do mínimo');
  });

  it('classifica como NÃO ENCONTRADO quando match é null', () => {
    const result = classifyMatch1to1(null, []);
    expect(result.status).toBe('NÃO ENCONTRADO');
  });

  it('classifica como CONCILIADO quando diferença é exatamente igual ao threshold', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 90 };
    const candidates = [
      match,
      { a_id: 'A0', b_id: 'B1', score: 85 }, // diferença = 5
    ];
    const result = classifyMatch1to1(match, candidates, { ambiguityThreshold: 5 });
    expect(result.status).toBe('CONCILIADO');
  });

  it('classifica como DIVERGÊNCIA quando data está fora da tolerância', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 80 };
    const a = { id: 'A0', value: new Decimal('1500.00'), date: new Date('2026-09-15'), description_original: 'PAGTO FORNECEDOR' };
    const b = { id: 'B0', value: new Decimal('1500.00'), date: new Date('2026-09-20'), description_original: 'PAGTO FORNECEDOR' };
    const result = classifyMatch1to1(match, [match], { dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('DIVERGÊNCIA');
    expect(result.justification).toContain('Data fora da tolerância');
    expect(result.alerts).toHaveLength(1);
  });

  it('classifica como CONCILIADO quando data está dentro da tolerância', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 100 };
    const a = { id: 'A0', value: new Decimal('1500.00'), date: new Date('2026-09-15'), description_original: 'PAGTO' };
    const b = { id: 'B0', value: new Decimal('1500.00'), date: new Date('2026-09-17'), description_original: 'PAGTO' };
    const result = classifyMatch1to1(match, [match], { dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('CONCILIADO');
  });

  it('classifica como DIVERGÊNCIA quando valor está fora da tolerância', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 70 };
    const a = { id: 'A0', value: new Decimal('1500.00'), date: new Date('2026-09-15'), description_original: 'PAGTO' };
    const b = { id: 'B0', value: new Decimal('1500.50'), date: new Date('2026-09-15'), description_original: 'PAGTO' };
    const result = classifyMatch1to1(match, [match], { valueTolerance: '0.01', dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('DIVERGÊNCIA');
    expect(result.justification).toContain('Valor fora da tolerância');
  });

  it('data ausente não gera divergência de data', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 80 };
    const a = { id: 'A0', value: new Decimal('100.00'), date: null, description_original: 'X' };
    const b = { id: 'B0', value: new Decimal('100.00'), date: new Date('2026-09-25'), description_original: 'X' };
    const result = classifyMatch1to1(match, [match], { dateToleranceDays: 0 }, a, b);
    expect(result.status).toBe('CONCILIADO');
  });

  it('classifica como DIVERGÊNCIA quando data está fora da tolerância', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 80 };
    const a = { id: 'A0', value: new Decimal('1500.00'), date: new Date('2026-09-15'), description_original: 'PAGTO FORNECEDOR' };
    const b = { id: 'B0', value: new Decimal('1500.00'), date: new Date('2026-09-20'), description_original: 'PAGTO FORNECEDOR' };
    const result = classifyMatch1to1(match, [match], { dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('DIVERGÊNCIA');
    expect(result.justification).toContain('Data fora da tolerância');
    expect(result.alerts).toHaveLength(1);
  });

  it('classifica como CONCILIADO quando data está dentro da tolerância', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 100 };
    const a = { id: 'A0', value: new Decimal('1500.00'), date: new Date('2026-09-15'), description_original: 'PAGTO' };
    const b = { id: 'B0', value: new Decimal('1500.00'), date: new Date('2026-09-17'), description_original: 'PAGTO' };
    const result = classifyMatch1to1(match, [match], { dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('CONCILIADO');
  });

  it('classifica como DIVERGÊNCIA quando valor está fora da tolerância', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 70 };
    const a = { id: 'A0', value: new Decimal('1500.00'), date: new Date('2026-09-15'), description_original: 'PAGTO' };
    const b = { id: 'B0', value: new Decimal('1500.50'), date: new Date('2026-09-15'), description_original: 'PAGTO' };
    const result = classifyMatch1to1(match, [match], { valueTolerance: '0.01', dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('DIVERGÊNCIA');
    expect(result.justification).toContain('Valor fora da tolerância');
  });

  it('valor e data fora da tolerância geram dois alertas', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 60 };
    const a = { id: 'A0', value: new Decimal('100.00'), date: new Date('2026-09-10'), description_original: 'X' };
    const b = { id: 'B0', value: new Decimal('120.00'), date: new Date('2026-09-20'), description_original: 'X' };
    const result = classifyMatch1to1(match, [match], { valueTolerance: '0.01', dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('DIVERGÊNCIA');
    expect(result.alerts).toHaveLength(2);
  });

  it('data ausente não gera divergência de data', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 80 };
    const a = { id: 'A0', value: new Decimal('100.00'), date: null, description_original: 'X' };
    const b = { id: 'B0', value: new Decimal('100.00'), date: new Date('2026-09-25'), description_original: 'X' };
    const result = classifyMatch1to1(match, [match], { dateToleranceDays: 0 }, a, b);
    expect(result.status).toBe('CONCILIADO');
  });

  it('ambiguidade tem prioridade sobre divergência', () => {
    const match = { a_id: 'A0', b_id: 'B0', score: 80 };
    const rival = { a_id: 'A0', b_id: 'B1', score: 79 };
    const a = { id: 'A0', value: new Decimal('100.00'), date: new Date('2026-09-15'), description_original: 'X' };
    const b = { id: 'B0', value: new Decimal('100.00'), date: new Date('2026-09-25'), description_original: 'X' };
    const result = classifyMatch1to1(match, [match, rival], { dateToleranceDays: 2 }, a, b);
    expect(result.status).toBe('POSSÍVEL CORRESPONDÊNCIA');
  });
});

describe('classifyBatchMatch', () => {
  it('classifica lote como POSSÍVEL CORRESPONDÊNCIA (revisão humana obrigatória)', () => {
    const batchMatch = { a_id: 'A0', b_ids: ['B0', 'B1', 'B2'] };
    const recordA = { id: 'A0', value: new Decimal('3000') };
    const recordsB = [
      { id: 'B0', value: new Decimal('1000') },
      { id: 'B1', value: new Decimal('1000') },
      { id: 'B2', value: new Decimal('1000') },
    ];
    const result = classifyBatchMatch(batchMatch, recordA, recordsB);
    expect(result.status).toBe('POSSÍVEL CORRESPONDÊNCIA');
    expect(result.justification).toContain('3 itens');
    expect(result.batch_items).toHaveLength(3);
    expect(result.alerts).toContain('Lote detectado: confirmação humana obrigatória');
  });

  it('lote nunca é CONCILIADO automático', () => {
    const batchMatch = { a_id: 'A0', b_ids: ['B0', 'B1'] };
    const recordA = { id: 'A0', value: new Decimal('3000') };
    const recordsB = [
      { id: 'B0', value: new Decimal('1000') },
      { id: 'B1', value: new Decimal('2000') },
    ];
    const result = classifyBatchMatch(batchMatch, recordA, recordsB);
    expect(result.status).not.toBe('CONCILIADO');
    expect(result.status).toBe('POSSÍVEL CORRESPONDÊNCIA');
  });

  it('classifica como NÃO ENCONTRADO quando lote vazio', () => {
    const batchMatch = { a_id: 'A0', b_ids: [] };
    const result = classifyBatchMatch(batchMatch, {}, []);
    expect(result.status).toBe('NÃO ENCONTRADO');
  });

  it('classifica como NÃO ENCONTRADO quando batchMatch é null', () => {
    const result = classifyBatchMatch(null, {}, []);
    expect(result.status).toBe('NÃO ENCONTRADO');
  });

  it('classifica como NÃO ENCONTRADO quando itens não existem', () => {
    const batchMatch = { a_id: 'A0', b_ids: ['B99'] };
    const recordsB = [{ id: 'B0', value: new Decimal('1000') }];
    const result = classifyBatchMatch(batchMatch, {}, recordsB);
    expect(result.status).toBe('NÃO ENCONTRADO');
  });
    it('adiciona alerta de ambiguidade quando lote tem múltiplas combinações', () => {
    const batchMatch = { a_id: 'A0', b_ids: ['B0', 'B1'], ambiguous: true, alternative_count: 2 };
    const recordA = { id: 'A0', value: new Decimal('5000') };
    const recordsB = [
      { id: 'B0', value: new Decimal('3000') },
      { id: 'B1', value: new Decimal('2000') },
    ];
    const result = classifyBatchMatch(batchMatch, recordA, recordsB);
    expect(result.status).toBe('POSSÍVEL CORRESPONDÊNCIA');
    expect(result.alerts.some((a) => a.includes('Ambiguidade'))).toBe(true);
  });
});

describe('classifyNotFound', () => {
  it('retorna NÃO ENCONTRADO com justificativa padrão', () => {
    const record = { id: 'A0', alerts: [] };
    const result = classifyNotFound(record);
    expect(result.status).toBe('NÃO ENCONTRADO');
    expect(result.justification).toBe('Sem correspondente encontrado');
  });

  it('preserva alertas do registro original', () => {
    const record = { id: 'A0', alerts: ['Valor inválido', 'Data ausente'] };
    const result = classifyNotFound(record);
    expect(result.alerts).toEqual(['Valor inválido', 'Data ausente']);
  });
});