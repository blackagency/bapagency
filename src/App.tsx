import { useEffect, useState } from 'react';
import { api, type SessionUser } from './lib/api';
import { LedgerPage } from './pages/LedgerPage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <main className="login-screen">
        <p className="eyebrow">BAP-Agency</p>
      </main>
    );
  }

  if (!user) return <LoginPage onSuccess={setUser} />;
  return <LedgerPage user={user} onLogout={() => setUser(null)} />;
}
