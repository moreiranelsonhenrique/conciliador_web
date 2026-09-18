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
});

describe('classifyBatchMatch', () => {
  it('classifica lote como CONCILIADO quando itens encontrados', () => {
    const batchMatch = { a_id: 'A0', b_ids: ['B0', 'B1', 'B2'] };
    const recordA = { id: 'A0', value: new Decimal('3000') };
    const recordsB = [
      { id: 'B0', value: new Decimal('1000') },
      { id: 'B1', value: new Decimal('1000') },
      { id: 'B2', value: new Decimal('1000') },
    ];
    const result = classifyBatchMatch(batchMatch, recordA, recordsB);
    expect(result.status).toBe('CONCILIADO');
    expect(result.justification).toContain('3 itens');
    expect(result.batch_items).toHaveLength(3);
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