# Phase 6 実行手順（あなたのターミナルで実行）

このファイルはコマンド集です。**すべてあなた自身のターミナルで実行してください**（Claude は実行しません）。

ローカルPC側は **PowerShell**、VPSにログインした後は **bash** を想定しています。

---

## 1. バックアップスクリプトを配置する（ローカルPC → VPS）

ローカルPC・PowerShellから、リポジトリのルートで実行:

```powershell
scp -i C:\Users\mikoto\.ssh\takemiko_github -P 22 deploy\backup\backup-cms.sh deploy@162.43.44.178:/tmp/backup-cms.sh
```

VPS側（sudo ユーザー）:

```bash
sudo mv /tmp/backup-cms.sh /usr/local/sbin/backup-cms.sh
sudo chown root:root /usr/local/sbin/backup-cms.sh
sudo chmod 700 /usr/local/sbin/backup-cms.sh
```

**⚠️ このスクリプトは `/etc/takemiko-cms.env`（DBパスワード等を含む）を読み取るため、root専用の場所に置き、rootのみ実行できるようにしています。**

## 2. 手動で1回実行し、動作確認する（VPS・sudo ユーザー）

```bash
sudo /usr/local/sbin/backup-cms.sh
ls -la /var/backups/takemiko/
```

`db-<日時>.sql.gz` と `uploads-<日時>.tar.gz`（アップロード画像があれば）が作られていることを確認してください。

## 3. cron で毎日自動実行する（VPS・sudo ユーザー）

```bash
sudo nano /etc/cron.d/takemiko-backup
```

以下の内容を貼り付けて保存してください（毎日 JST 3:00 = UTC 18:00 に実行）:

```
0 18 * * * root /usr/local/sbin/backup-cms.sh >> /var/log/takemiko-backup.log 2>&1
```

保存後、翌日以降 `/var/log/takemiko-backup.log` にログが積まれていくか確認してください。

## 4. 復元リハーサルを1回実施する（VPS・sudo ユーザー）

本番データには触れず、一時的なテスト用DBに復元して検証します。

```bash
sudo -u postgres createdb takemiko_cms_restore_test
gunzip -c /var/backups/takemiko/db-<手順2で作られたファイル名の日時>.sql.gz | sudo -u postgres psql -d takemiko_cms_restore_test
sudo -u postgres psql -d takemiko_cms_restore_test -c "SELECT count(*) FROM articles;"
```

件数が本番の記事数とおおよそ一致していれば復元成功です。確認後、テスト用DBを削除してください:

```bash
sudo -u postgres dropdb takemiko_cms_restore_test
```

アップロード画像側も同様に確認します:

```bash
mkdir -p /tmp/uploads-restore-test
tar -xzf /var/backups/takemiko/uploads-<日時>.tar.gz -C /tmp/uploads-restore-test
ls /tmp/uploads-restore-test/uploads
rm -rf /tmp/uploads-restore-test
```

**この復元リハーサルが1回成功したことを確認できたら、Phase 6 の中で最も重要な項目は完了です。**

## 5. 二経路の一致検証（ローカルPC + ブラウザ）

経路A（ローカルビルド配送）と経路B（CMS更新時のCIビルド配送）が同じ結果を出すことを確認します。

1. ローカルPCで何も変更がない状態のまま、`web` ディレクトリで `pnpm release` を実行（コード変更がなければ実質何もしないはずですが、実行自体は成功することを確認）
2. GitHub リポジトリの Actions タブ → `Deploy (Content / 記事更新)` → **Run workflow** で経路Bを手動実行
3. 両方の配送が完了したら `https://takemiko.com/` を再読み込みし、見た目に差分が出ていないことを確認

差分が出た場合は `web/.env.production` の内容（`STRAPI_URL` 等）がローカルとCIで揃っているか確認してください（§6.7 の環境一致）。

## 6. プライバシーポリシー・構造化データの反映

このセッションで以下を実装済みです（コード側の作業は完了、あとはデプロイするだけです）:
- `/privacy/` ページ（GA4の利用について明記）
- トップページに `Person` / `WebSite` の構造化データ（`sameAs` に本番SNSリンクが自動反映されます）
- フッターに「プライバシーポリシー」へのリンク

反映するには、ローカルで `pnpm release` を実行してください（手順5と合わせて1回で構いません）。

反映後、以下で確認してください:
```powershell
curl.exe -I https://takemiko.com/privacy/
```
`200` が返れば OK です。

任意で [Google リッチリザルトテスト](https://search.google.com/test/rich-results) に `https://takemiko.com/` を入力し、`Person` と `WebSite` が検出されるか確認すると安心です。

すべて OK なら Phase 6 完了です。
