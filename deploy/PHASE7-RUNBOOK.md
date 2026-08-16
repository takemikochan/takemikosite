# Phase 7 実行手順（あなたのターミナルで実行）

このファイルはコマンド集です。**すべてあなた自身のターミナルで実行してください**（Claude は実行しません）。
秘密情報が関わる手順が中心のため、意図的にそうしています。

今回は画像素材の投入は行わず、**お問い合わせフォーム（Cloudflare Worker + Turnstile + D1）の実装のみ**を対象とします。

---

## 1. wrangler にログインする（ローカルPC・PowerShell）

```powershell
cd worker
npx wrangler login
```

ブラウザが開くので、Cloudflareアカウントで認証してください（OAuthのため、パスワードを直接入力する画面はここには出ません）。

## 2. D1 データベースを作成する

```powershell
npx wrangler d1 create takemiko-contact
```

出力の中に `database_id = "xxxxxxxx-xxxx-..."` という行があります。この値をコピーし、`worker/wrangler.toml` の `database_id = "REPLACE_WITH_D1_DATABASE_ID"` を書き換えてください。

## 3. D1 にスキーマを適用する

```powershell
npx wrangler d1 execute takemiko-contact --remote --file=schema.sql
```

## 4. Turnstile サイトを登録する（ブラウザ）

Cloudflareダッシュボード → Turnstile → サイトを追加
- ドメイン: `takemiko.com`
- ウィジェットモード: Managed（推奨）

発行される **Site Key**（公開情報）と **Secret Key**（秘密情報）を控えてください。

## 5. メール通知サービス（Resend）に登録する（ブラウザ）

[resend.com](https://resend.com) でアカウントを作成し、API Key を発行してください（無料枠で十分です）。**ドメイン認証は不要**です。デフォルトの送信元 `onboarding@resend.dev` は、Resendアカウント登録時のメールアドレス宛にのみ送信できる制限がありますが、今回は「サイト運営者への通知メール」用途なのでこの制限で問題ありません。

## 6. Worker にシークレットを登録する（ローカルPC・PowerShell、`worker/` ディレクトリで）

それぞれ実行するとプロンプトで値の入力を求められます（**値は直接入力し、Claude には共有しないでください**）:

```powershell
npx wrangler secret put TURNSTILE_SECRET
```
（手順4の Secret Key を入力）

```powershell
npx wrangler secret put RESEND_API_KEY
```
（手順5の API Key を入力）

```powershell
npx wrangler secret put CONTACT_NOTIFY_EMAIL
```
（通知を受け取りたいメールアドレスを入力。Resend登録時のメールアドレスと同じものを推奨）

## 7. Worker をデプロイする

```powershell
npx wrangler deploy
```

成功すると `https://form.takemiko.workers.dev` のようなURLが表示されます。このURLを控えてください（これは秘密情報ではありません）。

## 8. フロント側の環境変数を設定する

`web/.env` と `web/.env.production` の両方に、以下を追記してください（Site Keyは公開情報です）:

```
PUBLIC_CONTACT_ENDPOINT=https://form.takemiko.workers.dev
PUBLIC_TURNSTILE_SITE_KEY=手順4のSite Key
```

GitHub リポジトリ → Settings → Secrets and variables → Actions にも同じ2つを登録してください（経路B、CMS更新時のビルドでも使うため）:

| Secret名 | 値 |
|---|---|
| `PUBLIC_CONTACT_ENDPOINT` | `https://form.takemiko.workers.dev` |
| `PUBLIC_TURNSTILE_SITE_KEY` | 手順4のSite Key |

## 9. デプロイして確認する

```powershell
cd ../web
pnpm release
```

反映後、ブラウザで `https://takemiko.com/contact/` を開き、フォームが表示されること（「準備中」のフォールバック文言ではないこと）を確認してください。実際に1件テスト送信し、手順6で設定したメールアドレスに通知が届くか確認してください。

## 10. 攻撃耐性の確認

デプロイ後に教えてください。Claude側から公開エンドポイントに対して以下を確認します（これはあなたの秘密情報に触れない、公開HTTPの挙動確認のみです）:
- Turnstileトークンなしの直接POSTが `400` で弾かれること
- 許可していないOriginからのPOSTが `403` になること
- ハニーポット（`website`）を埋めた送信が `200`（成功を装う）を返しつつ、実際にはD1に保存されないこと

すべて OK なら Phase 7（フォーム部分）は完了です。画像素材の投入は別の機会に行います。
