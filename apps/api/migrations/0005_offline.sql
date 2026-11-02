ALTER TABLE weather ADD COLUMN client_ts TEXT;
ALTER TABLE surface_water ADD COLUMN client_ts TEXT;
ALTER TABLE coagulant ADD COLUMN client_ts TEXT;
ALTER TABLE evidences ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX idx_evidences_client_id ON evidences(client_id) WHERE client_id IS NOT NULL;
