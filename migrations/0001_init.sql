CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_login_attempts_ip ON login_attempts (ip, created_at);

CREATE TABLE statements (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  title TEXT NOT NULL,
  share_count INTEGER NOT NULL,
  total_income_cents INTEGER NOT NULL,
  total_expense_cents INTEGER NOT NULL,
  total_profit_cents INTEGER NOT NULL,
  dividend_cents INTEGER NOT NULL,
  remainder_cents INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_statements_date ON statements (entry_date DESC, created_at DESC);

CREATE TABLE shareholders (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  income_cents INTEGER NOT NULL,
  expense_cents INTEGER NOT NULL,
  dividend_cents INTEGER NOT NULL,
  profit_cents INTEGER NOT NULL
);

CREATE INDEX idx_shareholders_statement ON shareholders (statement_id, position);

CREATE TABLE cash_lines (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  person_name TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX idx_cash_lines_statement ON cash_lines (statement_id, kind, position);
