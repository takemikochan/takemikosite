import { defineCollection, z } from 'astro:content';
import { strapiLoader } from './lib/strapi/loader';
import { mockLoader } from './lib/mock/loader';
import { mockNews, mockCategories, mockWorks, mockSnsLinks, mockGoodsLinks } from './lib/mock/data';

const url = import.meta.env.STRAPI_URL;
const token = import.meta.env.STRAPI_TOKEN;
export const USE_CMS = Boolean(url && token);

// Strapi のレスポンスを平坦化した後の形。モックもこの形を満たす。
const mediaSchema = z.object({
  // 本番（Strapi ローダー）では常に絶対URL、モックではローカル public/ への相対パスを許容する。
  // <Image>/<img> はどちらも扱えるため、ここでは絶対URLを強制しない。
  url: z.string(),
  width: z.number(),
  height: z.number(),
  alternativeText: z.string().nullable().optional(),
});

const newsSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable().optional(),
  content: z.array(z.any()), // Blocks（描画は BlocksRenderer が担当）
  pinned: z.boolean().default(false),
  publishedAt: z.string(),
  updatedAt: z.string().optional(),
  category: z
    .object({ name: z.string(), slug: z.string(), color: z.string().optional() })
    .nullable()
    .optional(),
  thumbnail: mediaSchema.nullable().optional(),
});

const workSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  liveUrl: z.string().url(),
  techTags: z.string().nullable().optional(), // カンマ区切り。表示側で split(',') する
  pinned: z.boolean().default(false),
  publishedAt: z.string(),
  thumbnail: mediaSchema.nullable().optional(),
});

const snsLinkSchema = z.object({
  id: z.string(),
  platform: z.enum(['x', 'youtube', 'twitch', 'pixiv', 'booth', 'suzuri', 'other']),
  label: z.string(),
  url: z.string().url(),
  handle: z.string().nullable().optional(),
  order: z.number().default(0),
});

const goodsLinkSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  url: z.string().url(),
  kind: z.enum(['ec', 'support', 'nft']),
  badge: z.string().nullable().optional(),
  order: z.number().default(0),
  image: mediaSchema.nullable().optional(),
});

export const collections = {
  news: defineCollection({
    loader: USE_CMS
      ? strapiLoader({
          url: url!,
          token: token!,
          endpoint: 'articles',
          params: { populate: ['thumbnail', 'category'], sort: 'publishedAt:desc' },
        })
      : mockLoader('news', mockNews),
    schema: newsSchema,
  }),
  categories: defineCollection({
    loader: USE_CMS
      ? strapiLoader({ url: url!, token: token!, endpoint: 'categories' })
      : mockLoader('categories', mockCategories),
    schema: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      color: z.enum(['primary', 'accent', 'neutral']).optional(),
    }),
  }),
  works: defineCollection({
    loader: USE_CMS
      ? strapiLoader({
          url: url!,
          token: token!,
          endpoint: 'works',
          params: { populate: ['thumbnail'], sort: 'publishedAt:desc' },
        })
      : mockLoader('works', mockWorks),
    schema: workSchema,
  }),
  snsLinks: defineCollection({
    loader: USE_CMS
      ? strapiLoader({
          url: url!,
          token: token!,
          endpoint: 'sns-links',
          params: { sort: 'order:asc' },
        })
      : mockLoader('snsLinks', mockSnsLinks),
    schema: snsLinkSchema,
  }),
  goodsLinks: defineCollection({
    loader: USE_CMS
      ? strapiLoader({
          url: url!,
          token: token!,
          endpoint: 'goods-links',
          params: { populate: ['image'], sort: 'order:asc' },
        })
      : mockLoader('goodsLinks', mockGoodsLinks),
    schema: goodsLinkSchema,
  }),
};
