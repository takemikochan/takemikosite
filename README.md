# たけるのみこと Official Site

「たけるのみこと（takerunomikoto / たけみこ）」の公式サイト。Astro（静的生成）+ Strapi 5（自前ホスト CMS）+ Cloudflare Worker（お問い合わせ）の 3 サブプロジェクト構成。

## 構成

```
web/     Astro サイト本体（pnpm）
cms/     Strapi 5 CMS（npm）
worker/  お問い合わせフォームの受け口（Cloudflare Worker）
```

各サブプロジェクトは独立したパッケージマネージャ・依存関係を持つ（pnpm workspace としては連結しない）。

## 開発

- Node: `.nvmrc` で 24 系に固定（開発機に既存インストール済みのバージョンを採用。§1 参照）
- `web/`: `pnpm install && pnpm dev`
- `cms/`: `npm install && npm run develop`（下記「ローカル PostgreSQL」を先に起動しておくこと）
- `worker/`: `npm install && npx wrangler dev`

### ローカル PostgreSQL（`cms/` 用）

Windows のグローバルな PostgreSQL サービスとは別に、**プロジェクト専用のクラスタ**を `cms/.pgdata/` に用意している（venv のようにデータを分離する運用）。ポートは 5433。

起動:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "D:\Projects\takemikosite\cms\.pgdata" -l "D:\Projects\takemikosite\cms\.pgdata\server.log" start
```

停止:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "D:\Projects\takemikosite\cms\.pgdata" stop
```

接続情報は `cms/.env` の `DATABASE_*`（DB名 `takemiko_cms`、ユーザー `postgres`）。パスワードは `.env` 内に記載（git 管理外）。

なお winget でインストールした PostgreSQL 18 は、既定でグローバルな Windows サービス（`postgresql-x64-18`、ポート5432、自動起動）も一緒に有効化される。このプロジェクトでは使わないため、不要であれば管理者権限で無効化してよい（本セッションでは権限不足のため未実施）。

## デプロイ

- コード変更: ローカルで `pnpm release`（`web/scripts/release.sh`）→ GitHub Release 作成 → Actions が VPS へ配送
- 記事更新: Strapi 上での公開操作をトリガーに GitHub Actions が自動ビルド・配送

詳細は実装計画（`E:\AI\Claude\plans\official-site-shimmering-brook.md`）を参照。

## 運用手順

### CMS コード更新の反映

`cms/` のコード（lifecycle subscriber・Content-Type スキーマ等）を変更した場合、自動デプロイの対象外（§6.3 参照）。VPS 上で手動反映する:

```bash
# deploy ユーザーで、VPS上の /opt/takemiko-cms-src にて
git pull origin main
cd cms && npm ci && npm run build
sudo systemctl restart takemiko-cms
journalctl -u takemiko-cms -f
```

### バックアップ

`deploy/backup/backup-cms.sh` が PostgreSQL のダンプとアップロード画像を `/var/backups/takemiko/` に日次で保存する（cron 設定は `deploy/PHASE6-RUNBOOK.md` 参照）。直近14世代を保持。

### 復元手順

1. DB を復元する場合、まず一時DBに復元して内容を確認してから本番に適用する（本番へ直接上書きする前に必ず検証する）:
   ```bash
   sudo -u postgres createdb takemiko_cms_restore_verify
   gunzip -c /var/backups/takemiko/db-<日時>.sql.gz | sudo -u postgres psql -d takemiko_cms_restore_verify
   # 内容を確認したら
   sudo -u postgres dropdb takemiko_cms_restore_verify
   ```
2. 本番へ適用する場合は CMS サービスを止めてから行う:
   ```bash
   sudo systemctl stop takemiko-cms
   sudo -u postgres dropdb takemiko_cms
   sudo -u postgres createdb takemiko_cms
   gunzip -c /var/backups/takemiko/db-<日時>.sql.gz | sudo -u postgres psql -d takemiko_cms
   sudo systemctl start takemiko-cms
   ```
3. アップロード画像を復元する場合:
   ```bash
   sudo systemctl stop takemiko-cms
   sudo tar -xzf /var/backups/takemiko/uploads-<日時>.tar.gz -C /opt/takemiko-cms/public/
   sudo systemctl start takemiko-cms
   ```

復元リハーサルは Phase 6（`deploy/PHASE6-RUNBOOK.md` 手順4）で1回実施済み。
