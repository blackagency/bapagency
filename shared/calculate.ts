export interface NormalizedLine {
  amountCents: number;
  personName: string;
}

export interface PersonResult {
  name: string;
  incomeCents: number;
  expenseCents: number;
  dividendCents: number;
  profitCents: number;
}

export interface Calculation {
  shareCount: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  totalProfitCents: number;
  dividendCents: number;
  remainderCents: number;
  people: PersonResult[];
}

function sumCents(lines: NormalizedLine[]): number {
  return lines.reduce((total, line) => total + line.amountCents, 0);
}

/** Chia số cent, dư 1 cent lần lượt cho người đứng trước. Tổng các phần bằng đúng tổng gốc. */
export function divideCents(total: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error('Số cổ phần phải lớn hơn 0');
  }
  const base = Math.trunc(total / parts);
  let remainder = total - base * parts;
  const shares = Array.from({ length: parts }, () => base);
  const step = remainder > 0 ? 1 : -1;
  let index = 0;
  while (remainder !== 0) {
    shares[index] += step;
    remainder -= step;
    index += 1;
  }
  return shares;
}

function totalFor(lines: NormalizedLine[], name: string): number {
  return lines.reduce((total, line) => (line.personName === name ? total + line.amountCents : total), 0);
}

/**
 * Tổng lãi = tổng thu − tổng chi.
 * Cổ tức = tổng lãi / số cổ phần.
 * Lợi nhuận từng người = cổ tức − thu của người đó + chi của người đó.
 */
export function calculate(shareholders: string[], incomes: NormalizedLine[], expenses: NormalizedLine[]): Calculation {
  const shareCount = shareholders.length;
  const totalIncomeCents = sumCents(incomes);
  const totalExpenseCents = sumCents(expenses);
  const totalProfitCents = totalIncomeCents - totalExpenseCents;
  const dividends = divideCents(totalProfitCents, shareCount);
  const dividendCents = dividends[0] ?? 0;
  const remainderCents = totalProfitCents - dividendCents * shareCount;

  const people = shareholders.map((name, index) => {
    const incomeCents = totalFor(incomes, name);
    const expenseCents = totalFor(expenses, name);
    const share = dividends[index] ?? 0;
    return {
      name,
      incomeCents,
      expenseCents,
      dividendCents: share,
      profitCents: share - incomeCents + expenseCents,
    };
  });

  return {
    shareCount,
    totalIncomeCents,
    totalExpenseCents,
    totalProfitCents,
    dividendCents,
    remainderCents,
    people,
  };
}
