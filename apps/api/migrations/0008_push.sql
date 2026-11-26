CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE TABLE notification_log (
  key TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
