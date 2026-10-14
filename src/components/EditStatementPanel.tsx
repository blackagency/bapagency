import { useState } from 'react';

export interface EditableLine {
  key: string;
  amount: string;
  personName: string;
}

export interface EditableStatement {
  entryDate: string;
  title: string;
  names: string[];
  expenses: EditableLine[];
  incomes: EditableLine[];
}

function blankLine(): EditableLine {
  return { key: crypto.randomUUID(), amount: '', personName: '' };
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function EditStatementPanel({
  value,
  onChange,
}: {
  value: EditableStatement;
  onChange: (next: EditableStatement) => void;
}) {
  const [countText, setCountText] = useState(String(value.names.length));
  const named = value.names.map(clean).filter(Boolean);

  function patch(partial: Partial<EditableStatement>) {
    onChange({ ...value, ...partial });
  }

  function resize(count: number) {
    const nextCount = Math.min(30, Math.max(1, Math.trunc(count)));
    const names = value.names.slice(0, nextCount);
    while (names.length < nextCount) names.push('');
    const removed = new Set(value.names.slice(nextCount).map(clean).filter(Boolean));
    const keep = (lines: EditableLine[]) =>
      lines.map((line) => (removed.has(line.personName) ? { ...line, personName: '' } : line));
    setCountText(String(nextCount));
    onChange({
      ...value,
      names,
      expenses: keep(value.expenses),
      incomes: keep(value.incomes),
    });
  }

  function rename(index: number, nextName: string) {
    const previous = value.names[index] ?? '';
    const names = value.names.map((name, item) => (item === index ? nextName : name));
    const retarget = (lines: EditableLine[]) =>
      lines.map((line) => (clean(previous) && line.personName === previous ? { ...line, personName: nextName } : line));
    onChange({ ...value, names, expenses: retarget(value.expenses), incomes: retarget(value.incomes) });
  }

  function updateLine(kind: 'expenses' | 'incomes', key: string, partial: Partial<EditableLine>) {
    patch({
      [kind]: value[kind].map((line) => (line.key === key ? { ...line, ...partial } : line)),
    });
  }

  return (
    <div className="edit-sheet">
      <div className="grid-2">
        <label>
          Ngày
          <input type="date" value={value.entryDate} onChange={(event) => patch({ entryDate: event.target.value })} required />
        </label>
        <label>
          Tên mục
          <input value={value.title} maxLength={120} onChange={(event) => patch({ title: event.target.value })} />
        </label>
      </div>

      <section className="block">
        <div className="block-head">
          <h2>Cổ phần</h2>
          <div className="stepper">
            <button type="button" aria-label="Giảm cổ phần" onClick={() => resize(value.names.length - 1)}>
              −
            </button>
            <input
              inputMode="numeric"
              aria-label="Số người góp cổ phần"
              value={countText}
              onChange={(event) => setCountText(event.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => {
                const next = Number(countText);
                if (!countText || next < 1) resize(value.names.length);
                else resize(next);
              }}
            />
            <button type="button" aria-label="Tăng cổ phần" onClick={() => resize(value.names.length + 1)}>
              +
            </button>
          </div>
        </div>
        <div className="name-grid">
          {value.names.map((name, index) => (
            <label key={index}>
              Cổ phần {index + 1}
              <input value={name} maxLength={60} onChange={(event) => rename(index, event.target.value)} />
            </label>
          ))}
        </div>
      </section>

      <LineEditor
        title="Chi"
        personLabel="Ai chi"
        lines={value.expenses}
        names={named}
        onAdd={() => patch({ expenses: [...value.expenses, blankLine()] })}
        onUpdate={(key, partial) => updateLine('expenses', key, partial)}
        onRemove={(key) => patch({ expenses: value.expenses.filter((line) => line.key !== key) })}
      />
      <LineEditor
        title="Thu"
        personLabel="Ai thu"
        lines={value.incomes}
        names={named}
        onAdd={() => patch({ incomes: [...value.incomes, blankLine()] })}
        onUpdate={(key, partial) => updateLine('incomes', key, partial)}
        onRemove={(key) => patch({ incomes: value.incomes.filter((line) => line.key !== key) })}
      />
    </div>
  );
}

function LineEditor({
  title,
  personLabel,
  lines,
  names,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  personLabel: string;
  lines: EditableLine[];
  names: string[];
  onAdd: () => void;
  onUpdate: (key: string, partial: Partial<EditableLine>) => void;
  onRemove: (key: string) => void;
}) {
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
              onChange={(event) => onUpdate(line.key, { amount: event.target.value })}
            />
          </label>
          <label>
            {personLabel}
            <select value={line.personName} onChange={(event) => onUpdate(line.key, { personName: event.target.value })}>
              <option value="">Chọn người</option>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {line.personName && !names.includes(line.personName) ? (
                <option value={line.personName}>{line.personName}</option>
              ) : null}
            </select>
          </label>
          <button className="icon-btn" type="button" aria-label={`Xóa dòng ${title} ${index + 1}`} onClick={() => onRemove(line.key)}>
            ×
          </button>
        </div>
      ))}
      <button className="btn btn-ghost" type="button" onClick={onAdd}>
        Thêm khoản
      </button>
    </section>
  );
}
