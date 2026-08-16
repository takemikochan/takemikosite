-- REL-01: 通知メールの送達状況を追跡し、失敗時に再送できるようにする。
-- 既存の本番D1に対しては `wrangler d1 execute takemiko-contact --remote --file=migrations/0001_delivery_tracking.sql` で適用する。
ALTER TABLE submissions ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE submissions ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN last_error TEXT;
