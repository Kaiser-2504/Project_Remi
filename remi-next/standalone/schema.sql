-- Schema cho bản chạy ĐỘC LẬP của Người 4 (remi-next/standalone). Chạy lại nhiều lần được.
-- Khi nhóm ghép xong, schema thật là db/migrations/001_init.sql của Người 1; bốn bảng states, reminders, push_subs, ai_usage
-- phải khớp với những gì remi-next/lib/store-pg.ts dùng (xem docs/NGUOI-4.md).
CREATE TABLE IF NOT EXISTS users (
  id         text PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  pass       text NOT NULL,
  created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  hash       text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  ua         text
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS states (
  user_id    text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version    int NOT NULL,
  data       jsonb NOT NULL,
  updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     text NOT NULL,
  fire_at bigint NOT NULL,
  title   text NOT NULL,
  body    text NOT NULL,
  cond    text NOT NULL DEFAULT '',
  sent    int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(sent, fire_at);
CREATE TABLE IF NOT EXISTS push_subs (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  ua         text,
  created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     text NOT NULL,
  count   int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
