import { MetadataRoute } from 'next';

/**
 * Sitemap generator for Google Search Console crawling.
 *
 * ARCHITECTURE: This file does NOT import Prisma at the module level.
 * Database queries are done inside isolated try/catch blocks so that
 * even if the DB is completely unavailable (wrong URL, connection refused,
 * schema mismatch, etc.), the static pages + categories always render.
 *
 * This is critical because:
 *   1. During `next build`, DATABASE_URL may not be set
 *   2. On Vercel cold starts, the DB may be momentarily unreachable
 *   3. In local dev with SQLite, the Prisma schema expects PostgreSQL
 *
 * DEEP-LINKING: Since Styra is a single-page app, we use ?page=X
 * query parameters that the app's page.tsx parses to navigate to
 * the correct internal page.
 */

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://styra.app';

  // ── Static Pages (always included — no DB dependency) ──────────────
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

  // ── Category Pages (no DB dependency) ─────────────────────────────
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

  // ── Dynamic Pages (DB-dependent — gracefully skipped if DB unavailable) ──
  let businessPages: MetadataRoute.Sitemap = [];
  let blogPages: MetadataRoute.Sitemap = [];

  try {
    // Dynamic import so Prisma is only loaded if we actually need it
    // This prevents module-level crashes when DB is misconfigured
    const { db } = await import('@/lib/db');

    // Fetch approved businesses
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
        take: 1000, // Cap at 1000 businesses for sitemap size
      });

      businessPages = businesses.map((business) => ({
        url: `${baseUrl}/?page=business&id=${business.id}`,
        lastModified: business.updatedAt || business.createdAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    } catch (error) {
      console.warn('[Sitemap] Could not fetch businesses:', error instanceof Error ? error.message : error);
    }

    // Fetch published blog articles
    try {
      const articles = await db.blogArticle.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          slug: true,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      blogPages = articles.map((article) => ({
        url: `${baseUrl}/?page=blog&article=${article.slug || article.id}`,
        lastModified: article.updatedAt || article.createdAt,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
    } catch (error) {
      console.warn('[Sitemap] Could not fetch blog articles:', error instanceof Error ? error.message : error);
    }
  } catch (error) {
    // Prisma module itself failed to load (e.g., missing at build time)
    console.warn('[Sitemap] Database module unavailable:', error instanceof Error ? error.message : error);
  }

  return [...staticPages, ...categoryPages, ...businessPages, ...blogPages];
}
