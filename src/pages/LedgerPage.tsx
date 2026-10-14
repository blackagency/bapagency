import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { centsToInput, formatUsd } from '@shared/money';
import { parseStatementDraft } from '@shared/parse';
import { EditStatementPanel } from '../components/EditStatementPanel';
import { ResultsPanel } from '../components/ResultsPanel';
import { api, type SessionUser, type StatementSummary } from '../lib/api';

interface LineDraft {
  key: string;
  amount: string;
  personName: string;
}

function blankLine(): LineDraft {
  return { key: crypto.randomUUID(), amount: '', personName: '' };
}

function formatVnDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function prune(lines: LineDraft[], names: string[]): LineDraft[] {
  const known = new Set(names.map((name) => name.replace(/\s+/g, ' ').trim()).filter(Boolean));
  return lines.map((line) => (known.has(line.personName) ? line : { ...line, personName: '' }));
}

export function LedgerPage({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [entryDate, setEntryDate] = useState(user.today);
  const [title, setTitle] = useState('');
  const [names, setNames] = useState(['', '']);
  const [countText, setCountText] = useState('2');
  const [expenses, setExpenses] = useState<LineDraft[]>([blankLine()]);
  const [incomes, setIncomes] = useState<LineDraft[]>([blankLine()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const named = names.map((name) => name.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const draft = useMemo(
    () => ({
      entryDate,
      title,
      shareholders: names,
      incomes: incomes.map(({ amount, personName }) => ({ amount, personName })),
      expenses: expenses.map(({ amount, personName }) => ({ amount, personName })),
    }),
    [entryDate, title, names, incomes, expenses],
  );

  const preview = useMemo(() => parseStatementDraft(draft, 'preview'), [draft]);

  async function refresh() {
    const data = await api.list();
    setStatements(data.statements);
  }

  useEffect(() => {
    void refresh().catch((cause: unknown) => {
      setFormError(cause instanceof Error ? cause.message : 'Không tải được sổ');
    });
  }, []);

  function resizeShares(next: number) {
    const count = Math.min(30, Math.max(1, Math.trunc(next)));
    const resized = names.slice(0, count);
    while (resized.length < count) resized.push('');
    setNames(resized);
    setCountText(String(count));
    setExpenses((lines) => prune(lines, resized));
    setIncomes((lines) => prune(lines, resized));
  }

  function updateName(index: number, value: string) {
    const resized = names.map((name, item) => (item === index ? value : name));
    setNames(resized);
    setExpenses((lines) => prune(lines, resized));
    setIncomes((lines) => prune(lines, resized));
  }

  function resetForm() {
    setEditingId(null);
    setEntryDate(user.today);
    setTitle('');
    setNames(['', '']);
    setCountText('2');
    setExpenses([blankLine()]);
    setIncomes([blankLine()]);
    setFormError('');
    setNotice('');
  }

  async function editStatement(id: string) {
    setFormError('');
    setNotice('');
    try {
      const { statement } = await api.get(id);
      const shareholders = statement.people.map((person) => person.name);
      setEditingId(statement.id);
      setEntryDate(statement.entryDate);
      setTitle(statement.title);
      setNames(shareholders);
      setCountText(String(shareholders.length));
      setExpenses(
        statement.expenses.length
          ? statement.expenses.map((line) => ({
              key: crypto.randomUUID(),
              amount: centsToInput(line.amountCents),
              personName: line.personName,
            }))
          : [blankLine()],
      );
      setIncomes(
        statement.incomes.length
          ? statement.incomes.map((line) => ({
              key: crypto.randomUUID(),
              amount: centsToInput(line.amountCents),
              personName: line.personName,
            }))
          : [blankLine()],
      );
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Không mở được phiếu');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseStatementDraft(draft, 'save');
    if (!parsed.ok) {
      setFormError(parsed.error);
      setNotice('');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api.update(editingId, draft);
        setNotice('Đã cập nhật phiếu');
      } else {
        const created = await api.create(draft);
        setEditingId(created.id);
        setNotice('Đã lưu phiếu');
      }
      await refresh();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Xóa phiếu này?')) return;
    setFormError('');
    try {
      await api.remove(id);
      if (editingId === id) resetForm();
      setNotice('Đã xóa phiếu');
      await refresh();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Không xóa được');
    }
  }

  async function logout() {
    await api.logout();
    onLogout();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">BAP</span>
          <div>
            <strong>BAP-Agency</strong>
          </div>
        </div>
        <div className="top-actions">
          <span className="today">Hôm nay {formatVnDate(user.today)} · ICT</span>
          <span className="user-pill">{user.username}</span>
          <button className="btn btn-ghost" type="button" onClick={() => void logout()}>
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="workspace">
        <form className="panel entry-form" onSubmit={(event) => void save(event)}>
          <div className="form-head">
            <div>
              <p className="eyebrow">{editingId ? 'Sửa phiếu' : 'Phiếu mới'}</p>
              <h1>{editingId ? 'Sửa phiếu' : 'Nhập phát sinh'}</h1>
            </div>
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Phiếu mới
            </button>
          </div>

          {editingId ? (
            <EditStatementPanel
              key={editingId}
              value={{ entryDate, title, names, expenses, incomes }}
              onChange={(next) => {
                setEntryDate(next.entryDate);
                setTitle(next.title);
                setNames(next.names);
                setCountText(String(next.names.length));
                setExpenses(next.expenses);
                setIncomes(next.incomes);
              }}
            />
          ) : (
            <>
          <div className="grid-2">
            <label>
              Ngày
              <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
            </label>
            <label>
              Tên mục
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ví dụ: Deal khách A"
                maxLength={120}
              />
            </label>
          </div>

          <section className="block">
            <div className="block-head">
              <h2>Cổ phần</h2>
              <div className="stepper">
                <button type="button" onClick={() => resizeShares(names.length - 1)} aria-label="Giảm cổ phần">
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label="Số người góp cổ phần"
                  value={countText}
                  onChange={(event) => setCountText(event.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => {
                    const next = Number(countText);
                    if (!countText || next < 1) resizeShares(names.length);
                    else resizeShares(next);
                  }}
                />
                <button type="button" onClick={() => resizeShares(names.length + 1)} aria-label="Tăng cổ phần">
                  +
                </button>
              </div>
            </div>
            <div className="name-grid">
              {names.map((name, index) => (
                <label key={index}>
                  Cổ phần {index + 1}
                  <input
                    value={name}
                    onChange={(event) => updateName(index, event.target.value)}
                    placeholder={`Tên người ${index + 1}`}
                    maxLength={60}
                  />
                </label>
              ))}
            </div>
          </section>

          <MoneyBlock
            title="Chi"
            personLabel="Ai chi"
            lines={expenses}
            names={named}
            onChange={setExpenses}
          />
          <MoneyBlock
            title="Thu"
            personLabel="Ai thu"
            lines={incomes}
            names={named}
            onChange={setIncomes}
          />
            </>
          )}

          {formError ? <p className="alert">{formError}</p> : null}
          {notice ? <p className="notice">{notice}</p> : null}

          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Đang lưu...' : editingId ? 'Cập nhật phiếu' : 'Lưu phiếu'}
          </button>
        </form>

        <div className="side">
          <ResultsPanel
            calculation={preview.ok ? preview.value.calculation : null}
            message={preview.ok ? '' : preview.error}
            tone={!preview.ok && preview.level === 'invalid' ? 'bad' : 'idle'}
          />
          <section className="panel history">
            <p className="eyebrow">Phiếu cũ</p>
            <h2>Sửa phiếu đã lưu</h2>
            {statements.length === 0 ? <p className="hint">Chưa có phiếu nào.</p> : null}
            <div className="history-list">
              {statements.map((statement) => (
                <article key={statement.id} className={statement.id === editingId ? 'history-item active' : 'history-item'}>
                  <button type="button" className="history-open" onClick={() => void editStatement(statement.id)}>
                    <span>{formatVnDate(statement.entryDate)}</span>
                    <strong>{statement.title}</strong>
                    <em className={statement.totalProfitCents < 0 ? 'loss-text' : 'gain-text'}>
                      {formatUsd(statement.totalProfitCents)}
                    </em>
                  </button>
                  <p>{statement.people.map((person) => `${person.name} ${formatUsd(person.profitCents)}`).join(' · ')}</p>
                  <div className="history-actions">
                    <button className="btn btn-ghost" type="button" onClick={() => void editStatement(statement.id)}>
                      Sửa
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => void remove(statement.id)}>
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MoneyBlock({
  title,
  personLabel,
  lines,
  names,
  onChange,
}: {
  title: string;
  personLabel: string;
  lines: LineDraft[];
  names: string[];
  onChange: (lines: LineDraft[]) => void;
}) {
  function update(key: string, patch: Partial<LineDraft>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <section className="block">
      <div className="block-head">
        <h2>{title}</h2>
      </div>
      {lines.map((line, index) => (
        <div className="line-row" key={line.key}>
          <label>
            USD
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={line.amount}
              onChange={(event) => update(line.key, { amount: event.target.value })}
            />
          </label>
          <label>
            {personLabel}
            <select value={line.personName} onChange={(event) => update(line.key, { personName: event.target.value })}>
              <option value="">Chọn người</option>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-btn"
            type="button"
            aria-label={`Xóa dòng ${title} ${index + 1}`}
            onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
          >
            ×
          </button>
        </div>
      ))}
      <button className="btn btn-ghost" type="button" onClick={() => onChange([...lines, blankLine()])}>
        Thêm khoản
      </button>
    </section>
  );
}
