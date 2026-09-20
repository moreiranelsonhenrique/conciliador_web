import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  formatDateBR,
  statusSlug,
  situationLabel,
  buildSummaryRows,
  renderSummaryTable,
  renderFiltersBar,
  applyFilters,
  renderResultCard,
  findUnmatchedB,
  renderUnmatchedBTable,
} from '../js/resultsUi.js';
import { ReviewableResult, BRegistry } from '../js/review.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
  justification: 'justificativa de teste',
  alerts: [],
  score_total: b ? 100 : null,
  score_details: b ? { total: 100, value: 50, date: 20, text: 30 } : null,
  human_decision: 'PENDING',
});

// ---------------------------------------------------------------------------
// formatDateBR
// ---------------------------------------------------------------------------
describe('formatDateBR', () => {
  it('formata data UTC como dd/mm/aaaa', () => {
    expect(formatDateBR(new Date('2026-09-15'))).toBe('15/09/2026');
    expect(formatDateBR(new Date('2026-01-05'))).toBe('05/01/2026');
  });

  it('retorna string vazia para null ou data inválida', () => {
    expect(formatDateBR(null)).toBe('');
    expect(formatDateBR(new Date('invalid'))).toBe('');
  });
});

// ---------------------------------------------------------------------------
// statusSlug
// ---------------------------------------------------------------------------
describe('statusSlug', () => {
  it('mapeia os quatro status para classes CSS', () => {
    expect(statusSlug('CONCILIADO')).toBe('conciliado');
    expect(statusSlug('POSSÍVEL CORRESPONDÊNCIA')).toBe('possivel');
    expect(statusSlug('DIVERGÊNCIA')).toBe('divergencia');
    expect(statusSlug('NÃO ENCONTRADO')).toBe('nao-encontrado');
  });
});

// ---------------------------------------------------------------------------
// situationLabel
// ---------------------------------------------------------------------------
describe('situationLabel', () => {
  const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'PAGTO');
  const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'PAGTO');

  it('conciliado automático pendente e confirmado', () => {
    const rv = new ReviewableResult(makeResult(a, b));
    expect(situationLabel(rv)).toBe('🟢 Conciliado automático · Pendente');
    rv.confirm();
    expect(situationLabel(rv)).toBe('✅ Conciliado automático · Confirmado');
  });

  it('possível correspondência pendente', () => {
    const rv = new ReviewableResult(makeResult(a, b, null, 'POSSÍVEL CORRESPONDÊNCIA'));
    expect(situationLabel(rv)).toBe('🟡 Possível · Pendente');
  });

  it('sugestão rejeitada', () => {
    const rv = new ReviewableResult(makeResult(a, b));
    rv.reject();
    expect(situationLabel(rv)).toBe('🚫 Sugestão rejeitada');
  });

  it('não encontrado sem vínculo', () => {
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    expect(situationLabel(rv)).toBe('❌ Não encontrado');
  });

  it('lote automático pendente, confirmado e rejeitado', () => {
    const b1 = makeRecord('B0', 'B', '60.00', '2026-09-15', 'I1');
    const b2 = makeRecord('B1', 'B', '40.00', '2026-09-15', 'I2');
    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    expect(situationLabel(rv)).toBe('🔗 Lote automático · Pendente');
    rv.confirm();
    expect(situationLabel(rv)).toBe('✅ Lote automático · Confirmado');
    const rv2 = new ReviewableResult(makeResult(a, null, [b1, b2]));
    rv2.reject();
    expect(situationLabel(rv2)).toBe('🚫 Lote rejeitado');
  });

  it('conciliação manual', () => {
    const b2 = makeRecord('B1', 'B', '100.00', '2026-09-15', 'OUTRO');
    const reg = new BRegistry([b, b2]);
    reg.occupy('B0', 'A0');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.applyManualMatch('B1', reg);
    expect(situationLabel(rv)).toBe('🔧 Conciliado manual · Pendente');
  });
});

// ---------------------------------------------------------------------------
// buildSummaryRows
// ---------------------------------------------------------------------------
describe('buildSummaryRows', () => {
  it('agrega entradas e saídas por status com Decimal', () => {
    const a1 = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X', 'ENTRADA');
    const b1 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const a2 = makeRecord('A1', 'A', '50.00', '2026-09-15', 'Y', 'SAIDA');
    const b2 = makeRecord('B1', 'B', '50.00', '2026-09-15', 'Y');
    const a3 = makeRecord('A2', 'A', '30.00', '2026-09-15', 'Z', 'INDEFINIDO');
    const rvs = [
      new ReviewableResult(makeResult(a1, b1)),
      new ReviewableResult(makeResult(a2, b2)),
      new ReviewableResult(makeResult(a3, null, null, 'NÃO ENCONTRADO')),
    ];
    const { rows, total } = buildSummaryRows(rvs);

    const conc = rows.find((r) => r.status === 'CONCILIADO');
    expect(conc.qtd).toBe(2);
    expect(conc.entradas.toFixed(2)).toBe('100.00');
    expect(conc.saidas.toFixed(2)).toBe('50.00');
    expect(conc.movimentado.toFixed(2)).toBe('150.00');

    // INDEFINIDO não entra em entradas/saídas, mas entra no movimentado
    const nf = rows.find((r) => r.status === 'NÃO ENCONTRADO');
    expect(nf.qtd).toBe(1);
    expect(nf.entradas.toFixed(2)).toBe('0.00');
    expect(nf.saidas.toFixed(2)).toBe('0.00');
    expect(nf.movimentado.toFixed(2)).toBe('30.00');

    expect(total.qtd).toBe(3);
    expect(total.entradas.toFixed(2)).toBe('100.00');
    expect(total.saidas.toFixed(2)).toBe('50.00');
    expect(total.movimentado.toFixed(2)).toBe('180.00');
  });

  it('valor inválido (null) conta quantidade mas não soma', () => {
    const aInv = makeRecord('A0', 'A', null, '2026-09-15', 'INV');
    const rv = new ReviewableResult(makeResult(aInv, null, null, 'NÃO ENCONTRADO'));
    const { rows } = buildSummaryRows([rv]);
    const nf = rows.find((r) => r.status === 'NÃO ENCONTRADO');
    expect(nf.qtd).toBe(1);
    expect(nf.movimentado.toFixed(2)).toBe('0.00');
  });

  it('lista vazia gera quatro linhas zeradas', () => {
    const { rows, total } = buildSummaryRows([]);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.qtd).toBe(0);
      expect(row.movimentado.toFixed(2)).toBe('0.00');
    }
    expect(total.qtd).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// renderSummaryTable
// ---------------------------------------------------------------------------
describe('renderSummaryTable', () => {
  it('gera tabela com status e valores formatados', () => {
    const a = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X', 'ENTRADA');
    const b = makeRecord('B0', 'B', '100.00', '2026-09-15', 'X');
    const summary = buildSummaryRows([new ReviewableResult(makeResult(a, b))]);
    const html = renderSummaryTable(summary);
    expect(html).toContain('resumo-table');
    expect(html).toContain('🟢 Conciliados');
    expect(html).toContain('R$ 100,00');
    expect(html).toContain('TOTAL GERAL');
  });
});

// ---------------------------------------------------------------------------
// renderFiltersBar
// ---------------------------------------------------------------------------
describe('renderFiltersBar', () => {
  it('contém os três controles de filtro', () => {
    const html = renderFiltersBar();
    expect(html).toContain('id="filtro-status"');
    expect(html).toContain('id="filtro-revisao"');
    expect(html).toContain('id="filtro-busca"');
  });

  it('M40: barra contém filtros de período e faixa de valor', () => {
    const html = renderFiltersBar();
    expect(html).toContain('id="filtro-data-de"');
    expect(html).toContain('id="filtro-data-ate"');
    expect(html).toContain('id="filtro-valor-min"');
    expect(html).toContain('id="filtro-valor-max"');
  });
});

// ---------------------------------------------------------------------------
// applyFilters
// ---------------------------------------------------------------------------
describe('applyFilters', () => {
  const makeFixtures = () => {
    const a1 = makeRecord('A0', 'A', '100.00', '2026-09-15', 'PAGTO FORNECEDOR');
    const b1 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'FORNECEDOR SILVA');
    const a2 = makeRecord('A1', 'A', '200.00', '2026-09-15', 'RECEBIMENTO PIX', 'ENTRADA');
    const b2 = makeRecord('B1', 'B', '200.00', '2026-09-15', 'PIX CLIENTE', 'ENTRADA');
    const a3 = makeRecord('A2', 'A', '300.00', '2026-09-15', 'TARIFA');
    const rvs = [
      new ReviewableResult(makeResult(a1, b1)),
      new ReviewableResult(makeResult(a2, b2)),
      new ReviewableResult(makeResult(a3, null, null, 'NÃO ENCONTRADO')),
    ];
    const registry = new BRegistry([b1, b2]);
    return { rvs, registry };
  };

  it('filtra por status', () => {
    const { rvs, registry } = makeFixtures();
    const list = applyFilters(rvs, registry, { status: 'CONCILIADO', review: 'Todos', search: '' });
    expect(list).toHaveLength(2);
  });

  it('filtra por revisão', () => {
    const { rvs, registry } = makeFixtures();
    rvs[0].confirm();
    const list = applyFilters(rvs, registry, { status: 'Todos', review: 'CONFIRMED', search: '' });
    expect(list).toHaveLength(1);
  });

  it('busca casa com descrição do A', () => {
    const { rvs, registry } = makeFixtures();
    const list = applyFilters(rvs, registry, { status: 'Todos', review: 'Todos', search: 'fornecedor' });
    expect(list).toHaveLength(1);
    expect(list[0].a_id).toBe('A0');
  });

  it('busca casa com descrição do B vinculado (via registry)', () => {
    const { rvs, registry } = makeFixtures();
    const list = applyFilters(rvs, registry, { status: 'Todos', review: 'Todos', search: 'cliente' });
    expect(list).toHaveLength(1);
    expect(list[0].a_id).toBe('A1');
  });

  it('filtros Todos retorna tudo', () => {
    const { rvs, registry } = makeFixtures();
    const list = applyFilters(rvs, registry, { status: 'Todos', review: 'Todos', search: '' });
    expect(list).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// renderResultCard
// ---------------------------------------------------------------------------
describe('renderResultCard', () => {
  it('cartão 1:1 contém badge, linha A e dados do B (sem rótulo de situação)', () => {
    const a = makeRecord('A0', 'A', '1500.00', '2026-09-15', 'PAGTO FORNECEDOR');
    const b = makeRecord('B0', 'B', '1500.00', '2026-09-15', 'FORNECEDOR SILVA');
    const registry = new BRegistry([b]);
    const rv = new ReviewableResult(makeResult(a, b));
    const html = renderResultCard(rv, registry);
    expect(html).toContain('result-status conciliado');
    expect(html).toContain('🟢 CONCILIADO');
    expect(html).not.toContain('result-situacao');
    expect(html).toContain('Linha A 1');
    expect(html).toContain('Registro B vinculado');
    expect(html).toContain('FORNECEDOR SILVA');
    expect(html).toContain('Score: 100');
  });

  it('cartão de lote exibe itens inline, soma e conferência (recolhido por padrão)', () => {
    const a = makeRecord('A0', 'A', '300.00', '2026-09-15', 'PAGTO LOTE');
    const b1 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'ITEM 1');
    const b2 = makeRecord('B1', 'B', '200.00', '2026-09-15', 'ITEM 2');
    const registry = new BRegistry([b1, b2]);
    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    const html = renderResultCard(rv, registry);
    expect(html).toContain('<details>');
    expect(html).not.toContain('<details open>');
    expect(html).toContain('Itens do lote (2)');
    expect(html).toContain('ITEM 1');
    expect(html).toContain('ITEM 2');
    expect(html).toContain('Soma dos itens (R$ 300,00) confere');
  });

  it('valor inválido aparece como texto, nunca como R$ 0,00', () => {
    const a = makeRecord('A0', 'A', null, '2026-09-15', 'SEM VALOR');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const html = renderResultCard(rv, new BRegistry([]));
    expect(html).toContain('(valor inválido)');
    expect(html).not.toContain('R$ 0,00');
  });

  it('escapa HTML nas descrições', () => {
    const a = makeRecord('A0', 'A', '10.00', '2026-09-15', '<script>alert(1)</script>');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const html = renderResultCard(rv, new BRegistry([]));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('resultado sem vínculo mostra mensagem adequada', () => {
    const a = makeRecord('A0', 'A', '10.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const html = renderResultCard(rv, new BRegistry([]));
    expect(html).toContain('Nenhum registro B vinculado');
  });

  // ---------------------------------------------------------------------------
// findUnmatchedB
// ---------------------------------------------------------------------------
describe('findUnmatchedB', () => {
  const b0 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'VINCULADO');
  const b1 = makeRecord('B1', 'B', '200.00', '2026-09-15', 'SOBRA');
  const b2 = makeRecord('B2', 'B', '300.00', '2026-09-15', 'SOBRA 2');

  it('retorna vazio quando todos os B estão vinculados (1:1)', () => {
    const a0 = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const a1 = makeRecord('A1', 'A', '200.00', '2026-09-15', 'Y');
    const rv0 = new ReviewableResult(makeResult(a0, b0));
    const rv1 = new ReviewableResult(makeResult(a1, b1));
    const sobras = findUnmatchedB([rv0, rv1], [b0, b1, b2]);
    // b0 e b1 vinculados; b2 sobra
    expect(sobras).toHaveLength(1);
    expect(sobras[0].id).toBe('B2');
  });

  it('considera vínculo atual (current_b_id), não o original', () => {
    const a0 = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a0, b0));
    // Simula correção manual: A0 agora aponta para b1
    rv.current_b_id = 'B1';
    const sobras = findUnmatchedB([rv], [b0, b1]);
    // b0 está liberado (era o original), b1 está ocupado (atual)
    expect(sobras).toHaveLength(1);
    expect(sobras[0].id).toBe('B0');
  });

  it('considera lote (current_batch_ids)', () => {
    const a0 = makeRecord('A0', 'A', '300.00', '2026-09-15', 'LOTE');
    const rv = new ReviewableResult(makeResult(a0, null, [b0, b1]));
    const sobras = findUnmatchedB([rv], [b0, b1, b2]);
    expect(sobras).toHaveLength(1);
    expect(sobras[0].id).toBe('B2');
  });

  it('B rejeitado aparece como sobra', () => {
    const a0 = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a0, b0));
    rv.current_b_id = null; // simula rejeição
    rv.current_batch_ids = [];
    const sobras = findUnmatchedB([rv], [b0, b1]);
    expect(sobras).toHaveLength(2);
    const ids = sobras.map((s) => s.id).sort();
    expect(ids).toEqual(['B0', 'B1']);
  });

  it('retorna todos os B quando não há resultados', () => {
    const sobras = findUnmatchedB([], [b0, b1]);
    expect(sobras).toHaveLength(2);
  });

  it('trata entradas inválidas', () => {
    expect(findUnmatchedB(null, [b0])).toEqual([]);
    expect(findUnmatchedB([], null)).toEqual([]);
    expect(findUnmatchedB(null, null)).toEqual([]);
  });

  it('ignora B não presente no array recordsB', () => {
    // Referência a B que não está em recordsB (defesa)
    const a0 = makeRecord('A0', 'A', '100.00', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a0, b0));
    const sobras = findUnmatchedB([rv], [b1]);
    expect(sobras).toHaveLength(1);
    expect(sobras[0].id).toBe('B1');
  });
});

// ---------------------------------------------------------------------------
// renderUnmatchedBTable
// ---------------------------------------------------------------------------
describe('renderUnmatchedBTable', () => {
  const b0 = makeRecord('B0', 'B', '100.00', '2026-09-15', 'SOBRA A');
  const b1 = makeRecord('B1', 'B', '200.00', '2026-09-16', 'SOBRA B');

  it('retorna string vazia para lista vazia', () => {
    expect(renderUnmatchedBTable([])).toBe('');
  });

  it('retorna string vazia para null/undefined', () => {
    expect(renderUnmatchedBTable(null)).toBe('');
    expect(renderUnmatchedBTable(undefined)).toBe('');
  });

  it('renderiza título com contagem', () => {
    const html = renderUnmatchedBTable([b0, b1]);
    expect(html).toContain('Registros B sem correspondente no Arquivo A (2)');
  });

  it('renderiza uma linha por B com dados formatados', () => {
    const html = renderUnmatchedBTable([b0, b1]);
    expect(html).toContain('SOBRA A');
    expect(html).toContain('SOBRA B');
    expect(html).toContain('15/09/2026');
    expect(html).toContain('16/09/2026');
    expect(html).toContain('R$ 100,00');
    expect(html).toContain('R$ 200,00');
  });

  it('escapa HTML em descrições', () => {
    const bHtml = makeRecord('B0', 'B', '100.00', '2026-09-15', '<script>x</script>');
    const html = renderUnmatchedBTable([bHtml]);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('trata valor nulo como (valor inválido)', () => {
    const bNull = { ...b0, value: null };
    const html = renderUnmatchedBTable([bNull]);
    expect(html).toContain('(valor inválido)');
  });

  it('trata data nula como (sem data)', () => {
    const bNoDate = { ...b0, date: null };
    const html = renderUnmatchedBTable([bNoDate]);
    expect(html).toContain('(sem data)');
  });

  it('usa a classe unmatched-b', () => {
    const html = renderUnmatchedBTable([b0]);
    expect(html).toContain('class="unmatched-b"');
  });

    it('tabela de sobras vem recolhida em details com contador', () => {
    const html = renderUnmatchedBTable([b0, b1]);
    expect(html).toContain('<details class="unmatched-b">');
    expect(html).toContain('clique para expandir');
    expect(html).not.toContain('open>');
  });
});
// ---------------------------------------------------------------------------
// applyFilters — filtros avançados (Microentrega 40)
// ---------------------------------------------------------------------------
describe('applyFilters — filtros avançados (M40)', () => {
  const makeAdvFixtures = () => {
    const a1 = makeRecord('A0', 'A', '100.00', '2026-09-10', 'PAGTO FORNECEDOR');
    const b1 = makeRecord('B0', 'B', '100.00', '2026-09-10', 'FORNECEDOR SILVA');
    const a2 = makeRecord('A1', 'A', '250.00', '2026-09-15', 'RECEBIMENTO PIX', 'ENTRADA');
    const b2 = makeRecord('B1', 'B', '250.00', '2026-09-15', 'PIX CLIENTE', 'ENTRADA');
    const a3 = makeRecord('A2', 'A', '3000.00', '2026-09-20', 'ALUGUEL');
    const rvs = [
      new ReviewableResult(makeResult(a1, b1)),
      new ReviewableResult(makeResult(a2, b2)),
      new ReviewableResult(makeResult(a3, null, null, 'NÃO ENCONTRADO')),
    ];
    const registry = new BRegistry([b1, b2]);
    return { rvs, registry };
  };

  it('filtra por período de/até (inclusivo)', () => {
    const { rvs, registry } = makeAdvFixtures();
    const list = applyFilters(rvs, registry, { dateFrom: '2026-09-10', dateTo: '2026-09-15' });
    expect(list).toHaveLength(2);
    expect(list.map((r) => r.a_id)).toEqual(['A0', 'A1']);
  });

  it('período só com "de" filtra a partir da data', () => {
    const { rvs, registry } = makeAdvFixtures();
    const list = applyFilters(rvs, registry, { dateFrom: '2026-09-15' });
    expect(list).toHaveLength(2); // A1 (15/09) e A2 (20/09)
  });

  it('período só com "até" filtra até a data', () => {
    const { rvs, registry } = makeAdvFixtures();
    const list = applyFilters(rvs, registry, { dateTo: '2026-09-15' });
    expect(list).toHaveLength(2); // A0 (10/09) e A1 (15/09)
  });

  it('registros sem data ficam de fora quando há filtro de período', () => {
    const { rvs, registry } = makeAdvFixtures();
    rvs[2].result.a.date = null;
    const list = applyFilters(rvs, registry, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    expect(list).toHaveLength(2);
  });

  it('filtra por valor mínimo (valor absoluto)', () => {
    const { rvs, registry } = makeAdvFixtures();
    const list = applyFilters(rvs, registry, { valueMin: '200' });
    expect(list).toHaveLength(2); // 250 e 3000
  });

  it('filtra por valor máximo', () => {
    const { rvs, registry } = makeAdvFixtures();
    const list = applyFilters(rvs, registry, { valueMax: '300' });
    expect(list).toHaveLength(2); // 100 e 250
  });

  it('valor e período combinados', () => {
    const { rvs, registry } = makeAdvFixtures();
    const list = applyFilters(rvs, registry, { dateFrom: '2026-09-14', valueMin: '1000' });
    expect(list).toHaveLength(1);
    expect(list[0].a_id).toBe('A2');
  });

  it('valores de filtro inválidos são ignorados (não quebram)', () => {
    const { rvs, registry } = makeAdvFixtures();
    const list = applyFilters(rvs, registry, { valueMin: 'abc', valueMax: 'xyz', dateFrom: 'data-ruim' });
    expect(list).toHaveLength(3);
  });

  it('registros com valor inválido ficam de fora quando há filtro de valor', () => {
    const { rvs, registry } = makeAdvFixtures();
    rvs[0].result.a.value = null;
    const list = applyFilters(rvs, registry, { valueMin: '1' });
    expect(list).toHaveLength(2);
  });
});
// ---------------------------------------------------------------------------
// applyFilters — período por chave de dia (Microentrega 40B)
// ---------------------------------------------------------------------------
describe('applyFilters — período por chave de dia (M40B)', () => {
  const makeRecordAt = (id, iso) => ({
    id,
    source: 'A',
    value: new Decimal('100.00'),
    date: new Date(iso),
    description_original: 'X',
    direction: 'SAIDA',
    original_row: 1,
    alerts: [],
  });

  it('De=Até no mesmo dia encontra registro com hora diferente de 00:00 UTC (bug real)', () => {
    // Simula data com componente de hora (ex.: midnight local em UTC-3 = 03:00 UTC)
    const a = makeRecordAt('A0', '2026-09-15T03:00:00.000Z');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const list = applyFilters([rv], null, { dateFrom: '2026-09-15', dateTo: '2026-09-15' });
    expect(list).toHaveLength(1);
  });

  it('dia anterior e posterior ficam de fora quando De=Até', () => {
    const rv14 = new ReviewableResult(makeResult(makeRecordAt('A0', '2026-09-14T03:00:00.000Z'), null, null, 'NÃO ENCONTRADO'));
    const rv15 = new ReviewableResult(makeResult(makeRecordAt('A1', '2026-09-15T03:00:00.000Z'), null, null, 'NÃO ENCONTRADO'));
    const rv16 = new ReviewableResult(makeResult(makeRecordAt('A2', '2026-09-16T03:00:00.000Z'), null, null, 'NÃO ENCONTRADO'));
    const list = applyFilters([rv14, rv15, rv16], null, { dateFrom: '2026-09-15', dateTo: '2026-09-15' });
    expect(list).toHaveLength(1);
    expect(list[0].a_id).toBe('A1');
  });
});
});