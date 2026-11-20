import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { AppError } from '@/lib/app-error';
import { successResponse, handleApiError, paginatedResponse, parsePagination } from '@/lib/api-utils';
import { favoriteBusinessInclude, publicBusinessWhere, toFavoriteListing } from '@/lib/favorites';

const addFavoriteSchema = z.object({
  businessId: z.string().min(1).max(100),
});

/**
 * GET /api/favorites: the signed-in user's saved businesses, newest first.
 * Paginated like GET /api/businesses, and each item has the same shape plus `favoritedAt`.
 * A saved business that is no longer listed (deactivated, not approved) is left out.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { page, limit, skip } = parsePagination(new URL(request.url).searchParams);
    const where = { userId: session.userId, business: publicBusinessWhere() };

    const [rows, total] = await Promise.all([
      db.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { business: { include: favoriteBusinessInclude } },
      }),
      db.favorite.count({ where }),
    ]);

    const businesses = rows.map((row) => ({ ...toFavoriteListing(row.business), favoritedAt: row.createdAt }));
    return paginatedResponse(businesses, page, limit, total);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/favorites { businessId }: save a business. Saving one that is already saved is fine.
 * Admins have no favorites, and a business owner cannot save their own business.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if ((session.role || '').toUpperCase() === 'ADMIN') {
      throw new AppError('Admin accounts cannot save favorites.', 403);
    }

    const parsed = addFavoriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new AppError('Send the business to save as {"businessId": "..."}.', 400);
    }
    const { businessId } = parsed.data;

    const business = await db.business.findFirst({
      where: { id: businessId, ...publicBusinessWhere() },
      select: { id: true, ownerId: true },
    });
    if (!business) throw new AppError('Business not found.', 404);
    if (business.ownerId === session.userId) {
      throw new AppError('You cannot save your own business.', 400);
    }

    // skipDuplicates makes a second tap, or two taps at once, harmless
    await db.favorite.createMany({
      data: [{ userId: session.userId, businessId }],
      skipDuplicates: true,
    });

    return successResponse({ businessId, isFavorite: true });
  } catch (error) {
    return handleApiError(error);
  }
}
