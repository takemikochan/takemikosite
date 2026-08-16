# 運用ガイド — 日々のメンテナンス

すでに動いている本番環境を対象にした、繰り返し行う作業のためのガイドです。ゼロからの構築は [`REBUILD.md`](./REBUILD.md)、シークレット・環境変数の値は [`REFERENCE.md`](./REFERENCE.md) を参照してください。

記法規約は [`REBUILD.md` §0](./REBUILD.md#0-このドキュメントについて) と共通です（`[ローカル/PowerShell]` 等のラベル、プレースホルダ）。

## 0. 困ったときのショートカット

| 症状 | 直行先 |
|---|---|
| サイトが502/503を返す | §13 障害対応プレイブック |
| CMSにログインできない・落ちている | §13 |
| お問い合わせフォームが送れない | §12 外形確認 → §13 |
| GitHub Actionsが赤い | §4 コードのデプロイ |
| 証明書が切れそう/切れた | §9 TLS証明書 |
| ディスクが逼迫している | §13 |
| 何かのシークレットを漏らしたかもしれない | §7 シークレットのローテーション |

---

## 1. チートシート

日常の8割はこの表で済みます。

| やりたいこと | コマンド | 実行場所 | 危険度 |
|---|---|---|---|
| コード変更をデプロイ | `pnpm release`（`web/`で） | ローカル | 低 |
| CMSコード変更を反映 | §4.2参照 | VPS | 中 |
| Worker変更をデプロイ | `npm test && npx wrangler deploy`（`worker/`で） | ローカル | 低 |
| nginx設定を反映 | §5参照 | ローカル→VPS | 中 |
| ログを見る（CMS） | `journalctl -u takemiko-cms -n 50 --no-pager` | VPS | 低 |
| サービス状態を見る | `sudo systemctl status takemiko-cms` | VPS | 低 |
| バックアップを手動実行 | `sudo /usr/local/sbin/backup-cms.sh` | VPS | 低 |
| fail2banの状況を見る | `sudo fail2ban-client status takemiko-cms` | VPS | 低 |
| 誤banを解除 | `sudo fail2ban-client set takemiko-cms unbanip <IP>` | VPS | 低 |
| 証明書の期限を見る | `sudo certbot certificates` | VPS | 低 |

---

## 2. 定期タスクカレンダー

### 自動（何もしなくてよい）

- [ ] 毎日 JST 03:00: VPSのバックアップcron（`/etc/cron.d/takemiko-backup`）
- [ ] 毎日 UTC 18:00: Workerのcron（データ保持期限切れ削除・通知メール再送、[`REFERENCE.md` 表D](./REFERENCE.md)）
- [ ] 毎日 JST 00:10: 予約公開取りこぼし保険cron（`.github/workflows/deploy-content.yml`）
- [ ] 証明書の自動更新（`certbot.timer`、期限30日前から試行）

### 人手（チェックボックスで管理）

**毎週**
- [ ] Dependabotが作ったPRを確認する（§10）

**毎月**
- [ ] `sudo certbot certificates` で有効期限を目視確認
- [ ] `/var/backups/takemiko/` の世代数とサイズを確認

**四半期**
- [ ] 復元リハーサルを実施（§8.2）
- [ ] `sudo certbot renew --dry-run` を実施
- [ ] `npm audit` / `pnpm audit` を3サブプロジェクトで実施し、新規のHigh/Criticalが無いか確認

**年次**
- [ ] deployのSSH鍵をローテーション（§7）
- [ ] GitHub PAT（読み取り専用・書き込み用の2つ）をローテーション（§7）
- [ ] Workerのシークレット3つをローテーション（§7）
- [ ] DBパスワードをローテーション（§7）

---

## 3. コンテンツ運用

Strapi管理画面で記事・制作実績・SNSリンク・グッズリンクを公開/更新/非公開/削除すると、lifecycle subscriber（`cms/src/index.ts`）が30秒デバウンスで `repository_dispatch` を送り、経路B（`.github/workflows/deploy-content.yml`）が自動でビルド・配送する。

予約公開は、Strapi側の予約公開機能に加えて `deploy-content.yml` の日次cron（JST 00:10）が保険として再ビルドする（Strapiの予約公開自体はrepository_dispatchを飛ばさないため）。

**画像アップロード時は必ずAlt属性を入力する**（SEO・アクセシビリティ。Geminiレビューでの指摘）。

反映されない場合の切り分け:
1. GitHub Actionsの `Deploy (Content / 記事更新)` が起動しているか（Actionsタブ）
2. 起動していない → `journalctl -u takemiko-cms -n 50 --no-pager` で `repository_dispatch` 送信のログ・エラーを確認、`/etc/takemiko-cms.env` の `GH_TOKEN`/`GH_REPO` を確認
3. 起動したが失敗している → Actionsのログでビルドエラーを確認

---

## 4. コードのデプロイ

### 4.1 web（経路A）

```powershell
cd web
pnpm release
```

`release.sh` の3ガード: (1) 作業ツリーが汚れていたら中止 (2) ローカルHEADが `origin/main` と不一致なら中止 (3) ビルド成果物のサニティチェック。これらは経路Bが後から再ビルドしても同じ結果になることを保証するための仕組みなので、**ガードで止まったときは無視せず原因を解消する**（`git status`/`git push` を確認）。

### 4.2 cms（Strapiコード）

`cms/` のコード変更（lifecycle subscriber・Content-Typeスキーマ・middlewares.ts等）は経路A/Bどちらの自動デプロイの対象**外**。手動で反映する。

`[VPS/bash: deploy]`:
```bash
sudo su - deploy
cd /opt/takemiko-cms-src
git pull origin main
cd cms
npm ci
npm run build
exit
```

`[VPS/bash: sudoユーザー]`（**deployにはsudoが無いので、必ず`exit`してから実行する**）:
```bash
sudo systemctl restart takemiko-cms
journalctl -u takemiko-cms -n 30 --no-pager
```

`Strapi started successfully` を確認する。Content-Type Builderでスキーマを変更した場合は、ローカルで先に動作確認してから（マイグレーションファイルが自動生成されるので、それをcommitしてから）反映する。

### 4.3 worker

```powershell
cd worker
npm test
npx wrangler deploy
```

新しいD1マイグレーションを含む変更の場合は、デプロイ前に §6 の手順でマイグレーションを適用しておく。

### 4.4 ロールバック

| 対象 | 方法 |
|---|---|
| web（静的サイト） | VPS上で `ls -1dt /var/www/takemiko/releases/*/` から前の世代を選び、`sudo ln -sfn <前の世代のパス> /var/www/takemiko/current`（直近5世代が残っている） |
| cms | 前のコミットSHAで `git checkout <SHA>` してから4.2の手順を再実行 |
| worker | `npx wrangler rollback` で直前のデプロイに戻す、またはD1のスキーマ変更を伴う場合は手動で切り戻す |

---

## 5. サーバ設定ファイルの変更反映

nginx・systemd・fail2ban・バックアップスクリプトはすべて同じパターンで反映する。

| 手順 | 内容 |
|---|---|
| 1 | リポジトリの `deploy/` 配下を編集する |
| 2 | commit・push する |
| 3 | `[ローカル/PowerShell]` で `scp -i <SSH_KEY_PATH> -P 22 deploy\<対象ファイル> deploy@<VPS_HOST>:/tmp/<ファイル名>` |
| 4 | `[VPS/bash: sudoユーザー]` で `sudo mv /tmp/<ファイル名> <配置先>`（配置先は[`REFERENCE.md` 表F](./REFERENCE.md#7-表f-vps-ファイル配置マップ)参照） |
| 5 | 種別ごとの検証・反映コマンドを実行する（下表） |

| 種別 | 検証 | 反映 |
|---|---|---|
| nginx | `sudo nginx -t` | `sudo systemctl reload nginx` |
| systemd | （なし） | `sudo systemctl daemon-reload && sudo systemctl restart takemiko-cms` |
| fail2ban | （なし） | `sudo systemctl restart fail2ban` → `sudo fail2ban-client status takemiko-cms` で確認 |
| backup-cms.sh | （なし） | `sudo chown root:root` + `sudo chmod 700` を忘れずに |

`nginx -t` は必ず `reload`/`restart` の**前**に実行する。エラーが出た状態でreloadすると、直前の設定のまま古いプロセスが動き続ける（サイトは落ちないが変更も反映されない）ので、`nginx -t` の失敗を放置しない。

---

## 6. D1マイグレーション運用（汎用手順）

新しいテーブル・カラムが必要になったとき:

1. `worker/migrations/NNNN_snake_case.sql` を連番で作成する（例: `0003_...`）。`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN`（既存カラムがあってもエラーにならない書き方）を使い、冪等に書く
2. **`worker/schema.sql` にも同じ変更を反映する**（`schema.sql` は「今すぐ新規構築したら何が出来るか」を表す完成形。新規構築時はこちらしか使わないため、`migrations/` だけ増やすとズレる）
3. ローカルで検証: `npx wrangler d1 execute takemiko-contact --local --file=migrations/NNNN_*.sql`
4. 本番に適用: `npx wrangler d1 execute takemiko-contact --remote --file=migrations/NNNN_*.sql`
5. `worker/src/index.ts` を新しいスキーマに対応させてからデプロイする（**適用とデプロイの順序に注意**: 新カラムを参照するコードを先にデプロイすると、マイグレーション未適用の本番D1に対してエラーになる）
6. [`REFERENCE.md` 表E](./REFERENCE.md#6-表e-d1-スキーマ台帳worker) に追記する（ここへの追記をもって完了とする）

失敗時の戻し方: D1はスキーマ変更のトランザクショナルなロールバック機能を持たないため、`ALTER TABLE ... DROP COLUMN`（対応していればSQLiteの制約に注意）または新しいテーブルを作って移行する。破壊的な変更をする前には `wrangler d1 export` でバックアップを取る。

---

## 7. シークレットのローテーション

| 対象 | 手順 | ローテ後の検証 |
|---|---|---|
| Worker secrets（TURNSTILE_SECRET / RESEND_API_KEY / CONTACT_NOTIFY_EMAIL） | `npx wrangler secret put <NAME>` で上書き | `/contact/` からテスト送信 |
| Strapi API Token（read-only） | 管理画面で新規発行 → GitHub Secretsと`web/.env.production`を更新 → 旧トークンを失効 | `pnpm release` を実行しビルドが成功するか |
| Strapi Transfer Token | 使う直前に都度発行、使用後は失効させる（常設しない） | - |
| GitHub PAT（Contents: Read-only、`/opt/takemiko-cms-src`のclone用） | 新規発行 → VPS上で `git remote set-url origin https://<user>:<新PAT>@github.com/...` | `git pull` が成功するか |
| GitHub PAT（Contents: Read and write、`GH_TOKEN`用） | 新規発行 → `/etc/takemiko-cms.env` の `GH_TOKEN` を更新 → `sudo systemctl restart takemiko-cms` | 記事を1本公開し経路Bが起動するか |
| deployのSSH鍵 | 1. 新しい鍵ペアを生成 2. VPSの `authorized_keys` に**新しい公開鍵を追記**（旧鍵は残したまま） 3. GitHub Secretの`SSH_PRIVATE_KEY`を新しい秘密鍵に更新 4. `pnpm release`でテストデプロイ 5. 成功を確認してから`authorized_keys`の旧鍵を削除 | テストデプロイの成功 |
| DBパスワード（`strapi`ロール） | `ALTER USER strapi WITH PASSWORD '新パスワード';` → `/etc/takemiko-cms.env`の`DATABASE_PASSWORD`を更新 → `sudo systemctl restart takemiko-cms` | ログイン・記事一覧表示 |
| Turnstile Secret Key / Resend APIキー | 各ダッシュボードで再発行 → Worker secretsを更新（上記1行目） | テスト送信 |

**鍵のローテーションは新→旧の順で切り替える**（旧を先に消すとロックアウトの危険がある）。

---

## 8. バックアップと復元

### 8.1 生成の確認

```bash
sudo ls -la /var/backups/takemiko/
cat /var/log/takemiko-backup.log
```
`db-<日時>.sql.gz` と `uploads-<日時>.tar.gz` が直近14世代分あることを確認する。

### 8.2 復元リハーサル（本番に触れない）

```bash
sudo -u postgres createdb takemiko_cms_restore_test
sudo gunzip -c /var/backups/takemiko/db-<日時>.sql.gz | sudo -u postgres psql -d takemiko_cms_restore_test
sudo -u postgres psql -d takemiko_cms_restore_test -c "SELECT count(*) FROM articles;"
sudo -u postgres dropdb takemiko_cms_restore_test
```

アップロード側:
```bash
mkdir -p /tmp/uploads-restore-test
sudo tar -xzf /var/backups/takemiko/uploads-<日時>.tar.gz -C /tmp/uploads-restore-test
sudo chown -R "$USER" /tmp/uploads-restore-test
ls /tmp/uploads-restore-test/uploads
rm -rf /tmp/uploads-restore-test
```

### 8.3 実際の復元

DB（**サービスを止めてから**）:
```bash
sudo systemctl stop takemiko-cms
sudo -u postgres dropdb takemiko_cms
sudo -u postgres createdb takemiko_cms
sudo gunzip -c /var/backups/takemiko/db-<日時>.sql.gz | sudo -u postgres psql -d takemiko_cms
sudo systemctl start takemiko-cms
```

アップロード:
```bash
sudo systemctl stop takemiko-cms
sudo tar -xzf /var/backups/takemiko/uploads-<日時>.tar.gz -C /opt/takemiko-cms/public/
sudo systemctl start takemiko-cms
```

### 8.4 ログのローテーション

`/etc/logrotate.d/takemiko-backup`（[`REBUILD.md` §11](./REBUILD.md#11-バックアップ)で設置済み）が週次でローテートする。手動で確認する場合:
```bash
sudo logrotate -d /etc/logrotate.d/takemiko-backup   # ドライラン
```

### 8.5 既知の限界

バックアップは同一VPS内にのみ保存され、暗号化されていない。ディスク障害やVPSアカウント侵害時には本体と同時に失う可能性がある。オフサイト保管・暗号化は §15「既知の課題」参照。

---

## 9. TLS証明書

証明書は `certonly --webroot` で取得しており、更新は `certbot.timer`（systemdタイマー）が自動で行う。

定期確認:
```bash
sudo certbot certificates
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

`sudo certbot renew --dry-run` が失敗する場合:
- `/var/www/letsencrypt` が存在するか、nginxの `location ^~ /.well-known/acme-challenge/` がそこを指しているか確認
- 80番ポートが実際に外部から到達可能か（`curl -I http://<DOMAIN>/.well-known/acme-challenge/test` を外部から）
- DNSが変更されていないか

---

## 10. セキュリティ運用

### fail2ban

```bash
sudo fail2ban-client status                    # ジェイル一覧
sudo fail2ban-client status takemiko-cms        # banされたIP一覧
sudo fail2ban-client status sshd
sudo fail2ban-client set takemiko-cms unbanip <IP>   # 誤banの解除
```

自分自身を誤banした場合、VPSプロバイダのコンソール（ブラウザ経由のVNC/シリアルコンソール、SSHを経由しない）からログインしてunbanする。

### その他

```bash
sudo ufw status
sudo tail -f /var/log/nginx/cms.takemiko.com.access.log   # CMSアクセスログ
cat /etc/apt/apt.conf.d/20auto-upgrades                    # unattended-upgradesの確認
```

### Dependabot PRの処理

週次で作られるPRは、CI（`.github/workflows/ci.yml`）が自動でtypecheck/testを走らせる。**Strapiのメジャーバージョン更新PRは自動化対象外**（`.github/dependabot.yml` で除外設定済み）。CIが通ったマイナー/パッチ更新はレビューの上マージしてよい。

---

## 11. 監視・ログ

| 対象 | コマンド |
|---|---|
| CMSサービス状態 | `sudo systemctl status takemiko-cms` |
| CMSログ | `journalctl -u takemiko-cms -n 100 --no-pager` / `journalctl -u takemiko-cms -f`（追跡） |
| nginxアクセスログ | `sudo tail -f /var/log/nginx/cms.takemiko.com.access.log` |
| nginxエラーログ | `sudo tail -f /var/log/nginx/error.log` |
| PostgreSQL | `sudo systemctl status postgresql` |
| バックアップログ | `cat /var/log/takemiko-backup.log` |
| Workerのリアルタイムログ | `cd worker && npx wrangler tail` |
| Workerのcron実行確認 | `npx wrangler tail` を実行した状態でcron発火時刻（UTC 18:00）を待つ、またはCloudflareダッシュボード → Workers → 対象Worker → Triggers → Cron Triggersの実行履歴 |
| D1のレート制限テーブルが減っているか | `npx wrangler d1 execute takemiko-contact --remote --command "SELECT COUNT(*) FROM request_attempts;"` を日をまたいで比較 |

---

## 12. 外形確認

大きな変更の後にまとめて実行する（[`REBUILD.md` §13](./REBUILD.md#13-受け入れ検証)の縮小版・日常点検用）。

```powershell
curl.exe -sI https://<DOMAIN>/
curl.exe -sI https://<DOMAIN>/no-such-page/
curl.exe -sI https://cms.<DOMAIN>/admin
curl.exe -sI -H "Origin: https://evil.example.com" https://cms.<DOMAIN>/api/articles

# フォームの異常系
curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://<WORKER_URL> -H "Content-Type: application/json" -H "Origin: https://<DOMAIN>" -d '{"name":"t","email":"t@example.com","subject":"t","message":"t"}'
curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://<WORKER_URL> -H "Content-Type: application/json" -H "Origin: https://evil.example.com" -d '{"name":"t","email":"t@example.com","subject":"t","message":"t","token":"dummy"}'
```

期待値は [`REBUILD.md` §13](./REBUILD.md#13-受け入れ検証) の表を参照。ビルド設定や環境変数（`STRAPI_URL`等）を変更したときは、経路A/B一致検証（`pnpm release` → 経路Bを`workflow_dispatch`で手動実行 → 目視比較）も実施する。

---

## 13. 障害対応プレイブック

| 症状 | 初動 | 切り分け | 復旧 |
|---|---|---|---|
| サイトが502/503 | `sudo systemctl status nginx` | nginxのエラーログ確認、`sudo nginx -t` | `sudo systemctl restart nginx` |
| CMSが落ちた | `sudo systemctl status takemiko-cms` | `journalctl -u takemiko-cms -n 100` でエラー内容確認 | `sudo systemctl restart takemiko-cms`。DBが原因なら`sudo systemctl status postgresql`も確認 |
| フォームが送れない | `npx wrangler tail` でリアルタイムログ確認 | §12のcurlチェックで400/403/429のどれが返るか特定 | シークレットの再登録（§7）、CSPの`connect-src`確認 |
| Actionsが赤い | Actionsタブでログ確認 | ビルドエラーか、rsync（SSH）エラーか | ビルドエラー→コード修正。SSHエラー→`SSH_KNOWN_HOSTS`更新 |
| 証明書切れ | `sudo certbot certificates` | §9のトラブルシュートを実施 | 緊急時は`REBUILD.md §7.3-7.4`の手順で再取得 |
| ディスク満杯 | `df -h` | `du -sh /var/backups/takemiko/* /opt/takemiko-cms/public/uploads` 等で大きいものを特定 | 古いバックアップ世代を手動削除、`/var/www/takemiko/releases`の世代数確認（自動で5世代保持のはず） |

---

## 14. 変更時に一緒に直すもの（連動表）

| 変更 | 連動して直す必要があるもの |
|---|---|
| ドメイン変更 | [`REFERENCE.md` 表G](./REFERENCE.md#8-表g-ドメインurlがハードコードされている箇所) の全箇所 |
| Worker URL変更 | `web/.env`・`.env.production`・GitHub Secrets 2件・`security-headers.conf`のCSP `connect-src` |
| CSP変更 | `deploy/nginx/security-headers.conf` → 配置（§5）→ ブラウザのコンソールで実際にブロックされていないか確認 |
| CMS CORS origin変更 | `cms/config/middlewares.ts` → §4.2の手順でデプロイ |
| `trailingSlash` の変更（astro.config.mjs） | nginxの `try_files` パターン、sitemap、既存の外部リンク |
| `DEPLOY_PATH` の変更 | GitHub Secret、`.github/actions/deploy-dist/action.yml` の前提、VPS側のディレクトリ実体 |
| fail2banの `logpath` 変更 | `deploy/fail2ban/jail.d/takemiko-cms.local` と nginx側の `access_log` ディレクティブを揃える |

---

## 15. 既知の課題

- **deployユーザーとCMS実行ユーザーが同一**: GitHub Actionsが握る静的サイト配送用のSSH鍵（`deploy`ユーザー）と、Strapiプロセスを実行するユーザーが同じ`deploy`になっている。デプロイ鍵が侵害された場合、静的ファイルの改ざんに留まらずCMSの実行コードまで書き換えられる状態。専用の実行ユーザー（例: `strapi`）へ分離し、`/opt/takemiko-cms`の所有権と`takemiko-cms.service`の`User=`を切り替えることで解消できるが、稼働中のVPSでのユーザー切り分け作業を要するため未対応（[`REFERENCE.md` 表H](./REFERENCE.md#9-表h-セキュリティレビュー指摘コードの対応表) OPS-01）。
- **バックアップが同一VPS内・非暗号化**: `deploy/backup/backup-cms.sh` はVPS内の`/var/backups/takemiko/`にのみ保存する。ディスク障害やVPSアカウント侵害時に本体と同時に失うリスクがある。オフサイト保管（S3/rclone等）と保存時の暗号化を将来的に追加したい（OPS-01H OPS-03）。
- **Node.jsのバージョン差**: ローカル・GitHub Actionsは24系（`.nvmrc`）、VPSはUbuntu標準の22系。`cms`の`engines`は`>=20 <=26`を満たすため実害は無いが、意図的な差として認識しておく。
- **`cms.takemiko.com` vhostにCSPが無い**: `deploy/nginx/security-headers.conf`は`takemiko.com`（サイト本体）のみに適用しており、CMS管理画面側はStrapi自身の`strapi::security`ミドルウェアが返すCSPに任せている（管理画面はinline script/evalを要するため、サイト本体と同じ厳格なCSPを被せると管理画面自体が壊れる）。意図的な設計判断。
- **バックアップの整合性検証は手動**: 世代保持のみで、自動的な整合性チェック（例: 復元して行数を比較しSlack通知する等）は無い。§2の四半期タスクで人手により検証する。
