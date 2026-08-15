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

（Phase 5 以降、CMS コード更新の runbook・バックアップ復元手順などをここに追記する）
