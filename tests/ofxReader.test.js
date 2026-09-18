import { describe, it, expect } from 'vitest';
import { parseOFXString } from '../js/ofxReader.js';

const OFX_SAMPLE_XML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260915120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>0
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>033
<ACCTID>12345678901
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260901120000
<DTEND>20260915120000
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260915120000
<TRNAMT>-1570.00
<FITID>20260915001
<NAME>PAGTO FORNECEDOR A
<MEMO>PAGAMENTO EFETUADO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260915120000
<TRNAMT>4500.50
<FITID>20260915002
<NAME>RECEBIMENTO PIX
<MEMO>CREDITO RECEBIDO
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

describe('parseOFXString', () => {
  it('lê OFX com duas transações', () => {
    const transactions = parseOFXString(OFX_SAMPLE_XML);
    expect(transactions).toHaveLength(2);
  });

  it('extrai campos da transação de débito', () => {
    const transactions = parseOFXString(OFX_SAMPLE_XML);
    const debit = transactions[0];
    expect(debit.TRNTYPE).toBe('DEBIT');
    expect(debit.DTPOSTED).toBe('20260915120000');
    expect(debit.DTPOSTED_FORMATTED).toBe('2026-09-15');
    expect(debit.TRNAMT).toBe('-1570.00');
    expect(debit.TRNAMT_NUM).toBe(-1570.00);
    expect(debit.FITID).toBe('20260915001');
    expect(debit.NAME).toBe('PAGTO FORNECEDOR A');
    expect(debit.MEMO).toBe('PAGAMENTO EFETUADO');
    expect(debit.DIRECTION).toBe('D');
  });

  it('extrai campos da transação de crédito', () => {
    const transactions = parseOFXString(OFX_SAMPLE_XML);
    const credit = transactions[1];
    expect(credit.TRNTYPE).toBe('CREDIT');
    expect(credit.DTPOSTED).toBe('20260915120000');
    expect(credit.DTPOSTED_FORMATTED).toBe('2026-09-15');
    expect(credit.TRNAMT).toBe('4500.50');
    expect(credit.TRNAMT_NUM).toBe(4500.50);
    expect(credit.FITID).toBe('20260915002');
    expect(credit.NAME).toBe('RECEBIMENTO PIX');
    expect(credit.MEMO).toBe('CREDITO RECEBIDO');
    expect(credit.DIRECTION).toBe('C');
  });

  it('converte data YYYYMMDDHHMMSS para formato legível', () => {
    const transactions = parseOFXString(OFX_SAMPLE_XML);
    expect(transactions[0].DTPOSTED_FORMATTED).toBe('2026-09-15');
  });

  it('determina direção D para valor negativo', () => {
    const transactions = parseOFXString(OFX_SAMPLE_XML);
    expect(transactions[0].TRNAMT_NUM).toBeLessThan(0);
    expect(transactions[0].DIRECTION).toBe('D');
  });

  it('determina direção C para valor positivo', () => {
    const transactions = parseOFXString(OFX_SAMPLE_XML);
    expect(transactions[1].TRNAMT_NUM).toBeGreaterThan(0);
    expect(transactions[1].DIRECTION).toBe('C');
  });

  it('retorna array vazio para OFX sem transações', () => {
    const emptyOFX = `<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>`;
    const transactions = parseOFXString(emptyOFX);
    expect(transactions).toEqual([]);
  });

  it('lança erro se argumento não for string', () => {
    expect(() => parseOFXString(null)).toThrow(TypeError);
    expect(() => parseOFXString(123)).toThrow(TypeError);
  });
});