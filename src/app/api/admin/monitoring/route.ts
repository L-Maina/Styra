import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { getRecentErrors, getErrorStats, resolveErrors } from '@/lib/error-tracker';
import { getAlertStats } from '@/lib/security-alerts';
import { env } from '@/lib/env';

// ============================================
// GET /api/admin/monitoring?type=errors|alerts|webhooks|system
// ============================================

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'system';

    switch (type) {
      case 'errors':
        return await handleErrorsRequest(request);
      case 'alerts':
        return await handleAlertsRequest(request);
      case 'webhooks':
        return await handleWebhooksRequest(request);
      case 'system':
        return await handleSystemRequest();
      default:
        return errorResponse(`Unknown monitoring type: ${type}. Use: errors, alerts, webhooks, system`, 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================
// POST /api/admin/monitoring — Resolve errors
// ============================================

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { action, errorIds } = body;

    if (action === 'resolve' && Array.isArray(errorIds)) {
      const count = await resolveErrors(errorIds);
      return successResponse({ resolved: count });
    }

    return errorResponse('Invalid action. Supported: resolve (with errorIds array)', 400);
  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================
// ERRORS HANDLER
// ============================================

async function handleErrorsRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

  const [recentErrors, stats] = await Promise.all([
    getRecentErrors(limit),
    getErrorStats(),
  ]);

  return successResponse({
    errors: recentErrors,
    stats,
  });
}

// ============================================
// SECURITY ALERTS HANDLER
// ============================================

async function handleAlertsRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const statusFilter = searchParams.get('status');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

  const where: Record<string, unknown> = {};
  if (statusFilter && ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'].includes(statusFilter)) {
    where.status = statusFilter;
  }

  const [alerts, stats] = await Promise.all([
    db.securityAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        severity: true,
        ipAddress: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    }),
    getAlertStats(),
  ]);

  return successResponse({
    alerts,
    stats,
  });
}

// ============================================
// WEBHOOK EVENTS HANDLER
// ============================================

async function handleWebhooksRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

  const [
    recentEvents,
    totalByStatus,
    totalByProvider,
    recentFailures,
  ] = await Promise.all([
    // Recent webhook events
    db.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        provider: true,
        eventType: true,
        status: true,
        processingTimeMs: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    // Total counts by status
    db.webhookEvent.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    // Total counts by provider
    db.webhookEvent.groupBy({
      by: ['provider'],
      _count: { id: true },
    }),
    // Recent failures (last 24h)
    db.webhookEvent.findMany({
      where: {
        status: { in: ['FAILED', 'INVALID_SIGNATURE'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        provider: true,
        eventType: true,
        status: true,
        errorMessage: true,
        processingTimeMs: true,
        createdAt: true,
      },
    }),
  ]);

  // Format status counts
  const byStatus: Record<string, number> = {};
  for (const item of totalByStatus) {
    byStatus[item.status] = item._count.id;
  }

  // Format provider counts
  const byProvider: Record<string, number> = {};
  for (const item of totalByProvider) {
    byProvider[item.provider] = item._count.id;
  }

  // Total events
  const total = Object.values(byStatus).reduce((sum, c) => sum + c, 0);

  // Failure rate
  const failureCount = (byStatus['FAILED'] || 0) + (byStatus['INVALID_SIGNATURE'] || 0);
  const failureRate = total > 0 ? Math.round((failureCount / total) * 1000) / 10 : 0;

  // Average processing time
  const recentProcessed = await db.webhookEvent.findMany({
    where: { processingTimeMs: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { processingTimeMs: true },
  });
  const avgProcessingTime = recentProcessed.length > 0
    ? Math.round(recentProcessed.reduce((sum, e) => sum + (e.processingTimeMs || 0), 0) / recentProcessed.length)
    : 0;

  return successResponse({
    events: recentEvents,
    stats: {
      total,
      byStatus,
      byProvider,
      failureRate,
      recentFailures: recentFailures.length,
      avgProcessingTimeMs: avgProcessingTime,
    },
  });
}

// ============================================
// SYSTEM HEALTH HANDLER
// ============================================

async function handleSystemRequest() {
  const now = new Date();

  // Database size approximation
  let dbSizeBytes = 0;
  try {
    const result = await db.$queryRaw<Array<{ size: number }>>`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `;
    dbSizeBytes = result[0]?.size || 0;
  } catch {
    dbSizeBytes = 0;
  }

  // Record counts
  const [
    totalUsers,
    totalBusinesses,
    totalBookings,
    totalPayments,
    totalAlerts,
    totalErrors,
    totalWebhookEvents,
    totalAuditLogs,
    openAlerts,
    unresolvedErrors,
  ] = await Promise.all([
    db.user.count(),
    db.business.count(),
    db.booking.count(),
    db.payment.count(),
    db.securityAlert.count(),
    db.monitoringError.count(),
    db.webhookEvent.count(),
    db.securityAuditLog.count(),
    db.securityAlert.count({ where: { status: 'OPEN' } }),
    db.monitoringError.count({ where: { resolved: false } }),
  ]);

  // Recent activity (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    recentBookings,
    recentPayments,
    recentAlerts,
    recentErrors,
    recentWebhooks,
  ] = await Promise.all([
    db.booking.count({ where: { createdAt: { gte: yesterday } } }),
    db.payment.count({ where: { createdAt: { gte: yesterday } } }),
    db.securityAlert.count({ where: { createdAt: { gte: yesterday } } }),
    db.monitoringError.count({ where: { createdAt: { gte: yesterday } } }),
    db.webhookEvent.count({ where: { createdAt: { gte: yesterday } } }),
  ]);

  // Uptime approximation (time since first audit log entry)
  let firstEntry: { createdAt: Date } | null = null;
  try {
    firstEntry = await db.securityAuditLog.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
  } catch {
    // Ignore
  }

  const uptimeMs = firstEntry ? now.getTime() - firstEntry.createdAt.getTime() : 0;
  const uptimeDays = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
  const uptimeHours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  // Payment status breakdown
  const paymentStatuses = await db.payment.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const byPaymentStatus: Record<string, number> = {};
  for (const item of paymentStatuses) {
    byPaymentStatus[item.status] = item._count.id;
  }

  return successResponse({
    status: 'healthy',
    timestamp: now.toISOString(),
    environment: env.env,
    database: {
      sizeBytes: dbSizeBytes,
      sizeMB: Math.round((dbSizeBytes / (1024 * 1024)) * 100) / 100,
      tables: {
        users: totalUsers,
        businesses: totalBusinesses,
        bookings: totalBookings,
        payments: totalPayments,
      },
    },
    uptime: {
      approximate: `${uptimeDays}d ${uptimeHours}h`,
      firstRecordAt: firstEntry?.createdAt?.toISOString() || null,
    },
    security: {
      openAlerts,
      unresolvedErrors,
      totalAuditLogs,
      totalWebhookEvents,
    },
    recentActivity24h: {
      bookings: recentBookings,
      payments: recentPayments,
      alerts: recentAlerts,
      errors: recentErrors,
      webhookEvents: recentWebhooks,
    },
    paymentBreakdown: byPaymentStatus,
  });
}
