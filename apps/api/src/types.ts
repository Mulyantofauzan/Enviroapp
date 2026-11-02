import type { Role } from '@evo/shared';

export type Env = { DB: D1Database; EVIDENCE: R2Bucket };
export type SessionUser = { id: string; name: string; role: Role };
export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };
