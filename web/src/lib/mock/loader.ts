import type { Loader } from 'astro/loaders';

// Strapi 未接続時（STRAPI_URL / STRAPI_TOKEN が未設定）にのみ使われるモックローダー。
// 警告ログを出すことで、意図せずモックのまま本番公開される事故を防ぐ。
export function mockLoader(name: string, items: Record<string, unknown>[]): Loader {
  return {
    name: `mock-${name}`,
    load: async ({ store, parseData, logger }) => {
      logger.warn(
        `[mock] microCMS/Strapi 未設定のため「${name}」はモックデータで描画されます（本番前に .env を設定してください）`
      );
      store.clear();
      for (const item of items) {
        const id = String(item.id);
        store.set({ id, data: await parseData({ id, data: item }) });
      }
    },
  };
}
