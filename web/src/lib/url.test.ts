import { describe, expect, it } from 'vitest';
import { isHttpUrl, isSafeInlineUrl } from './url';

describe('isHttpUrl', () => {
  it('accepts http/https URLs', () => {
    expect(isHttpUrl('https://x.com/foo')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  it('rejects dangerous schemes', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isHttpUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('isSafeInlineUrl', () => {
  it('accepts site-relative paths', () => {
    expect(isSafeInlineUrl('/news/foo/')).toBe(true);
    expect(isSafeInlineUrl('#section')).toBe(true);
  });

  it('accepts http/https/mailto', () => {
    expect(isSafeInlineUrl('https://x.com/foo')).toBe(true);
    expect(isSafeInlineUrl('mailto:a@b.com')).toBe(true);
  });

  it('rejects dangerous schemes even without a leading slash', () => {
    expect(isSafeInlineUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeInlineUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects empty/undefined input', () => {
    expect(isSafeInlineUrl(undefined)).toBe(false);
    expect(isSafeInlineUrl(null)).toBe(false);
    expect(isSafeInlineUrl('')).toBe(false);
  });
});
