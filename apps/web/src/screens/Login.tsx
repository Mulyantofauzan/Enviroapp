import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button';
import { allItems, outboxAvailable } from '../lib/outbox/db';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    if (outboxAvailable()) allItems().then((x) => setWaiting(x.length)).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ui-login">
      <img className="ui-login__logo" src="/logo.png" srcSet="/logo.png 1x, /logo@2x.png 2x" width="96" height="96" alt="" />
      <h1>EVOS</h1>
      <p>Environment Operation System</p>
      {waiting > 0 && <p className="ui-muted" role="status">Ada {waiting} data belum terunggah di HP ini. Masuk dengan akun pemiliknya untuk mengunggah.</p>}
      <form onSubmit={submit} className="ui-login__form">
        <label>
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          <span>Kata sandi</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <Button type="submit" block disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</Button>
        {error && <p className="ui-login__error" role="alert">{error}</p>}
      </form>
    </main>
  );
}
