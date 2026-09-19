import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import * as XLSX from '../js/vendor/xlsx.mjs';
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
    expect(output.rows[0]['Origem Vínculo']).toBe('Manual');
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

  it('inclui sobras do Arquivo B como linhas extras', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b0 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const b1 = makeRecord('B1', 'B', '200.00', '2026-09-16', 'SOBRA');
    const results = [makeResult(a, b0)];
    const output = exportToExcel(results, { unmatchedB: results, recordsB: [b0, b1] });
    expect(output.rows).toHaveLength(2);
    const sobra = output.rows[1];
    expect(sobra['Status']).toBe('NÃO ENCONTRADO (SOBRA EM B)');
    expect(sobra['Linha A']).toBe('');
    expect(sobra['Descrição B']).toBe('SOBRA');
  });

  it('não inclui sobra quando todos os B estão vinculados', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b0 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const results = [makeResult(a, b0)];
    const output = exportToExcel(results, { unmatchedB: results, recordsB: [b0] });
    expect(output.rows).toHaveLength(1);
  });

  it('sobra reflete vínculo manual: B antigo vira sobra, B novo é ocupado', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b0 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const b1 = makeRecord('B1', 'B', '100.00', '2026-09-15', 'Y');
    const rv = new ReviewableResult(makeResult(a, b0));
    rv.current_b_id = 'B1'; // simula correção manual: A0 agora aponta para B1
    const output = exportToExcel([rv], { unmatchedB: [rv], recordsB: [b0, b1] });
    // Esperado: 1 linha do A + 1 linha de sobra (B0, que foi liberado)
    expect(output.rows).toHaveLength(2);
    const sobra = output.rows[1];
    expect(sobra['Status']).toBe('NÃO ENCONTRADO (SOBRA EM B)');
    expect(sobra['Descrição B']).toBe('X'); // B0 tem desc "X"
  });

  it('quando todos os B estão ocupados, não há linha de sobra', () => {
    const a1 = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X1');
    const a2 = makeRecord('A1', 'A', '100.00', '2026-09-15', 'X2');
    const b0 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'B0');
    const b1 = makeRecord('B1', 'B', '100.00', '2026-09-15', 'B1');
    const rv1 = new ReviewableResult(makeResult(a1, b0));
    const rv2 = new ReviewableResult(makeResult(a2, b1));
    const output = exportToExcel([rv1, rv2], { unmatchedB: [rv1, rv2], recordsB: [b0, b1] });
    expect(output.rows).toHaveLength(2); // apenas as 2 linhas de A
  });
    it('cria aba Detalhe_dos_Lotes quando há lotes', () => {
    const a = makeRecord('A0', 'A', '3000.00', '2026-09-15', 'PAGTO LOTE');
    const b1 = makeRecord('B0', 'B', '1000.00', '2026-09-15', 'ITEM 1');
    const b2 = makeRecord('B1', 'B', '2000.00', '2026-09-15', 'ITEM 2');
    const results = [makeResult(a, null, [b1, b2])];
    const output = exportToExcel(results);
    expect(output.workbook.SheetNames).toContain('Detalhe_dos_Lotes');
    expect(output.batchDetailRows).toHaveLength(2);
    expect(output.batchDetailRows[0]['id_lote']).toBe('LOTE-A1');
    expect(output.batchDetailRows[0]['linha_a']).toBe(1);
    expect(output.batchDetailRows[0]['linha_b']).toBe(1);
    expect(output.batchDetailRows[0]['descricao_b']).toBe('ITEM 1');
    expect(output.batchDetailRows[1]['linha_b']).toBe(2);
    expect(output.batchDetailRows[1]['descricao_b']).toBe('ITEM 2');
  });

  it('não cria aba Detalhe_dos_Lotes quando não há lotes', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const results = [makeResult(a, b)];
    const output = exportToExcel(results);
    expect(output.workbook.SheetNames).not.toContain('Detalhe_dos_Lotes');
    expect(output.batchDetailRows).toEqual([]);
  });
    it('origem e decisão em português por padrão', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const output = exportToExcel([makeResult(a, b)]);
    expect(output.rows[0]['Origem Vínculo']).toBe('Automático');
    expect(output.rows[0]['Decisão Humana']).toBe('Pendente');
  });

  it('valor_a aparece apenas na primeira linha de cada lote', () => {
    const a = makeRecord('A0', 'A', '3000.00', '2026-09-15', 'PAGTO LOTE');
    const b1 = makeRecord('B0', 'B', '1000.00', '2026-09-15', 'ITEM 1');
    const b2 = makeRecord('B1', 'B', '2000.00', '2026-09-15', 'ITEM 2');
    const output = exportToExcel([makeResult(a, null, [b1, b2])]);
    expect(output.batchDetailRows).toHaveLength(2);
    expect(output.batchDetailRows[0]['valor_a']).toBe('3.000,00');
    expect(output.batchDetailRows[1]['valor_a']).toBe('');
  });

  it('valores viram células numéricas com formato de moeda (negativo vermelho)', () => {
    const a = makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO');
    const b = makeRecord('B0', 'B', '1500.00', '2026-09-15', 'PAGTO');
    const output = exportToExcel([makeResult(a, b)]);
    const ws = output.workbook.Sheets['Conciliação'];
    const headers = Object.keys(output.rows[0]);
    const addr = XLSX.utils.encode_cell({ r: 1, c: headers.indexOf('Valor A') });
    expect(ws[addr].t).toBe('n');
    expect(ws[addr].v).toBe(1500);
    expect(ws[addr].z).toContain('[Red]');
  });

  it('datas viram células de data filtráveis (serial + dd/mm/yyyy)', () => {
    const a = makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO');
    const b = makeRecord('B0', 'B', '1500.00', '2026-09-15', 'PAGTO');
    const output = exportToExcel([makeResult(a, b)]);
    const ws = output.workbook.Sheets['Conciliação'];
    const headers = Object.keys(output.rows[0]);
    const addr = XLSX.utils.encode_cell({ r: 1, c: headers.indexOf('Data A') });
    expect(ws[addr].t).toBe('n');
    expect(ws[addr].z).toBe('dd/mm/yyyy');
    expect(ws[addr].v).toBe(46280); // serial Excel de 15/09/2026
  });
});