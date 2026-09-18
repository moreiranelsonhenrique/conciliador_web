import { describe, it, expect } from 'vitest';
import {
  textSimilarity,
  scoreValue,
  scoreDate,
  scoreText,
  totalScore,
} from '../js/scorer.js';

describe('textSimilarity', () => {
  it('textos idênticos têm similaridade 1', () => {
    expect(textSimilarity('PAGTO FORNECEDOR', 'PAGTO FORNECEDOR')).toBe(1);
  });

  it('textos totalmente diferentes têm similaridade 0', () => {
    expect(textSimilarity('PAGTO FORNECEDOR', 'RECEBIMENTO PIX')).toBe(0);
  });

  it('textos vazios têm similaridade 1', () => {
    expect(textSimilarity('', '')).toBe(1);
  });

  it('um texto vazio e outro não têm similaridade 0', () => {
    expect(textSimilarity('', 'PAGTO')).toBe(0);
  });

  it('é case insensitive e ignora acentos', () => {
    expect(textSimilarity('Pagto Fornecedor', 'PAGTO FORNECEDOR')).toBe(1);
    expect(textSimilarity('Pagamento', 'PAGAMENTO')).toBe(1);
  });
});

describe('scoreValue', () => {
  it('valores iguais retornam 50', () => {
    expect(scoreValue('1500.00', '1500.00')).toBe(50);
  });

  it('valores dentro da tolerância retornam 50', () => {
    expect(scoreValue('1500.00', '1500.01', '0.01')).toBe(50);
  });

  it('valores fora da tolerância retornam 0', () => {
    expect(scoreValue('1500.00', '1500.02', '0.01')).toBe(0);
  });

  it('compara valores absolutos (ignora sinal)', () => {
    expect(scoreValue('-1500.00', '1500.00')).toBe(50);
  });

  it('valores nulos retornam 0', () => {
    expect(scoreValue(null, '1500.00')).toBe(0);
    expect(scoreValue('1500.00', null)).toBe(0);
  });

  it('valores não numéricos retornam 0', () => {
    expect(scoreValue('abc', '1500.00')).toBe(0);
  });
});

describe('scoreDate', () => {
  it('mesma data retorna 20', () => {
    expect(scoreDate('2026-09-15', '2026-09-15')).toBe(20);
  });

  it('datas dentro da tolerância retornam 20', () => {
    expect(scoreDate('2026-09-15', '2026-09-16', 1)).toBe(20);
  });

  it('datas fora da tolerância retornam 0', () => {
    expect(scoreDate('2026-09-15', '2026-09-17', 1)).toBe(0);
  });

  it('datas nulas retornam 0', () => {
    expect(scoreDate(null, '2026-09-15')).toBe(0);
    expect(scoreDate('2026-09-15', null)).toBe(0);
  });

  it('datas inválidas retornam 0', () => {
    expect(scoreDate('invalid', '2026-09-15')).toBe(0);
  });
});

describe('scoreText', () => {
  it('textos idênticos retornam 30', () => {
    expect(scoreText('PAGTO FORNECEDOR', 'PAGTO FORNECEDOR')).toBe(30);
  });

  it('textos similares retornam score proporcional', () => {
    // 'PAGTO FORNECEDOR' (2 tokens) vs 'PAGTO FORNECEDOR SILVA' (3 tokens)
    // Jaccard: interseção 2 / união 3 = 0.666... >= 0.6
    const score = scoreText('PAGTO FORNECEDOR', 'PAGTO FORNECEDOR SILVA');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(30);
  });

  it('textos totalmente diferentes retornam 0', () => {
    expect(scoreText('PAGTO FORNECEDOR', 'RECEBIMENTO PIX')).toBe(0);
  });

  it('textos nulos retornam 0', () => {
    expect(scoreText(null, 'PAGTO')).toBe(0);
    expect(scoreText('PAGTO', null)).toBe(0);
  });
});

describe('totalScore', () => {
  it('match perfeito retorna 100', () => {
    const result = totalScore({
      valueA: '1500.00',
      valueB: '1500.00',
      dateA: '2026-09-15',
      dateB: '2026-09-15',
      textA: 'PAGTO FORNECEDOR',
      textB: 'PAGTO FORNECEDOR',
    });
    expect(result.total).toBe(100);
    expect(result.value).toBe(50);
    expect(result.date).toBe(20);
    expect(result.text).toBe(30);
  });

  it('match apenas por valor retorna 50', () => {
    const result = totalScore({
      valueA: '1500.00',
      valueB: '1500.00',
      dateA: '2026-09-15',
      dateB: '2026-10-20',
      textA: 'PAGTO FORNECEDOR',
      textB: 'RECEBIMENTO PIX',
    });
    expect(result.total).toBe(50);
    expect(result.value).toBe(50);
    expect(result.date).toBe(0);
    expect(result.text).toBe(0);
  });

  it('respeita configuração de tolerância', () => {
    const result = totalScore(
      {
        valueA: '1500.00',
        valueB: '1500.05',
        dateA: '2026-09-15',
        dateB: '2026-09-16',
        textA: 'PAGTO FORNECEDOR',
        textB: 'PAGTO FORNECEDOR',
      },
      { valueTolerance: '0.10', dateToleranceDays: 1 }
    );
    expect(result.value).toBe(50);
    expect(result.date).toBe(20);
  });
});