# Phase 4 実行手順（あなたのターミナルで実行）

このファイルはコマンド集です。**すべてあなた自身のターミナルで実行してください**（Claude は実行しません）。
秘密情報が関わる手順が中心のため、意図的にそうしています。

ローカルPC側は **PowerShell**、VPSにログインした後は **bash** を想定しています（VPSがLinuxのため）。

---

## 1. デプロイ用 SSH 鍵ペアを生成する（ローカルPC・PowerShell）

```powershell
ssh-keygen -t ed25519 -C "github@takemiko" -f C:\Users\mikoto\.ssh\takemiko_github
```

実行すると2回プロンプトが出ます。**両方とも何も入力せず Enter だけ押してください**（パスフレーズなしにするため。GitHub Actions が自動実行するため空にする必要があります）。

```
Enter passphrase (empty for no passphrase): [Enterのみ]
Enter same passphrase again: [Enterのみ]
```

- `C:\Users\mikoto\.ssh\takemiko_github`（秘密鍵）と `takemiko_github.pub`（公開鍵）が作られます。
- 普段使いの SSH 鍵とは別にしてください（これは専用の新しい鍵です）。

## 2. VPS に SSH ログインし、80/443 を開放する（VPS・bash）

```bash
sudo ufw allow 80,443/tcp
sudo ufw status
```

**⚠️ クラウド側のセキュリティグループ/パケットフィルタも別途確認してください**（さくら/ConoHa/Xserver 等のコンソール側）。両方開くまで証明書は発行できません。

DNS設定後、ローカルPCから `curl -I http://takemiko.com` が接続拒否にならなければ成功です。

## 3. DNS を VPS に向ける

DNS 管理画面で、以下の A/AAAA レコードを VPS の IP に向けてください（レジストラの管理画面での作業。Claude からは操作できません）。

- `takemiko.com`
- `www.takemiko.com`
- `cms.takemiko.com`（Phase 5 で使いますが、証明書をまとめて取るため今のうちに設定）

## 4. deploy ユーザーを作成し、公開鍵を登録する（VPS・bash）

既存の sudo ユーザーでログインした状態で:

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/takemiko/releases
sudo chown -R deploy:deploy /var/www/takemiko

sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
```

手順1で作った**公開鍵ファイルの中身**を、ローカルPC（PowerShell）で表示してコピーします:

```powershell
Get-Content C:\Users\mikoto\.ssh\takemiko_github.pub
```

表示された1行（`ssh-ed25519 AAAA... github@takemiko`）をコピーし、VPS側で:

```bash
sudo nano /home/deploy/.ssh/authorized_keys
# ↑ コピーした公開鍵の1行を貼り付けて保存（Ctrl+O → Enter → Ctrl+X）

sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

**deploy ユーザーには sudo を与えません。**

動作確認（ローカルPC・PowerShellから）:
```powershell
ssh -i C:\Users\mikoto\.ssh\takemiko_github -p 22 deploy@<VPSのホスト名またはIP>
```
ログインできれば成功（`exit` で抜けてください）。

## 5. nginx と certbot をインストールし、サイト設定を配置する（VPS・bash）

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

このリポジトリの `deploy/nginx/takemiko.com.conf` を VPS に転送します（ローカルPC・PowerShellから、リポジトリのルートで実行）:
```powershell
scp deploy\nginx\takemiko.com.conf <sudoユーザー>@<VPSホスト>:/tmp/takemiko.com.conf
```

VPS 側で配置:
```bash
sudo mv /tmp/takemiko.com.conf /etc/nginx/sites-available/takemiko.com.conf
sudo ln -s /etc/nginx/sites-available/takemiko.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. TLS 証明書を発行する（VPS・bash）

```bash
sudo certbot --nginx -d takemiko.com -d www.takemiko.com -d cms.takemiko.com
```

`cms.takemiko.com` はまだ nginx 設定が無いため、certbot が「該当する server ブロックが見つからない」と聞いてくる場合があります。その場合は `takemiko.com` と `www.takemiko.com` の2つだけで先に発行し、`cms.takemiko.com` は Phase 5 で改めて発行してください:
```bash
sudo certbot --nginx -d takemiko.com -d www.takemiko.com
```

## 7. SSH known_hosts を取得する（ローカルPC・PowerShell）

GitHub Actions が「知らないホストへの接続」を拒否しないよう、事前に host key を登録します。

```powershell
ssh-keyscan -p 22 <VPSのホスト名またはIP> > takemiko_known_hosts.txt
Get-Content takemiko_known_hosts.txt
```

この中身（**秘密情報ではありません**。公開鍵情報です）を、次の GitHub Secrets 登録で使います。

## 8. GitHub Secrets を登録する

GitHub リポジトリ → Settings → Secrets and variables → Actions → New repository secret で、以下 6 つを登録してください（この時点で `STRAPI_URL` 等は不要です）。

| Secret名 | 値 |
|---|---|
| `SSH_PRIVATE_KEY` | `Get-Content C:\Users\mikoto\.ssh\takemiko_github` で表示した中身全体 |
| `SSH_HOST` | VPS のホスト名または IP |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | `22` |
| `SSH_KNOWN_HOSTS` | 手順7で取得した `takemiko_known_hosts.txt` の中身 |
| `DEPLOY_PATH` | `/var/www/takemiko` |

## 9. GitHub CLI を認証する（ローカルPC、初回デプロイに必要）

```powershell
gh auth login
```
ブラウザでの認証を選んでください（パスワード入力は不要な OAuth フローです）。

## 10. 初回デプロイ

```powershell
cd web
pnpm release
```

成功すると GitHub Release が作られ、Actions が自動で VPS へ配送します。GitHub リポジトリの Actions タブで進捗を確認できます。

## 11. 動作確認（ローカルPCから）

```powershell
curl.exe -I https://takemiko.com/
curl.exe -I https://takemiko.com/_astro/
curl.exe -I https://takemiko.com/no-such-page/
```
（PowerShell の `curl` は `Invoke-WebRequest` のエイリアスのため、`curl.exe` と明示してください）

- 1つ目: `200` かつ `Cache-Control: public, max-age=0, must-revalidate`
- 2つ目: `Cache-Control: public, max-age=31536000, immutable`
- 3つ目: `404`

すべて OK なら Phase 4 完了です。
