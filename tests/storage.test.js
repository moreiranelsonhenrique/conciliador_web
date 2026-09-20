import { describe, it, expect } from 'vitest';
import { layoutHash, storageKey, loadMapping, saveMapping } from '../js/storage.js';

/**
 * Storage fake mínimo para testes (Vitest roda em Node, sem localStorage).
 */
const makeFakeStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(String(k), String(v)); },
    removeItem: (k) => { data.delete(String(k)); },
  };
};

describe('layoutHash', () => {
  it('mesmas colunas geram o mesmo hash', () => {
    expect(layoutHash(['Data', 'Valor', 'Descrição'])).toBe(layoutHash(['Data', 'Valor', 'Descrição']));
  });

  it('colunas diferentes geram hashes diferentes', () => {
    expect(layoutHash(['Data', 'Valor'])).not.toBe(layoutHash(['Data', 'Valor', 'D/C']));
    expect(layoutHash(['Data', 'Valor'])).not.toBe(layoutHash(['Valor', 'Data']));
  });

  it('trata lista vazia ou inválida', () => {
    expect(typeof layoutHash([])).toBe('string');
    expect(typeof layoutHash(null)).toBe('string');
    expect(layoutHash([])).toBe(layoutHash(null));
  });
});

describe('storageKey', () => {
  it('chave contém o lado e o hash do layout', () => {
    const cols = ['Data', 'Valor'];
    const key = storageKey('A', cols);
    expect(key).toContain('.A.');
    expect(key).toContain(layoutHash(cols));
    expect(storageKey('B', cols)).not.toBe(storageKey('A', cols));
    expect(storageKey('X', cols)).toBeNull();
  });
});

describe('loadMapping/saveMapping', () => {
  const cols = ['Data', 'Descrição', 'Valor', 'D/C'];
  const mapping = { date: 'Data', value: 'Valor', description: 'Descrição', dc: 'D/C', type: null, balance: null };

  it('salvar e carregar devolve o mesmo mapeamento (round-trip)', () => {
    const store = makeFakeStorage();
    expect(saveMapping('A', cols, mapping, store)).toBe(true);
    expect(loadMapping('A', cols, store)).toEqual(mapping);
  });

  it('load sem nada salvo retorna null', () => {
    expect(loadMapping('A', cols, makeFakeStorage())).toBeNull();
  });

  it('degrada sem storage (load null, save false)', () => {
    expect(loadMapping('A', cols, null)).toBeNull();
    expect(saveMapping('A', cols, mapping, null)).toBe(false);
  });

  it('JSON corrompido retorna null (não lança)', () => {
    const store = makeFakeStorage();
    store.setItem(storageKey('A', cols), '{isso não é json');
    expect(loadMapping('A', cols, store)).toBeNull();
  });

  it('mapeamento salvo com papéis ausentes volta com null nos faltantes', () => {
    const store = makeFakeStorage();
    saveMapping('A', cols, { date: 'Data', value: 'Valor' }, store);
    expect(loadMapping('A', cols, store)).toEqual({
      date: 'Data',
      value: 'Valor',
      description: null,
      dc: null,
      type: null,
      balance: null,
    });
  });

  it('storage que lança erro é tratado (load null, save false)', () => {
    const throwing = {
      getItem: () => { throw new Error('boom'); },
      setItem: () => { throw new Error('boom'); },
    };
    expect(loadMapping('A', cols, throwing)).toBeNull();
    expect(saveMapping('A', cols, mapping, throwing)).toBe(false);
  });

  it('chaves são separadas por lado (A não vaza para B)', () => {
    const store = makeFakeStorage();
    saveMapping('A', cols, mapping, store);
    expect(loadMapping('B', cols, store)).toBeNull();
  });

  it('papel Saldo é persistido (M42)', () => {
    const store = makeFakeStorage();
    const colsWithSaldo = ['Data', 'Descrição', 'Valor', 'D/C', 'Saldo'];
    const mapWithSaldo = { date: 'Data', value: 'Valor', description: 'Descrição', dc: 'D/C', type: null, balance: 'Saldo' };
    expect(saveMapping('A', colsWithSaldo, mapWithSaldo, store)).toBe(true);
    expect(loadMapping('A', colsWithSaldo, store).balance).toBe('Saldo');
  });

  it('mapeamento apontando para coluna inexistente é descartado', () => {
    const store = makeFakeStorage();
    store.setItem(storageKey('A', cols), JSON.stringify({
      columns: cols,
      mapping: { date: 'COLUNA_FANTASMA', value: 'Valor', description: null, dc: null, type: null },
      savedAt: '2026-09-20T00:00:00.000Z',
    }));
    expect(loadMapping('A', cols, store)).toBeNull();
  });
});