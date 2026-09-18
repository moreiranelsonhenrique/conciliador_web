import { describe, it, expect } from 'vitest';
import { normalizeDirectionText, directionFromSign } from '../js/direction.js';

describe('normalizeDirectionText', () => {
  it('normaliza C para ENTRADA', () => {
    expect(normalizeDirectionText('C')).toBe('ENTRADA');
  });

  it('normaliza D para SAIDA', () => {
    expect(normalizeDirectionText('D')).toBe('SAIDA');
  });

  it('normaliza CREDITO para ENTRADA', () => {
    expect(normalizeDirectionText('CREDITO')).toBe('ENTRADA');
  });

  it('normaliza DEBITO para SAIDA', () => {
    expect(normalizeDirectionText('DEBITO')).toBe('SAIDA');
  });

  it('normaliza com case insensitive', () => {
    expect(normalizeDirectionText('entrada')).toBe('ENTRADA');
    expect(normalizeDirectionText('saida')).toBe('SAIDA');
    expect(normalizeDirectionText('Credit')).toBe('ENTRADA');
    expect(normalizeDirectionText('Debit')).toBe('SAIDA');
  });

  it('normaliza com acentos', () => {
    expect(normalizeDirectionText('Crédito')).toBe('ENTRADA');
    expect(normalizeDirectionText('Débito')).toBe('SAIDA');
    expect(normalizeDirectionText('Saída')).toBe('SAIDA');
  });

  it('normaliza PAGAR e PAGAMENTO para SAIDA', () => {
    expect(normalizeDirectionText('PAGAR')).toBe('SAIDA');
    expect(normalizeDirectionText('PAGAMENTO')).toBe('SAIDA');
  });

  it('normaliza RECEBIMENTO para ENTRADA', () => {
    expect(normalizeDirectionText('RECEBIMENTO')).toBe('ENTRADA');
  });

  it('retorna INDEFINIDO para valor desconhecido', () => {
    expect(normalizeDirectionText('XYZ')).toBe('INDEFINIDO');
    expect(normalizeDirectionText('')).toBe('INDEFINIDO');
  });

  it('retorna INDEFINIDO para null/undefined', () => {
    expect(normalizeDirectionText(null)).toBe('INDEFINIDO');
    expect(normalizeDirectionText(undefined)).toBe('INDEFINIDO');
  });
});

describe('directionFromSign', () => {
  it('valor positivo é ENTRADA', () => {
    expect(directionFromSign(100)).toBe('ENTRADA');
    expect(directionFromSign(4500.50)).toBe('ENTRADA');
  });

  it('valor negativo é SAIDA', () => {
    expect(directionFromSign(-100)).toBe('SAIDA');
    expect(directionFromSign(-1570.00)).toBe('SAIDA');
  });

  it('valor zero é INDEFINIDO', () => {
    expect(directionFromSign(0)).toBe('INDEFINIDO');
  });

  it('aceita string numérica', () => {
    expect(directionFromSign('100')).toBe('ENTRADA');
    expect(directionFromSign('-100')).toBe('SAIDA');
  });

  it('retorna INDEFINIDO para não-numérico', () => {
    expect(directionFromSign('abc')).toBe('INDEFINIDO');
    expect(directionFromSign(null)).toBe('INDEFINIDO');
  });
});