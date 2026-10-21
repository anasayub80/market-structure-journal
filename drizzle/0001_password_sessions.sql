CREATE TABLE password_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), credential_version TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX password_session_user ON password_sessions(user_id,expires_at);
--> statement-breakpoint
CREATE TABLE login_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL);
