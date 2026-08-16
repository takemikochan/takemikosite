#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."          # web/

# ── ガード1：未コミットの変更を dist に混入させない
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ 未コミットの変更があります。commit か stash をしてください。" >&2; exit 1
fi
# ── ガード2：push 忘れを防ぐ（CI が再ビルドしても同じ結果になることの担保）
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "✗ HEAD が origin/main と一致しません。push してください。" >&2; exit 1
fi

pnpm astro check
pnpm build

# ── ガード3：CI と同一のサニティチェック
test -f dist/index.html
test -f dist/profile/index.html
test -f dist/works/index.html
test -f dist/goods/index.html
test -f dist/news/index.html
test -f dist/contact/index.html
test -f dist/privacy/index.html
test -f dist/sitemap-index.xml

SHA=$(git rev-parse --short=12 HEAD)
TAG="web-$(date -u +%Y%m%d-%H%M%S)-${SHA}"
tar -czf dist.tar.gz -C dist .
gh release create "$TAG" dist.tar.gz --target main \
  --title "$TAG" --notes "commit: $(git rev-parse HEAD)"
rm -f dist.tar.gz
echo "✓ Release $TAG を作成しました。GitHub Actions が配送します。"
