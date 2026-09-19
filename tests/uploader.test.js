import { describe, it, expect } from 'vitest';
import { detectFileType, readFile } from '../js/uploader.js';

describe('detectFileType', () => {
  it('detecta CSV', () => {
    expect(detectFileType('extrato.csv')).toBe('csv');
    expect(detectFileType('extrato.CSV')).toBe('csv');
  });

  it('detecta XLSX', () => {
    expect(detectFileType('extrato.xlsx')).toBe('xlsx');
    expect(detectFileType('extrato.XLSX')).toBe('xlsx');
  });

  it('detecta XLS', () => {
    expect(detectFileType('extrato.xls')).toBe('xlsx');
    expect(detectFileType('extrato.XLS')).toBe('xlsx');
  });

  it('detecta OFX', () => {
    expect(detectFileType('extrato.ofx')).toBe('ofx');
    expect(detectFileType('extrato.OFX')).toBe('ofx');
  });

  it('retorna unknown para extensões não suportadas', () => {
    expect(detectFileType('documento.pdf')).toBe('unknown');
    expect(detectFileType('imagem.png')).toBe('unknown');
  });

  it('retorna unknown para entrada inválida', () => {
    expect(detectFileType(null)).toBe('unknown');
    expect(detectFileType('')).toBe('unknown');
    expect(detectFileType(123)).toBe('unknown');
  });
});

describe('readFile', () => {
  it('lança erro para arquivo não-File', async () => {
    await expect(readFile(null)).rejects.toThrow(TypeError);
    await expect(readFile('não é um File')).rejects.toThrow(TypeError);
  });

  it('lança erro para tipo desconhecido', async () => {
    const mockFile = new File(['conteúdo'], 'documento.pdf', { type: 'application/pdf' });
    await expect(readFile(mockFile)).rejects.toThrow(/não suportado/);
  });

  it('lê CSV e retorna rows e columns', async () => {
    const csvContent = 'Data,Valor\n15/09/2026,1500.00';
    const mockFile = new File([csvContent], 'extrato.csv', { type: 'text/csv' });

    const result = await readFile(mockFile);

    expect(result.type).toBe('csv');
    expect(result.rows).toHaveLength(1);
    expect(result.columns).toEqual(['Data', 'Valor']);
    expect(result.rows[0].Data).toBe('15/09/2026');
  });

  it('lê OFX e retorna transações', async () => {
    const ofxContent = `<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260915
<TRNAMT>-1500.00
<FITID>001
<NAME>PAGTO
</STMTTRN>
</OFX>`;
    const mockFile = new File([ofxContent], 'extrato.ofx', { type: 'text/plain' });

    const result = await readFile(mockFile);

    expect(result.type).toBe('ofx');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].TRNTYPE).toBe('DEBIT');
    expect(result.columns).toContain('TRNTYPE');
  });

  it('lê Excel e retorna rows', async () => {
    // Cria um Excel mínimo em memória
    const XLSX = await import('../js/vendor/xlsx.mjs');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Data', 'Valor'],
      ['15/09/2026', '1500.00'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const mockFile = new File([blob], 'extrato.xlsx', { type: blob.type });

    const result = await readFile(mockFile);

    expect(result.type).toBe('xlsx');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Data).toBe('15/09/2026');
    expect(result.columns).toContain('Data');
  });

  it('retorna array vazio para arquivo vazio', async () => {
    const mockFile = new File([''], 'vazio.csv', { type: 'text/csv' });
    const result = await readFile(mockFile);

    expect(result.rows).toEqual([]);
    expect(result.columns).toEqual([]);
  });
  it('detecta cabeçalho após linhas de título', async () => {
    const csvContent = 'Banco XYZ\nPeríodo: Setembro/2026\nData,Valor\n15/09/2026,1500.00';
    const mockFile = new File([csvContent], 'extrato.csv', { type: 'text/csv' });

    const result = await readFile(mockFile);

    expect(result.headerRowIndex).toBe(2);
    expect(result.columns).toEqual(['Data', 'Valor']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Data).toBe('15/09/2026');
  });
    it('detecta colunas em CSV separado por ponto-e-vírgula (caso real)', async () => {
    const csvContent =
      'Data;Descricao;Valor\n15/09/2026;PAGTO FORNECEDOR;1500,00\n16/09/2026;RECEBIMENTO;2000,00';
    const mockFile = new File([csvContent], 'extrato.csv', { type: 'text/csv' });
    const result = await readFile(mockFile);
    expect(result.columns).toEqual(['Data', 'Descricao', 'Valor']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Valor).toBe('1500,00');
  });
});