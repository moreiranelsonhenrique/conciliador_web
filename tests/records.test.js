import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseDate,
  parseValue,
  generateId,
  determineDirection,
  buildRecords,
} from '../js/records.js';

describe('parseDate', () => {
  it('converte formato BR dd/mm/yyyy', () => {
    const r = parseDate('15/09/2026');
    expect(r.status).toBe('OK');
    expect(r.date.getFullYear()).toBe(2026);
    expect(r.date.getMonth()).toBe(8); // Setembro é mês 8 (0-based)
    expect(r.date.getDate()).toBe(15);
  });

  it('converte formato ISO yyyy-mm-dd', () => {
    const r = parseDate('2026-09-15');
    expect(r.status).toBe('OK');
    expect(r.date.getFullYear()).toBe(2026);
    expect(r.date.getMonth()).toBe(8);
    expect(r.date.getDate()).toBe(15);
  });

  it('converte formato com datetime', () => {
    const r = parseDate('15/09/2026 14:30:00');
    expect(r.status).toBe('OK');
    expect(r.date.getDate()).toBe(15);
  });

  it('retorna MISSING para valor vazio', () => {
    const r = parseDate('');
    expect(r.status).toBe('MISSING');
    expect(r.date).toBeNull();
  });

  it('retorna MISSING para null', () => {
    const r = parseDate(null);
    expect(r.status).toBe('MISSING');
    expect(r.date).toBeNull();
  });

  it('retorna INVALID para data malformada', () => {
    const r = parseDate('32/13/2026');
    expect(r.status).toBe('INVALID');
    expect(r.date).toBeNull();
    expect(r.message).toContain('inválida');
  });

  it('retorna INVALID para texto qualquer', () => {
    const r = parseDate('não é data');
    expect(r.status).toBe('INVALID');
    expect(r.date).toBeNull();
  });
});

describe('parseValue', () => {
  it('converte formato BR com centavos', () => {
    const r = parseValue('1.234,56');
    expect(r.status).toBe('OK');
    expect(r.value.equals(new Decimal('1234.56'))).toBe(true);
  });

  it('converte formato BR sem milhares', () => {
    const r = parseValue('100,50');
    expect(r.status).toBe('OK');
    expect(r.value.equals(new Decimal('100.50'))).toBe(true);
  });

  it('converte formato internacional', () => {
    const r = parseValue('1234.56');
    expect(r.status).toBe('OK');
    expect(r.value.equals(new Decimal('1234.56'))).toBe(true);
  });

  it('converte formato americano com milhares', () => {
    const r = parseValue('1,234.56');
    expect(r.status).toBe('OK');
    expect(r.value.equals(new Decimal('1234.56'))).toBe(true);
  });

  it('preserva sinal negativo', () => {
    const r = parseValue('-1500,00');
    expect(r.status).toBe('OK');
    expect(r.value.isNegative()).toBe(true);
    expect(r.value.equals(new Decimal('-1500.00'))).toBe(true);
  });

  it('retorna MISSING para valor vazio', () => {
    const r = parseValue('');
    expect(r.status).toBe('MISSING');
    expect(r.value).toBeNull();
  });

  it('retorna MISSING para null', () => {
    const r = parseValue(null);
    expect(r.status).toBe('MISSING');
    expect(r.value).toBeNull();
  });

  it('retorna INVALID para texto não numérico', () => {
    const r = parseValue('N/A');
    expect(r.status).toBe('INVALID');
    expect(r.value).toBeNull();
    expect(r.message).toContain('inválido');
  });

  it('converte valor com símbolo monetário', () => {
    const r = parseValue('R$ 1.500,00');
    expect(r.status).toBe('OK');
    expect(r.value.equals(new Decimal('1500.00'))).toBe(true);
  });
});

describe('generateId', () => {
  it('gera ID com fonte e linha', () => {
    expect(generateId('A', 0)).toBe('A0');
    expect(generateId('B', 15)).toBe('B15');
  });
});

describe('determineDirection', () => {
  it('modo TIPO_DOMINANTE usa Tipo quando disponível', () => {
    const r = determineDirection({
      dcValue: 'C',
      typeValue: 'PAGAR', // PAGAR = SAÍDA
      signValue: 100,
      mode: 'TIPO_DOMINANTE',
    });
    expect(r.direction).toBe('SAIDA');
  });

  it('modo TIPO_DOMINANTE usa D/C se Tipo indefinido', () => {
    const r = determineDirection({
      dcValue: 'D',
      typeValue: null,
      signValue: null,
      mode: 'TIPO_DOMINANTE',
    });
    expect(r.direction).toBe('SAIDA');
  });

  it('modo TIPO_DOMINANTE usa sinal negativo se D/C e Tipo indefinidos', () => {
    const r = determineDirection({
      dcValue: null,
      typeValue: null,
      signValue: -500,
      mode: 'TIPO_DOMINANTE',
    });
    expect(r.direction).toBe('SAIDA');
  });

  it('modo TIPO_DOMINANTE retorna INDEFINIDO para sinal positivo sem D/C/Tipo', () => {
    const r = determineDirection({
      dcValue: null,
      typeValue: null,
      signValue: 500,
      mode: 'TIPO_DOMINANTE',
    });
    expect(r.direction).toBe('INDEFINIDO');
  });

  it('modo TIPO_DOMINANTE retorna INDEFINIDO quando nada disponível', () => {
    const r = determineDirection({
      dcValue: null,
      typeValue: null,
      signValue: null,
      mode: 'TIPO_DOMINANTE',
    });
    expect(r.direction).toBe('INDEFINIDO');
  });

  it('modo STRICT_CONFLICT retorna INDEFINIDO em caso de contradição', () => {
    const r = determineDirection({
      dcValue: 'C',
      typeValue: null,
      signValue: -100, // C diz entrada, sinal diz saída
      mode: 'STRICT_CONFLICT',
    });
    expect(r.direction).toBe('INDEFINIDO');
    expect(r.message).toContain('Conflito');
  });

  it('modo STRICT_CONFLICT aceita quando tudo coincide', () => {
    const r = determineDirection({
      dcValue: 'D',
      typeValue: 'PAGAR',
      signValue: -100,
      mode: 'STRICT_CONFLICT',
    });
    expect(r.direction).toBe('SAIDA');
  });
});

describe('buildRecords', () => {
  it('constrói registros básicos com mapeamento completo', () => {
    const rows = [
      { Data: '15/09/2026', Descricao: 'PAGTO FORNECEDOR', Valor: '1500,00', 'D/C': 'D' },
      { Data: '16/09/2026', Descricao: 'RECEBIMENTO PIX', Valor: '2000,50', 'D/C': 'C' },
    ];
    const mapping = { date: 'Data', description: 'Descricao', value: 'Valor', dc: 'D/C' };
    const records = buildRecords(rows, mapping, { source: 'A' });

    expect(records).toHaveLength(2);
    expect(records[0].id).toBe('A0');
    expect(records[0].original_row).toBe(1);
    expect(records[0].source).toBe('A');
    expect(records[0].value.equals(new Decimal('1500.00'))).toBe(true);
    expect(records[0].value_status).toBe('OK');
    expect(records[0].date_status).toBe('OK');
    expect(records[0].direction).toBe('SAIDA');
    expect(records[0].description_original).toBe('PAGTO FORNECEDOR');
    expect(records[0].description_normalized).toBe('pagto fornecedor');

    expect(records[1].direction).toBe('ENTRADA');
    expect(records[1].value.equals(new Decimal('2000.50'))).toBe(true);
  });

  it('registra alerta para valor inválido (N/A)', () => {
    const rows = [{ Data: '15/09/2026', Valor: 'N/A' }];
    const mapping = { date: 'Data', value: 'Valor' };
    const records = buildRecords(rows, mapping, { source: 'A' });

    expect(records[0].value_status).toBe('INVALID');
    expect(records[0].value).toBeNull();
    expect(records[0].alerts.length).toBeGreaterThan(0);
    expect(records[0].alerts[0]).toContain('inválido');
  });

  it('registra alerta para data inválida', () => {
    const rows = [{ Data: '32/13/2026', Valor: '100,00' }];
    const mapping = { date: 'Data', value: 'Valor' };
    const records = buildRecords(rows, mapping, { source: 'A' });

    expect(records[0].date_status).toBe('INVALID');
    expect(records[0].date).toBeNull();
    expect(records[0].alerts.some((a) => a.includes('Data'))).toBe(true);
  });

  it('funciona com colunas faltantes (sem dc/type)', () => {
    const rows = [{ Data: '15/09/2026', Valor: '100,00' }];
    const mapping = { date: 'Data', value: 'Valor' };
    const records = buildRecords(rows, mapping, { source: 'A' });

    expect(records).toHaveLength(1);
    expect(records[0].direction).toBe('INDEFINIDO');
  });

  it('aplica modo STRICT_CONFLICT', () => {
    const rows = [{ Data: '15/09/2026', Valor: '-100,00', 'D/C': 'C' }];
    const mapping = { date: 'Data', value: 'Valor', dc: 'D/C' };
    const records = buildRecords(rows, mapping, {
      source: 'A',
      directionMode: 'STRICT_CONFLICT',
    });

    expect(records[0].direction).toBe('INDEFINIDO');
    expect(records[0].alerts.some((a) => a.includes('Conflito'))).toBe(true);
  });

  it('retorna array vazio para rows não-array', () => {
    expect(buildRecords(null, { date: 'Data' })).toEqual([]);
  });

  it('retorna array vazio para mapping inválido', () => {
    expect(buildRecords([{ Data: '15/09/2026' }], null)).toEqual([]);
  });

  it('preserva raw da linha original', () => {
    const row = { Data: '15/09/2026', Valor: '100,00', Extra: 'xyz' };
    const mapping = { date: 'Data', value: 'Valor' };
    const records = buildRecords([row], mapping, { source: 'A' });
    expect(records[0].raw).toBe(row);
    expect(records[0].raw.Extra).toBe('xyz');
  });
});