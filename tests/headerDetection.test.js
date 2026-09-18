import { describe, it, expect } from 'vitest';
import { detectHeader } from '../js/headerDetection.js';

describe('detectHeader', () => {
  it('detecta cabeçalho na primeira linha', () => {
    const rows = [
      ['Data', 'Descrição', 'Valor'],
      ['15/09/2026', 'PAGTO FORNECEDOR', '1500.00'],
    ];
    expect(detectHeader(rows)).toBe(0);
  });

  it('detecta cabeçalho após linhas de título', () => {
    const rows = [
      ['Banco do Brasil'],
      ['Extrato de Conta Corrente'],
      ['Data', 'Histórico', 'Valor'],
      ['15/09/2026', 'PAGTO FORNECEDOR', '1500.00'],
    ];
    expect(detectHeader(rows)).toBe(2);
  });

  it('retorna 0 quando não há cabeçalho reconhecível', () => {
    const rows = [
      ['15/09/2026', 'PAGTO FORNECEDOR', '1500.00'],
      ['16/09/2026', 'RECEBIMENTO PIX', '2000.00'],
    ];
    expect(detectHeader(rows)).toBe(0);
  });

  it('detecta cabeçalho em inglês', () => {
    const rows = [
      ['Date', 'Description', 'Amount'],
      ['2026-09-15', 'PAYMENT', '1500.00'],
    ];
    expect(detectHeader(rows)).toBe(0);
  });

  it('detecta cabeçalho com coluna D/C após linha de título', () => {
    const rows = [
      ['BANCO XYZ', 'Período: 01/09 a 15/09'],
      ['Data', 'Histórico', 'Valor', 'D/C'],
      ['15/09/2026', 'PAGTO FORNECEDOR', '1500.00', 'D'],
    ];
    expect(detectHeader(rows)).toBe(1);
  });

  it('retorna 0 para array vazio', () => {
    expect(detectHeader([])).toBe(0);
  });

  it('retorna 0 para argumento não-array', () => {
    expect(detectHeader(null)).toBe(0);
    expect(detectHeader(undefined)).toBe(0);
  });

  it('respeita o limite de maxScanLines', () => {
    const rows = [];
    for (let i = 0; i < 20; i++) {
      rows.push(['linha qualquer ' + i]);
    }
    rows[15] = ['Data', 'Valor'];
    expect(detectHeader(rows, 10)).toBe(0);
    expect(detectHeader(rows, 20)).toBe(15);
  });
});