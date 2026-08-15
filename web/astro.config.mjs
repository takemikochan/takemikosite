// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://takemiko.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
  image: {
    // CMS 画像をビルド時に取り込み最適化する。訪問者へ Strapi を直配信しない（計画のリスク対策）。
    domains: ['localhost', 'cms.takemiko.com'],
  },
});