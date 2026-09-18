import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { reconcile } from '../js/engine.js';

const makeRecord = (id, source, value, date, desc) => ({
  id,
  source,
  value: new Decimal(value),
  date: new Date(date),
  description_original: desc,
  description_normalized: desc.toLowerCase(),
  direction: 'SAIDA',
  original_row: parseInt(id.replace(source, '')) + 1,
  alerts: [],
});

describe('reconcile', () => {
  it('conciliação básica 1:1 com match perfeito', () => {
    const a = [
      makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO FORNECEDOR'),
      makeRecord('A1', 'A', '2000.00', '2026-09-16', 'OUTRO PAGTO'),
    ];
    const b = [
      makeRecord('B0', 'B', '1500.00', '2026-09-15', 'PAGTO FORNECEDOR'),
      makeRecord('B1', 'B', '2000.00', '2026-09-16', 'OUTRO PAGTO'),
    ];
    const results = reconcile(a, b);

    expect(results).toHaveLength(2);
    const conc = results.filter((r) => r.status === 'CONCILIADO');
    expect(conc).toHaveLength(2);
  });

  it('registros sem par viram NÃO ENCONTRADO', () => {
    const a = [
      makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO'),
      makeRecord('A1', 'A', '999.00', '2026-09-20', 'SEM PAR'),
    ];
    const b = [makeRecord('B0', 'B', '1500.00', '2026-09-15', 'PAGTO')];
    const results = reconcile(a, b);

    expect(results).toHaveLength(2);
    const nf = results.filter((r) => r.status === 'NÃO ENCONTRADO');
    expect(nf).toHaveLength(1);
    expect(nf[0].a.id).toBe('A1');
  });

  it('detecta lote 1:N quando A não tem match 1:1', () => {
    const a = [makeRecord('A0', 'A', '3000.00', '2026-09-15', 'PAGTO LOTE')];
    const b = [
      makeRecord('B0', 'B', '1000.00', '2026-09-15', 'ITEM 1'),
      makeRecord('B1', 'B', '1500.00', '2026-09-15', 'ITEM 2'),
      makeRecord('B2', 'B', '500.00', '2026-09-15', 'ITEM 3'),
    ];
    const results = reconcile(a, b);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('CONCILIADO');
    expect(results[0].batch_items).toHaveLength(3);
    expect(results[0].b).toBeNull();
  });

  it('classifica como POSSÍVEL em caso de ambiguidade', () => {
    const a = [makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO')];
    const b = [
      makeRecord('B0', 'B', '1500.00', '2026-09-15', 'PAGTO FORNECEDOR A'),
      makeRecord('B1', 'B', '1500.00', '2026-09-15', 'PAGTO FORNECEDOR B'),
    ];
    const results = reconcile(a, b, { ambiguityThreshold: 5 });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('POSSÍVEL CORRESPONDÊNCIA');
  });

  it('não reutiliza B já matcheado em 1:1', () => {
    const a = [
      makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO 1'),
      makeRecord('A1', 'A', '1500.00', '2026-09-16', 'PAGTO 2'),
    ];
    const b = [
      makeRecord('B0', 'B', '1500.00', '2026-09-15', 'PAGTO 1'),
      makeRecord('B1', 'B', '1500.00', '2026-09-16', 'PAGTO 2'),
    ];
    const results = reconcile(a, b);

    const bIds = results
      .filter((r) => r.b)
      .map((r) => r.b.id);
    expect(new Set(bIds).size).toBe(bIds.length);
  });

  it('não reutiliza B já em lote', () => {
    const a = [
      makeRecord('A0', 'A', '2000.00', '2026-09-15', 'LOTE 1'),
      makeRecord('A1', 'A', '1000.00', '2026-09-15', 'LOTE 2'),
    ];
    const b = [
      makeRecord('B0', 'B', '1000.00', '2026-09-15', 'ITEM 1'),
      makeRecord('B1', 'B', '1000.00', '2026-09-15', 'ITEM 2'),
      makeRecord('B2', 'B', '500.00', '2026-09-15', 'ITEM 3'),
      makeRecord('B3', 'B', '500.00', '2026-09-15', 'ITEM 4'),
    ];
    const results = reconcile(a, b);

    const allBIds = [];
    for (const r of results) {
      if (r.b) allBIds.push(r.b.id);
      if (r.batch_items) r.batch_items.forEach((bi) => allBIds.push(bi.id));
    }
    expect(new Set(allBIds).size).toBe(allBIds.length);
  });

  it('retorna array vazio para entradas inválidas', () => {
    expect(reconcile(null, [])).toEqual([]);
    expect(reconcile([], null)).toEqual([]);
  });

  it('preserva human_decision como PENDING por padrão', () => {
    const a = [makeRecord('A0', 'A', '100.00', '2026-09-15', 'X')];
    const b = [makeRecord('B0', 'B', '100.00', '2026-09-15', 'X')];
    const results = reconcile(a, b);
    expect(results[0].human_decision).toBe('PENDING');
  });

  it('ordena resultados: matcheados primeiro por score desc', () => {
    const a = [
      makeRecord('A0', 'A', '100.00', '2026-09-15', 'SEM PAR'),
      makeRecord('A1', 'A', '200.00', '2026-09-15', 'MATCH ALTO'),
      makeRecord('A2', 'A', '300.00', '2026-09-15', 'MATCH BAIXO'),
    ];
    const b = [
      makeRecord('B1', 'B', '200.00', '2026-09-15', 'MATCH ALTO'),
      makeRecord('B2', 'B', '300.00', '2026-09-15', 'MATCH DIFERENTE'),
    ];
    const results = reconcile(a, b);

    // Primeiro devem vir os matcheados, por último NÃO ENCONTRADO
    const statuses = results.map((r) => r.status);
    const nfIdx = statuses.indexOf('NÃO ENCONTRADO');
    expect(nfIdx).toBe(statuses.length - 1);
  });
});