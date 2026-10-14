import type { PersonResult } from '@shared/calculate';

export interface SessionUser {
  username: string;
  today: string;
  timezone: string;
  currency: string;
}

export interface StatementSummary {
  id: string;
  entryDate: string;
  title: string;
  shareCount: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  totalProfitCents: number;
  dividendCents: number;
  remainderCents: number;
  people: PersonResult[];
  createdAt: number;
  updatedAt: number;
}

export interface StatementDetail extends StatementSummary {
  incomes: { amountCents: number; personName: string }[];
  expenses: { amountCents: number; personName: string }[];
}

export interface DraftPayload {
  entryDate: string;
  title: string;
  shareholders: string[];
  incomes: { amount: string; personName: string }[];
  expenses: { amount: string; personName: string }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    credentials: 'same-origin',
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data as T;
}

export const api = {
  me: () => request<SessionUser>('/api/auth/me'),
  login: (username: string, password: string) =>
    request<SessionUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  list: () => request<{ statements: StatementSummary[] }>('/api/statements'),
  get: (id: string) => request<{ statement: StatementDetail }>(`/api/statements/${id}`),
  create: (payload: DraftPayload) =>
    request<{ id: string }>('/api/statements', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: DraftPayload) =>
    request<{ id: string }>(`/api/statements/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string) => request<{ ok: boolean }>(`/api/statements/${id}`, { method: 'DELETE' }),
};
