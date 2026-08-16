# セキュリティレビュー対応の反映手順（あなたのターミナルで実行）

Codex/Geminiによるレビュー指摘への対応をリポジトリに反映しました。ここではその変更を **稼働中の本番VPSへ反映**する手順をまとめます。すべてあなた自身のターミナルで実行してください。

ローカルPC側は **PowerShell**、VPSにログインした後は **bash** を想定しています。

---

## 1. nginx 設定を更新する（サイト本体・CMS両方 + 新規スニペット）

ローカルPC・PowerShellから、リポジトリのルートで実行:

```powershell
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\nginx\security-headers.conf deploy@162.43.44.178:/tmp/security-headers.conf
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\nginx\takemiko.com.conf deploy@162.43.44.178:/tmp/takemiko.com.conf
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\nginx\cms.takemiko.com.conf deploy@162.43.44.178:/tmp/cms.takemiko.com.conf
```

VPS側（sudo ユーザー）:

```bash
sudo mkdir -p /etc/nginx/snippets
sudo mv /tmp/security-headers.conf /etc/nginx/snippets/security-headers.conf
sudo mv /tmp/takemiko.com.conf /etc/nginx/sites-available/takemiko.com.conf
sudo mv /tmp/cms.takemiko.com.conf /etc/nginx/sites-available/cms.takemiko.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

動作確認（ローカルPCから）:
```powershell
curl.exe -sI https://takemiko.com/ | Select-String "x-content-type|x-frame|referrer-policy|strict-transport|content-security-policy"
```
何行か表示されれば、セキュリティヘッダーが正しく返るようになっています（§SEC-05）。

## 2. fail2ban フィルタを更新する（実パス修正）

ローカルPC・PowerShellから:
```powershell
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\fail2ban\filter.d\takemiko-cms.conf deploy@162.43.44.178:/tmp/takemiko-cms-filter.conf
```

VPS側（sudo ユーザー）:
```bash
sudo mv /tmp/takemiko-cms-filter.conf /etc/fail2ban/filter.d/takemiko-cms.conf
sudo systemctl restart fail2ban
sudo fail2ban-client status takemiko-cms
```

## 3. systemd サービスを更新する（サンドボックス強化）

ローカルPC・PowerShellから:
```powershell
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\systemd\takemiko-cms.service deploy@162.43.44.178:/tmp/takemiko-cms.service
```

VPS側（sudo ユーザー）:
```bash
sudo mv /tmp/takemiko-cms.service /etc/systemd/system/takemiko-cms.service
sudo systemctl daemon-reload
sudo systemctl restart takemiko-cms
sudo systemctl status takemiko-cms
journalctl -u takemiko-cms -n 30 --no-pager
```

`Active: active (running)` になっていること、エラーが出ていないことを確認してください。`ProtectSystem=strict` 等の追加でアップロード書き込みが壊れていないか、後述の手順4のビルド後に確認します。

## 4. CMS のコードを反映する（CORS制限・アップロード形式縮小・poweredBy無効化）

VPS側、deploy ユーザーで（README.md「CMS コード更新の反映」と同じ手順）:

```bash
sudo su - deploy
cd /opt/takemiko-cms-src
git pull origin main
cd cms
npm ci
npm run build
exit
```

sudo ユーザーに戻って:
```bash
sudo systemctl restart takemiko-cms
journalctl -u takemiko-cms -n 30 --no-pager
```

`Strapi started successfully` が出ていることを確認してください。

動作確認（ローカルPCから、CORSが制限されたことの確認）:
```powershell
curl.exe -sI -H "Origin: https://evil.example.com" https://cms.takemiko.com/api/articles
```
`Access-Control-Allow-Origin` ヘッダーが返らない（またはevil.example.comが反射されない）ことを確認してください。

## 5. Worker を更新する（Turnstile検証強化・レート制限・保持期間・再送）

まず、追加されたカラム（`delivery_status`等）を本番D1に適用します。ローカルPC・PowerShellから:

```powershell
cd worker
npx wrangler d1 execute takemiko-contact --remote --file=migrations/0001_delivery_tracking.sql
```

続けてデプロイします（`[triggers]` の Cron も同時に有効化されます）:
```powershell
npx wrangler deploy
```

## 6. 攻撃耐性の再確認

デプロイ後に教えてください。以下を私の方で curl 確認します:
- Turnstileのhostname/action検証が効いているか（不正なトークンで送信した際のエラー内容）
- 同一IPから短時間に6回送信するとレート制限(429)が返るか
- セキュリティヘッダー・CSPが本番で実際に返っているか

すべて OK なら、今回のセキュリティレビュー対応は完了です。
