import { site } from '../data/site';

// CMS のサムネイルが無い場合、既定 OGP 画像へフォールバックする。
export function resolveOgImage(url?: string | null): string {
  return url ?? site.ogImage;
}

export function truncate(text: string, maxLength = 120): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
