# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

「たけるのみこと Official Site」— an Astro static site backed by a self-hosted Strapi 5 CMS, with a Cloudflare Worker handling the contact form. Three independent subprojects in one repo (no pnpm/npm workspace linking):

```
web/     Astro site (pnpm)
cms/     Strapi 5 CMS (npm)
worker/  Contact form endpoint — Cloudflare Worker + D1 + Turnstile (npm)
```

## Commands

```bash
# web/
pnpm install && pnpm dev              # dev server
pnpm astro check                      # typecheck
pnpm test                             # vitest (src/lib/url.ts etc.)
pnpm build                            # static build

# cms/ (start the local Postgres cluster first — see README.md)
npm install && npm run develop
npx tsc --noEmit -p tsconfig.json     # typecheck

# worker/
npm install
npm run typecheck                     # tsc --noEmit
npm test                              # vitest + @cloudflare/vitest-pool-workers (Miniflare-backed)
npm run dev                           # wrangler dev
```

Run a single vitest test: `pnpm exec vitest run <path>` (web) or `npx vitest run <path>` (worker).

## Architecture

**Content Layer loader switch** (`web/src/content.config.ts`): every collection's `loader` branches on `USE_CMS = Boolean(STRAPI_URL && STRAPI_TOKEN)`. Unset → `lib/mock/loader.ts` (fixture data in `lib/mock/data.ts`). Set → `lib/strapi/loader.ts`, which paginates the Strapi REST API, maps `documentId` → Astro's `id`, and absolutizes media URLs. Pages only ever call `getCollection(...)`; they don't know which backend answered. When Strapi is configured but unreachable, the build fails loudly rather than falling back to mock — a broken build is preferred over silently publishing stale/wrong content.

**URL scheme validation** (`web/src/lib/url.ts`): all CMS-authored URLs (SNS links, goods links, work `liveUrl`, Blocks inline links) are validated through `isHttpUrl`/`isSafeInlineUrl` before being used as `href`. `z.string().url()` alone accepts `javascript:`/`data:` schemes, so this check exists specifically to reject those. Dedicated link fields fail the Zod schema (build breaks); inline Blocks links just render as plain text instead of an `<a>`.

**Rich text rendering**: Strapi Blocks are rendered by `components/news/BlocksRenderer.astro` and friends, never via `set:html`. There is no official Astro renderer for Strapi Blocks (the official one is React-only), so this is hand-rolled and deliberately kept minimal.

**Two-path deployment** — code changes and content changes go through different pipelines that must converge on the same output:
- Path A (code): `web/scripts/release.sh` → GitHub Release → `.github/workflows/deploy-release.yml` downloads the pre-built `dist.tar.gz` and deploys (no build in CI).
- Path B (content): Strapi's `cms/src/index.ts` lifecycle subscriber fires a `repository_dispatch` on publish/update/delete (30s debounced) → `.github/workflows/deploy-content.yml` builds from `main` and deploys.
- Both converge on `.github/actions/deploy-dist` (composite action: sanity-check → atomic rsync + symlink swap on the VPS). `release.sh`'s three guards (clean tree, HEAD == origin/main, sanity-checked build output) exist specifically to stop Path A and Path B from producing different output for the same commit.

**Deploy topology**: static site and Strapi run on the same VPS, deployed by the same `deploy` SSH user — deliberately not yet split into separate least-privilege users (tracked as a known gap, see `docs/OPERATIONS.md` §15 "既知の課題"). nginx sits in front of both; note that nginx's `add_header` does **not** inherit into a `location {}` block that defines its own `add_header` — see `deploy/nginx/security-headers.conf` and the `include` pattern used in `deploy/nginx/takemiko.com.conf` before changing headers.

**Secrets discipline**: this repo is public. `.env*` (except `.env.example`) and `worker/.dev.vars` are gitignored; production secrets are set via `wrangler secret put` / VPS-local files, never committed. When editing `docs/REBUILD.md` or `docs/OPERATIONS.md`, keep secret-generating/viewing steps as commands the human runs themselves in their own terminal.

**Docs are generated in pairs**: `docs/REBUILD.md`, `docs/OPERATIONS.md`, `docs/REFERENCE.md` are the source of truth; `docs/*.html` are mechanically rendered from them via `docs/tools/render.mjs` (`cd docs && npm run render`). CI (`.github/workflows/ci.yml`, `docs` job) fails if the committed HTML doesn't match a fresh render — after editing any `docs/*.md`, always re-run the renderer and commit the resulting `.html` in the same change.

## Where things live

| Concern | File |
|---|---|
| Loader switch + Zod schemas | `web/src/content.config.ts` |
| Strapi fetch/pagination | `web/src/lib/strapi/loader.ts` |
| CMS URL/XSS guard | `web/src/lib/url.ts` |
| Design tokens | `web/src/styles/tokens.css` |
| CMS lifecycle → rebuild trigger | `cms/src/index.ts` |
| CMS CORS/security middleware | `cms/config/middlewares.ts` |
| Contact form logic (Turnstile/D1/rate-limit) | `worker/src/index.ts` |
| Release guards | `web/scripts/release.sh` |
| Shared deploy step | `.github/actions/deploy-dist/action.yml` |
| From-scratch rebuild guide | `docs/REBUILD.md` |
| Day-to-day operations guide | `docs/OPERATIONS.md` |
| Secrets/env var/D1 migration reference | `docs/REFERENCE.md` |
