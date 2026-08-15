import type { Loader } from 'astro/loaders';
import type { StrapiListResponse } from './types';

interface StrapiLoaderOptions {
  url: string;
  token: string;
  endpoint: string;
  params?: Record<string, string | string[]>;
}

function buildQuery(
  params: StrapiLoaderOptions['params'],
  page: number,
  pageSize: number
): string {
  const search = new URLSearchParams();
  search.set('pagination[page]', String(page));
  search.set('pagination[pageSize]', String(pageSize));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) search.append(key === 'populate' ? 'populate' : key, v);
      } else {
        search.set(key, value);
      }
    }
  }
  return search.toString();
}

function absolutizeUrl(base: string, maybeUrl: unknown): unknown {
  if (typeof maybeUrl !== 'string') return maybeUrl;
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return maybeUrl;
  }
}

// Strapi はメディアの url を相対パスで返す場合がある（ローカルプロバイダ利用時など）。
// サイトのビルド元と Strapi のホストは別ドメイン（cms.takemiko.com）のため、必ず絶対化する。
function absolutizeMedia(base: string, value: unknown): unknown {
  if (value && typeof value === 'object' && 'url' in value) {
    const media = value as { url: unknown };
    return { ...media, url: absolutizeUrl(base, media.url) };
  }
  return value;
}

export function strapiLoader(options: StrapiLoaderOptions): Loader {
  const { url, token, endpoint, params } = options;

  return {
    name: `strapi-${endpoint}`,
    load: async ({ store, parseData, logger }) => {
      const pageSize = 100;
      let page = 1;
      let pageCount = 1;
      const items: Record<string, unknown>[] = [];

      // ページネーションを最後まで辿って全件取得する
      do {
        const query = buildQuery(params, page, pageSize);
        const endpointUrl = `${url.replace(/\/$/, '')}/api/${endpoint}?${query}`;
        const res = await fetch(endpointUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Strapi が落ちている／トークンが無効な場合はビルドを失敗させる。
        // モックへフォールバックしない（§3.4 の非対称性）。
        if (!res.ok) {
          throw new Error(
            `[strapi] ${endpoint} の取得に失敗しました (${res.status} ${res.statusText}): ${endpointUrl}`
          );
        }

        const json = (await res.json()) as StrapiListResponse<Record<string, unknown>>;
        items.push(...json.data);
        pageCount = json.meta?.pagination?.pageCount ?? 1;
        page += 1;
      } while (page <= pageCount);

      store.clear();
      for (const raw of items) {
        // Strapi 5 では documentId が安定 ID。数値の id はリビジョンで変わりうるため使わない。
        const { documentId, id: _numericId, thumbnail, image, ...rest } = raw;
        const flattened: Record<string, unknown> = { ...rest, id: String(documentId) };
        if (thumbnail !== undefined) flattened.thumbnail = absolutizeMedia(url, thumbnail);
        if (image !== undefined) flattened.image = absolutizeMedia(url, image);

        const id = String(documentId);
        store.set({ id, data: await parseData({ id, data: flattened }) });
      }

      logger.info(`[strapi] ${endpoint}: ${items.length} 件取得`);
    },
  };
}
