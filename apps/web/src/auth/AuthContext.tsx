import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@evo/shared';
import { api, post, setUnauthorizedHandler } from '../api/client';
import { clearReadCache } from '../api/readCache';

export type User = { id: string; name: string; role: Role };
type Ctx = { user: User | null; loading: boolean; login(email: string, pw: string): Promise<void>; logout(): Promise<void> };

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); void clearReadCache(); });
    api<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value: Ctx = {
    user,
    loading,
    async login(email, password) {
      const u = await post<User>('/auth/login', { email, password });
      await clearReadCache();
      setUser(u);
    },
    async logout() {
      await post('/auth/logout', {}).catch(() => {});
      // The read cache holds this person's days and events; the outbox stays until its owner signs in again.
      await clearReadCache();
      setUser(null);
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
