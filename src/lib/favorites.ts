import type { Prisma } from '@prisma/client';
import { omitPrivateBusinessFields } from '@/lib/business-public';

/** Businesses the public can see: active and approved or verified. Same rule as GET /api/businesses. */
export function publicBusinessWhere(): Prisma.BusinessWhereInput {
  return { isActive: true, verificationStatus: { in: ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'] } };
}

/** What a business card needs: the first services and the review and portfolio counts. */
export const favoriteBusinessInclude = {
  services: { where: { isActive: true }, take: 5 },
  _count: { select: { reviews: true, portfolio: true } },
} satisfies Prisma.BusinessInclude;

// A Cloudinary link is short. An older row can hold a base64 data URL that is megabytes long.
function lightUrl(value: string | null | undefined): string | null {
  return value && !value.startsWith('data:') && value.length <= 2048 ? value : null;
}

interface ListedBusiness {
  coverImage: string | null;
  logo: string | null;
  boothPhotoUrl: string | null;
  _count: { reviews: number; portfolio: number };
}

/**
 * One business as GET /api/favorites returns it: the same shape as a row of GET /api/businesses
 * (heavy images are not inlined, `hasCoverImage` / `hasLogo` say whether to fetch them), without
 * the owner-only columns, and marked as a favorite.
 */
export function toFavoriteListing<T extends ListedBusiness>(business: T) {
  const cover = business.coverImage || business.boothPhotoUrl;
  return omitPrivateBusinessFields({
    ...business,
    reviewCount: business._count.reviews,
    portfolioCount: business._count.portfolio,
    reviews: [],
    coverImage: lightUrl(cover),
    logo: lightUrl(business.logo),
    boothPhotoUrl: lightUrl(business.boothPhotoUrl),
    hasCoverImage: !!cover,
    hasLogo: !!business.logo,
    isFavorite: true,
  });
}
