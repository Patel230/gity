CREATE TABLE IF NOT EXISTS linear_connections (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linear_user_id TEXT NOT NULL,
  linear_user_name TEXT,
  workspace_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  scope TEXT NOT NULL DEFAULT 'read',
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS linear_connections_expires_at_idx
  ON linear_connections(expires_at);
