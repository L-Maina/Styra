import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

// ── Constants ──────────────────────────────────────────────────────────────

/** Time window for upcoming booking reminders: next 24 hours */
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Send a notification (fire-and-forget). Deduplicates by checking
 * if a similar notification was sent recently.
 */
async function sendReminderNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  try {
    await db.notification.create({
      data: {
        userId,
        title,
        message,
        type: type as never,
        link: JSON.stringify(data),
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ── GET Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/cron/booking-reminders
 *
 * Cron endpoint for sending booking reminders.
 *
 * Two reminder types:
 *   1. UPCOMING: CONFIRMED bookings coming up in the next 24 hours
 *      → Reminds both customer and provider
 *   2. VERIFY: COMPLETED bookings not yet verified (send "verify your service" reminder)
 *      → Reminds customer to verify within 24 hours
 *
 * Security: Requires CRON_SECRET header matching the environment variable.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = env.cronSecret || process.env.CRON_SECRET;

  if (!expectedSecret) {
    return errorResponse('CRON_SECRET not configured', 500);
  }

  if (
    !cronSecret ||
    !expectedSecret ||
    !crypto.timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expectedSecret))
  ) {
    return errorResponse('Invalid cron secret', 401);
  }

  try {
    const now = new Date();
    const upcomingCutoff = new Date(now.getTime() + UPCOMING_WINDOW_MS);

    let upcomingRemindersSent = 0;
    let verifyRemindersSent = 0;
    const errors: string[] = [];

    // ── Type 1: Upcoming booking reminders ───────────────────────────────
    // Find CONFIRMED bookings with appointments in the next 24 hours
    try {
      // Get today's date string and tomorrow's date string for the date range
      const today = now.toISOString().split('T')[0];
      const tomorrow = upcomingCutoff.toISOString().split('T')[0];

      const upcomingBookings = await db.booking.findMany({
        where: {
          status: 'CONFIRMED',
          date: { in: [today, tomorrow] },
        },
        include: {
          business: { select: { id: true, ownerId: true, name: true } },
          customer: { select: { id: true, name: true } },
          service: { select: { name: true } },
        },
      });

      for (const booking of upcomingBookings) {
        const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
        const msUntilAppointment = bookingDateTime.getTime() - now.getTime();

        // Only send for appointments within the next 24 hours
        if (msUntilAppointment < 0 || msUntilAppointment > UPCOMING_WINDOW_MS) {
          continue;
        }

        // Build time description
        const hoursUntil = Math.floor(msUntilAppointment / (1000 * 60 * 60));
        const timeDescription = hoursUntil < 1
          ? 'less than 1 hour'
          : `about ${hoursUntil} hours`;

        const serviceName = booking.service?.name || 'your appointment';

        // Remind customer
        try {
          await sendReminderNotification(
            booking.customerId,
            'Upcoming Appointment Reminder',
            `Your ${serviceName} at ${booking.business.name} is coming up in ${timeDescription}. Date: ${booking.date} at ${booking.time}.`,
            'BOOKING_REMINDER',
            { bookingId: booking.id, businessName: booking.business.name },
          );
          upcomingRemindersSent++;
        } catch {
          // Per-booking notification failure — continue
        }

        // Remind provider
        try {
          await sendReminderNotification(
            booking.business.ownerId,
            'Upcoming Appointment',
            `You have an upcoming ${serviceName} appointment in ${timeDescription}. Customer: ${booking.customer.name}. Date: ${booking.date} at ${booking.time}.`,
            'BOOKING_REMINDER',
            { bookingId: booking.id, customerName: booking.customer.name },
          );
          upcomingRemindersSent++;
        } catch {
          // Per-booking notification failure — continue
        }
      }
    } catch (error) {
      errors.push(
        `Upcoming reminders: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    // ── Type 2: Verify service reminders ─────────────────────────────────
    // Find COMPLETED bookings not yet verified (customer hasn't acted)
    try {
      const completedBookings = await db.booking.findMany({
        where: {
          status: 'COMPLETED',
        },
        include: {
          business: { select: { id: true, ownerId: true, name: true } },
          customer: { select: { id: true, name: true } },
          service: { select: { name: true } },
        },
        orderBy: { updatedAt: 'asc' },
      });

      for (const booking of completedBookings) {
        const hoursSinceCompleted =
          (now.getTime() - booking.updatedAt.getTime()) / (1000 * 60 * 60);

        // Only remind if less than 22 hours have passed (give them 2h buffer before auto-verify)
        // This avoids sending a reminder right before auto-verification kicks in
        if (hoursSinceCompleted > 22) {
          continue;
        }

        // Only send reminder if at least 1 hour has passed (avoid immediate spam)
        if (hoursSinceCompleted < 1) {
          continue;
        }

        const serviceName = booking.service?.name || 'your service';

        // Check if we already sent a verify reminder for this booking
        const existingReminder = await db.notification.findFirst({
          where: {
            userId: booking.customerId,
            type: 'BOOKING_REMINDER' as never,
            link: { contains: '"reminderType":"VERIFY"' },
            createdAt: { gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) }, // 4 hours
          },
        });

        if (existingReminder) {
          continue; // Already sent a reminder recently
        }

        try {
          const hoursRemaining = Math.round(24 - hoursSinceCompleted);
          await sendReminderNotification(
            booking.customerId,
            'Verify Your Service',
            `Please verify that your ${serviceName} at ${booking.business.name} was completed satisfactorily. You have approximately ${hoursRemaining} hours remaining before the booking is auto-verified.`,
            'BOOKING_REMINDER',
            {
              bookingId: booking.id,
              businessName: booking.business.name,
              reminderType: 'VERIFY',
              hoursRemaining,
            },
          );
          verifyRemindersSent++;
        } catch {
          // Per-booking notification failure — continue
        }
      }
    } catch (error) {
      errors.push(
        `Verify reminders: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    return successResponse({
      message: 'Booking reminders cron completed',
      upcomingRemindersSent,
      verifyRemindersSent,
      totalRemindersSent: upcomingRemindersSent + verifyRemindersSent,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Cron execution failed',
      500,
    );
  }
}
