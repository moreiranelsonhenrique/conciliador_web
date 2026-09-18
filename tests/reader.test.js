import { describe, it, expect } from 'vitest';
import * as XLSX from '../js/vendor/xlsx.mjs';
import { parseCSVString, parseExcel } from '../js/reader.js';

describe('parseCSVString', () => {
  it('lê CSV simples com cabeçalho', () => {
    const csv = `data,descricao,valor\n2026-09-15,PAGTO FORNECEDOR,1500.00\n2026-09-16,RECEBIMENTO PIX,2000.50`;
    const rows = parseCSVString(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      data: '2026-09-15',
      descricao: 'PAGTO FORNECEDOR',
      valor: '1500.00',
    });
    expect(rows[1].valor).toBe('2000.50');
  });

  it('ignora linhas vazias', () => {
    const csv = `data,valor\n2026-09-15,100\n\n2026-09-16,200\n`;
    const rows = parseCSVString(csv);
    expect(rows).toHaveLength(2);
  });

  it('remove espaços do cabeçalho', () => {
    const csv = ` data , valor \n2026-09-15,100`;
    const rows = parseCSVString(csv);
    expect(rows[0]).toHaveProperty('data');
    expect(rows[0]).toHaveProperty('valor');
  });

  it('mantém valores numéricos como string (sem dynamicTyping)', () => {
    const csv = `valor\n1500.00\n0.50`;
    const rows = parseCSVString(csv);
    expect(typeof rows[0].valor).toBe('string');
    expect(rows[0].valor).toBe('1500.00');
  });

  it('respeita aspas em valores com vírgula', () => {
    const csv = `descricao,valor\n"PAGTO FORNECEDOR, SILVA",1500.00`;
    const rows = parseCSVString(csv);
    expect(rows[0].descricao).toBe('PAGTO FORNECEDOR, SILVA');
    expect(rows[0].valor).toBe('1500.00');
  });

  it('lê arquivo v1_banco.csv (estrutura esperada)', () => {
    const csv = `Data,Descricao,Valor,D/C
15/09/2026,RECEBIMENTO PIX,4500.50,C
15/09/2026,TARIFA BANCARIA,15.90,D
15/09/2026,PAGTO FORNECEDOR A,1570.00,D`;
    const rows = parseCSVString(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].Data).toBe('15/09/2026');
    expect(rows[0].Descricao).toBe('RECEBIMENTO PIX');
    expect(rows[0].Valor).toBe('4500.50');
    expect(rows[0]['D/C']).toBe('C');
  });

  it('aceita delimitador ponto-e-vírgula', () => {
    const csv = `data;valor\n2026-09-15;100`;
    const rows = parseCSVString(csv, { delimiter: ';' });
    expect(rows[0]).toEqual({ data: '2026-09-15', valor: '100' });
  });

  it('lança erro se o argumento não for string', () => {
    expect(() => parseCSVString(null)).toThrow(TypeError);
    expect(() => parseCSVString(123)).toThrow(TypeError);
  });
});

describe('parseExcel', () => {
  it('lê Excel simples com cabeçalho', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Data', 'Descricao', 'Valor'],
      ['15/09/2026', 'PAGTO FORNECEDOR', '1500.00'],
      ['16/09/2026', 'RECEBIMENTO PIX', '2000.50'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = parseExcel(buffer);
    expect(rows).toHaveLength(2);
    expect(rows[0].Data).toBe('15/09/2026');
    expect(rows[0].Descricao).toBe('PAGTO FORNECEDOR');
    expect(rows[0].Valor).toBe('1500.00');
  });

  it('retorna array vazio se aba existe mas está vazia', () => {
    const ws = XLSX.utils.aoa_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = parseExcel(buffer);
    expect(rows).toEqual([]);
  });

  it('trata células vazias como string vazia', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Data', 'Descricao'],
      ['15/09/2026', null],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = parseExcel(buffer);
    expect(rows[0].Descricao).toBe('');
  });

  it('lança erro se buffer for nulo', () => {
    expect(() => parseExcel(null)).toThrow(TypeError);
  });
});