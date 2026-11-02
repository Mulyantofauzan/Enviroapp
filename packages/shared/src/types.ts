export type Role = 'Admin' | 'Manager' | 'Operator' | 'Auditor';
export const ROLES: Role[] = ['Admin', 'Manager', 'Operator', 'Auditor'];
export type CoagulantType = 'Tawas Serbuk' | 'Tawas Batu' | 'Kapur';
export const COAGULANT_TYPES: CoagulantType[] = ['Kapur', 'Tawas Serbuk', 'Tawas Batu'];
export type Threshold = { min: number | null; max: number | null };
export const THRESHOLD_KEYS = ['ph_outlet', 'tss_outlet'] as const;
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];
