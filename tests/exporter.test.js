import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { exportToExcel } from '../js/exporter.js';
import { ReviewableResult } from '../js/review.js';

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
  justification: 'Test justification',
  alerts: ['Alerta de teste'],
  score_total: 100,
  score_details: { total: 100 },
  human_decision: 'PENDING',
});

describe('exportToExcel', () => {
  it('exporta resultado simples 1:1', () => {
    const a = makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO FORNECEDOR');
    const b = makeRecord('B0', 'B', '1500.00', '2026-09-15', 'PAGTO FORNECEDOR');
    const results = [makeResult(a, b)];

    const output = exportToExcel(results);

    expect(output.fileName).toBe('conciliacao_resultado.xlsx');
    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]['Linha A']).toBe(1);
    expect(output.rows[0]['Data A']).toBe('15/09/2026');
    expect(output.rows[0]['Descrição A']).toBe('PAGTO FORNECEDOR');
    expect(output.rows[0]['Valor A']).toBe('1.500,00');
    expect(output.rows[0]['Linha B']).toBe(1);
    expect(output.rows[0]['Status']).toBe('CONCILIADO');
    expect(output.rows[0]['Alertas']).toBe('Alerta de teste');
  });

  it('exporta lote com múltiplos itens', () => {
    const a = makeRecord('A0', 'A', '3000.00', '2026-09-15', 'PAGTO LOTE');
    const b1 = makeRecord('B0', 'B', '1000.00', '2026-09-15', 'ITEM 1');
    const b2 = makeRecord('B1', 'B', '2000.00', '2026-09-15', 'ITEM 2');
    const results = [makeResult(a, null, [b1, b2])];

    const output = exportToExcel(results);

    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]['Linha B']).toBe('LOTE (2 itens)');
    expect(output.rows[0]['Valor B']).toBe('3.000,00');
    expect(output.rows[0]['Descrição B']).toContain('ITEM 1');
    expect(output.rows[0]['Descrição B']).toContain('ITEM 2');
  });

  it('exporta resultado NÃO ENCONTRADO', () => {
    const a = makeRecord('A0', 'A', '999.00', '2026-09-15', 'SEM PAR');
    const results = [makeResult(a, null, null, 'NÃO ENCONTRADO')];

    const output = exportToExcel(results);

    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]['Status']).toBe('NÃO ENCONTRADO');
    expect(output.rows[0]['Linha B']).toBe('');
  });

  it('aceita ReviewableResult e preserva origem do vínculo', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.match_origin = 'MANUAL';

    const output = exportToExcel([rv]);

    expect(output.rows).toHaveLength(1);
    expect(output.rows[0]['Origem Vínculo']).toBe('MANUAL');
  });

  it('usa fileName e sheetName customizados', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const results = [makeResult(a, b)];

    const output = exportToExcel(results, {
      fileName: 'meu_arquivo',
      sheetName: 'Resultados',
    });

    expect(output.fileName).toBe('meu_arquivo.xlsx');
    expect(output.workbook.SheetNames).toContain('Resultados');
  });

  it('lança erro para entrada não-array', () => {
    expect(() => exportToExcel(null)).toThrow(TypeError);
    expect(() => exportToExcel('não array')).toThrow(TypeError);
  });

  it('exporta array vazio sem erro', () => {
    const output = exportToExcel([]);
    expect(output.rows).toEqual([]);
  });
});