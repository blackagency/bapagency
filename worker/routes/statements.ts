import { Hono } from 'hono';
import type { PersonResult } from '../../shared/calculate';
import { parseStatementDraft, type DraftStatement, type NormalizedLine } from '../../shared/parse';
import type { AppEnv } from './auth';
import { readAuth } from './auth';
import { TIMEZONE, todayInTimeZone } from '../lib/time';

interface StatementRow {
  id: string;
  entry_date: string;
  title: string;
  share_count: number;
  total_income_cents: number;
  total_expense_cents: number;
  total_profit_cents: number;
  dividend_cents: number;
  remainder_cents: number;
  created_at: number;
  updated_at: number;
}

interface PersonRow {
  statement_id: string;
  position: number;
  name: string;
  income_cents: number;
  expense_cents: number;
  dividend_cents: number;
  profit_cents: number;
}

interface LineRow {
  statement_id: string;
  kind: 'income' | 'expense';
  amount_cents: number;
  person_name: string;
  position: number;
}

function asDraft(body: unknown, fallbackDate: string): DraftStatement | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const lines = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value.map((line) => {
      const item = line as Record<string, unknown>;
      return {
        amount: typeof item?.amount === 'string' ? item.amount : '',
        personName: typeof item?.personName === 'string' ? item.personName : '',
      };
    });
  };
  return {
    entryDate: typeof record.entryDate === 'string' && record.entryDate.trim() ? record.entryDate : fallbackDate,
    title: typeof record.title === 'string' ? record.title : '',
    shareholders: Array.isArray(record.shareholders)
      ? record.shareholders.filter((name): name is string => typeof name === 'string')
      : [],
    incomes: lines(record.incomes),
    expenses: lines(record.expenses),
  };
}

function personView(row: PersonRow): PersonResult {
  return {
    name: row.name,
    incomeCents: row.income_cents,
    expenseCents: row.expense_cents,
    dividendCents: row.dividend_cents,
    profitCents: row.profit_cents,
  };
}

function summary(row: StatementRow, people: PersonRow[]) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    title: row.title,
    shareCount: row.share_count,
    totalIncomeCents: row.total_income_cents,
    totalExpenseCents: row.total_expense_cents,
    totalProfitCents: row.total_profit_cents,
    dividendCents: row.dividend_cents,
    remainderCents: row.remainder_cents,
    people: people.map(personView),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function lineView(row: LineRow): NormalizedLine {
  return { amountCents: row.amount_cents, personName: row.person_name };
}

async function requireUser(c: { env: AppEnv['Bindings']; req: { raw: Request }; json: (data: unknown, status?: number) => Response }) {
  if (await readAuth(c.env, c.req.raw)) return true;
  return false;
}

export const statementRoutes = new Hono<AppEnv>();

statementRoutes.use('*', async (c, next) => {
  if (!(await requireUser(c))) return c.json({ error: 'Chưa đăng nhập' }, 401);
  await next();
});

statementRoutes.get('/', async (c) => {
  const listed = await c.env.DB.prepare(
    `SELECT id, entry_date, title, share_count, total_income_cents, total_expense_cents,
            total_profit_cents, dividend_cents, remainder_cents, created_at, updated_at
     FROM statements
     ORDER BY entry_date DESC, created_at DESC
     LIMIT 100`,
  ).all<StatementRow>();
  const rows = listed.results ?? [];
  if (rows.length === 0) return c.json({ statements: [] });

  const marks = rows.map(() => '?').join(',');
  const people = await c.env.DB.prepare(
    `SELECT statement_id, position, name, income_cents, expense_cents, dividend_cents, profit_cents
     FROM shareholders
     WHERE statement_id IN (${marks})
     ORDER BY position`,
  )
    .bind(...rows.map((row) => row.id))
    .all<PersonRow>();

  const grouped = new Map<string, PersonRow[]>();
  for (const person of people.results ?? []) {
    const list = grouped.get(person.statement_id) ?? [];
    list.push(person);
    grouped.set(person.statement_id, list);
  }

  return c.json({ statements: rows.map((row) => summary(row, grouped.get(row.id) ?? [])) });
});

statementRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT id, entry_date, title, share_count, total_income_cents, total_expense_cents,
            total_profit_cents, dividend_cents, remainder_cents, created_at, updated_at
     FROM statements WHERE id = ?`,
  )
    .bind(id)
    .first<StatementRow>();
  if (!row) return c.json({ error: 'Không tìm thấy phiếu' }, 404);

  const [people, lines] = await Promise.all([
    c.env.DB.prepare(
      `SELECT statement_id, position, name, income_cents, expense_cents, dividend_cents, profit_cents
       FROM shareholders WHERE statement_id = ? ORDER BY position`,
    )
      .bind(id)
      .all<PersonRow>(),
    c.env.DB.prepare(
      `SELECT statement_id, kind, amount_cents, person_name, position
       FROM cash_lines WHERE statement_id = ? ORDER BY kind, position`,
    )
      .bind(id)
      .all<LineRow>(),
  ]);

  const allLines = lines.results ?? [];
  return c.json({
    statement: {
      ...summary(row, people.results ?? []),
      incomes: allLines.filter((line) => line.kind === 'income').map(lineView),
      expenses: allLines.filter((line) => line.kind === 'expense').map(lineView),
    },
  });
});

function persist(env: AppEnv['Bindings'], id: string, createdAt: number, draft: DraftStatement) {
  const parsed = parseStatementDraft(draft, 'save');
  if (!parsed.ok) return parsed;

  const now = Date.now();
  const calc = parsed.value.calculation;
  const statements = [
    env.DB.prepare('DELETE FROM cash_lines WHERE statement_id = ?').bind(id),
    env.DB.prepare('DELETE FROM shareholders WHERE statement_id = ?').bind(id),
    env.DB.prepare(
      `INSERT INTO statements (
        id, entry_date, title, share_count, total_income_cents, total_expense_cents,
        total_profit_cents, dividend_cents, remainder_cents, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        entry_date = excluded.entry_date,
        title = excluded.title,
        share_count = excluded.share_count,
        total_income_cents = excluded.total_income_cents,
        total_expense_cents = excluded.total_expense_cents,
        total_profit_cents = excluded.total_profit_cents,
        dividend_cents = excluded.dividend_cents,
        remainder_cents = excluded.remainder_cents,
        updated_at = excluded.updated_at`,
    ).bind(
      id,
      parsed.value.entryDate,
      parsed.value.title,
      calc.shareCount,
      calc.totalIncomeCents,
      calc.totalExpenseCents,
      calc.totalProfitCents,
      calc.dividendCents,
      calc.remainderCents,
      createdAt,
      now,
    ),
  ];

  calc.people.forEach((person, index) => {
    statements.push(
      env.DB.prepare(
        `INSERT INTO shareholders (
          id, statement_id, position, name, income_cents, expense_cents, dividend_cents, profit_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        id,
        index,
        person.name,
        person.incomeCents,
        person.expenseCents,
        person.dividendCents,
        person.profitCents,
      ),
    );
  });

  const insertLine = (kind: 'income' | 'expense', line: NormalizedLine, index: number) => {
    statements.push(
      env.DB.prepare(
        `INSERT INTO cash_lines (id, statement_id, kind, amount_cents, person_name, position)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), id, kind, line.amountCents, line.personName, index),
    );
  };
  parsed.value.incomes.forEach((line, index) => insertLine('income', line, index));
  parsed.value.expenses.forEach((line, index) => insertLine('expense', line, index));

  return { ok: true as const, statements, id };
}

statementRoutes.post('/', async (c) => {
  const fallback = todayInTimeZone(c.env.TIMEZONE || TIMEZONE);
  const draft = asDraft(await c.req.json().catch(() => null), fallback);
  if (!draft) return c.json({ error: 'Dữ liệu không hợp lệ' }, 400);
  const saved = persist(c.env, crypto.randomUUID(), Date.now(), draft);
  if (!saved.ok) return c.json({ error: saved.error }, 400);
  await c.env.DB.batch(saved.statements);
  return c.json({ id: saved.id }, 201);
});

statementRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT created_at FROM statements WHERE id = ?')
    .bind(id)
    .first<{ created_at: number }>();
  if (!existing) return c.json({ error: 'Không tìm thấy phiếu' }, 404);

  const fallback = todayInTimeZone(c.env.TIMEZONE || TIMEZONE);
  const draft = asDraft(await c.req.json().catch(() => null), fallback);
  if (!draft) return c.json({ error: 'Dữ liệu không hợp lệ' }, 400);
  const saved = persist(c.env, id, existing.created_at, draft);
  if (!saved.ok) return c.json({ error: saved.error }, 400);
  await c.env.DB.batch(saved.statements);
  return c.json({ id });
});

statementRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM statements WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Không tìm thấy phiếu' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM cash_lines WHERE statement_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM shareholders WHERE statement_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM statements WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});
