import { Navigate, Route, Routes } from 'react-router-dom';
import { isAdmin } from '@evo/shared';
import { useAuth } from './auth/AuthContext';
import { TabBar } from './components/TabBar';
import { Login } from './screens/Login';
import { Today } from './screens/Today';
import { History } from './screens/History';
import { Admin } from './screens/Admin';

export function App() {
  const { user, loading, logout } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  if (!user) return <Login />;
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand-sm">EVO</span>
        <button className="link" onClick={logout}>Sign out ({user.name})</button>
      </header>
      <div className="content">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/admin" element={isAdmin(user.role) ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
    </div>
  );
}
