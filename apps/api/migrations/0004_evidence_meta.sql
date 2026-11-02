ALTER TABLE evidences ADD COLUMN source TEXT NOT NULL DEFAULT 'gallery';
ALTER TABLE evidences ADD COLUMN gps_accuracy REAL;
