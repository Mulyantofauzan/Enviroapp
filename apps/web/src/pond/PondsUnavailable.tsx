import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button';
import { usePond } from './PondContext';

/** Shown when there is no pond to pick: either the list failed to load, or there really are none. */
export function PondsUnavailable() {
  const { error, reload } = usePond();
  const { user } = useAuth();
  if (error) {
    return (
      <section className="ui-card ui-stack">
        <p className="ui-error" role="alert">{error}</p>
        <Button variant="outline" onClick={reload}>Coba lagi</Button>
      </section>
    );
  }
  return (
    <section className="ui-card ui-stack">
      <p className="ui-muted">Belum ada settling pond aktif. Minta admin menambahkannya di menu Master.</p>
      {user?.role === 'Admin' && <Link to="/master" className="ui-link">Buka Master</Link>}
    </section>
  );
}
