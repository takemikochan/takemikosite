# cms/

Strapi 5 による「たけるのみこと Official Site」の CMS。自前の VPS へ systemd 常駐でデプロイしており、Strapi Cloud は使用していません。開発コマンド・デプロイ手順はリポジトリルートの [`README.md`](../README.md) と [`CLAUDE.md`](../CLAUDE.md) を参照してください。

```bash
npm install
npm run develop
```

ローカルの PostgreSQL クラスタを先に起動する必要があります（ルート README.md 参照）。
