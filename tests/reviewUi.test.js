import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { renderActionButtons, renderCorrectForm, filterAvailableBs } from '../js/reviewUi.js';
import { ReviewableResult } from '../js/review.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeRecord = (id, source, value, date, desc) => ({
  id,
  source,
  value: value == null ? null : new Decimal(value),
  date: date ? new Date(date) : null,
  description_original: desc,
  direction: 'SAIDA',
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
  score_total: b ? 100 : null,
  score_details: b ? { total: 100, value: 50, date: 20, text: 30 } : null,
  human_decision: 'PENDING',
});

// ---------------------------------------------------------------------------
// renderActionButtons
// ---------------------------------------------------------------------------
describe('renderActionButtons', () => {
  it('pendente 1:1 mostra Confirmar e Rejeitar (sem Corrigir)', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    const html = renderActionButtons(rv);
    expect(html).toContain('data-action="confirm"');
    expect(html).toContain('data-action="reject"');
    expect(html).not.toContain('data-action="correct"');
    expect(html).not.toContain('Corrigir vínculo');
  });

  it('confirmado 1:1 mostra apenas Rejeitar (sem Corrigir)', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.confirm();
    const html = renderActionButtons(rv);
    expect(html).not.toContain('data-action="confirm"');
    expect(html).toContain('data-action="reject"');
    expect(html).not.toContain('data-action="correct"');
  });

  it('lote pendente mostra apenas Confirmar e Rejeitar (sem Corrigir)', () => {
    const a = makeRecord('A0', 'A', '300', '2026-09-15', 'LOTE');
    const b1 = makeRecord('B0', 'B', '100', '2026-09-15', 'I1');
    const b2 = makeRecord('B1', 'B', '200', '2026-09-15', 'I2');
    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    const html = renderActionButtons(rv);
    expect(html).toContain('data-action="confirm"');
    expect(html).toContain('data-action="reject"');
    expect(html).not.toContain('data-action="correct"');
  });

  it('não encontrado mostra "Conciliar manualmente"', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const html = renderActionButtons(rv);
    expect(html).toContain('data-action="correct"');
    expect(html).toContain('Conciliar manualmente');
    expect(html).not.toContain('data-action="confirm"');
    expect(html).not.toContain('data-action="reject"');
  });

  it('rejeitado 1:1 mostra Desfazer rejeição e Conciliar manualmente', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    rv.reject();
    const html = renderActionButtons(rv);
    expect(html).toContain('data-action="undo-reject"');
    expect(html).toContain('Desfazer rejeição');
    expect(html).not.toContain('data-action="confirm"');
    expect(html).toContain('data-action="correct"');
    expect(html).toContain('Conciliar manualmente');
  });

  it('rejeitado sem vínculo original mostra apenas Conciliar manualmente (estado forçado)', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    // Força o estado de rejeitado sem vínculo original (cenário de borda defensivo da UI).
    // Não usamos rv.reject() porque a classe corretamente bloqueia rejeitar sem vínculo.
    rv.human_decision = 'REJECTED';
    rv.result.human_decision = 'REJECTED';
    rv.original_b_id = null;
    rv.original_batch_ids = [];
    const html = renderActionButtons(rv);
    expect(html).toContain('data-action="correct"');
    expect(html).toContain('Conciliar manualmente');
    expect(html).not.toContain('data-action="undo-reject"');
  });

  it('retorna vazio para rv inválido', () => {
    expect(renderActionButtons(null)).toBe('');
    expect(renderActionButtons({})).toBe('');
  });

  it('lote rejeitado mostra apenas Desfazer rejeição (sem ajuste manual — D4)', () => {
    const a = makeRecord('A0', 'A', '300', '2026-09-15', 'LOTE');
    const b1 = makeRecord('B0', 'B', '100', '2026-09-15', 'I1');
    const b2 = makeRecord('B1', 'B', '200', '2026-09-15', 'I2');
    const rv = new ReviewableResult(makeResult(a, null, [b1, b2]));
    rv.reject();
    const html = renderActionButtons(rv);
    expect(html).toContain('data-action="undo-reject"');
    expect(html).not.toContain('data-action="correct"');
  });

  it('escapa a_id no data attribute', () => {
    const a = makeRecord('A<0>', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    const html = renderActionButtons(rv);
    expect(html).toContain('data-a-id="A&lt;0&gt;"');
  });
});

// ---------------------------------------------------------------------------
// renderCorrectForm
// ---------------------------------------------------------------------------
describe('renderCorrectForm', () => {
  it('gera select com opções de Bs disponíveis', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    const bAvail = [
      makeRecord('B5', 'B', '99.50', '2026-09-15', 'FORNECEDOR SILVA'),
      makeRecord('B7', 'B', '100.00', '2026-09-16', 'OUTRO'),
    ];
    const html = renderCorrectForm(rv, bAvail);
    expect(html).toContain('data-role="correct-b"');
    expect(html).toContain('value="B5"');
    expect(html).toContain('value="B7"');
    expect(html).toContain('FORNECEDOR SILVA');
    expect(html).toContain('L6');  // B5 -> original_row = parseInt('5')+1 = 6
    expect(html).toContain('15/09/2026');
    expect(html).toContain('data-action="apply-correct"');
    expect(html).toContain('data-action="cancel-correct"');
  });

  it('M40B: sem option de placeholder (lista visível, escolha explícita)', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    const html = renderCorrectForm(rv, []);
    expect(html).not.toContain('(selecione um registro B)');
    expect(html).toContain('data-role="correct-b"');
  });

  it('trata B sem data e sem descrição', () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const b = makeRecord('B0', 'B', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, b));
    const bAvail = [makeRecord('B1', 'B', null, null, null)];
    const html = renderCorrectForm(rv, bAvail);
    expect(html).toContain('(sem data)');
    expect(html).toContain('(sem descrição)');
    expect(html).toContain('(inválido)');
  });

  it('retorna vazio para rv inválido', () => {
    expect(renderCorrectForm(null, [])).toBe('');
    expect(renderCorrectForm({}, [])).toBe('');
  });
  // ---------------------------------------------------------------------------
// filterAvailableBs
// ---------------------------------------------------------------------------
describe('filterAvailableBs', () => {
  const bs = [
    makeRecord('B0', 'B', '100.00', '2026-09-15', 'FORNECEDOR SILVA'),  // linha 1
    makeRecord('B41', 'B', '250.50', '2026-09-16', 'TARIFA BANCARIA'),  // linha 42
    makeRecord('B2', 'B', null, null, null),                            // linha 3
  ];

  it('termo vazio retorna todos', () => {
    expect(filterAvailableBs(bs, '')).toHaveLength(3);
    expect(filterAvailableBs(bs, '   ')).toHaveLength(3);
    expect(filterAvailableBs(bs, null)).toHaveLength(3);
  });

  it('filtra por descrição (case-insensitive)', () => {
    const list = filterAvailableBs(bs, 'fornecedor');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('B0');
  });

  it('filtra por linha', () => {
    const list = filterAvailableBs(bs, '42');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('B41');
  });

  it('filtra por valor formatado', () => {
    const list = filterAvailableBs(bs, '250,50');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('B41');
  });

  it('filtra por data dd/mm/aaaa', () => {
    const list = filterAvailableBs(bs, '16/09/2026');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('B41');
  });

  it('sem correspondência retorna vazio', () => {
    expect(filterAvailableBs(bs, 'xyzabc')).toEqual([]);
  });

  it('trata lista inválida', () => {
    expect(filterAvailableBs(null, 'x')).toEqual([]);
    expect(filterAvailableBs(undefined, 'x')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// renderCorrectForm — busca (Microentrega 37)
// ---------------------------------------------------------------------------
describe('renderCorrectForm com busca', () => {
  const makeFormFixture = () => {
    const a = makeRecord('A0', 'A', '100', '2026-09-15', 'X');
    const rv = new ReviewableResult(makeResult(a, null, null, 'NÃO ENCONTRADO'));
    const bAvail = [
      makeRecord('B5', 'B', '99.50', '2026-09-15', 'FORNECEDOR SILVA'),
      makeRecord('B7', 'B', '100.00', '2026-09-16', 'OUTRO LANCAMENTO'),
    ];
    return { rv, bAvail };
  };

  it('formulário tem campo de busca e contador de disponíveis', () => {
    const { rv, bAvail } = makeFormFixture();
    const html = renderCorrectForm(rv, bAvail);
    expect(html).toContain('data-role="correct-search"');
    expect(html).toContain('2 de 2 registro(s) disponível(is)');
  });

  it('filtro reduz opções do select e atualiza contador', () => {
    const { rv, bAvail } = makeFormFixture();
    const html = renderCorrectForm(rv, bAvail, 'silva');
    expect(html).toContain('FORNECEDOR SILVA');
    expect(html).not.toContain('OUTRO LANCAMENTO');
    expect(html).toContain('1 de 2 registro(s) disponível(is)');
    expect(html).toContain('value="silva"');
  });

  it('filtro sem correspondência deixa o select sem opções', () => {
    const { rv, bAvail } = makeFormFixture();
    const html = renderCorrectForm(rv, bAvail, 'zzzabc');
    expect(html).toContain('0 de 2 registro(s) disponível(is)');
    expect(html).not.toContain('<option');
  });

  it('M37B: select é lista visível (size) — opções filtradas aparecem sem expandir', () => {
    const { rv, bAvail } = makeFormFixture();
    const html = renderCorrectForm(rv, bAvail, 'silva');
    expect(html).toContain('size="8"');
  });
});
});