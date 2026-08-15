import type { Core } from '@strapi/strapi';

const WATCHED = [
  'api::article.article',
  'api::category.category',
  'api::work.work',
  'api::sns-link.sns-link',
  'api::goods-link.goods-link',
];

const DEBOUNCE_MS = 30_000;
let timer: ReturnType<typeof setTimeout> | null = null;

const requestRebuild = (strapi: Core.Strapi) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const repo = process.env.GH_REPO;
    const token = process.env.GH_TOKEN;
    if (!repo || !token) {
      strapi.log.warn('[rebuild] GH_REPO / GH_TOKEN が未設定のため再ビルド要求をスキップしました');
      return;
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: 'cms-update' }),
      });
      if (!res.ok) {
        strapi.log.error(`[rebuild] repository_dispatch failed: ${res.status} ${await res.text()}`);
      } else {
        strapi.log.info('[rebuild] repository_dispatch を送信しました');
      }
    } catch (err) {
      strapi.log.error('[rebuild] repository_dispatch の送信中にエラーが発生しました', err as Error);
    }
  }, DEBOUNCE_MS);
};

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.db.lifecycles.subscribe({
      models: WATCHED,
      afterCreate: () => requestRebuild(strapi),
      afterUpdate: () => requestRebuild(strapi),
      afterDelete: () => requestRebuild(strapi),
    });
  },
};
