import type { CollectionEntry } from 'astro:content';

type NewsEntry = CollectionEntry<'news'>;

// pinned な記事を先頭に、それ以外は公開日の新しい順。
export function sortPinnedFirst(entries: NewsEntry[]): NewsEntry[] {
  return [...entries].sort((a, b) => {
    if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
    return new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime();
  });
}

interface BlockNode {
  type: string;
  text?: string;
  children?: BlockNode[];
}

function extractText(nodes: BlockNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text ?? '';
      if (node.children) return extractText(node.children);
      return '';
    })
    .join('');
}

// excerpt が未入力のとき、本文（Blocks）の最初の段落から自動生成する。
export function getExcerpt(entry: NewsEntry, maxLength = 80): string {
  if (entry.data.excerpt) return entry.data.excerpt;

  const blocks = entry.data.content as BlockNode[];
  const firstParagraph = blocks.find((block) => block.type === 'paragraph');
  const text = firstParagraph ? extractText(firstParagraph.children ?? []) : '';

  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
