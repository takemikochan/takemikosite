# たけるのみこと Official Site

「たけるのみこと（takerunomikoto / たけみこ）」の公式サイト。Astro（静的生成）+ Strapi 5（自前ホスト CMS）+ Cloudflare Worker（お問い合わせ）の 3 サブプロジェクト構成。

## 構成

```
web/     Astro サイト本体（pnpm）
cms/     Strapi 5 CMS（npm）
worker/  お問い合わせフォームの受け口（Cloudflare Worker）
docs/    ドキュメント（下記参照）
```

各サブプロジェクトは独立したパッケージマネージャ・依存関係を持つ（pnpm workspace としては連結しない）。

## クイックスタート（ローカル開発）

```bash
cd web && pnpm install && pnpm dev
```

Strapi 未接続でもモックデータで起動する。Strapi・Workerも含めた開発環境の全体セットアップは [`docs/REBUILD.md` §3](docs/REBUILD.md#3-ローカル開発環境) を参照。

### ローカル PostgreSQL（`cms/` 用）

プロジェクト専用クラスタが `cms/.pgdata/` にある（ポート5433）。

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "D:\Projects\takemikosite\cms\.pgdata" -l "D:\Projects\takemikosite\cms\.pgdata\server.log" start
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "D:\Projects\takemikosite\cms\.pgdata" stop
```

## ドキュメント

| 文書 | いつ読むか |
|---|---|
| [`docs/REBUILD.md`](docs/REBUILD.md) | ゼロから作り直すとき・開発環境を新しいPCに用意するとき |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | 記事を出す・デプロイする・障害対応・定期メンテ |
| [`docs/REFERENCE.md`](docs/REFERENCE.md) | シークレット・環境変数・配置先を調べるとき |
| [`CLAUDE.md`](CLAUDE.md) | AIエージェントがこのリポジトリを触るとき |

各`docs/*.md`には人間向けの同内容HTML版（`docs/*.html`）がある。

## デプロイ

- コード変更: ローカルで `pnpm release`（`web/scripts/release.sh`）→ GitHub Release → Actions が VPS へ配送
- 記事更新: Strapi上での公開操作をトリガーに GitHub Actions が自動ビルド・配送

詳細は [`docs/OPERATIONS.md` §4](docs/OPERATIONS.md#4-コードのデプロイ)。

## 既知の課題

未対応のセキュリティ上の割り切り（deployユーザーとCMS実行ユーザーの分離、バックアップのオフサイト化 等）は [`docs/OPERATIONS.md` §15](docs/OPERATIONS.md#15-既知の課題) に一覧しています。
