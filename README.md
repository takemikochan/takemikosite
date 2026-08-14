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

- Node: `.nvmrc` で 22 系に固定
- `web/`: `pnpm install && pnpm dev`
- `cms/`: `npm install && npm run develop`
- `worker/`: `npm install && npx wrangler dev`

## デプロイ

- コード変更: ローカルで `pnpm release`（`web/scripts/release.sh`）→ GitHub Release 作成 → Actions が VPS へ配送
- 記事更新: Strapi 上での公開操作をトリガーに GitHub Actions が自動ビルド・配送

詳細は実装計画（`E:\AI\Claude\plans\official-site-shimmering-brook.md`）を参照。

## 運用手順

（Phase 5 以降、CMS コード更新の runbook・バックアップ復元手順などをここに追記する）
