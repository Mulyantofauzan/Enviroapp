CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','Manager','Operator','Auditor'))
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE settling_ponds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE weather (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  rainfall_mm REAL,
  rain_hours REAL,
  logged_by TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE surface_water (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  sp_id TEXT NOT NULL REFERENCES settling_ponds(id),
  ph_inlet REAL, ph_outlet REAL,
  tss_inlet REAL, tss_outlet REAL,
  debit_inlet_m3s REAL, debit_outlet_m3s REAL,
  logged_by TEXT NOT NULL REFERENCES users(id),
  UNIQUE (date, sp_id)
);
CREATE TABLE coagulant (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  sp_id TEXT NOT NULL REFERENCES settling_ponds(id),
  type TEXT NOT NULL CHECK (type IN ('Tawas Serbuk','Tawas Batu','Kapur')),
  stock_in REAL, stock_out REAL, stock_remaining REAL,
  logged_by TEXT NOT NULL REFERENCES users(id),
  UNIQUE (date, sp_id, type)
);
CREATE TABLE thresholds (
  key TEXT PRIMARY KEY,
  min REAL,
  max REAL
);
