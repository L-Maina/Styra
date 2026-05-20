import { MetadataRoute } from 'next';

/**
 * Sitemap generator for Google Search Console crawling.
 *
 * ARCHITECTURE: This file does NOT import Prisma at the module level.
 * Database queries are done inside isolated try/catch blocks so that
 * even if the DB is completely unavailable, static pages always render.
 *
 * XML COMPLIANCE: URLs use path-based format (/marketplace/category/spa)
 * instead of query params (?page=X&category=Y) to avoid XML entity
 * issues with unescaped ampersands.
 *
 * DEEP-LINKING: Since Styra is a single-page app, the page.tsx component
 * parses these URL paths and navigates to the correct internal page.
 */

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://styra-silk.vercel.app';

  // ── Static Pages (always included — no DB dependency) ──────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/marketplace`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/safety`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/press`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/advertise`,
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
  // Use path format /marketplace/category/spa to avoid XML entity issues
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
    url: `${baseUrl}/marketplace/category/${category}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // ── Dynamic Pages (DB-dependent — gracefully skipped if DB unavailable) ──
  let businessPages: MetadataRoute.Sitemap = [];
  let blogPages: MetadataRoute.Sitemap = [];

  try {
    // Dynamic import so Prisma is only loaded if we actually need it
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
        take: 1000,
      });

      businessPages = businesses.map((business) => ({
        url: `${baseUrl}/business/${business.slug || business.id}`,
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
        url: `${baseUrl}/blog/${article.slug || article.id}`,
        lastModified: article.updatedAt || article.createdAt,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
    } catch (error) {
      console.warn('[Sitemap] Could not fetch blog articles:', error instanceof Error ? error.message : error);
    }
  } catch (error) {
    console.warn('[Sitemap] Database module unavailable:', error instanceof Error ? error.message : error);
  }

  return [...staticPages, ...categoryPages, ...businessPages, ...blogPages];
}
