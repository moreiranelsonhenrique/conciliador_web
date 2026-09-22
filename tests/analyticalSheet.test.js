import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  buildBankRows,
  buildFinancialRows,
  LEGENDA_CONFIANCA,
} from '../js/analyticalSheet.js';
import { ReviewableResult } from '../js/review.js';

const makeRecord = (id, source, value, date, desc, direction = 'SAIDA') => ({
  id,
  source,
  value: value == null ? null : new Decimal(value),
  date: date ? new Date(date) : null,
  description_original: desc,
  direction,
  original_row: parseInt(id.slice(1), 10) + 1,
  alerts: [],
});

const makeResult = (a, b = null, batch = null, status = 'CONCILIADO') => ({
  a,
  b,
  batch_items: batch,
  status,
  justification: 'just',
  alerts: [],
  score_details: b
    ? { total: 85, value: 50, date: 20, text: 15 }
    : batch
      ? null
      : null,
  human_decision: 'PENDING',
});

describe('buildBankRows', () => {
  it('1:1 confirmado com diferença zero → CONCILIADO + chave textual + confiança', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'PAGTO FORNECEDOR');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'PAGTO FORNECEDOR');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.confirm();
    const rows = buildBankRows([rv], [], {}, '0.01');
    expect(rows).toHaveLength(1);
    expect(rows[0].STATUS).toBe('CONCILIADO');
    expect(rows[0].CHAVE_CONCILIACAO).toBe('DOC_CONTIDO_NO_HISTORICO');
    expect(rows[0].CONFIANCA_PCT).toBe('85');
    expect(rows[0].REF_LINHA_MATCH).toBe('1');
  });

  it('1:1 confirmado com diferença dentro da tolerância → CONCILIADO_DIFERENCA + DIF_CENTAVOS_DOC_FUZZY', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'PAGTO');
    const b = makeRecord('B0', 'B', '100.01', '2026-09-15', 'PAGTO');
    const rv = new ReviewableResult(makeResult(a, b, null, 'DIVERGÊNCIA'));
    rv.confirm();
    const rows = buildBankRows([rv], [], {}, '0.01');
    expect(rows[0].STATUS).toBe('CONCILIADO_DIFERENCA');
    expect(rows[0].CHAVE_CONCILIACAO).toBe('DIF_CENTAVOS_DOC_FUZZY');
  });

  it('sem vínculo → PENDENTE_EXTRATO, chave e confiança em branco', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const rows = buildBankRows([rv], [], {}, '0.01');
    expect(rows[0].STATUS).toBe('PENDENTE_EXTRATO');
    expect(rows[0].CHAVE_CONCILIACAO).toBe('');
    expect(rows[0].CONFIANCA_PCT).toBe('');
    expect(rows[0].REF_LINHA_MATCH).toBe('');
  });

  it('vínculo manual → chave MANUAL', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.match_origin = 'MANUAL';
    rv.confirm();
    const rows = buildBankRows([rv], [], {}, '0.01');
    expect(rows[0].CHAVE_CONCILIACAO).toBe('MANUAL');
  });

  it('lote confirmado → chave SUMARIZACAO_LOTE_SEQUENCIAL e confiança em branco (D6)', () => {
    const a = makeRecord('A0', 'A', '300.00', '2026-09-15', 'LOTE');
    const b1 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'ITEM 1');
    const b2 = makeRecord('B1', 'B', '200.00', '2026-09-15', 'ITEM 2');
    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    rv.confirm();
    const rows = buildBankRows([rv], [], {}, '0.01');
    expect(rows[0].STATUS).toBe('CONCILIADO');
    expect(rows[0].CHAVE_CONCILIACAO).toBe('SUMARIZACAO_LOTE_SEQUENCIAL');
    expect(rows[0].CONFIANCA_PCT).toBe('');
    expect(rows[0].REF_LINHA_MATCH).toBe('1, 2');
  });

  it('lê saldo da coluna mapeada quando houver papel balance', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.confirm();
    const fileARows = [{ Saldo: '1.234,56' }];
    const mappingA = { balance: 'Saldo' };
    const rows = buildBankRows([rv], fileARows, mappingA, '0.01');
    expect(rows[0].Saldo).toBe('1.234,56');
  });

  it('sem coluna de saldo mapeada, campo Saldo fica vazio', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.confirm();
    const rows = buildBankRows([rv], [], {}, '0.01');
    expect(rows[0].Saldo).toBe('');
  });

  it('lista vazia produz array vazio', () => {
    expect(buildBankRows([], [], {}, '0.01')).toEqual([]);
  });
});

describe('buildFinancialRows', () => {
  it('B vinculado a A confirmado → CONCILIADO + ref da linha A', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.confirm();
    const rows = buildFinancialRows([rv], [b], [], {}, '0.01');
    expect(rows).toHaveLength(1);
    expect(rows[0].STATUS).toBe('CONCILIADO');
    expect(rows[0].REF_LINHA_MATCH).toBe('1');
  });

  it('B sem vínculo (sobra) → PENDENTE_RAZAO', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const bVinc = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const bSobra = makeRecord('B1', 'B', '200.00', '2026-09-15', 'SOBRA');
    const rv = new ReviewableResult(makeResult(a, bVinc));
    rv.confirm();
    const rows = buildFinancialRows([rv], [bVinc, bSobra], [], {}, '0.01');
    expect(rows).toHaveLength(2);
    const sobra = rows.find((r) => r.Linha === 2);
    expect(sobra.STATUS).toBe('PENDENTE_RAZAO');
    expect(sobra.CHAVE_CONCILIACAO).toBe('');
    expect(sobra.CONFIANCA_PCT).toBe('');
    expect(sobra.REF_LINHA_MATCH).toBe('');
  });

  it('B dentro de lote confirmado → ref da linha A, confiança em branco (D6)', () => {
    const a = makeRecord('A0', 'A', '300.00', '2026-09-15', 'LOTE');
    const b1 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'I1');
    const b2 = makeRecord('B1', 'B', '200.00', '2026-09-15', 'I2');
    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    rv.confirm();
    const rows = buildFinancialRows([rv], [b1, b2], [], {}, '0.01');
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.STATUS).toBe('CONCILIADO');
      expect(r.CONFIANCA_PCT).toBe('');
      expect(r.REF_LINHA_MATCH).toBe('1');
      expect(r.CHAVE_CONCILIACAO).toBe('SUMARIZACAO_LOTE_SEQUENCIAL');
    }
  });

  it('B vinculado mas não confirmado → PENDENTE_RAZAO', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b)); // PENDING
    const rows = buildFinancialRows([rv], [b], [], {}, '0.01');
    expect(rows[0].STATUS).toBe('PENDENTE_RAZAO');
  });

  it('lê saldo de B quando há papel balance mapeado', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.confirm();
    const fileBRows = [{ Saldo: '9.876,54' }];
    const mappingB = { balance: 'Saldo' };
    const rows = buildFinancialRows([rv], [b], fileBRows, mappingB, '0.01');
    expect(rows[0].Saldo).toBe('9.876,54');
  });

  it('array vazio de B produz array vazio', () => {
    expect(buildFinancialRows([], [], [], {}, '0.01')).toEqual([]);
  });
});

describe('LEGENDA_CONFIANCA', () => {
  it('explica regra D6 (lote sem score)', () => {
    expect(LEGENDA_CONFIANCA).toContain('lotes não possuem score');
    expect(LEGENDA_CONFIANCA).toContain('1:1');
  });
});