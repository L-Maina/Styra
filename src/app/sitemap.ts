import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

/**
 * Sitemap generator for Google Search Console crawling.
 *
 * This generates a comprehensive sitemap including:
 * - Static pages (home, marketplace, about, etc.)
 * - Dynamic business profile pages
 * - Blog articles
 * - Legal/policy pages
 * - Category pages
 *
 * Since Styra is a single-page app with client-side routing,
 * we use query parameters (?page=X) that the app can parse
 * to deep-link into specific pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://styra.app';

  // ── Static Pages ─────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/?page=marketplace`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/?page=map`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/?page=about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/?page=blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/?page=support`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/?page=safety`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/?page=careers`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/?page=press`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/?page=advertise`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    // Legal pages (actual Next.js routes with SSR)
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/provider-policies`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // ── Category Pages ───────────────────────────────────────────────────
  const categories = [
    'barbershop',
    'hair-salon',
    'nail-salon',
    'spa',
    'beauty-salon',
    'massage',
    'skincare',
    'makeup',
    'tattoo',
    'wellness',
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${baseUrl}/?page=marketplace&category=${category}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // ── Dynamic Business Pages ───────────────────────────────────────────
  let businessPages: MetadataRoute.Sitemap = [];

  try {
    const businesses = await db.business.findMany({
      where: {
        verificationStatus: { in: ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'] },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    businessPages = businesses.map((business) => ({
      url: `${baseUrl}/?page=business&id=${business.id}`,
      lastModified: business.updatedAt || business.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    // If DB query fails (e.g., during build without DB), skip business pages
    console.warn('[Sitemap] Could not fetch businesses:', error);
  }

  // ── Blog Articles ────────────────────────────────────────────────────
  let blogPages: MetadataRoute.Sitemap = [];

  try {
    const articles = await db.blogArticle.findMany({
      where: { published: true },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    blogPages = articles.map((article) => ({
      url: `${baseUrl}/?page=blog&article=${article.slug || article.id}`,
      lastModified: article.updatedAt || article.createdAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch (error) {
    // If DB query fails, skip blog pages
    console.warn('[Sitemap] Could not fetch blog articles:', error);
  }

  return [...staticPages, ...categoryPages, ...businessPages, ...blogPages];
}
