import type { Role } from '@evo/shared';

export type Env = {
  DB: D1Database; EVIDENCE: R2Bucket; BACKUP: R2Bucket;
  VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string;
};
export type SessionUser = { id: string; name: string; role: Role };
export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };
