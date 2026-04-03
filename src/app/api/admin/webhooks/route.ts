import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError, parsePagination } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';
import { getDetailedWebhookStats, getWebhookStats, pruneOldEvents } from '@/lib/webhook-store';

/**
 * GET /api/admin/webhooks?type=detailed|events|stats&limit=50&status=FAILED&provider=STRIPE
 * POST /api/admin/webhooks?type=prune
 *
 * Admin webhook monitoring endpoint.
 * Protected with requireAdmin().
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const url = request.nextUrl;
    const type = url.searchParams.get('type') || 'stats';

    switch (type) {
      case 'detailed': {
        const stats = await getDetailedWebhookStats();
        return successResponse(stats);
      }

      case 'events': {
        const { limit } = parsePagination(url.searchParams);
        const status = url.searchParams.get('status');
        const provider = url.searchParams.get('provider');

        // Build where clause with optional filters
        const where: Record<string, unknown> = {};
        if (status) where.status = status;
        if (provider) where.provider = provider;

        const [events, total] = await Promise.all([
          db.webhookEvent.findMany({
            where: Object.keys(where).length > 0 ? where : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              provider: true,
              providerEventId: true,
              eventType: true,
              status: true,
              processingAttempts: true,
              processingTimeMs: true,
              errorMessage: true,
              ipAddress: true,
              signatureValid: true,
              relatedPaymentId: true,
              createdAt: true,
            },
          }),
          db.webhookEvent.count({
            where: Object.keys(where).length > 0 ? where : undefined,
          }),
        ]);

        return successResponse({ events, total, limit });
      }

      case 'stats': {
        const stats = await getWebhookStats();
        return successResponse(stats);
      }

      default:
        return errorResponse('Invalid type. Use: detailed, events, or stats', 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const url = request.nextUrl;
    const type = url.searchParams.get('type');

    if (type === 'prune') {
      const pruned = await pruneOldEvents();
      return successResponse({ success: true, pruned });
    }

    return errorResponse('Invalid POST type. Use: prune', 400);
  } catch (error) {
    return handleApiError(error);
  }
}
