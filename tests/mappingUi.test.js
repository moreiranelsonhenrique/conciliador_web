import { describe, it, expect } from 'vitest';
import {
  renderMappingSelects,
  validateMapping,
  normalizeConfig,
} from '../js/mappingUi.js';

describe('validateMapping', () => {
  it('valida mapeamento com date e value', () => {
    const r = validateMapping({ date: 'Data', value: 'Valor' });
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('description, dc e type sao opcionais', () => {
    const r = validateMapping({
      date: 'Data',
      value: 'Valor',
      description: null,
      dc: null,
      type: null,
    });
    expect(r.valid).toBe(true);
  });

  it('invalido sem date', () => {
    const r = validateMapping({ date: null, value: 'Valor' });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.includes('Data'))).toBe(true);
  });

  it('invalido sem value', () => {
    const r = validateMapping({ date: 'Data', value: null });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.includes('Valor'))).toBe(true);
  });

  it('invalido sem date e value lista dois problemas', () => {
    const r = validateMapping({});
    expect(r.valid).toBe(false);
    expect(r.issues).toHaveLength(2);
  });

  it('mapping null ou undefined eh invalido', () => {
    expect(validateMapping(null).valid).toBe(false);
    expect(validateMapping(undefined).valid).toBe(false);
  });
});

describe('renderMappingSelects', () => {
  const columns = ['Data', 'Descricao', 'Valor', 'D/C'];

  it('gera um select por papel (5 no total)', () => {
    const html = renderMappingSelects(columns, {}, 'mapping-a');
    const matches = html.match(/<select/g) || [];
    expect(matches).toHaveLength(5);
  });

  it('cada select tem data-role e id com prefixo', () => {
    const html = renderMappingSelects(columns, {}, 'mapping-a');
    for (const role of ['date', 'value', 'description', 'dc', 'type']) {
      expect(html).toContain(`data-role="${role}"`);
      expect(html).toContain(`id="mapping-a-${role}"`);
    }
  });

  it('marca a coluna mapeada como selected', () => {
    const html = renderMappingSelects(columns, { date: 'Data', value: 'Valor' }, 'p');
    expect(html).toContain('<option value="Data" selected>Data</option>');
    expect(html).toContain('<option value="Valor" selected>Valor</option>');
  });

  it('papel sem coluna fica com "(não mapear)" selecionado', () => {
    const html = renderMappingSelects(columns, { date: 'Data' }, 'p');
    expect(html).toContain('<option value="" selected>(não mapear)</option>');
  });

  it('funciona com lista de colunas vazia', () => {
    const html = renderMappingSelects([], {}, 'p');
    const matches = html.match(/<select/g) || [];
    expect(matches).toHaveLength(5);
    expect(html).toContain('(não mapear)');
  });

  it('escapa caracteres HTML nos nomes de coluna', () => {
    const html = renderMappingSelects(['<script>x</script>'], {}, 'p');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('normalizeConfig', () => {
  it('converte similaridade de porcentagem para fracao (50 -> 0.5)', () => {
    const cfg = normalizeConfig({
      valueTolerance: '0.01',
      dateToleranceDays: '2',
      minTextSimilarityPercent: '50',
    });
    expect(cfg.minTextSimilarity).toBe(0.5);
  });

  it('converte extremos 0 e 100', () => {
    expect(normalizeConfig({ minTextSimilarityPercent: '0' }).minTextSimilarity).toBe(0);
    expect(normalizeConfig({ minTextSimilarityPercent: '100' }).minTextSimilarity).toBe(1);
  });

  it('converte valor intermediario (33 -> 0.33)', () => {
    expect(normalizeConfig({ minTextSimilarityPercent: 33 }).minTextSimilarity).toBe(0.33);
  });

  it('limita similaridade acima de 100 para 1', () => {
    expect(normalizeConfig({ minTextSimilarityPercent: '150' }).minTextSimilarity).toBe(1);
  });

  it('limita similaridade negativa para 0', () => {
    expect(normalizeConfig({ minTextSimilarityPercent: '-20' }).minTextSimilarity).toBe(0);
  });

  it('valueTolerance sai como string normalizada', () => {
    const cfg = normalizeConfig({ valueTolerance: '0.10' });
    expect(cfg.valueTolerance).toBe('0.1');
    expect(typeof cfg.valueTolerance).toBe('string');
  });

  it('dateToleranceDays sai como inteiro', () => {
    expect(normalizeConfig({ dateToleranceDays: '3' }).dateToleranceDays).toBe(3);
    expect(normalizeConfig({ dateToleranceDays: 2.9 }).dateToleranceDays).toBe(2);
  });

  it('aplica padroes quando campos ausentes', () => {
    const cfg = normalizeConfig({});
    expect(cfg.valueTolerance).toBe('0.01');
    expect(cfg.dateToleranceDays).toBe(2);
    expect(cfg.minTextSimilarity).toBe(0.6);
  });

  it('lanca erro para valueTolerance nao numerica', () => {
    expect(() => normalizeConfig({ valueTolerance: 'abc' })).toThrow(/inválida/);
  });

  it('lanca erro para valueTolerance negativa', () => {
    expect(() => normalizeConfig({ valueTolerance: '-1' })).toThrow(/negativa/);
  });

  it('lanca erro para dateToleranceDays invalida', () => {
    expect(() => normalizeConfig({ dateToleranceDays: 'xyz' })).toThrow(/inválida/);
    expect(() => normalizeConfig({ dateToleranceDays: -1 })).toThrow(/inválida/);
  });

  it('lanca erro para similaridade nao numerica', () => {
    expect(() => normalizeConfig({ minTextSimilarityPercent: 'abc' })).toThrow(/inválida/);
  });
});