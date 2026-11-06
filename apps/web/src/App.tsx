import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '@evo/shared';
import { useAuth } from './auth/AuthContext';
import { PondProvider } from './pond/PondContext';
import { homeFor } from './nav/nav';
import { useWide } from './hooks/useWide';
import { TabBar } from './components/TabBar';
import { SideRail } from './components/SideRail';
import { SyncChip } from './ui/SyncChip';
import { startSync } from './lib/outbox/sync';
import { Login } from './screens/Login';
import { Akun } from './screens/Akun';
import { BerandaOperator } from './screens/BerandaOperator';
import { BerandaManager } from './screens/BerandaManager';
import { InputHub } from './screens/InputHub';
import { InputCuaca } from './screens/InputCuaca';
import { InputAir } from './screens/InputAir';
import { Eviden } from './screens/Eviden';
import { Laporan } from './screens/Laporan';
import { Riwayat } from './screens/Riwayat';
import { Pengguna } from './screens/Pengguna';
import { Master } from './screens/Master';
import { KategoriEvent } from './screens/KategoriEvent';
import { ImporEvent } from './screens/ImporEvent';
import { Kalender } from './screens/Kalender';
import { EventDetail } from './screens/EventDetail';
import { AturJadwal } from './screens/AturJadwal';

function RequireRole({ role, allow, children }: { role: Role; allow: Role[]; children: ReactNode }) {
  return allow.includes(role) ? <>{children}</> : <Navigate to={homeFor(role)} replace />;
}

/** Old bookmarks to the separate koagulan screen land on the combined screen, keeping date and pond. */
function KoagulanRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/input/air${search}`} replace />;
}

export function App() {
  const { user, loading } = useAuth();
  const wide = useWide();
  useEffect(() => (user ? startSync(() => user.id) : undefined), [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <p className="ui-loading">Memuat…</p>;
  if (!user) return <Login />;
  const role = user.role;
  const writers: Role[] = ['Operator', 'Admin'];
  return (
    <PondProvider>
      <div className={`ui-shell${wide ? ' ui-shell--wide' : ''}`}>
        {wide && <SideRail role={role} />}
        <main className="ui-main">
          <div className="ui-conn-slot"><SyncChip /></div>
          <Routes>
            <Route path="/" element={role === 'Auditor' ? <Navigate to="/kalender" replace /> : role === 'Manager' || role === 'Admin' ? <BerandaManager /> : <BerandaOperator />} />
            <Route path="/input" element={<RequireRole role={role} allow={writers}><InputHub /></RequireRole>} />
            <Route path="/input/cuaca" element={<RequireRole role={role} allow={writers}><InputCuaca /></RequireRole>} />
            <Route path="/input/air" element={<RequireRole role={role} allow={writers}><InputAir /></RequireRole>} />
            <Route path="/input/koagulan" element={<KoagulanRedirect />} />
            <Route path="/kalender" element={<Kalender />} />
            <Route path="/kalender/jadwal" element={<RequireRole role={role} allow={['Manager', 'Admin']}><AturJadwal /></RequireRole>} />
            <Route path="/kalender/jadwal/impor" element={<RequireRole role={role} allow={['Manager', 'Admin']}><ImporEvent /></RequireRole>} />
            <Route path="/kalender/kategori" element={<RequireRole role={role} allow={['Manager', 'Admin']}><KategoriEvent /></RequireRole>} />
            <Route path="/kalender/:scheduleId/:date" element={<EventDetail />} />
            <Route path="/eviden" element={<Eviden />} />
            <Route path="/laporan" element={<RequireRole role={role} allow={['Manager', 'Admin', 'Auditor']}><Laporan /></RequireRole>} />
            <Route path="/riwayat" element={<Riwayat />} />
            <Route path="/akun" element={<Akun />} />
            <Route path="/pengguna" element={<RequireRole role={role} allow={['Admin']}><Pengguna /></RequireRole>} />
            <Route path="/master" element={<RequireRole role={role} allow={['Admin']}><Master /></RequireRole>} />
            <Route path="*" element={<Navigate to={homeFor(role)} replace />} />
          </Routes>
        </main>
        {!wide && <TabBar role={role} />}
      </div>
    </PondProvider>
  );
}
