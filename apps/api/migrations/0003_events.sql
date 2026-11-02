CREATE TABLE event_schedules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('Daily','Weekly','Monthly','Quarterly','Semi-Annual','Annual')),
  start_date TEXT NOT NULL,
  sp_id TEXT REFERENCES settling_ponds(id),
  assigned_to TEXT REFERENCES users(id),
  ended_on TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE event_completions (
  schedule_id TEXT NOT NULL REFERENCES event_schedules(id),
  due_date TEXT NOT NULL,
  completed_by TEXT NOT NULL REFERENCES users(id),
  completed_at TEXT NOT NULL,
  completed_on TEXT NOT NULL,
  PRIMARY KEY (schedule_id, due_date)
);

CREATE TABLE evidences (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES event_schedules(id),
  due_date TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL,
  gps_lat REAL,
  gps_lng REAL,
  taken_at TEXT
);
CREATE INDEX idx_evidences_event ON evidences(schedule_id, due_date);
