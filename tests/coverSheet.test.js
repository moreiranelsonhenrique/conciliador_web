import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { buildCoverSheet, computeCoverSummary, computeTying } from '../js/coverSheet.js';
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
  score_details: b ? { total: 100, value: 50, date: 20, text: 30 } : null,
  human_decision: 'PENDING',
});

describe('computeCoverSummary', () => {
  it('replica os números da imagem de inspiração (M43)', () => {
    // Constrói reviewables que produzem:
    // - conciliados com diferença = R$ 2,30 (CONFIRMED, |diff| <= tol)
    // - pendências banco = -R$ 1.015,50 (A sem vínculo, SAIDA)
    // - pendências financeiro = -R$ 120.528,57 (sobras de B)
    // - divergência de valor = R$ 0,00
    //
    // Observação sobre a tolerância: a diferença do vínculo é R$ 2,30.
    // Para que seja classificado como "conciliado com diferença" (e não
    // como divergência de valor), a tolerância precisa ser >= 2,30.
    // Usamos R$ 5,00 como valor realista do cenário de inspiração.

    const a1 = makeRecord('A1', 'A', '1000.00', '2026-09-15', 'CONC DIF');
    const b1 = makeRecord('B1', 'B', '1002.30', '2026-09-15', 'CONC DIF B');
    const rv1 = new ReviewableResult(makeResult(a1, b1));
    rv1.confirm();

    const a2 = makeRecord('A2', 'A', '1015.50', '2026-09-15', 'PENDENTE A', 'SAIDA');
    const rv2 = new ReviewableResult(makeResult(a2, null, null, 'NÃO ENCONTRADO'));

    const bS1 = makeRecord('B2', 'B', '100000.00', '2026-09-15', 'SOBRA 1', 'SAIDA');
    const bS2 = makeRecord('B3', 'B', '20528.57', '2026-09-15', 'SOBRA 2', 'SAIDA');

    // Tolerância de R$ 5,00 aceita a diferença de R$ 2,30 como "conciliado com diferença"
    const summary = computeCoverSummary([rv1, rv2], [b1, bS1, bS2], '5.00');
    expect(summary.conciliados.toFixed(2)).toBe('0.00');
    expect(summary.conciliadosComDiferenca.toFixed(2)).toBe('2.30');
    expect(summary.pendenciasBanco.toFixed(2)).toBe('-1015.50');
    expect(summary.pendenciasFinanceiro.toFixed(2)).toBe('-120528.57');
    expect(summary.divergenciaValor.toFixed(2)).toBe('0.00');
  });

  it('soma divergência de valor quando não confirmada', () => {
    const a = makeRecord('A1', 'A', '1000.00', '2026-09-15', 'X');
    const b = makeRecord('B1', 'B', '1050.00', '2026-09-15', 'Y');
    const rv = new ReviewableResult(makeResult(a, b, null, 'DIVERGÊNCIA'));
    const s = computeCoverSummary([rv], [b], '0.01');
    expect(s.divergenciaValor.toFixed(2)).toBe('50.00');
  });

  it('divergência confirmada não conta em divergenciaValor', () => {
    const a = makeRecord('A1', 'A', '1000.00', '2026-09-15', 'X');
    const b = makeRecord('B1', 'B', '1050.00', '2026-09-15', 'Y');
    const rv = new ReviewableResult(makeResult(a, b, null, 'DIVERGÊNCIA'));
    rv.confirm();
    const s = computeCoverSummary([rv], [b], '0.01');
    expect(s.divergenciaValor.toFixed(2)).toBe('0.00');
  });

  it('lista vazia retorna tudo zerado', () => {
    const s = computeCoverSummary([], [], '0.01');
    expect(s.conciliados.toFixed(2)).toBe('0.00');
    expect(s.pendenciasBanco.toFixed(2)).toBe('0.00');
    expect(s.pendenciasFinanceiro.toFixed(2)).toBe('0.00');
  });

  it('entradas em pendências somam positivo (com sinal)', () => {
    const a = makeRecord('A1', 'A', '500.00', '2026-09-15', 'X', 'ENTRADA');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const s = computeCoverSummary([rv], [], '0.01');
    expect(s.pendenciasBanco.toFixed(2)).toBe('500.00');
  });
});

describe('computeTying (M43)', () => {
  it('amarração fecha em 0,00 com os números da imagem de inspiração', () => {
    const diag = {
      A: { reportedFinal: new Decimal('303960.50') },
      B: { reportedFinal: new Decimal('184445.13') },
    };
    const summary = {
      pendenciasBanco: new Decimal('-1015.50'),
      pendenciasFinanceiro: new Decimal('-120528.57'),
      conciliadosComDiferenca: new Decimal('2.30'),
    };
    const tying = computeTying(diag, summary);
    expect(tying.diagnostica.toFixed(2)).toBe('-119515.37');
    expect(tying.explicada.toFixed(2)).toBe('-119515.37');
    expect(tying.naoExplicada.toFixed(2)).toBe('0.00');
    expect(tying.disponivel).toBe(true);
  });

  it('sem diagnóstico: disponivel=false e explicada ainda calculada', () => {
    const summary = {
      pendenciasBanco: new Decimal('-1000'),
      pendenciasFinanceiro: new Decimal('-1500'),
      conciliadosComDiferenca: new Decimal('10'),
    };
    const tying = computeTying(null, summary);
    expect(tying.disponivel).toBe(false);
    // -1500 - (-1000) - 10 = -510
    expect(tying.explicada.toFixed(2)).toBe('-510.00');
  });

  it('variação não explicada captura diferença real', () => {
    const diag = {
      A: { reportedFinal: new Decimal('1000') },
      B: { reportedFinal: new Decimal('1100') },
    };
    const summary = {
      pendenciasBanco: new Decimal(0),
      pendenciasFinanceiro: new Decimal(0),
      conciliadosComDiferenca: new Decimal(0),
    };
    const tying = computeTying(diag, summary);
    // diagnostica = 1100 - 1000 = 100; explicada = 0; naoExplicada = 100
    expect(tying.naoExplicada.toFixed(2)).toBe('100.00');
  });
});

describe('buildCoverSheet', () => {
  it('produz os 4 blocos na ordem correta', () => {
    const { rows } = buildCoverSheet({
      empresa: 'ABC LTDA',
      banco: 'ITAU',
      agConta: '0612/010123-7',
      periodoDe: new Date('2026-09-01'),
      periodoAte: new Date('2026-09-19'),
    });
    expect(rows[0][0]).toBe('CONCILIAÇÃO BANCÁRIA');
    const titulos = rows.map((r) => r[0]);
    expect(titulos.indexOf('CHECK DE SALDOS')).toBeGreaterThan(
      titulos.indexOf('CONCILIAÇÃO BANCÁRIA')
    );
    expect(titulos.indexOf('RESUMO CONCILIAÇÃO (CRUZAMENTOS -/+)')).toBeGreaterThan(
      titulos.indexOf('CHECK DE SALDOS')
    );
    expect(titulos.indexOf('AMARRAÇÃO')).toBeGreaterThan(
      titulos.indexOf('RESUMO CONCILIAÇÃO (CRUZAMENTOS -/+)')
    );
  });

  it('preenche cabeçalho com dados informados', () => {
    const { rows } = buildCoverSheet({
      empresa: 'ABC LTDA',
      banco: 'ITAU',
      agConta: '0612/010123-7',
    });
    expect(rows.some((r) => r[0] === 'Empresa:' && r[1] === 'ABC LTDA')).toBe(true);
    expect(rows.some((r) => r[0] === 'Banco:' && r[1] === 'ITAU')).toBe(true);
    expect(rows.some((r) => r[0] === 'Ag/Cta:' && r[1] === '0612/010123-7')).toBe(true);
  });

  it('sem diagnóstico mostra aviso no CHECK DE SALDOS', () => {
    const { rows } = buildCoverSheet({ diagnostico: null });
    const linha = rows.find((r) => String(r[0]).includes('controle de saldos não habilitado'));
    expect(linha).toBeDefined();
  });

  it('com diagnóstico completo, exibe saldos e diferença', () => {
    const diag = {
      A: { initial: new Decimal('1000'), reportedFinal: new Decimal('800') },
      B: { initial: new Decimal('1000'), reportedFinal: new Decimal('900') },
    };
    const { rows } = buildCoverSheet({ diagnostico: diag });
    const labels = rows.map((r) => r[0]);
    expect(labels).toContain('Saldo inicial financeiro');
    expect(labels).toContain('Saldo final banco');
    expect(labels).toContain('Diferença');
  });

  it('amarração indisponível quando não há saldos informados', () => {
    const { rows, tying } = buildCoverSheet({ diagnostico: null });
    expect(tying.disponivel).toBe(false);
    const aviso = rows.find((r) => String(r[0]).includes('amarração indisponível'));
    expect(aviso).toBeDefined();
  });

  it('formatação de valores com sinal explícito', () => {
    const a = makeRecord('A1', 'A', '1000.00', '2026-09-15', 'X', 'SAIDA');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const { rows } = buildCoverSheet({ reviewables: [rv] });
    const pend = rows.find((r) => r[0] === 'Pendências banco');
    expect(pend[1]).toBe('-R$ 1.000,00');
  });

  it('formatação nunca produz R$ 0,00 para null', () => {
    const diag = {
      A: { initial: null, reportedFinal: null },
      B: { initial: null, reportedFinal: null },
    };
    const { rows } = buildCoverSheet({ diagnostico: diag });
    const saldoInicial = rows.find((r) => r[0] === 'Saldo inicial banco');
    expect(saldoInicial[1]).toBe('—');
  });
});