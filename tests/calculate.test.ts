import { describe, expect, it } from 'vitest';
import { calculate, divideCents } from '../shared/calculate';
import { formatUsd, parseUsdToCents } from '../shared/money';
import { parseStatementDraft } from '../shared/parse';

describe('money', () => {
  it('parses USD into cents', () => {
    expect(parseUsdToCents('100')).toBe(10000);
    expect(parseUsdToCents('$1,250.50')).toBe(125050);
    expect(parseUsdToCents('100,50')).toBe(10050);
    expect(parseUsdToCents('0')).toBeNull();
    expect(parseUsdToCents('10.999')).toBeNull();
    expect(parseUsdToCents('-5')).toBeNull();
  });

  it('formats signed USD', () => {
    expect(formatUsd(20000)).toBe('$200.00');
    expect(formatUsd(-20000)).toBe('-$200.00');
    expect(formatUsd(16666)).toBe('$166.66');
  });
});

describe('divideCents', () => {
  it('keeps the exact total when the split is uneven', () => {
    expect(divideCents(50000, 3)).toEqual([16667, 16667, 16666]);
    expect(divideCents(-5, 2)).toEqual([-3, -2]);
  });
});

describe('calculate', () => {
  it('settles two shareholders from income and expense', () => {
    const result = calculate(
      ['An', 'Bình'],
      [{ amountCents: 30000, personName: 'Bình' }],
      [{ amountCents: 10000, personName: 'An' }],
    );

    expect(result.totalIncomeCents).toBe(30000);
    expect(result.totalExpenseCents).toBe(10000);
    expect(result.totalProfitCents).toBe(20000);
    expect(result.dividendCents).toBe(10000);
    expect(result.people.map((person) => person.profitCents)).toEqual([20000, -20000]);
    expect(result.people.reduce((sum, person) => sum + person.profitCents, 0)).toBe(0);
  });

  it('sums repeated lines and distributes leftover cents', () => {
    const result = calculate(
      ['An', 'Bình', 'Chi'],
      [
        { amountCents: 50000, personName: 'An' },
        { amountCents: 20000, personName: 'Bình' },
      ],
      [
        { amountCents: 15000, personName: 'Bình' },
        { amountCents: 5000, personName: 'Chi' },
      ],
    );

    expect(result.totalProfitCents).toBe(50000);
    expect(result.people.map((person) => person.dividendCents)).toEqual([16667, 16667, 16666]);
    expect(result.people.map((person) => person.profitCents)).toEqual([-33333, 11667, 21666]);
    expect(result.people.reduce((sum, person) => sum + person.profitCents, 0)).toBe(0);
  });

  it('shows a loss when expenses exceed income', () => {
    const result = calculate(
      ['An', 'Bình'],
      [{ amountCents: 5000, personName: 'An' }],
      [{ amountCents: 8000, personName: 'Bình' }],
    );
    expect(result.totalProfitCents).toBe(-3000);
    expect(result.people[0]?.profitCents).toBe(-1500 - 5000);
    expect(result.people[1]?.profitCents).toBe(-1500 + 8000);
  });
});

describe('parseStatementDraft', () => {
  const base = {
    entryDate: '2026-10-15',
    title: 'Deal A',
    shareholders: ['An', 'Bình'],
    incomes: [{ amount: '300', personName: 'Bình' }],
    expenses: [{ amount: '100', personName: 'An' }],
  };

  it('accepts a complete statement', () => {
    const parsed = parseStatementDraft(base, 'save');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.calculation.totalProfitCents).toBe(20000);
  });

  it('waits for every shareholder name in preview', () => {
    const parsed = parseStatementDraft({ ...base, shareholders: ['An', ''] }, 'preview');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.level).toBe('incomplete');
  });

  it('rejects a payer outside the shareholder list', () => {
    const parsed = parseStatementDraft(
      { ...base, expenses: [{ amount: '100', personName: 'Lan' }] },
      'save',
    );
    expect(parsed.ok).toBe(false);
  });
});
