import type { Calculation } from '@shared/calculate';
import { formatUsd } from '@shared/money';

export function ResultsPanel({
  calculation,
  message,
  tone,
}: {
  calculation: Calculation | null;
  message: string;
  tone: 'idle' | 'bad';
}) {
  if (!calculation) {
    return (
      <section className="panel results-card">
        <p className="eyebrow">Kết quả</p>
        <h2>Chưa đủ dữ liệu</h2>
        <p className={tone === 'bad' ? 'alert' : 'hint'}>{message}</p>
        <Formula />
      </section>
    );
  }

  const profit = calculation.totalProfitCents;
  const uneven = calculation.people.some((person) => person.dividendCents !== calculation.dividendCents);

  return (
    <section className="panel results-card">
      <p className="eyebrow">Kết quả · USD</p>
      <h2>{profit > 0 ? 'Có lãi' : profit < 0 ? 'Đang lỗ' : 'Hòa vốn'}</h2>
      <div className="stat-grid">
        <article className="stat">
          <span>Tổng thu</span>
          <strong>{formatUsd(calculation.totalIncomeCents)}</strong>
        </article>
        <article className="stat">
          <span>Tổng chi</span>
          <strong>{formatUsd(calculation.totalExpenseCents)}</strong>
        </article>
        <article className={`stat ${profit < 0 ? 'loss' : 'gain'}`}>
          <span>Tổng lãi</span>
          <strong>{formatUsd(profit)}</strong>
        </article>
        <article className="stat">
          <span>Cổ tức</span>
          <strong>{formatUsd(calculation.dividendCents)}</strong>
        </article>
      </div>
      {uneven ? (
        <p className="hint">
          Tổng lãi không chia hết từng cent. Phần dư được cộng lần lượt cho người đứng trước để sổ cân bằng về $0.00.
        </p>
      ) : null}
      <div className="people">
        {calculation.people.map((person) => (
          <article key={person.name} className="person">
            <header>
              <h3>{person.name}</h3>
              <strong className={person.profitCents < 0 ? 'loss-text' : 'gain-text'}>
                {formatUsd(person.profitCents)}
              </strong>
            </header>
            <p>
              Cổ tức {formatUsd(person.dividendCents)} − Thu {formatUsd(person.incomeCents)} + Chi{' '}
              {formatUsd(person.expenseCents)}
            </p>
            <p className="person-note">
              {person.profitCents > 0
                ? 'Được nhận thêm'
                : person.profitCents < 0
                  ? 'Cần đưa ra'
                  : 'Đã cân bằng'}
            </p>
          </article>
        ))}
      </div>
      <Formula />
    </section>
  );
}

function Formula() {
  return (
    <div className="formula">
      <p>Tổng lãi = tổng thu − tổng chi</p>
      <p>Cổ tức = tổng lãi / số cổ phần</p>
      <p>Lợi nhuận từng người = cổ tức − thu của người đó + chi của người đó</p>
    </div>
  );
}
