import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { BRegistry, ReviewableResult, createReviewableResults } from '../js/review.js';

const makeRecord = (id, source, value, date, desc) => ({
  id,
  source,
  value: new Decimal(value),
  date: new Date(date),
  description_original: desc,
  direction: 'SAIDA',
  original_row: parseInt(id.replace(source, '')) + 1,
  alerts: [],
});

const makeResult = (a, b = null, batch = null, status = 'CONCILIADO') => ({
  a,
  b,
  batch_items: batch,
  status,
  justification: 'Test',
  alerts: [],
  score_total: 100,
  score_details: { total: 100 },
  human_decision: 'PENDING',
});

describe('BRegistry', () => {
  it('ocupa e libera registros B', () => {
    const b = [makeRecord('B0', 'B', '100', '2026-09-15', 'X')];
    const reg = new BRegistry(b);

    expect(reg.isAvailable('B0')).toBe(true);
    reg.occupy('B0', 'A0');
    expect(reg.isAvailable('B0')).toBe(false);
    reg.release('B0');
    expect(reg.isAvailable('B0')).toBe(true);
  });

  it('impede ocupar B já ocupado', () => {
    const b = [makeRecord('B0', 'B', '100', '2026-09-15', 'X')];
    const reg = new BRegistry(b);
    reg.occupy('B0', 'A0');
    expect(() => reg.occupy('B0', 'A1')).toThrow(/já está ocupado/);
  });

  it('lista B disponíveis', () => {
    const b = [
      makeRecord('B0', 'B', '100', '2026-09-15', 'X'),
      makeRecord('B1', 'B', '200', '2026-09-15', 'Y'),
    ];
    const reg = new BRegistry(b);
    reg.occupy('B0', 'A0');
    expect(reg.getAvailableIds()).toEqual(['B1']);
  });
});

describe('ReviewableResult', () => {
  it('cria resultado revisável com estado inicial PENDING', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));

    expect(rv.human_decision).toBe('PENDING');
    expect(rv.match_origin).toBe('AUTO');
    expect(rv.current_b_id).toBe('B0');
    expect(rv.is_batch).toBe(false);
    expect(rv.has_link).toBe(true);
  });

  it('confirma vínculo', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.confirm();

    expect(rv.human_decision).toBe('CONFIRMED');
    expect(rv.result.human_decision).toBe('CONFIRMED');
  });

  it('não confirma sem vínculo ativo', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, null));
    expect(() => rv.confirm()).toThrow(/Não há vínculo/);
  });

  it('rejeita vínculo e libera B no registry', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const reg = new BRegistry([b]);
    reg.occupy('B0', 'A0');

    const rv = new ReviewableResult(makeResult(a, b));
    rv.reject(reg);

    expect(rv.human_decision).toBe('REJECTED');
    expect(rv.current_b_id).toBeNull();
    expect(reg.isAvailable('B0')).toBe(true);
  });

  it('corrige vínculo manualmente', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const bOriginal = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const bNovo = makeRecord('B1', 'B', '100', '2026-09-15', 'Y');
    const reg = new BRegistry([bOriginal, bNovo]);
    reg.occupy('B0', 'A0');

    const rv = new ReviewableResult(makeResult(a, bOriginal));
    rv.applyManualMatch('B1', reg);

    expect(rv.current_b_id).toBe('B1');
    expect(rv.original_b_id).toBe('B0');
    expect(rv.match_origin).toBe('MANUAL');
    expect(reg.isAvailable('B0')).toBe(true);
    expect(reg.isAvailable('B1')).toBe(false);
  });

  it('impede correção para B já ocupado', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const bOriginal = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const bOcupado = makeRecord('B1', 'B', '100', '2026-09-15', 'Y');
    const reg = new BRegistry([bOriginal, bOcupado]);
    reg.occupy('B0', 'A0');
    reg.occupy('B1', 'A99');

    const rv = new ReviewableResult(makeResult(a, bOriginal));
    expect(() => rv.applyManualMatch('B1', reg)).toThrow(/já está vinculado/);
  });

  it('não permite correção manual em lote', () => {
    const a = makeRecord('A0', 'A', '300', '2026-09-15', 'X');
    const b1 = makeRecord('B0', 'B', '100', '2026-09-15', 'I1');
    const b2 = makeRecord('B1', 'B', '200', '2026-09-15', 'I2');
    const reg = new BRegistry([b1, b2]);

    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    expect(rv.is_batch).toBe(true);
    expect(() => rv.applyManualMatch('B0', reg)).toThrow(/não é suportada/);
  });

  it('rejeita lote liberando todos os B', () => {
    const a = makeRecord('A0', 'A', '300', '2026-09-15', 'X');
    const b1 = makeRecord('B0', 'B', '100', '2026-09-15', 'I1');
    const b2 = makeRecord('B1', 'B', '200', '2026-09-15', 'I2');
    const reg = new BRegistry([b1, b2]);
    reg.occupy('B0', 'A0');
    reg.occupy('B1', 'A0');

    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    rv.reject(reg);

    expect(reg.isAvailable('B0')).toBe(true);
    expect(reg.isAvailable('B1')).toBe(true);
  });
});

describe('createReviewableResults', () => {
  it('cria reviewables e ocupa B vinculados', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const results = [makeResult(a, b)];
    const recordsB = [b];

    const { reviewables, registry } = createReviewableResults(results, recordsB);

    expect(reviewables).toHaveLength(1);
    expect(registry.isAvailable('B0')).toBe(false);
  });

  it('mantém B livres disponíveis para correção', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b0 = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const b1 = makeRecord('B1', 'B', '100', '2026-09-15', 'Y');
    const results = [makeResult(a, b0)];
    const recordsB = [b0, b1];

    const { registry } = createReviewableResults(results, recordsB);

    expect(registry.isAvailable('B0')).toBe(false);
    expect(registry.isAvailable('B1')).toBe(true);
  });
});