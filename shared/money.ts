const MAX_WHOLE_DIGITS = 8;

export function parseUsdToCents(input: string): number | null {
  const raw = input.trim().replace(/[$\s]/g, '');
  let cleaned = raw;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw)) cleaned = raw.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(raw)) cleaned = raw.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  if (whole.length > MAX_WHOLE_DIGITS) return null;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export function formatUsd(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = `${whole.toLocaleString('en-US')}.${String(frac).padStart(2, '0')}`;
  return `${negative ? '-' : ''}$${body}`;
}

export function centsToInput(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0')}`;
}
