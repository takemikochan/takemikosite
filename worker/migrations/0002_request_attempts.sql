-- SEC-06 修正: レート制限が「D1に保存された成功送信」だけをカウントしており、
-- Turnstile検証失敗・スキーマ不正等で弾かれるリクエストは何度送っても
-- カウントされない不具合があった。成否に関わらず全POST試行を記録する
-- 専用テーブルに切り替える。
CREATE TABLE IF NOT EXISTS request_attempts (
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_request_attempts_ip_created
  ON request_attempts (ip, created_at);
