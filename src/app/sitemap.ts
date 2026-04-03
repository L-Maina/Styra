import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://styra.app';

  // In production, fetch dynamic routes from database
  const staticRoutes = [
    '',
    '/marketplace',
    '/map',
  ];

  const routes = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Add business routes (in production, fetch from DB)
  // const businesses = await db.business.findMany({ where: { verificationStatus: 'APPROVED' } });
  // businesses.forEach(business => {
  //   routes.push({
  //     url: `${baseUrl}/business/${business.slug}`,
  //     lastModified: business.updatedAt,
  //     changeFrequency: 'weekly',
  //     priority: 0.7,
  //   });
  // });

  return routes;
}
