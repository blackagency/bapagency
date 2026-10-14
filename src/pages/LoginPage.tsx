import { useState, type FormEvent } from 'react';
import type { SessionUser } from '../lib/api';
import { api } from '../lib/api';

export function LoginPage({ onSuccess }: { onSuccess: (user: SessionUser) => void }) {
  const [username, setUsername] = useState('Admin111');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      onSuccess(await api.login(username.trim(), password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đăng nhập được');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="panel login-card" onSubmit={submit}>
        <div className="brand-mark">BAP</div>
        <p className="eyebrow">Agency ledger</p>
        <h1>BAP-Agency</h1>
        <label>
          Tên đăng nhập
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="alert">{error}</p> : null}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Đang vào...' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
