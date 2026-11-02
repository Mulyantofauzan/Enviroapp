import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { canWrite } from '@evo/shared';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useDay } from '../hooks/useDay';
import { useThresholds } from '../hooks/useThresholds';
import { PondChips, type Pond } from '../components/PondChips';
import { DayForm } from './DayForm';

const localToday = () => new Date().toLocaleDateString('en-CA');

export function Today() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || localToday();
  const [ponds, setPonds] = useState<Pond[] | null>(null);
  const sp = params.get('sp') || ponds?.[0]?.id || null;
  const thresholds = useThresholds();
  const { data, error, reload, version } = useDay(date, sp);

  useEffect(() => { api<Pond[]>('/ponds').then(setPonds).catch((e) => { setPonds([]); toast(e.message); }); }, []); // eslint-disable-line

  if (ponds === null) return <p className="muted center">Loading…</p>;
  if (ponds.length === 0) return <p className="muted center">No active ponds yet. Ask an admin to add one.</p>;

  const pondIsActive = !!sp && ponds.some((p) => p.id === sp);
  const canEdit = !!user && canWrite(user.role) && pondIsActive;
  const setQuery = (patch: Record<string, string>) => setParams({ date, ...(sp ? { sp } : {}), ...patch }, { replace: true });

  return (
    <div className="stack today">
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setQuery({ date: e.target.value })} />
      </label>
      <PondChips ponds={ponds} value={pondIsActive ? sp : null} onChange={(id) => setQuery({ sp: id })} />
      {!pondIsActive && <p className="muted">This pond is switched off. You can read this day but not change it.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <p className="muted">Loading day…</p>}
      {data && sp && (
        <DayForm key={`${date}|${sp}|${version}`} date={date} sp={sp} data={data} thresholds={thresholds} canEdit={canEdit} onSaved={reload} />
      )}
    </div>
  );
}
