-- Auth API compatibility additions. Safe to run repeatedly after 001_init.sql.

ALTER TABLE remi.users
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS remi.sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES remi.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON remi.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON remi.sessions (expires_at);

CREATE TABLE IF NOT EXISTS remi.rate_limits (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON remi.rate_limits (window_start);

ALTER TABLE remi.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE remi.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE remi.rate_limits ENABLE ROW LEVEL SECURITY;
