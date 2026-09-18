import { describe, it, expect } from 'vitest';
import { parseCSVString } from '../js/reader.js';

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
    // Replica a estrutura do sample de validação v1_banco.csv
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