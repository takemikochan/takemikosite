# リファレンス — シークレット・環境変数・配置先の一覧

[`REBUILD.md`](./REBUILD.md)（再構築ガイド）と [`OPERATIONS.md`](./OPERATIONS.md)（運用ガイド）の両方から参照される共通の定義集です。値そのものの説明はここに一本化し、他の2文書は名前だけを列挙してここへリンクします。二重管理を避けるため、値の意味を変更するときは必ずこのファイルを更新してください。

## 1. プレースホルダ規約

このリポジトリのドキュメントは公開されているため、実際の値（VPSのIPアドレス等）を書きません。以下のプレースホルダで統一します。

| プレースホルダ | 意味 | 実値の控え方 |
|---|---|---|
| `<VPS_HOST>` | VPSのホスト名またはIPアドレス | あなたの手元のパスワードマネージャ等（このリポジトリには書かない） |
| `<DOMAIN>` | 本番ドメイン（例では `takemiko.com`） | このプロジェクトでは確定値。ドメインを変更する場合は §7「ドメイン/URLがハードコードされている箇所」参照 |
| `<GITHUB_OWNER>` | GitHubのユーザー名/Organization名 | `gh repo view --json owner` 等で確認 |
| `<WORKER_URL>` | お問い合わせWorkerのURL（例: `https://form.takemiko.workers.dev`） | `wrangler deploy` の出力。秘密情報ではないが、変更時は §7 の3箇所を更新する |
| `<SSH_KEY_PATH>` | デプロイ用SSH秘密鍵のローカルパス（例では `C:\Users\mikoto\.ssh\takemiko_github`） | 生成時に自分で決めた場所 |

## 2. 表A: GitHub Secrets（全11件）

Settings → Secrets and variables → Actions で登録する。`.github/workflows/deploy-release.yml` は①〜⑥を、`.github/workflows/deploy-content.yml` は①〜⑪すべてを使う。

| # | Secret名 | 値の内容 | 発行元 |
|---|---|---|---|
| ① | `SSH_PRIVATE_KEY` | デプロイ用SSH秘密鍵の中身全体 | ローカルで `ssh-keygen` |
| ② | `SSH_HOST` | `<VPS_HOST>` | VPS契約時 |
| ③ | `SSH_USER` | `deploy` | 固定値 |
| ④ | `SSH_PORT` | `22` | 固定値 |
| ⑤ | `SSH_KNOWN_HOSTS` | `ssh-keyscan -p 22 <VPS_HOST>` の出力 | ローカルで取得 |
| ⑥ | `DEPLOY_PATH` | `/var/www/takemiko` | 固定値 |
| ⑦ | `STRAPI_URL` | `https://cms.<DOMAIN>` | 固定値 |
| ⑧ | `STRAPI_TOKEN` | Strapi管理画面で発行するread-only APIトークン | Settings → API Tokens |
| ⑨ | `PUBLIC_GA_ID` | GA4測定ID（未使用なら空文字） | Google Analytics |
| ⑩ | `PUBLIC_CONTACT_ENDPOINT` | `<WORKER_URL>` | `wrangler deploy` の出力 |
| ⑪ | `PUBLIC_TURNSTILE_SITE_KEY` | Turnstileのサイトキー（公開情報） | Cloudflareダッシュボード → Turnstile |

①〜⑥が揃わないと経路A（コード変更）が動かない。⑦〜⑪が揃わないと経路B（記事更新）のビルドがモックデータにフォールバックする（ビルド自体は失敗しない）。

## 3. 表B: `/etc/takemiko-cms.env` の完成形

VPS上に `root:root 0600` で配置する（`cms/.env.example` と対応）。**一度にこの完成形を作る**（後から2段階で編集しない）。

```
NODE_ENV=production
HOST=127.0.0.1
PORT=1337

APP_KEYS=<生成した値1>,<生成した値2>
API_TOKEN_SALT=<生成した値3>
ADMIN_JWT_SECRET=<生成した値4>
JWT_SECRET=<生成した値5>
TRANSFER_TOKEN_SALT=<生成した値6>
ENCRYPTION_KEY=<生成した値7>

DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=takemiko_cms
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=<DBロール作成時に生成したパスワード>
DATABASE_SSL=false

GH_REPO=<GITHUB_OWNER>/takemikosite
GH_TOKEN=<Contents: Read and write 権限のFine-grained PAT>
```

- `APP_KEYS` は複数キーが推奨のため、生成した値のうち2つをカンマ区切りで入れる（`openssl rand -base64 32` を7回実行し、最初の2つを `APP_KEYS`、残り5つをそれぞれの項目に割り当てる）。
- `HOST=127.0.0.1` は必須（Strapiを外部に直接晒さないため。外部からは常にnginx経由）。
- `GH_REPO`/`GH_TOKEN` は `cms/src/index.ts` のlifecycle subscriberが `repository_dispatch` を送るために使う（Contents: Read/Write権限のPAT。§10「シークレットのローテーション」参照）。

## 4. 表C: ローカル環境 vs 本番環境の対応

| 項目 | ローカル | 本番（VPS） |
|---|---|---|
| PostgreSQLポート | 5433（プロジェクト専用クラスタ、`cms/.pgdata/`） | 5432（VPS標準） |
| DB接続ユーザー | `postgres` | `strapi`（専用ロール） |
| DB名 | `takemiko_cms` | `takemiko_cms` |
| `cms/.env` の役割 | ローカル開発用（gitignore済み） | 使用しない（`/etc/takemiko-cms.env` を使う） |
| `web/.env` の役割 | `pnpm dev` 用。ローカルStrapiまたは未設定でモック | ローカルでの検証専用。VPSでは使わない |
| `web/.env.production` の役割 | `pnpm release` 実行時に読み込まれる本番相当の値 | 実体は無し。値はGitHub Secretsとして経路Bに渡る |
| `worker/.dev.vars` の役割 | `wrangler dev` 用のローカルシークレット（gitignore済み） | 使用しない（`wrangler secret put` で本番に個別登録） |

`cms/.env.example` の既定 `DATABASE_NAME=strapi` / `DATABASE_USERNAME=strapi` は Strapi公式のテンプレート値。このプロジェクトではローカル・本番とも `takemiko_cms` に読み替える。

## 5. 表D: Cloudflare Worker の vars と secrets

`worker/wrangler.toml` 参照。

| 名前 | 種別 | 値 | 設定場所 |
|---|---|---|---|
| `ALLOWED_ORIGIN` | `[vars]`（公開・コミット済み） | `https://<DOMAIN>` | `wrangler.toml` に直接記述 |
| `database_id`（D1バインディング） | `[[d1_databases]]`（公開・コミット済み） | `wrangler d1 create` の出力 | `wrangler.toml` に直接記述 |
| `TURNSTILE_SECRET` | secret | Turnstile登録時に発行されるSecret Key | `wrangler secret put TURNSTILE_SECRET` |
| `RESEND_API_KEY` | secret | Resendダッシュボードで発行 | `wrangler secret put RESEND_API_KEY` |
| `CONTACT_NOTIFY_EMAIL` | secret | 通知を受け取りたいメールアドレス | `wrangler secret put CONTACT_NOTIFY_EMAIL` |

## 6. 表E: D1 スキーマ台帳（`worker/`）

| ファイル | 用途 | 適用先 |
|---|---|---|
| `schema.sql` | **新規構築専用**。`submissions` テーブル（`delivery_status`等を含む完成形）と `request_attempts` テーブルの両方を含む、常に最新の完成形 | 新しいD1データベースを作った直後、1回だけ実行 |
| `migrations/0001_delivery_tracking.sql` | 既存の`submissions`テーブルに `delivery_status`/`delivery_attempts`/`last_error` を追加するALTER TABLE | 本番D1に適用済み（2026-08-16） |
| `migrations/0002_request_attempts.sql` | レート制限用の `request_attempts` テーブルを新設 | 本番D1に適用済み（2026-08-16） |

**運用規約（詳細は `OPERATIONS.md` §6）**: `schema.sql` は常に「今すぐ新規構築したら何が出来上がるか」を表す完成形として保守する。既存の本番D1に対しては `migrations/NNNN_*.sql` を個別に適用する。新規構築時に `migrations/` を流さない（`schema.sql` と内容が重複し、`CREATE TABLE` の衝突やカラム重複エラーになる）。

## 7. 表F: VPS ファイル配置マップ

| リポジトリのパス | VPS上の配置先 | 所有者:グループ | 権限 | 反映コマンド |
|---|---|---|---|---|
| `deploy/nginx/security-headers.conf` | `/etc/nginx/snippets/security-headers.conf` | root:root | 644 | `sudo mv` → `nginx -t` → `systemctl reload nginx` |
| `deploy/nginx/takemiko.com.conf` | `/etc/nginx/sites-available/takemiko.com.conf`（`sites-enabled/`へsymlink） | root:root | 644 | 同上 |
| `deploy/nginx/cms.takemiko.com.conf` | `/etc/nginx/sites-available/cms.takemiko.com.conf`（`sites-enabled/`へsymlink） | root:root | 644 | 同上 |
| `deploy/systemd/takemiko-cms.service` | `/etc/systemd/system/takemiko-cms.service` | root:root | 644 | `sudo mv` → `systemctl daemon-reload` → `systemctl restart takemiko-cms` |
| `deploy/fail2ban/filter.d/takemiko-cms.conf` | `/etc/fail2ban/filter.d/takemiko-cms.conf` | root:root | 644 | `sudo mv` → `systemctl restart fail2ban` |
| `deploy/fail2ban/jail.d/takemiko-cms.local` | `/etc/fail2ban/jail.d/takemiko-cms.local` | root:root | 644 | 同上 |
| `deploy/backup/backup-cms.sh` | `/usr/local/sbin/backup-cms.sh` | root:root | **700**（DBパスワードを読むため） | `sudo mv` → `chown root:root` → `chmod 700` |
| （リポジトリ外で作成） | `/etc/takemiko-cms.env`（表B参照） | root:root | **600** | `sudo nano` で直接編集 |
| （リポジトリ外で作成） | `/etc/cron.d/takemiko-backup` | root:root | 644 | `sudo nano` で直接編集 |
| `cms/`（sparse-checkout） | `/opt/takemiko-cms-src/cms`（`/opt/takemiko-cms` からsymlink） | deploy:deploy | - | `git pull` → `npm ci && npm run build` |

全てのVPS転送は、GitHub Actions用のデプロイ鍵（`deploy`ユーザー、sudo権限なし）を使い、いったん `/tmp/` に置いてから `sudo mv` で最終配置に移す（`/tmp` は誰でも書き込めるため、sudoを持たない `deploy` 鍵でも転送できる）。

## 8. 表G: ドメイン/URLがハードコードされている箇所

別ドメイン・別Cloudflareアカウントで再構築する場合、以下すべてを書き換える必要がある。

| ファイル | 該当箇所 | 値 |
|---|---|---|
| `web/astro.config.mjs` | `site:` | `https://<DOMAIN>` |
| `web/astro.config.mjs` | `image.domains` | `cms.<DOMAIN>` |
| `web/src/data/site.ts` | `url` | `https://<DOMAIN>` |
| `web/src/data/site.ts` | `contactEmail` | `contact@<DOMAIN>` |
| `cms/config/middlewares.ts` | `strapi::cors` の `origin` | `https://cms.<DOMAIN>` |
| `worker/wrangler.toml` | `ALLOWED_ORIGIN` | `https://<DOMAIN>` |
| `worker/wrangler.toml` | `database_id` | 新しいCloudflareアカウントで `wrangler d1 create` した値 |
| `deploy/nginx/takemiko.com.conf` | `server_name` ×4、証明書パス | `<DOMAIN>` / `www.<DOMAIN>` |
| `deploy/nginx/cms.takemiko.com.conf` | `server_name` ×2、証明書パス | `cms.<DOMAIN>` |
| `deploy/nginx/security-headers.conf` | CSPの `connect-src` | `<WORKER_URL>` |
| `deploy/fail2ban/filter.d/takemiko-cms.conf` | `logpath` の由来 | `cms.<DOMAIN>` のアクセスログ名 |

## 9. 表H: セキュリティレビュー指摘コードの対応表

`deploy/systemd/takemiko-cms.service`、`deploy/nginx/*.conf`、`cms/config/{middlewares,plugins}.ts`、`worker/src/index.ts` 等のコメントに登場する識別子の一覧（2026-08-16のコードレビューで採番）。詳細な指摘文自体はリポジトリに含めていないため、実装箇所と一行要約のみをここに記録する。

| コード | 一行要約 | 主な実装箇所 |
|---|---|---|
| SEC-01 | CMS由来URLの `javascript:`/`data:` スキームによる保存型XSS対策 | `web/src/lib/url.ts`, `web/src/content.config.ts` |
| SEC-02 | Strapiログインの実パスは `/admin/login`（`/admin/auth/login` ではない） | `deploy/nginx/cms.takemiko.com.conf`, `deploy/fail2ban/filter.d/takemiko-cms.conf` |
| SEC-03 | CMS依存の既知脆弱性（ビルド時ツールに限定、本番非露出） | `.github/dependabot.yml` |
| SEC-04 | Strapi CORSの任意Origin許可（資格情報付き）を自ドメインへ制限 | `cms/config/middlewares.ts` |
| SEC-05 | nginxの `add_header` 非継承バグによるセキュリティヘッダー欠落・CSP追加 | `deploy/nginx/security-headers.conf` |
| SEC-06 | 問い合わせWorkerの濫用対策（Turnstileのhostname/action検証・レート制限・サイズ上限） | `worker/src/index.ts` |
| SEC-07 | アップロード許可形式を `image/*` のみに縮小、未使用プラグイン削除 | `cms/config/plugins.ts` |
| PRIV-01 | D1の個人情報に180日保持期限と自動削除 | `worker/src/index.ts`（`scheduled()`）, `web/src/pages/privacy.astro` |
| REL-01 | 通知メール送信失敗の検知・記録・再送 | `worker/src/index.ts`（`deliver()`） |
| OPS-01 | deployユーザーとCMS実行ユーザーの分離（**未対応**） | `OPERATIONS.md` §15「既知の課題」参照 |
| OPS-02 | systemdサンドボックス強化 | `deploy/systemd/takemiko-cms.service` |
| OPS-03 | バックアップの暗号化・オフサイト化（**未対応**） | `OPERATIONS.md` §15「既知の課題」参照 |
| INFO-01 | `server_tokens off`、Strapiの`poweredBy`ミドルウェア無効化 | `deploy/nginx/*.conf`, `cms/config/middlewares.ts` |

## 10. 用語集

| 用語 | 意味 |
|---|---|
| 経路A | コード変更のデプロイ経路。ローカルで `pnpm release` → GitHub Release → Actions が配送（CIはビルドしない） |
| 経路B | 記事更新のデプロイ経路。Strapiの公開操作 → `repository_dispatch` → Actions がビルドから配送まで行う |
| `deploy` ユーザー | VPS上でGitHub Actionsが使うSSHユーザー。sudoなし。`/var/www/takemiko` の所有者かつ `takemiko-cms.service` の実行ユーザー |
| atomic deploy | `releases/<sha>-<ts>/` に配置してから symlink を `current` に張り替える方式。配信中に「一部だけ新しい」状態を作らない |
