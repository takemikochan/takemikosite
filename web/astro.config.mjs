// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://takemiko.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
  // Phase 3 で Strapi 導入時に image.domains へ cms.takemiko.com を追加する
});