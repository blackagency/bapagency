import { calculate, type Calculation, type NormalizedLine } from './calculate';

export type { NormalizedLine };
import { parseUsdToCents } from './money';

export interface DraftLine {
  amount: string;
  personName: string;
}

export interface DraftStatement {
  entryDate: string;
  title: string;
  shareholders: string[];
  incomes: DraftLine[];
  expenses: DraftLine[];
}

export interface NormalizedStatement {
  entryDate: string;
  title: string;
  shareholders: string[];
  incomes: NormalizedLine[];
  expenses: NormalizedLine[];
  calculation: Calculation;
}

export type ParseLevel = 'incomplete' | 'invalid';

export type ParseResult =
  | { ok: true; value: NormalizedStatement }
  | { ok: false; error: string; level: ParseLevel };

const MAX_SHARES = 30;
const MAX_LINES = 40;
const MAX_NAME = 60;
const MAX_TITLE = 120;

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function fail(error: string, level: ParseLevel): { ok: false; error: string; level: ParseLevel } {
  return { ok: false, error, level };
}

function normalizeLines(
  lines: DraftLine[],
  names: Set<string>,
  mode: 'preview' | 'save',
  label: 'chi' | 'thu',
): { ok: true; lines: NormalizedLine[] } | { ok: false; error: string; level: ParseLevel } {
  if (lines.length > MAX_LINES) {
    return fail(`Tối đa ${MAX_LINES} dòng ${label}`, 'invalid');
  }

  const normalized: NormalizedLine[] = [];
  for (const line of lines) {
    const amount = line.amount.trim();
    const personName = cleanText(line.personName);
    if (!amount && !personName) continue;

    if (!amount || !personName || (mode === 'preview' && /^\d+[.,]$/.test(amount))) {
      const level = mode === 'preview' ? 'incomplete' : 'invalid';
      return fail(`Nhập đủ số tiền USD và người cho khoản ${label}`, level);
    }

    const amountCents = parseUsdToCents(amount);
    if (amountCents === null) {
      return fail(`Số tiền ${label} phải là USD lớn hơn 0, tối đa 2 chữ số thập phân`, 'invalid');
    }
    if (!names.has(personName)) {
      return fail(`"${personName}" chưa có trong danh sách cổ phần`, 'invalid');
    }
    normalized.push({ amountCents, personName });
  }

  return { ok: true, lines: normalized };
}

export function parseStatementDraft(input: DraftStatement, mode: 'preview' | 'save'): ParseResult {
  const title = cleanText(input.title);
  if (title.length > MAX_TITLE) return fail('Tên mục tối đa 120 ký tự', 'invalid');
  if (mode === 'save' && !title) return fail('Nhập tên mục', 'invalid');

  const entryDate = input.entryDate.trim();
  if (mode === 'save' && !isIsoDate(entryDate)) return fail('Ngày không hợp lệ', 'invalid');

  if (!Array.isArray(input.shareholders) || input.shareholders.length < 1 || input.shareholders.length > MAX_SHARES) {
    return fail(`Số cổ phần từ 1 đến ${MAX_SHARES}`, 'invalid');
  }

  const shareholders = input.shareholders.map(cleanText);
  if (shareholders.some((name) => !name)) {
    const level = mode === 'preview' ? 'incomplete' : 'invalid';
    return fail('Nhập đủ tên từng cổ phần', level);
  }
  if (shareholders.some((name) => name.length > MAX_NAME)) {
    return fail(`Tên cổ phần tối đa ${MAX_NAME} ký tự`, 'invalid');
  }

  const seen = new Set<string>();
  for (const name of shareholders) {
    const key = name.toLocaleLowerCase('vi');
    if (seen.has(key)) return fail(`Tên cổ phần bị trùng: ${name}`, 'invalid');
    seen.add(key);
  }

  const nameSet = new Set(shareholders);
  const incomes = normalizeLines(input.incomes, nameSet, mode, 'thu');
  if (!incomes.ok) return incomes;
  const expenses = normalizeLines(input.expenses, nameSet, mode, 'chi');
  if (!expenses.ok) return expenses;

  return {
    ok: true,
    value: {
      entryDate,
      title,
      shareholders,
      incomes: incomes.lines,
      expenses: expenses.lines,
      calculation: calculate(shareholders, incomes.lines, expenses.lines),
    },
  };
}
