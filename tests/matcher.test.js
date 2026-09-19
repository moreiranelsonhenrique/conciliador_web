import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { generateCandidates, findMatches1to1, findBatchMatches } from '../js/matcher.js';

const makeRecord = (id, value, date, desc) => ({
  id,
  value: new Decimal(value),
  date: new Date(date),
  description_original: desc,
  direction: 'SAIDA',
});

describe('generateCandidates', () => {
  it('gera candidatos para todos os pares válidos', () => {
    const a = [makeRecord('A0', '100', '2026-09-15', 'PAGTO')];
    const b = [
      makeRecord('B0', '100', '2026-09-15', 'PAGTO'),
      makeRecord('B1', '200', '2026-09-15', 'OUTRO'),
    ];
    const candidates = generateCandidates(a, b);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => c.a_id === 'A0' && c.b_id === 'B0')).toBe(true);
  });

  it('pula registros com valor nulo', () => {
    const a = [{ id: 'A0', value: null, date: new Date(), description_original: '' }];
    const b = [makeRecord('B0', '100', '2026-09-15', 'PAGTO')];
    const candidates = generateCandidates(a, b);
    expect(candidates).toEqual([]);
  });

  it('retorna array vazio para entradas inválidas', () => {
    expect(generateCandidates(null, [])).toEqual([]);
    expect(generateCandidates([], null)).toEqual([]);
  });
});

describe('findMatches1to1', () => {
  it('encontra match perfeito (score 100)', () => {
    const candidates = [
      { a_id: 'A0', b_id: 'B0', score: 100, score_details: { total: 100 } },
    ];
    const matches = findMatches1to1(candidates);
    expect(matches).toHaveLength(1);
    expect(matches[0].a_id).toBe('A0');
    expect(matches[0].b_id).toBe('B0');
    expect(matches[0].status).toBe('CONCILIADO');
  });

  it('ignora candidatos abaixo do minScore', () => {
    const candidates = [
      { a_id: 'A0', b_id: 'B0', score: 30, score_details: { total: 30 } },
    ];
    const matches = findMatches1to1(candidates, { minScore: 50 });
    expect(matches).toEqual([]);
  });

  it('detecta ambiguidade quando 1º e 2º são próximos', () => {
    const candidates = [
      { a_id: 'A0', b_id: 'B0', score: 95, score_details: { total: 95 } },
      { a_id: 'A0', b_id: 'B1', score: 92, score_details: { total: 92 } },
    ];
    const matches = findMatches1to1(candidates, { ambiguityThreshold: 5 });
    expect(matches).toHaveLength(1);
    expect(matches[0].status).toBe('POSSÍVEL CORRESPONDÊNCIA');
    expect(matches[0].justification).toContain('Ambiguidade');
  });

  it('não reutiliza B já matcheado', () => {
    const candidates = [
      { a_id: 'A0', b_id: 'B0', score: 100, score_details: { total: 100 } },
      { a_id: 'A1', b_id: 'B0', score: 90, score_details: { total: 90 } },
      { a_id: 'A1', b_id: 'B1', score: 80, score_details: { total: 80 } },
    ];
    const matches = findMatches1to1(candidates);
    expect(matches).toHaveLength(2);
    expect(matches[0].b_id).toBe('B0');
    expect(matches[1].b_id).toBe('B1');
  });

  it('retorna array vazio para candidatos vazios', () => {
    expect(findMatches1to1([])).toEqual([]);
    expect(findMatches1to1(null)).toEqual([]);
  });
    it('propaga score_details do candidato para o match', () => {
    const candidates = [
      {
        a_id: 'A0',
        b_id: 'B0',
        score: 90,
        score_details: { total: 90, value: 50, date: 20, text: 20 },
      },
    ];
    const matches = findMatches1to1(candidates);
    expect(matches).toHaveLength(1);
    expect(matches[0].score_details).toEqual({
      total: 90,
      value: 50,
      date: 20,
      text: 20,
    });
  });
});

describe('findBatchMatches', () => {
  it('encontra lote 1:N com soma exata', () => {
    const a = [makeRecord('A0', '3000', '2026-09-15', 'PAGTO LOTE')];
    const b = [
      makeRecord('B0', '1000', '2026-09-15', 'ITEM 1'),
      makeRecord('B1', '1500', '2026-09-15', 'ITEM 2'),
      makeRecord('B2', '500', '2026-09-15', 'ITEM 3'),
    ];
    const matches = findBatchMatches(a, b);
    expect(matches).toHaveLength(1);
    expect(matches[0].a_id).toBe('A0');
    expect(matches[0].b_ids).toHaveLength(3);
    expect(matches[0].b_ids).toContain('B0');
    expect(matches[0].b_ids).toContain('B1');
    expect(matches[0].b_ids).toContain('B2');
  });

  it('respeita tolerância de valor', () => {
    const a = [makeRecord('A0', '3000', '2026-09-15', 'PAGTO LOTE')];
    const b = [
      makeRecord('B0', '1000', '2026-09-15', 'ITEM 1'),
      makeRecord('B1', '1500', '2026-09-15', 'ITEM 2'),
      makeRecord('B2', '499.99', '2026-09-15', 'ITEM 3'), // diferença de 0.01
    ];
    const matches = findBatchMatches(a, b, { valueTolerance: '0.01' });
    expect(matches).toHaveLength(1);
  });

  it('respeita maxBatchSize', () => {
    const a = [makeRecord('A0', '5000', '2026-09-15', 'PAGTO LOTE')];
    const b = [
      makeRecord('B0', '1000', '2026-09-15', 'ITEM 1'),
      makeRecord('B1', '1000', '2026-09-15', 'ITEM 2'),
      makeRecord('B2', '1000', '2026-09-15', 'ITEM 3'),
      makeRecord('B3', '1000', '2026-09-15', 'ITEM 4'),
      makeRecord('B4', '1000', '2026-09-15', 'ITEM 5'),
    ];
    const matches = findBatchMatches(a, b, { maxBatchSize: 3 });
    // Não encontra porque precisa de 5 itens mas max é 3
    expect(matches).toEqual([]);
  });

  it('não reutiliza B já em lote', () => {
    const a = [
      makeRecord('A0', '2000', '2026-09-15', 'LOTE 1'),
      makeRecord('A1', '1500', '2026-09-15', 'LOTE 2'),
    ];
    const b = [
      makeRecord('B0', '1000', '2026-09-15', 'ITEM 1'),
      makeRecord('B1', '1000', '2026-09-15', 'ITEM 2'),
      makeRecord('B2', '750', '2026-09-15', 'ITEM 3'),
      makeRecord('B3', '750', '2026-09-15', 'ITEM 4'),
    ];
    const matches = findBatchMatches(a, b);
    expect(matches).toHaveLength(2);
    // Verifica que não há B repetido
    const allBIds = matches.flatMap((m) => m.b_ids);
    expect(new Set(allBIds).size).toBe(allBIds.length);
  });

  it('retorna array vazio para entradas inválidas', () => {
    expect(findBatchMatches(null, [])).toEqual([]);
    expect(findBatchMatches([], null)).toEqual([]);
  });
    it('detecta ambiguidade quando duas combinações somam o mesmo valor', () => {
    const a = [makeRecord('A0', '5000', '2026-09-15', 'PAGTO LOTE')];
    const b = [
      makeRecord('B0', '3000', '2026-09-15', 'OPCAO A1'),
      makeRecord('B1', '2000', '2026-09-15', 'OPCAO A2'),
      makeRecord('B2', '3500', '2026-09-15', 'OPCAO B1'),
      makeRecord('B3', '1500', '2026-09-15', 'OPCAO B2'),
    ];
    const matches = findBatchMatches(a, b);
    expect(matches).toHaveLength(1);
    expect(matches[0].ambiguous).toBe(true);
    expect(matches[0].alternative_count).toBe(2);
  });

  it('marca ambiguous=false quando há combinação única', () => {
    const a = [makeRecord('A0', '3000', '2026-09-15', 'PAGTO LOTE')];
    const b = [
      makeRecord('B0', '1000', '2026-09-15', 'ITEM 1'),
      makeRecord('B1', '1500', '2026-09-15', 'ITEM 2'),
      makeRecord('B2', '500', '2026-09-15', 'ITEM 3'),
    ];
    const matches = findBatchMatches(a, b);
    expect(matches).toHaveLength(1);
    expect(matches[0].ambiguous).toBe(false);
    expect(matches[0].alternative_count).toBe(1);
  });
});