CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  created_at TEXT NOT NULL,
  -- 通知メールの送達状況（§REL-01）。pending | sent | failed
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

-- レート制限用。成否に関わらず全POST試行を記録する（§SEC-06）。
CREATE TABLE IF NOT EXISTS request_attempts (
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_request_attempts_ip_created
  ON request_attempts (ip, created_at);
