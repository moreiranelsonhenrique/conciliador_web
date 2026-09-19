import { describe, it, expect } from 'vitest';
import { parseOFXString } from '../js/ofxReader.js';
import { inferMapping } from '../js/mapper.js';

const OFX_SAMPLE = `OFXHEADER:100
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
    expect(parseOFXString(OFX_SAMPLE)).toHaveLength(2);
  });

  it('extrai campos da transação de débito com colunas amigáveis', () => {
    const [debit] = parseOFXString(OFX_SAMPLE);
    expect(debit['Tipo']).toBe('DEBIT');
    expect(debit['Data']).toBe('15/09/2026');
    expect(debit['Valor']).toBe('-1570.00');
    expect(debit['ID Transação']).toBe('20260915001');
    expect(debit['Descrição']).toBe('PAGTO FORNECEDOR A');
    expect(debit['Observação']).toBe('PAGAMENTO EFETUADO');
  });

  it('extrai campos da transação de crédito', () => {
    const [, credit] = parseOFXString(OFX_SAMPLE);
    expect(credit['Tipo']).toBe('CREDIT');
    expect(credit['Valor']).toBe('4500.50');
    expect(credit['Descrição']).toBe('RECEBIMENTO PIX');
  });

  it('converte DTPOSTED para dd/mm/yyyy', () => {
    const [debit] = parseOFXString(OFX_SAMPLE);
    expect(debit['Data']).toBe('15/09/2026');
  });

  it('não expõe códigos crus de OFX', () => {
    const [debit] = parseOFXString(OFX_SAMPLE);
    expect(debit).not.toHaveProperty('TRNTYPE');
    expect(debit).not.toHaveProperty('DTPOSTED');
    expect(debit).not.toHaveProperty('TRNAMT');
    expect(debit).not.toHaveProperty('FITID');
    expect(debit).not.toHaveProperty('NAME');
    expect(debit).not.toHaveProperty('MEMO');
  });

  it('mantém sinal do valor (negativo para débito)', () => {
    const [debit] = parseOFXString(OFX_SAMPLE);
    expect(Number(debit['Valor'])).toBeLessThan(0);
  });

  it('usa MEMO como Descrição quando NAME não existe', () => {
    const ofxSemName = `<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260915120000<TRNAMT>-100.00<FITID>1<MEMO>TARIFA QUALQUER</STMTTRN></OFX>`;
    const [trn] = parseOFXString(ofxSemName);
    expect(trn['Descrição']).toBe('TARIFA QUALQUER');
  });

  it('retorna array vazio para OFX sem transações', () => {
    expect(parseOFXString(`<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>`)).toEqual([]);
  });

  it('lança erro se argumento não for string', () => {
    expect(() => parseOFXString(null)).toThrow(TypeError);
    expect(() => parseOFXString(123)).toThrow(TypeError);
  });

  it('colunas amigáveis são reconhecidas pelo mapeamento automático', () => {
    const [debit] = parseOFXString(OFX_SAMPLE);
    const mapping = inferMapping(Object.keys(debit));
    expect(mapping.date).toBe('Data');
    expect(mapping.value).toBe('Valor');
    expect(mapping.description).toBe('Descrição');
    expect(mapping.type).toBe('Tipo');
  });
});