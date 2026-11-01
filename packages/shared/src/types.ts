export type Role = 'Admin' | 'Manager' | 'Operator' | 'Auditor';
export const ROLES: Role[] = ['Admin', 'Manager', 'Operator', 'Auditor'];
export type CoagulantType = 'Tawas Serbuk' | 'Tawas Batu' | 'Kapur';
export const COAGULANT_TYPES: CoagulantType[] = ['Tawas Serbuk', 'Tawas Batu', 'Kapur'];
export type Threshold = { min: number | null; max: number | null };
export const THRESHOLD_KEYS = ['ph_inlet', 'ph_outlet', 'tss_inlet', 'tss_outlet'] as const;
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];
