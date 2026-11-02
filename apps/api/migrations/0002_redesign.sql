ALTER TABLE settling_ponds ADD COLUMN code TEXT;
ALTER TABLE settling_ponds ADD COLUMN latitude REAL;
ALTER TABLE settling_ponds ADD COLUMN longitude REAL;
CREATE UNIQUE INDEX idx_ponds_code ON settling_ponds(code) WHERE code IS NOT NULL;

CREATE TABLE pond_thresholds (
  sp_id TEXT NOT NULL REFERENCES settling_ponds(id),
  key TEXT NOT NULL CHECK (key IN ('ph_outlet','tss_outlet')),
  min REAL,
  max REAL,
  PRIMARY KEY (sp_id, key)
);
DROP TABLE thresholds;

ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
