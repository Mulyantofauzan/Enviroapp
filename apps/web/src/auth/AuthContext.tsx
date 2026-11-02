import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@evo/shared';
import { api, post, setUnauthorizedHandler } from '../api/client';

export type User = { id: string; name: string; role: Role };
type Ctx = { user: User | null; loading: boolean; login(email: string, pw: string): Promise<void>; logout(): Promise<void> };

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value: Ctx = {
    user,
    loading,
    async login(email, password) {
      setUser(await post<User>('/auth/login', { email, password }));
    },
    async logout() {
      await post('/auth/logout', {}).catch(() => {});
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
