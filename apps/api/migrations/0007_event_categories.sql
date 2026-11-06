CREATE TABLE event_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_event_categories_name ON event_categories(lower(name));

ALTER TABLE event_schedules ADD COLUMN category_id TEXT REFERENCES event_categories(id);
