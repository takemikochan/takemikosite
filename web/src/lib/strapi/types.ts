// Strapi 5 REST API の共通レスポンス形。v5 はリレーション/メディアがフラット化されている
// （v4 のような { data: { attributes: {...} } } のネストはない）。

export interface StrapiMedia {
  id: number;
  documentId: string;
  url: string;
  width: number;
  height: number;
  alternativeText: string | null;
}

export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface StrapiListResponse<T> {
  data: T[];
  meta: { pagination: StrapiPagination };
}
