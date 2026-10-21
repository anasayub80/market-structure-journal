CREATE TABLE users (id TEXT PRIMARY KEY, auth_id TEXT UNIQUE, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')), status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Invited','Suspended')), created TEXT NOT NULL, settings TEXT NOT NULL DEFAULT '{}');
--> statement-breakpoint
CREATE TABLE accounts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), license TEXT UNIQUE, number TEXT NOT NULL DEFAULT '', server TEXT NOT NULL DEFAULT '' COLLATE NOCASE, status TEXT NOT NULL, expires TEXT NOT NULL DEFAULT '', token_hash TEXT, data TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX account_binding ON accounts(number,server) WHERE number <> '';
--> statement-breakpoint
CREATE INDEX account_owner ON accounts(owner_id);
--> statement-breakpoint
CREATE TABLE batches (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), account_id TEXT NOT NULL REFERENCES accounts(id), state TEXT NOT NULL CHECK(state IN ('pending','committed','undone')), created TEXT NOT NULL, data TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX pending_account_import ON batches(account_id) WHERE state = 'pending';
--> statement-breakpoint
CREATE TABLE trades (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), account_id TEXT NOT NULL REFERENCES accounts(id), batch_id TEXT NOT NULL REFERENCES batches(id), broker_key TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(account_id,broker_key));
--> statement-breakpoint
CREATE INDEX trades_owner ON trades(owner_id,account_id);
--> statement-breakpoint
CREATE TABLE entries (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX entries_owner ON entries(owner_id);
--> statement-breakpoint
CREATE TABLE activity (id TEXT PRIMARY KEY, owner_id TEXT, actor_id TEXT NOT NULL, time TEXT NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE configuration (key TEXT PRIMARY KEY, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE kv_outbox (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, batch_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', updated TEXT NOT NULL, error TEXT);
