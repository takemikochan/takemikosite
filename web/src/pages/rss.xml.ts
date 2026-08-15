import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getExcerpt, sortPinnedFirst } from '../lib/news';
import { site } from '../data/site';

export const GET: APIRoute = async (context) => {
  const allNews = await getCollection('news');
  const sorted = sortPinnedFirst(allNews);

  return rss({
    title: site.name,
    description: site.description,
    site: context.site ?? site.url,
    items: sorted.map((entry) => {
      const slug = entry.data.slug || entry.id;
      return {
        title: entry.data.title,
        description: getExcerpt(entry, 160),
        pubDate: new Date(entry.data.publishedAt),
        link: `/news/${slug}/`,
      };
    }),
  });
};
