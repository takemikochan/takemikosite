// CMS 由来のURLは javascript: / data: 等の危険なスキームを含みうるため、
// 用途別に許可スキームを絞って検証する（保存型XSS対策）。

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);
const INLINE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// SNS/グッズ/制作実績リンクなど、外部サービスへの絶対URLのみを期待するフィールド用。
export function isHttpUrl(url: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

// 記事本文（Blocks）内のリンク用。サイト内相対リンク・mailto も許可する。
export function isSafeInlineUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (url.startsWith('/') || url.startsWith('#')) return true;
  try {
    return INLINE_PROTOCOLS.has(new URL(url, 'https://example.invalid').protocol);
  } catch {
    return false;
  }
}
