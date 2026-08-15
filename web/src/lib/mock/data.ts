// Strapi のレスポンス（平坦化後の形）を模したモックデータ。
// STRAPI_URL / STRAPI_TOKEN が未設定のときのみ、content.config.ts からこのデータが使われる。

const img = (name: string, w = 1200, h = 630) => ({
  url: `/placeholder/${name}`,
  width: w,
  height: h,
  alternativeText: null,
});

export const mockCategories = [
  { id: 'cat-news', name: 'お知らせ', slug: 'news', color: 'neutral' as const },
  { id: 'cat-stream', name: '配信', slug: 'stream', color: 'primary' as const },
  { id: 'cat-illust', name: 'イラスト', slug: 'illust', color: 'accent' as const },
  { id: 'cat-goods', name: 'グッズ', slug: 'goods', color: 'primary' as const },
  { id: 'cat-tech', name: 'プログラミング/AI', slug: 'tech', color: 'accent' as const },
];

const catRef = (slug: (typeof mockCategories)[number]['slug']) => {
  const c = mockCategories.find((c) => c.slug === slug)!;
  return { name: c.name, slug: c.slug, color: c.color };
};

export const mockNews = [
  {
    id: 'news-1',
    slug: 'stream-schedule-august',
    title: '8月の配信スケジュールのお知らせ',
    excerpt: '8月の配信予定をまとめてお知らせします。今月は初見ゲーム企画もあります。',
    pinned: true,
    publishedAt: '2026-08-01T10:00:00.000Z',
    category: catRef('stream'),
    thumbnail: img('thumb-01.svg'),
    content: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'みことちゃんです！8月の配信スケジュールをお知らせします。' }],
      },
      {
        type: 'heading',
        level: 2,
        children: [{ type: 'text', text: '今月の予定' }],
      },
      {
        type: 'list',
        format: 'unordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: '毎週土曜 21:00〜 雑談配信' }] },
          { type: 'list-item', children: [{ type: 'text', text: '8/15(土) 初見ゲーム企画' }] },
          { type: 'list-item', children: [{ type: 'text', text: '8/29(土) 合格祈願コラボ配信' }] },
        ],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '走海神社の巫女として、みんなの' },
          { type: 'text', text: '必勝祈願', bold: true },
          { type: 'text', text: 'も忘れずに届けます。楽しみにしていてください。' },
        ],
      },
    ],
  },
  {
    id: 'news-2',
    slug: 'ai-lp-making-report',
    title: '生成AIでランディングページを作ってみた',
    excerpt: '生成AIを使ってLPを1本作るまでの流れを、プログラミング初心者向けにまとめました。',
    pinned: false,
    publishedAt: '2026-07-24T09:00:00.000Z',
    category: catRef('tech'),
    thumbnail: img('thumb-02.svg'),
    content: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: '走海神社の巫女、たけるのみことです。今回は生成AIを使ったLP制作の手順を紹介します。',
          },
        ],
      },
      {
        type: 'heading',
        level: 2,
        children: [{ type: 'text', text: '使ったツール' }],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '今回は ' },
          {
            type: 'link',
            url: 'https://astro.build',
            children: [{ type: 'text', text: 'Astro' }],
          },
          { type: 'text', text: ' とAIエージェントを組み合わせて構築しました。' },
        ],
      },
      {
        type: 'image',
        image: img('thumb-02.svg', 1200, 630),
      },
      {
        type: 'quote',
        children: [
          { type: 'text', text: 'コードが書けなくても、伝えたいことが明確なら形にできる。' },
        ],
      },
      {
        type: 'heading',
        level: 2,
        children: [{ type: 'text', text: '手順まとめ' }],
      },
      {
        type: 'list',
        format: 'ordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: '要件を日本語で書き出す' }] },
          { type: 'list-item', children: [{ type: 'text', text: 'AIエージェントに設計を相談する' }] },
          { type: 'list-item', children: [{ type: 'text', text: '実装してもらいながら確認する' }] },
        ],
      },
    ],
  },
  {
    id: 'news-3',
    slug: 'new-illustration-komapenguin',
    title: '狛ペンギンのイラストを描きました',
    excerpt: '走海神社の守り神、狛ペンギンのイラストを新しく描き下ろしました。',
    pinned: false,
    publishedAt: '2026-07-10T12:00:00.000Z',
    category: catRef('illust'),
    thumbnail: img('thumb-03.svg'),
    content: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '走海神社の狛犬ならぬ狛ペンギンを描きました。かわいく描けたと思います。' },
        ],
      },
      {
        type: 'image',
        image: img('thumb-03.svg', 1200, 630),
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '今後もお知らせページで制作の様子を紹介していきます。' }],
      },
    ],
  },
  {
    id: 'news-4',
    slug: 'goods-restock',
    title: 'グッズ再入荷のお知らせ',
    excerpt: '好評につき、一部グッズを再入荷しました。',
    pinned: false,
    publishedAt: '2026-06-28T08:00:00.000Z',
    category: catRef('goods'),
    thumbnail: null,
    content: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '好評につき、一部グッズを再入荷しました。詳しくはグッズページをご覧ください。' }],
      },
    ],
  },
  {
    id: 'news-5',
    slug: 'greeting',
    title: '初めまして、たけるのみことです',
    excerpt: '走海神社の巫女、たけるのみことです。よろしくお願いします。',
    pinned: false,
    publishedAt: '2026-06-01T00:00:00.000Z',
    category: catRef('news'),
    thumbnail: img('thumb-01.svg'),
    content: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '初めまして、走海神社の巫女、たけるのみことです。「たけみこ」と呼んでください。' },
        ],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'VTuberとNFTを結ぶ活動をしながら、プログラミングやAIのコンテンツも作っています。よろしくお願いします。' },
        ],
      },
    ],
  },
  {
    id: 'news-6',
    slug: 'exam-blessing-note',
    title: '合格祈願、受け付けています',
    excerpt: '走海神社では合格祈願・必勝祈願を配信内で受け付けています。',
    pinned: false,
    publishedAt: '2026-05-20T00:00:00.000Z',
    category: catRef('news'),
    thumbnail: null,
    content: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '走海神社では合格祈願・必勝祈願を配信内で受け付けています。応援しています。' }],
      },
    ],
  },
];

export const mockWorks = [
  {
    id: 'work-1',
    slug: 'shrine-lp-demo',
    title: '走海神社 公式サイト風 LP',
    summary: '生成AIで作った、神社の世界観を活かしたランディングページのデモです。',
    liveUrl: 'https://example.com/works/shrine-lp-demo',
    techTags: 'Astro, Cloudflare, 生成AI',
    pinned: true,
    publishedAt: '2026-07-15T00:00:00.000Z',
    thumbnail: img('thumb-01.svg'),
  },
  {
    id: 'work-2',
    slug: 'nft-gallery-demo',
    title: 'NFTギャラリー LP デモ',
    summary: 'NFT作品を並べて紹介するギャラリー形式のLPを試作しました。',
    liveUrl: 'https://example.com/works/nft-gallery-demo',
    techTags: 'Astro, 生成AI',
    pinned: false,
    publishedAt: '2026-06-20T00:00:00.000Z',
    thumbnail: img('thumb-02.svg'),
  },
  {
    id: 'work-3',
    slug: 'exam-blessing-lp',
    title: '合格祈願キャンペーン LP',
    summary: '受験シーズンに向けた合格祈願キャンペーンの告知ページです。',
    liveUrl: 'https://example.com/works/exam-blessing-lp',
    techTags: null,
    pinned: false,
    publishedAt: '2026-05-05T00:00:00.000Z',
    thumbnail: img('thumb-03.svg'),
  },
];

export const mockSnsLinks = [
  { id: 'sns-x', platform: 'x' as const, label: 'X (Twitter)', url: 'https://x.com/takerunomikoto', handle: '@takerunomikoto', order: 1 },
  { id: 'sns-youtube', platform: 'youtube' as const, label: 'YouTube', url: 'https://www.youtube.com/@takerunomikoto', handle: null, order: 2 },
  { id: 'sns-twitch', platform: 'twitch' as const, label: 'Twitch', url: 'https://www.twitch.tv/takerunomikoto', handle: null, order: 3 },
  { id: 'sns-pixiv', platform: 'pixiv' as const, label: 'pixiv', url: 'https://www.pixiv.net/users/00000000', handle: null, order: 4 },
];

export const mockGoodsLinks = [
  {
    id: 'goods-booth',
    title: 'BOOTH ショップ',
    description: 'アクリルスタンドやステッカーなどのグッズを取り扱っています。',
    url: 'https://takerunomikoto.booth.pm/',
    kind: 'ec' as const,
    badge: '販売中',
    order: 1,
    image: img('goods-01.svg', 800, 800),
  },
  {
    id: 'goods-suzuri',
    title: 'SUZURI ショップ',
    description: 'Tシャツやマグカップなどのオリジナルグッズです。',
    url: 'https://suzuri.jp/takerunomikoto',
    kind: 'ec' as const,
    badge: null,
    order: 2,
    image: img('goods-02.svg', 800, 800),
  },
  {
    id: 'goods-support',
    title: '支援・投げ銭',
    description: '配信・制作活動の支援はこちらから。',
    url: 'https://example.com/support/takerunomikoto',
    kind: 'support' as const,
    badge: null,
    order: 3,
    image: null,
  },
  {
    id: 'goods-nft',
    title: 'NFT マーケットプレイス',
    description: 'マーケットプレイス未定のため準備中です。',
    url: 'https://example.com/nft/takerunomikoto',
    kind: 'nft' as const,
    badge: '準備中',
    order: 4,
    image: null,
  },
];
