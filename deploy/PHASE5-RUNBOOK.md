# Phase 5 実行手順（あなたのターミナルで実行）

このファイルはコマンド集です。**すべてあなた自身のターミナルで実行してください**（Claude は実行しません）。
秘密情報が関わる手順が中心のため、意図的にそうしています。

ローカルPC側は **PowerShell**、VPSにログインした後は **bash** を想定しています。

前提：Phase 4 が完了しており、`takemiko.com` が公開済み、TLS証明書は `takemiko.com` / `www.takemiko.com` / `cms.takemiko.com` の3ドメイン分を取得済みです。

---

## 1. Node と PostgreSQL をインストールする（VPS・bash）

Ubuntu 26.04 の標準リポジトリに Node 22 / PostgreSQL 18 が入っているため、外部リポジトリの追加は不要です。

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql
node -v   # v22.x であることを確認
```

## 2. データベースとロールを作成する（VPS・bash）

まずパスワードを生成します（**このターミナルの出力はあなたしか見ません。Claude には共有しないでください**）:

```bash
openssl rand -base64 24
```

表示された文字列を控えたら、PostgreSQL にロールとDBを作成します:

```bash
sudo -u postgres psql
```

psql のプロンプトで（`'ここに上のパスワードを貼り付け'` を実際の値に置き換えてください）:

```sql
CREATE DATABASE takemiko_cms;
CREATE USER strapi WITH ENCRYPTED PASSWORD 'ここに上のパスワードを貼り付け';
GRANT ALL PRIVILEGES ON DATABASE takemiko_cms TO strapi;
ALTER DATABASE takemiko_cms OWNER TO strapi;
\q
```

（任意・推奨）`shared_buffers` を増やす場合は `/etc/postgresql/18/main/postgresql.conf` を編集し `shared_buffers = 512MB` に変更後、`sudo systemctl restart postgresql`。

## 3. deploy ユーザーで CMS のコードを取得する（VPS・bash）

GitHub で **Fine-grained PAT** を発行します（あなたのブラウザで）：
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
- Repository access: このリポジトリのみ
- Permissions: **Contents: Read-only** のみ

発行されたトークンは Claude に共有せず、このあとの `git clone` コマンドに直接使ってください。

```bash
sudo su - deploy
```

（deploy ユーザーのシェルに入ります。以降このセクションは deploy ユーザーとして実行）

```bash
git clone --no-checkout --filter=blob:none \
  https://<GitHubユーザー名>:<上で発行したPAT>@github.com/<owner>/takemikosite.git /opt/takemiko-cms-src
cd /opt/takemiko-cms-src
git sparse-checkout set cms
git checkout main
exit
```

（deploy から抜けて、元の sudo ユーザーに戻ります）

```bash
sudo ln -s /opt/takemiko-cms-src/cms /opt/takemiko-cms
sudo chown -R deploy:deploy /opt/takemiko-cms-src

sudo su - deploy
cd /opt/takemiko-cms
npm ci
npm run build
exit
```

## 4. `/etc/takemiko-cms.env` を作成する（VPS・bash、sudo ユーザー）

まず必要なシークレットをまとめて生成します（**出力はあなたしか見ません**）:

```bash
for i in 1 2 3 4 5; do openssl rand -base64 32; echo; done
```

5個の値が表示されます。順に `APP_KEYS`（1つ目。カンマ区切りで複数入れる場合はもう1回生成して `,` で連結）、`API_TOKEN_SALT`、`ADMIN_JWT_SECRET`、`JWT_SECRET`、`TRANSFER_TOKEN_SALT`、`ENCRYPTION_KEY` に割り当てます（6項目必要なので、上のループを `1 2 3 4 5 6` にして6個生成してください）。

```bash
sudo nano /etc/takemiko-cms.env
```

以下の内容を、生成した値と手順2のDBパスワードで埋めて保存してください（`cms/.env.example` と同じ項目です）:

```
NODE_ENV=production
HOST=127.0.0.1
PORT=1337

APP_KEYS=ここに生成した値
API_TOKEN_SALT=ここに生成した値
ADMIN_JWT_SECRET=ここに生成した値
JWT_SECRET=ここに生成した値
TRANSFER_TOKEN_SALT=ここに生成した値
ENCRYPTION_KEY=ここに生成した値

DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=takemiko_cms
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=手順2で生成したパスワード
DATABASE_SSL=false
```

**⚠️ `HOST=127.0.0.1` を必ず指定してください**（Strapi を外部に直接晒さないため。外部からは nginx 経由のみでアクセスさせます）。

```bash
sudo chown root:root /etc/takemiko-cms.env
sudo chmod 600 /etc/takemiko-cms.env
```

## 5. systemd サービスを配置する（ローカルPC → VPS）

ローカルPC・PowerShellから、リポジトリのルートで実行:

```powershell
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\systemd\takemiko-cms.service deploy@<VPSホスト>:/tmp/takemiko-cms.service
```

VPS側（sudo ユーザー）:

```bash
sudo mv /tmp/takemiko-cms.service /etc/systemd/system/takemiko-cms.service
sudo systemctl daemon-reload
sudo systemctl enable --now takemiko-cms
sudo systemctl status takemiko-cms
journalctl -u takemiko-cms -f
```

`journalctl` でエラーなく起動しているのを確認したら `Ctrl+C` で抜けてください。

## 6. nginx に cms.takemiko.com を追加する（ローカルPC → VPS）

ローカルPC・PowerShellから:

```powershell
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\nginx\cms.takemiko.com.conf deploy@<VPSホスト>:/tmp/cms.takemiko.com.conf
```

VPS側（sudo ユーザー）:

```bash
sudo mv /tmp/cms.takemiko.com.conf /etc/nginx/sites-available/cms.takemiko.com.conf
sudo ln -s /etc/nginx/sites-available/cms.takemiko.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

動作確認（ローカルPCから）:

```powershell
curl.exe -I https://cms.takemiko.com/admin
```

`200` または `302` が返れば OK です。

## 7. 管理画面の初回セットアップ（ブラウザ）

ブラウザで `https://cms.takemiko.com/admin` を開き、初回管理者アカウントを作成してください（**メールアドレス・パスワードはあなたが直接ブラウザに入力し、Claude には共有しないでください**）。

作成後、右上のプロフィールメニュー → Interface language を **日本語** に変更 → 必ず「保存」ボタンを押してください（保存しないと反映されません）。

続けて、Phase 3 でローカルに投入した内容と同じものを本番に投入してください：
- カテゴリ 5件（お知らせ／配信／イラスト／グッズ／プログラミング・AI）
- 記事（お知らせ）
- 制作実績（Works）
- SNS リンク（実アカウント）
- グッズ／支援リンク（NFT リンクは Draft のままで OK）

## 8. 本番 API トークンと GitHub Secrets（ブラウザ + ローカルPC）

Strapi 管理画面 → Settings → API Tokens → Create new API Token
- Name: `astro-build-readonly-prod`
- Token type: **Read-only**

発行されたトークンをコピーし（Claude には共有しないでください）、GitHub リポジトリ → Settings → Secrets and variables → Actions で以下を追加・更新してください:

| Secret名 | 値 |
|---|---|
| `STRAPI_URL` | `https://cms.takemiko.com` |
| `STRAPI_TOKEN` | 上で発行したトークン |
| `PUBLIC_GA_ID` | GA4 の測定ID（未設定なら空文字のまま） |

続けて、**ローカルの `web/.env.production` にも同じ値を設定**してください（`pnpm release` が本番と同じ内容でビルドするため）。ファイルが無ければ作成し、`web/.env.example` と同じ形式で `STRAPI_URL` / `STRAPI_TOKEN` / `PUBLIC_GA_ID` を埋めてください。このファイルは `.gitignore` 済みです。

## 9. 再ビルド自動トリガーを有効化する（VPS・bash）

GitHub で **もう1つ別の** Fine-grained PAT を発行します（手順3のものとは別。こちらは書き込み権限が要ります）：
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
- Repository access: このリポジトリのみ
- Permissions: **Contents: Read and write**

```bash
sudo nano /etc/takemiko-cms.env
```

末尾に以下を追加（`<owner>` は GitHub のユーザー名/Organization名）:

```
GH_REPO=<owner>/takemikosite
GH_TOKEN=上で発行したPAT
```

保存後、サービスを再起動:

```bash
sudo systemctl restart takemiko-cms
journalctl -u takemiko-cms -f
```

## 10. fail2ban を導入する（ローカルPC → VPS）

ローカルPC・PowerShellから:

```powershell
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\fail2ban\filter.d\takemiko-cms.conf deploy@<VPSホスト>:/tmp/takemiko-cms-filter.conf
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\fail2ban\jail.d\takemiko-cms.local deploy@<VPSホスト>:/tmp/takemiko-cms.local
```

VPS側（sudo ユーザー）:

```bash
sudo apt install -y fail2ban
sudo mv /tmp/takemiko-cms-filter.conf /etc/fail2ban/filter.d/takemiko-cms.conf
sudo mv /tmp/takemiko-cms.local /etc/fail2ban/jail.d/takemiko-cms.local
sudo systemctl restart fail2ban
sudo fail2ban-client status takemiko-cms
```

`Status for the jail: takemiko-cms` が表示されれば有効化成功です。

## 11. 動作確認

1. Strapi 管理画面で記事を1本「公開」する
2. 30秒ほど待ち、GitHub リポジトリの Actions タブで `Deploy (Content / 記事更新)` が起動することを確認
3. 数分後、`https://takemiko.com/` の最新のお知らせにその記事が出ていることを確認
4. 同じ記事を「非公開」に戻し、再度 Actions が起動してサイトから消えることを確認

すべて OK なら Phase 5 完了です。
