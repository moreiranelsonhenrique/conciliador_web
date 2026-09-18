import { describe, it, expect } from 'vitest';
import { inferMapping } from '../js/mapper.js';

describe('inferMapping', () => {
  it('mapeia colunas com nomes óbvios', () => {
    const columns = ['Data', 'Descrição', 'Valor'];
    const mapping = inferMapping(columns);
    expect(mapping.date).toBe('Data');
    expect(mapping.description).toBe('Descrição');
    expect(mapping.value).toBe('Valor');
  });

  it('mapeia colunas com nomes alternativos brasileiros', () => {
    const columns = ['Dt. Movimento', 'Histórico', 'Vlr'];
    const mapping = inferMapping(columns);
    expect(mapping.date).toBe('Dt. Movimento');
    expect(mapping.description).toBe('Histórico');
    expect(mapping.value).toBe('Vlr');
  });

  it('mapeia coluna D/C', () => {
    const columns = ['Data', 'Valor', 'D/C'];
    const mapping = inferMapping(columns);
    expect(mapping.date).toBe('Data');
    expect(mapping.value).toBe('Valor');
    expect(mapping.dc).toBe('D/C');
  });

  it('retorna null para papéis não encontrados', () => {
    const columns = ['Coluna A', 'Coluna B', 'Coluna C'];
    const mapping = inferMapping(columns);
    expect(mapping.date).toBeNull();
    expect(mapping.value).toBeNull();
    expect(mapping.description).toBeNull();
    expect(mapping.dc).toBeNull();
    expect(mapping.type).toBeNull();
  });

  it('mapeia colunas em inglês', () => {
    const columns = ['Date', 'Description', 'Amount'];
    const mapping = inferMapping(columns);
    expect(mapping.date).toBe('Date');
    expect(mapping.description).toBe('Description');
    expect(mapping.value).toBe('Amount');
  });

  it('mapeia campos OFX', () => {
    const columns = ['DTPOSTED', 'TRNAMT', 'NAME', 'TRNTYPE'];
    const mapping = inferMapping(columns);
    expect(mapping.date).toBe('DTPOSTED');
    expect(mapping.value).toBe('TRNAMT');
    expect(mapping.description).toBe('NAME');
    expect(mapping.type).toBe('TRNTYPE');
  });

  it('não mapeia a mesma coluna para dois papéis', () => {
    const columns = ['Data'];
    const mapping = inferMapping(columns);
    expect(mapping.date).toBe('Data');
    expect(mapping.value).toBeNull();
    expect(mapping.description).toBeNull();
  });

  it('retorna mapeamento vazio para array vazio', () => {
    const mapping = inferMapping([]);
    expect(mapping.date).toBeNull();
    expect(mapping.value).toBeNull();
  });

  it('retorna mapeamento vazio para argumento não-array', () => {
    const mapping = inferMapping(null);
    expect(mapping.date).toBeNull();
  });
});