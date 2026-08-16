# 再構築ガイド — ゼロから同等の本番環境を作る

## 0. このドキュメントについて

**目的**: 新しいVPS・新しいCloudflareアカウント・まっさらな開発機から出発し、このリポジトリの `main` ブランチだけを元に、既存の本番環境と同等の（かつ最初からセキュリティ対策済みの）環境を再構築する。ディザスタリカバリ、あるいは環境の作り直しに使う。

**日々の運用**（記事の公開、コード変更のデプロイ、設定ファイルの再反映、バックアップ・復元、シークレットのローテーション等）は扱わない。そちらは [`OPERATIONS.md`](./OPERATIONS.md) を参照。シークレットや環境変数の値の意味は [`REFERENCE.md`](./REFERENCE.md) に一本化されている。

**想定所要時間**: 半日程度（DNS伝播待ち・証明書発行待ちを含む）。

### 記法規約

- `[ローカル/PowerShell]` — あなたの開発機のPowerShellで実行
- `[VPS/bash: sudoユーザー]` — VPSにSSHログインした、sudo権限を持つ既存アカウントで実行
- `[VPS/bash: deploy]` — VPS上の `deploy` ユーザー（sudoなし）で実行
- `[ブラウザ]` — Webブラウザでの操作
- プレースホルダ（`<VPS_HOST>` 等）は [`REFERENCE.md` §1](./REFERENCE.md#1-プレースホルダ規約) 参照
- **秘密情報が関わる手順はすべて、あなた自身のターミナル・ブラウザで実行してください。** AIエージェントに秘密鍵・パスワード・トークンの中身を見せる必要はありません（生成コマンドの実行そのものも含む）

### 章の依存関係

```
§2 事前準備
 └─ §3 ローカル開発環境 ──────────────(ここで止めてもよい: ローカルで見るだけなら以降不要)
     └─ §4 VPS初期セットアップ
         └─ §5 デプロイ鍵とdeployユーザー
             └─ §6 DNS
                 └─ §7 TLS証明書
                     └─ §8 nginx配置
                         └─ §9 静的サイト初回デプロイ ──(ここまでで https://<DOMAIN>/ が見える)
                             └─ §10 Strapi本番構築
                                 └─ §11 バックアップ
                                     └─ §12 Cloudflare Worker
                                         └─ §13 受け入れ検証
```

---

## 1. 全体像とアカウント一覧

完成形の構成:

```
[ 訪問者のブラウザ ]
       │
       ├─ https://<DOMAIN>/          → nginx → /var/www/takemiko/current (Astro静的ファイル)
       ├─ https://cms.<DOMAIN>/admin → nginx → 127.0.0.1:1337 (Strapi)
       └─ フォーム送信              → Cloudflare Worker → D1 / Turnstile / Resend

[ GitHub Actions ]
       ├─ 経路A(コード変更): dist.tar.gz を rsync でVPSへ
       └─ 経路B(記事更新): Strapiのlifecycle → repository_dispatch → ビルド → rsync
```

必要なアカウント: GitHub（リポジトリ・Actions・Secrets）、VPS事業者（Ubuntu 26.04系、最低2vCPU/4GB目安）、ドメインレジストラ、Cloudflare（Workers/D1/Turnstile、無料枠で足りる）、Resend（メール通知、無料枠で足りる）、Google Analytics（任意）。

- [ ] 上記すべてのアカウントを用意した

---

## 2. 事前準備

- [ ] ドメインを取得し、レジストラの管理画面にアクセスできる
- [ ] VPSを契約し、sudo権限を持つ非rootアカウントでSSHログインできる（rootログイン不可の構成を推奨）
- [ ] GitHubにこのリポジトリをforkまたはpush済みで、Actionsが有効
- [ ] Cloudflareアカウントを作成し、`*.workers.dev` サブドメインを1つ確保している
- [ ] Resendアカウントを作成できる状態（登録は §12 で行う）

---

## 3. ローカル開発環境

`[ローカル/PowerShell]`

### 3.1 前提ツール

- Git
- Node.js 24系（リポジトリの `.nvmrc` に合わせる）
- pnpm（`npm install -g pnpm`。`corepack enable` は管理者権限が必要になる場合があるため、権限エラーが出たらこちらを使う）
- GitHub CLI（`gh`）— [cli.github.com](https://cli.github.com/) または `winget install --id GitHub.cli`
- Cloudflare Wrangler CLI — `worker/` の `npm install` で入る（別途インストール不要）
- PostgreSQL 18（ローカル開発用）

### 3.2 リポジトリを取得し、各サブプロジェクトの依存を入れる

```powershell
git clone https://github.com/<GITHUB_OWNER>/takemikosite.git
cd takemikosite

cd web
pnpm install
cd ..\cms
npm install
cd ..\worker
npm install
cd ..
```

3つのサブプロジェクトは独立したパッケージマネージャを使う（pnpm workspaceとして連結していない）。

### 3.3 ローカルPostgreSQLクラスタを作る

Windowsのグローバルサービスとは別に、プロジェクト専用のクラスタを `cms/.pgdata/` に作る（venvのようにデータを分離する）。ポートは **5433**。

```powershell
& "C:\Program Files\PostgreSQL\18\bin\initdb.exe" -D "D:\Projects\takemikosite\cms\.pgdata" -U postgres -E UTF8
```

`cms/.pgdata/postgresql.conf` の末尾に `port = 5433` を追記する。

起動・停止:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "D:\Projects\takemikosite\cms\.pgdata" -l "D:\Projects\takemikosite\cms\.pgdata\server.log" start
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "D:\Projects\takemikosite\cms\.pgdata" stop
```

起動後、DBを作成:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -p 5433 takemiko_cms
```

### 3.4 環境変数ファイルを作る

各 `.env.example` をコピーして値を埋める（[`REFERENCE.md` §4](./REFERENCE.md#4-表c-ローカル環境-vs-本番環境の対応) 参照）。

```powershell
Copy-Item web\.env.example web\.env
Copy-Item cms\.env.example cms\.env
Copy-Item worker\.dev.vars.example worker\.dev.vars
```

- `web/.env`: Strapiに接続しない場合は空のままでよい（モックデータで動く）
- `cms/.env`: `DATABASE_PORT=5433`、`DATABASE_NAME=takemiko_cms`、`DATABASE_USERNAME=postgres`。シークレット系（`APP_KEYS`等）はローカル開発用に適当な値で構わない（`openssl rand -base64 32` 等）
- `worker/.dev.vars`: ローカルでフォームの動作確認をしない限り空のままでよい

### 3.5 起動確認

```powershell
cd web
pnpm astro check
pnpm build
pnpm test
pnpm dev          # http://localhost:4321 でモックデータのサイトが見える

cd ..\cms
npm run develop   # http://localhost:1337/admin で初回管理者作成画面が見える

cd ..\worker
npm run typecheck
npm test
```

- [ ] `pnpm build` が成功する
- [ ] `pnpm test` / `npm test`（worker）が全件成功する
- [ ] `pnpm dev` でトップページが表示される

### 3.6 ここで止めてもよい出口

ローカルで見るだけ・コードを読むだけであれば、ここで作業を終えてよい。本番環境（VPS・Cloudflare）を構築する場合のみ §4 以降に進む。

---

## 4. VPS初期セットアップ

`[VPS/bash: sudoユーザー]`

### 4.1 OS更新とタイムゾーン

```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Tokyo
```

### 4.2 SSHのハードニング

`/etc/ssh/sshd_config` を編集し、以下を確認・設定する:

```
PermitRootLogin no
PasswordAuthentication no
```

（多くのVPS事業者はデフォルトで root ログイン不可・鍵認証必須の構成を提供している。既にそうなっていれば変更不要）

```bash
sudo systemctl restart sshd
```

### 4.3 ファイアウォール（ufw）

**順序が重要**: 先にSSHを許可してから有効化する。逆順だと自分がロックアウトされる。

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw allow 80,443/tcp
sudo ufw status
```

**⚠️ クラウド事業者側のパケットフィルタ/セキュリティグループも別途開放すること**（ufwだけでは不十分。事業者の管理コンソールで80・443・22を許可）。

判断基準: `curl -I http://<DOMAIN>` を打って、即座に「Connection refused」が返るなら開放は成功（この時点ではまだnginxが無いので拒否されるのが正常）。何十秒もタイムアウトする場合はファイアウォールが塞いでいる。

### 4.4 fail2ban（sshd保護）

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

デフォルトの `sshd` jailで十分。Strapi管理画面用のjailは §10.9 で追加する。

- [ ] `ufw status` が `Status: active` かつ 22/80/443 が許可されている
- [ ] クラウド事業者側のフィルタも80/443/22を許可した
- [ ] `fail2ban-client status sshd` が有効になっている

---

## 5. デプロイ鍵とdeployユーザー

### 5.1 デプロイ用SSH鍵ペアを生成する `[ローカル/PowerShell]`

```powershell
ssh-keygen -t ed25519 -C "github@takemiko" -f <SSH_KEY_PATH>
```

2回のパスフレーズ入力プロンプトは**両方とも空Enter**（GitHub Actionsが無人実行するため）。普段使いの鍵とは別にする。

### 5.2 deployユーザーを作成する `[VPS/bash: sudoユーザー]`

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/takemiko/releases
sudo chown -R deploy:deploy /var/www/takemiko
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
```

**deployユーザーにはsudoを一切与えない。**

`[ローカル/PowerShell]` で公開鍵の中身を表示:
```powershell
Get-Content <SSH_KEY_PATH>.pub
```

`[VPS/bash: sudoユーザー]` で貼り付け:
```bash
sudo nano /home/deploy/.ssh/authorized_keys
# 上でコピーした1行を貼り付けて保存
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

動作確認 `[ローカル/PowerShell]`:
```powershell
ssh -i <SSH_KEY_PATH> -p 22 deploy@<VPS_HOST>
```
ログインできたら `exit`。

- [ ] `deploy` ユーザーでSSHログインできる
- [ ] `deploy` に `sudo -l` を試すと権限がないことを確認した（任意）

---

## 6. DNS

レジストラの管理画面で、以下のA/AAAAレコードを `<VPS_HOST>` に向ける:

- `<DOMAIN>`
- `www.<DOMAIN>`
- `cms.<DOMAIN>`（証明書をまとめて取るため今の段階で設定しておく）

伝播確認（数分〜数時間かかる場合がある）:
```powershell
nslookup <DOMAIN>
nslookup cms.<DOMAIN>
```

- [ ] 3つのレコードすべてが `<VPS_HOST>` を返す

---

## 7. TLS証明書

`[VPS/bash: sudoユーザー]`

### 7.1 nginxとcertbotのインストール

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 7.2 webroot認証用のディレクトリを作る

証明書の取得・更新の両方をwebroot方式で行う（`--standalone` は使わない。取得時はport 80が空いていても、**更新時はnginxが常にport 80を使っているため `--standalone` は失敗する**）。

```bash
sudo mkdir -p /var/www/letsencrypt
```

### 7.3 最小構成のnginxを一時的に配置して証明書を取得する

`deploy/nginx/` の各設定ファイルは、証明書のパス（`/etc/letsencrypt/live/takemiko.com/`）を前提に書かれているため、**証明書が無い状態ではロードできない**。先に `/.well-known/acme-challenge/` だけを処理する最小構成を一時的に置く。

```bash
sudo tee /etc/nginx/sites-available/_acme-temp.conf > /dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type "text/plain";
    }
    location / { return 404; }
}
EOF
sudo ln -s /etc/nginx/sites-available/_acme-temp.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### 7.4 証明書を取得する

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  -d <DOMAIN> -d www.<DOMAIN> -d cms.<DOMAIN>
```

初回はメールアドレス・利用規約への同意を対話式で聞かれる。成功すると `/etc/letsencrypt/live/<DOMAIN>/fullchain.pem` 等が作られる。

### 7.5 一時設定を撤去する

```bash
sudo rm /etc/nginx/sites-enabled/_acme-temp.conf /etc/nginx/sites-available/_acme-temp.conf
```

（§8で本来の設定に置き換える。ここで一旦 `nginx -t` は失敗する状態になるが、§8で正しい設定を置くまでの一時的な状態なので問題ない）

- [ ] `/etc/letsencrypt/live/<DOMAIN>/fullchain.pem` が存在する
- [ ] `sudo certbot certificates` で3ドメイン分のSANが確認できる

---

## 8. nginx配置

`[ローカル/PowerShell]` → `[VPS/bash: sudoユーザー]`

**順序が重要**: security-headers.conf（共通スニペット）→ 各vhost、の順に配置する。逆にすると `include` 先が無く `nginx -t` が失敗する。

```powershell
scp -i <SSH_KEY_PATH> -P 22 deploy\nginx\security-headers.conf deploy@<VPS_HOST>:/tmp/security-headers.conf
scp -i <SSH_KEY_PATH> -P 22 deploy\nginx\takemiko.com.conf deploy@<VPS_HOST>:/tmp/takemiko.com.conf
scp -i <SSH_KEY_PATH> -P 22 deploy\nginx\cms.takemiko.com.conf deploy@<VPS_HOST>:/tmp/cms.takemiko.com.conf
```

```bash
sudo mkdir -p /etc/nginx/snippets
sudo mv /tmp/security-headers.conf /etc/nginx/snippets/security-headers.conf
sudo mv /tmp/takemiko.com.conf /etc/nginx/sites-available/takemiko.com.conf
sudo mv /tmp/cms.takemiko.com.conf /etc/nginx/sites-available/cms.takemiko.com.conf
sudo ln -s /etc/nginx/sites-available/takemiko.com.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/cms.takemiko.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

`nginx -t` がエラーを出す場合は、`security-headers.conf` が `/etc/nginx/snippets/` に存在するか、証明書のパスが実在するかを確認する。

### 8.1 証明書の自動更新を検証する

```bash
sudo certbot renew --dry-run
```

エラーなく完了すること。`certbot.timer` がすでに有効になっているはず:
```bash
sudo systemctl status certbot.timer
```

- [ ] `nginx -t` が通る
- [ ] `sudo certbot renew --dry-run` が成功する

---

## 9. 静的サイトの初回デプロイ

### 9.1 GitHub Secretsを登録する `[ブラウザ]`

GitHubリポジトリ → Settings → Secrets and variables → Actions で、[`REFERENCE.md` 表A](./REFERENCE.md#2-表a-github-secrets全11件) の①〜⑥を登録する（⑦〜⑪はStrapi構築後の §10.8 で追加する）。

`SSH_KNOWN_HOSTS` の値は `[ローカル/PowerShell]` で取得する:
```powershell
ssh-keyscan -p 22 <VPS_HOST> > known_hosts.txt
Get-Content known_hosts.txt
```
（秘密情報ではない。中身をコピーしたら `Remove-Item known_hosts.txt` で削除してよい）

### 9.2 GitHub CLIを認証する `[ローカル/PowerShell]`

```powershell
gh auth login
```
ブラウザでのOAuth認証を選ぶ。

### 9.3 初回デプロイ

```powershell
cd web
pnpm release
```

`web/scripts/release.sh` の3つのガード（作業ツリーが汚れていない・`origin/main`と一致・ビルド成果物のサニティチェック）を通過すると、GitHub Releaseが作られ、Actionsが自動でVPSへrsyncする。GitHubリポジトリのActionsタブで進捗を確認できる。

### 9.4 動作確認 `[ローカル/PowerShell]`

```powershell
curl.exe -sI https://<DOMAIN>/
```
`200` かつ `Cache-Control: public, max-age=0, must-revalidate` を確認。

ハッシュ付き静的アセットのキャッシュ確認（実際のファイル名は `dist/_astro/` を見て拾う。例: `pnpm build` 後の `web/dist/_astro/*.css`）:
```powershell
curl.exe -sI https://<DOMAIN>/_astro/<実際のファイル名>
```
`Cache-Control: public, max-age=31536000, immutable` を確認。

```powershell
curl.exe -sI https://<DOMAIN>/no-such-page/
```
`404` を確認。

セキュリティヘッダーの確認:
```powershell
curl.exe -sI https://<DOMAIN>/ | Select-String "x-content-type|x-frame|referrer-policy|strict-transport|content-security-policy"
```
5行前後表示されることを確認。

- [ ] トップページが200で表示される
- [ ] `/_astro/` のハッシュ付きファイルが `immutable` キャッシュを返す
- [ ] 存在しないパスが404を返す
- [ ] セキュリティヘッダーが返る

---

## 10. Strapi本番構築

`[VPS/bash: sudoユーザー]` を基本に、`[VPS/bash: deploy]` を挟む。

### 10.1 Node・PostgreSQLのインストール

```bash
sudo apt install -y nodejs npm postgresql
node -v   # v20〜v26系であることを確認（.nvmrcのローカル24系と完全一致しなくてよい。REFERENCE §4参照）
```

### 10.2 データベースとロールを作成する

```bash
openssl rand -base64 24
```
（出力はあなたしか見ません。控えておく）

```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE takemiko_cms;
CREATE USER strapi WITH ENCRYPTED PASSWORD '上で生成したパスワード';
GRANT ALL PRIVILEGES ON DATABASE takemiko_cms TO strapi;
ALTER DATABASE takemiko_cms OWNER TO strapi;
\q
```

（任意）`/etc/postgresql/18/main/postgresql.conf` の `shared_buffers` を `512MB` に変更 → `sudo systemctl restart postgresql`。

### 10.3 CMSコードを取得する

GitHubで **Fine-grained PAT**（対象リポジトリのみ、**Contents: Read-only**）を発行する `[ブラウザ]`。

```bash
sudo mkdir -p /opt/takemiko-cms-src
sudo chown deploy:deploy /opt/takemiko-cms-src
```

`[VPS/bash: deploy]`:
```bash
sudo su - deploy
git clone --no-checkout --filter=blob:none \
  https://<GitHubユーザー名>:<上で発行したPAT>@github.com/<GITHUB_OWNER>/takemikosite.git /opt/takemiko-cms-src
cd /opt/takemiko-cms-src
git sparse-checkout set cms
git checkout main
exit
```

`[VPS/bash: sudoユーザー]`:
```bash
sudo ln -s /opt/takemiko-cms-src/cms /opt/takemiko-cms
```

`[VPS/bash: deploy]`:
```bash
sudo su - deploy
cd /opt/takemiko-cms
npm ci
npm run build
exit
```

### 10.4 `/etc/takemiko-cms.env` を作成する

`[VPS/bash: sudoユーザー]`。まずGitHubでもう1つ **Fine-grained PAT**（**Contents: Read and write**）を発行する `[ブラウザ]`（lifecycle subscriberが再ビルドを要求するために使う。10.3のPATとは別物）。

シークレットを7個まとめて生成する:
```bash
for i in $(seq 7); do openssl rand -base64 32; echo; done
```

[`REFERENCE.md` 表B](./REFERENCE.md#3-表b-etctakemiko-cmsenv-の完成形) の完成形どおりに、1回で全項目を埋める:
```bash
sudo nano /etc/takemiko-cms.env
```

```
NODE_ENV=production
HOST=127.0.0.1
PORT=1337

APP_KEYS=<生成1>,<生成2>
API_TOKEN_SALT=<生成3>
ADMIN_JWT_SECRET=<生成4>
JWT_SECRET=<生成5>
TRANSFER_TOKEN_SALT=<生成6>
ENCRYPTION_KEY=<生成7>

DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=takemiko_cms
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=<10.2で生成したパスワード>
DATABASE_SSL=false

GH_REPO=<GITHUB_OWNER>/takemikosite
GH_TOKEN=<このステップで発行したPAT>
```

**`HOST=127.0.0.1` は必須**（Strapiを外部に直接晒さないため）。

```bash
sudo chown root:root /etc/takemiko-cms.env
sudo chmod 600 /etc/takemiko-cms.env
```

### 10.5 systemdサービスを配置する

`[ローカル/PowerShell]`:
```powershell
scp -i <SSH_KEY_PATH> -P 22 deploy\systemd\takemiko-cms.service deploy@<VPS_HOST>:/tmp/takemiko-cms.service
```

`[VPS/bash: sudoユーザー]`:
```bash
sudo mv /tmp/takemiko-cms.service /etc/systemd/system/takemiko-cms.service
sudo systemctl daemon-reload
sudo systemctl enable --now takemiko-cms
sudo systemctl status takemiko-cms
journalctl -u takemiko-cms -n 50 --no-pager
```

`Strapi started successfully` が出ていることを確認する。`ProtectSystem=strict` 等のサンドボックス設定は最初からこのユニットファイルに含まれている（後述の管理画面初期設定でアップロードが正常に動くかも確認する）。

### 10.6 cms.takemiko.com は §8 で配置済み

nginx側の `cms.<DOMAIN>` vhostは §8 で既に配置済み。動作確認:
```powershell
curl.exe -sI https://cms.<DOMAIN>/admin
```
`200` または `302` を確認。

### 10.7 管理画面の初回セットアップ `[ブラウザ]`

`https://cms.<DOMAIN>/admin` を開き、初回管理者アカウントを作成する（メールアドレス・パスワードは直接ブラウザに入力する）。

作成後、プロフィールメニュー → Interface language を **日本語** に変更 → 「保存」ボタンを押す（保存しないと反映されない）。

テスト画像を1枚アップロードし、`ProtectSystem=strict` サンドボックスがアップロード書き込みを妨げていないことを確認する。

### 10.8 コンテンツを投入する

新規構築（移行元データが無い）場合は、Content-Type Builderで定義済みのコンテンツタイプ（記事・カテゴリ・制作実績・SNSリンク・グッズリンク）へ、管理画面から直接データを入力する。

既存環境からの移行の場合は、移行元でTransfer Token（Push権限）を発行し、`npx strapi transfer --to https://cms.<DOMAIN>/admin --to-token <token>` を移行元で実行する。

### 10.9 本番APIトークンとGitHub Secrets `[ブラウザ]` `[ローカル/PowerShell]`

Strapi管理画面 → Settings → API Tokens → Create new API Token（Read-only）を発行。

GitHub Secretsに [`REFERENCE.md` 表A](./REFERENCE.md#2-表a-github-secrets全11件) の⑦〜⑨を追加登録する。ローカルの `web/.env.production` にも同じ値を設定する（`pnpm release` が本番と同じ内容でビルドするため。gitignore済み）。

### 10.10 fail2ban（Strapi管理画面用jail）

`[ローカル/PowerShell]`:
```powershell
scp -i <SSH_KEY_PATH> -P 22 deploy\fail2ban\filter.d\takemiko-cms.conf deploy@<VPS_HOST>:/tmp/takemiko-cms-filter.conf
scp -i <SSH_KEY_PATH> -P 22 deploy\fail2ban\jail.d\takemiko-cms.local deploy@<VPS_HOST>:/tmp/takemiko-cms.local
```

`[VPS/bash: sudoユーザー]`:
```bash
sudo mv /tmp/takemiko-cms-filter.conf /etc/fail2ban/filter.d/takemiko-cms.conf
sudo mv /tmp/takemiko-cms.local /etc/fail2ban/jail.d/takemiko-cms.local
sudo systemctl restart fail2ban
sudo fail2ban-client status takemiko-cms
```

### 10.11 経路Bの動作確認

Strapi管理画面で記事を1本「公開」する → 約30秒後、GitHub Actionsの `Deploy (Content / 記事更新)` が起動する → 数分後に `https://<DOMAIN>/` の最新のお知らせに反映される → 「非公開」に戻すと同様に反映されて消える。

- [ ] `journalctl -u takemiko-cms` に `Strapi started successfully` が出る
- [ ] 管理画面でのアップロードが成功する
- [ ] 記事の公開・非公開が本番サイトに反映される

---

## 11. バックアップ

`[ローカル/PowerShell]` → `[VPS/bash: sudoユーザー]`

```powershell
scp -i <SSH_KEY_PATH> -P 22 deploy\backup\backup-cms.sh deploy@<VPS_HOST>:/tmp/backup-cms.sh
```

```bash
sudo mv /tmp/backup-cms.sh /usr/local/sbin/backup-cms.sh
sudo chown root:root /usr/local/sbin/backup-cms.sh
sudo chmod 700 /usr/local/sbin/backup-cms.sh

sudo /usr/local/sbin/backup-cms.sh
sudo ls -la /var/backups/takemiko/
```

`db-<日時>.sql.gz` と（アップロードがあれば）`uploads-<日時>.tar.gz` が作られていることを確認する。

日次cronを設定する:
```bash
sudo tee /etc/cron.d/takemiko-backup > /dev/null <<'EOF'
0 18 * * * root /usr/local/sbin/backup-cms.sh >> /var/log/takemiko-backup.log 2>&1
EOF
```
（UTC 18:00 = JST 03:00）

ログローテーションを設定する:
```bash
sudo tee /etc/logrotate.d/takemiko-backup > /dev/null <<'EOF'
/var/log/takemiko-backup.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
EOF
```

復元リハーサルを1回実施する（本番データには一切触れない。手順は [`OPERATIONS.md` §8.2](./OPERATIONS.md#82-復元リハーサル本番に触れない) と同一）。

- [ ] 手動実行でバックアップファイルが作られる
- [ ] `/etc/cron.d/takemiko-backup` を設置した
- [ ] `/etc/logrotate.d/takemiko-backup` を設置した
- [ ] 復元リハーサルを1回成功させた

---

## 12. Cloudflare Worker（お問い合わせフォーム）

`[ローカル/PowerShell]`、`worker/` ディレクトリで。

### 12.1 wrangler にログイン

```powershell
npx wrangler login
```

### 12.2 D1データベースを作成する

```powershell
npx wrangler d1 create takemiko-contact
```

出力の `database_id` をコピーし、`worker/wrangler.toml` の `database_id` を**この値に置き換えてコミットする**（このリポジトリには前回構築時のIDが残っているため、必ず新しい値に置き換える）。

### 12.3 スキーマを適用する

**新規構築では `schema.sql` のみを適用する**（`migrations/` は既存データベースへの差分なので流さない。[`REFERENCE.md` §6](./REFERENCE.md#6-表e-d1-スキーマ台帳worker) 参照）:

```powershell
npx wrangler d1 execute takemiko-contact --remote --file=schema.sql
```

### 12.4 Turnstileサイトを登録する `[ブラウザ]`

Cloudflareダッシュボード → Turnstile → サイトを追加。ドメイン `<DOMAIN>`、ウィジェットモード Managed。Site Key（公開情報）とSecret Key（秘密情報）を控える。

### 12.5 Resendに登録する `[ブラウザ]`

[resend.com](https://resend.com) でアカウント作成、APIキーを発行する（無料枠で十分、ドメイン認証は不要）。デフォルトの送信元 `onboarding@resend.dev` は、Resend登録メールアドレス宛にのみ送信できる制限があるが、運営者への通知用途なので問題ない。

### 12.6 Workerにシークレットを登録する

```powershell
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CONTACT_NOTIFY_EMAIL
```
それぞれプロンプトで値を直接入力する。

### 12.7 デプロイする

```powershell
npx wrangler deploy
```
出力される `<WORKER_URL>`（例: `https://form.takemiko.workers.dev`）を控える。同時に `wrangler.toml` の `[triggers]` に設定されたCron（データ保持期限切れの自動削除・通知メール再送）も有効化される。

### 12.8 Worker URLを3箇所に反映する

- [ ] `web/.env` と `web/.env.production` に `PUBLIC_CONTACT_ENDPOINT=<WORKER_URL>` と `PUBLIC_TURNSTILE_SITE_KEY=<12.4のSite Key>` を追加
- [ ] GitHub Secretsに同じ2つを登録（[`REFERENCE.md` 表A](./REFERENCE.md#2-表a-github-secrets全11件) ⑩⑪）
- [ ] `deploy/nginx/security-headers.conf` のCSP `connect-src` に含まれる `<WORKER_URL>` が実際のURLと一致しているか確認し、違えば書き換えて §8 と同じ手順で再配置・`nginx -t`・reload
- [ ] `web` を `pnpm release` で再リリース

### 12.9 動作確認

`https://<DOMAIN>/contact/` を開き、フォームが表示される（「準備中」フォールバックでない）ことを確認。1件テスト送信し、12.5で設定したメールアドレスに通知が届くことを確認。

- [ ] `database_id` を新しい値に置き換えてコミットした
- [ ] `/contact/` でフォームが表示される
- [ ] テスト送信で通知メールが届く

---

## 13. 受け入れ検証

すべて新規構築後、または既存環境からの移行後に一度通しで実行する。

| # | 確認項目 | コマンド/操作 | 期待結果 |
|---|---|---|---|
| 1 | HTTPS | `curl.exe -sI https://<DOMAIN>/` | `200` |
| 2 | HTTP→HTTPSリダイレクト | `curl.exe -sI http://<DOMAIN>/` | `301` → `https://<DOMAIN>/` |
| 3 | www→apex正規化 | `curl.exe -sI https://www.<DOMAIN>/` | `301` → `https://<DOMAIN>/` |
| 4 | 静的アセットキャッシュ | `curl.exe -sI https://<DOMAIN>/_astro/<実ファイル名>` | `Cache-Control: ...immutable` |
| 5 | 404 | `curl.exe -sI https://<DOMAIN>/no-such-page/` | `404` |
| 6 | セキュリティヘッダー | `curl.exe -sI https://<DOMAIN>/ \| Select-String "x-content-type\|x-frame\|referrer-policy\|strict-transport\|content-security-policy"` | 5行前後表示 |
| 7 | CMS管理画面 | `curl.exe -sI https://cms.<DOMAIN>/admin` | `200`/`302` |
| 8 | CMS未認証API | `curl.exe -sI https://cms.<DOMAIN>/api/articles` | `403` |
| 9 | CMS CORS制限 | `curl.exe -sI -H "Origin: https://evil.example.com" https://cms.<DOMAIN>/api/articles` | `Access-Control-Allow-Origin` が返らない |
| 10 | フォーム: トークンなし | POST（本文は[`OPERATIONS.md` §12](./OPERATIONS.md#12-外形確認)参照） | `400` |
| 11 | フォーム: 不正Origin | 同上、`Origin: https://evil.example.com` | `403` |
| 12 | フォーム: レート制限 | 同一IPから6回連続POST | 6回目が `429` |
| 13 | フォーム: ハニーポット | `website` フィールドを埋めて送信 | `200`（成功を装う）だがD1に未保存 |
| 14 | バックアップ生成 | `sudo /usr/local/sbin/backup-cms.sh` → `ls` | ファイルが増える |
| 15 | 証明書更新 | `sudo certbot renew --dry-run` | 成功 |
| 16 | fail2ban | `sudo fail2ban-client status takemiko-cms` | ジェイルが有効 |
| 17 | 経路A/B一致 | `pnpm release`（無変更）→ 経路Bを`workflow_dispatch`で手動実行 → 目視比較 | 差分なし |

すべてチェックできたら再構築完了。

---

## 14. 別ドメイン・別アカウントで建てる場合

このリポジトリのコードは `<DOMAIN>`・Cloudflareアカウント固有の値を複数箇所にハードコードしている。[`REFERENCE.md` 表G](./REFERENCE.md#8-表g-ドメインurlがハードコードされている箇所) の全箇所を書き換えてからこのガイドを開始すること。特に `worker/wrangler.toml` の `database_id` は §12.2 で新しい値に置き換わるまで前の環境の値が残っている点に注意。

---

## 15. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `nginx -t` が失敗する | `security-headers.conf` が未配置、または証明書パスが存在しない | §8の順序（snippets→vhost）を再確認 |
| certbotが80番を確保できないと言う | ufwまたはクラウド側フィルタが閉じている／別プロセスが80番を使用中 | `sudo ss -tlnp \| grep :80`、§4.3を再確認 |
| Strapiが起動しない・すぐ落ちる | `/etc/takemiko-cms.env` の記述ミス、または `ProtectSystem=strict` が想定外のパスへの書き込みを拒否している | `journalctl -u takemiko-cms -n 100 --no-pager` でエラー内容を確認 |
| GitHub Actionsのrsyncが失敗する | `SSH_KNOWN_HOSTS` が古い／VPSのホストキーが変わった | `ssh-keyscan` を取り直してSecretを更新 |
| 記事を公開しても経路Bが走らない | `GH_TOKEN`/`GH_REPO` の設定ミス、またはPATの権限不足（Contents: Read and write が必要） | `/etc/takemiko-cms.env` を確認、Strapiを再起動してログを見る |
| CORS制限後に管理画面のフロントが壊れた | `cms/config/middlewares.ts` の `origin` がアクセスしているドメインと不一致 | 表G参照、`https://cms.<DOMAIN>` と完全一致させる |
| `strapi transfer` が接続できない | Transfer Tokenの権限不足、またはURLの末尾に `/admin` が抜けている | `--to` の値を `https://cms.<DOMAIN>/admin` の形にする |
| フォーム送信が常にCSP違反でブロックされる | `security-headers.conf` のCSPに実際のWorker URLが含まれていない | §12.8参照 |

---

## 付録: 全チェックリスト（コピー用）

```
□ §2  必要なアカウントをすべて用意した
□ §3  ローカルで pnpm build / pnpm test / npm test が通る
□ §4  ufw allow OpenSSH → enable → 80,443許可 の順で実行、クラウド側フィルタも開放、fail2ban(sshd)有効
□ §5  deploy ユーザーでSSHログインできる（sudoなし）
□ §6  DNS 3レコードが伝播した
□ §7  webroot方式で証明書を取得した
□ §8  nginx -t が通り、443で応答する
□ §9  経路Aで初回デプロイ、curlチェック4種が通る
□ §10 Strapiが起動し、アップロードが成功し、経路Bで記事が反映される
□ §11 バックアップの手動実行・cron・logrotate・復元リハーサル
□ §12 Workerがデプロイされ、フォーム送受信が成功する
□ §13 受け入れ検証17項目すべて完了
```
