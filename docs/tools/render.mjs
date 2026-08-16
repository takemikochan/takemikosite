// docs/*.md を単一ファイルの自己完結型HTMLへレンダリングする。
// 使い方: node docs/tools/render.mjs
//
// Markdownを正本とし、HTMLは常にこのスクリプトの出力として再生成する
// （手書きの二重管理を避けるための仕組み。§docs/REBUILD.md 参照の元になった
// 「同じ内容の文書が複数箇所で少しずつ食い違う」問題を構造的に防ぐ）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import taskLists from 'markdown-it-task-lists';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, '..');

// GitHub互換に近いslugify。ドキュメント内の手書きアンカーリンク
// （例: ./REFERENCE.md#2-表a-github-secrets全11件）と一致させるため、
// 見出しのID生成にもTOC生成にも同じ関数を使う。
function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function buildMarkdownIt() {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  md.use(markdownItAnchor, { slugify, permalink: false });
  md.use(taskLists, { enabled: false, label: true });

  // 相対リンクの .md を .html に書き換える（文書間の相互参照用）
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const hrefIndex = tokens[idx].attrIndex('href');
    if (hrefIndex >= 0) {
      const href = tokens[idx].attrs[hrefIndex][1];
      if (/^\.\/[A-Za-z0-9_-]+\.md(#.*)?$/.test(href)) {
        tokens[idx].attrs[hrefIndex][1] = href.replace(/\.md(#.*)?$/, '.html$1');
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

function extractHeadings(md, src) {
  const tokens = md.parse(src, {});
  const headings = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading_open' && (t.tag === 'h2' || t.tag === 'h3')) {
      const inline = tokens[i + 1];
      const text = inline ? inline.content : '';
      headings.push({ level: Number(t.tag[1]), text, slug: slugify(text) });
    }
  }
  return headings;
}

function renderToc(headings) {
  if (headings.length === 0) return '';
  const items = headings
    .map((h) => `<li class="toc-h${h.level}"><a href="#${h.slug}">${escapeHtml(h.text)}</a></li>`)
    .join('\n');
  return `<nav class="toc" aria-label="目次"><p class="toc-title">目次</p><ul>${items}</ul></nav>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageTemplate({ title, tocHtml, bodyHtml }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — たけるのみこと Official Site</title>
<style>
${css}
</style>
</head>
<body>
<div class="layout">
${tocHtml}
<main class="content">
${bodyHtml}
</main>
</div>
</body>
</html>
`;
}

const css = `
:root {
  color-scheme: light dark;
  --bg: #fdf8f6;
  --surface: #ffffff;
  --surface-muted: #f7eeea;
  --border: #eedfd9;
  --text: #241b1a;
  --text-muted: #6b5a56;
  --primary: #c01e2a;
  --accent: #00708a;
  --code-bg: #241b1a;
  --code-text: #f7eeea;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1413;
    --surface: #241b1a;
    --surface-muted: #2e2321;
    --border: #4a3a37;
    --text: #f2e9e6;
    --text-muted: #c2b0ac;
    --primary: #ef7b83;
    --accent: #6fc7dd;
    --code-bg: #100c0b;
    --code-text: #f2e9e6;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, "Hiragino Kaku Gothic ProN", "BIZ UDPGothic", Meiryo, "Noto Sans JP", system-ui, sans-serif;
  line-height: 1.8;
  letter-spacing: 0.02em;
}
.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem 6rem;
}
.toc {
  position: sticky;
  top: 1.5rem;
  align-self: start;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
  font-size: 0.85rem;
}
.toc-title { margin: 0 0 0.5rem; font-weight: 700; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; }
.toc ul { list-style: none; margin: 0; padding: 0; }
.toc li { margin: 0.15rem 0; }
.toc .toc-h3 { padding-left: 1rem; opacity: 0.85; }
.toc a { color: var(--text-muted); text-decoration: none; }
.toc a:hover { color: var(--primary); text-decoration: underline; }
.content { min-width: 0; max-width: 860px; }
h1, h2, h3, h4 { line-height: 1.4; scroll-margin-top: 1.5rem; }
h1 { font-size: 1.9rem; border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; }
h2 { font-size: 1.4rem; margin-top: 2.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border); }
h3 { font-size: 1.1rem; color: var(--accent); }
p { margin: 0.9em 0; }
a { color: var(--accent); }
code {
  background: var(--surface-muted);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
}
pre {
  background: var(--code-bg);
  color: var(--code-text);
  padding: 1rem 1.25rem;
  border-radius: 10px;
  overflow-x: auto;
}
pre code { background: none; padding: 0; color: inherit; }
table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 0.92rem; overflow-x: auto; display: block; }
table thead { display: table-header-group; }
table tbody { display: table-row-group; }
th, td { border: 1px solid var(--border); padding: 0.5em 0.75em; text-align: left; vertical-align: top; }
th { background: var(--surface-muted); }
blockquote { margin: 1em 0; padding: 0.25em 1em; border-left: 3px solid var(--primary); background: var(--surface-muted); border-radius: 0 6px 6px 0; }
ul.contains-task-list { list-style: none; padding-left: 0.25em; }
.task-list-item { display: flex; align-items: flex-start; gap: 0.5em; margin: 0.35em 0; }
.task-list-item input[type="checkbox"] { margin-top: 0.35em; width: 1.05em; height: 1.05em; }
hr { border: none; border-top: 1px solid var(--border); margin: 2.5em 0; }
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .toc { position: static; max-height: none; }
}
@media print {
  .toc { display: none; }
  .layout { display: block; max-width: 100%; }
  a { color: inherit; text-decoration: none; }
}
`;

function renderOne(mdFile) {
  const src = fs.readFileSync(mdFile, 'utf8');
  const md = buildMarkdownIt();
  const headings = extractHeadings(md, src);
  const bodyHtml = md.render(src);
  const titleMatch = src.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : path.basename(mdFile, '.md');
  const html = pageTemplate({ title, tocHtml: renderToc(headings), bodyHtml });
  const outFile = mdFile.replace(/\.md$/, '.html');
  fs.writeFileSync(outFile, html, 'utf8');
  console.log(`${path.relative(docsDir, mdFile)} -> ${path.relative(docsDir, outFile)}`);
}

const targets = ['REFERENCE.md', 'REBUILD.md', 'OPERATIONS.md'].map((f) => path.join(docsDir, f));
for (const f of targets) {
  if (!fs.existsSync(f)) {
    console.error(`skip (not found): ${f}`);
    continue;
  }
  renderOne(f);
}
