// ============================================
// RESOURCE OWNERSHIP ENFORCEMENT
// ============================================
// Prevents horizontal privilege escalation.

import { db } from './db';
import { AuthUser, requireAuth } from './auth';
import { logOwnershipCheckFailed } from './audit-log';

// ============================================
// BUSINESS OWNERSHIP
// ============================================

export async function requireBusinessOwnership(businessId: string): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.role === 'ADMIN') return user;

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });

  if (!business || business.ownerId !== user.id) {
    logOwnershipCheckFailed(user.id, user.email, 'business', businessId, '', '', '');
    throw new Error('Forbidden');
  }

  return user;
}

export async function ownsBusiness(userId: string, businessId: string): Promise<boolean> {
  try {
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    return business?.ownerId === userId;
  } catch {
    return false;
  }
}

// ============================================
// BOOKING OWNERSHIP
// ============================================

export async function requireBookingAccess(bookingId: string): Promise<AuthUser & { bookingRole: 'customer' | 'owner' }> {
  const user = await requireAuth();
  if (user.role === 'ADMIN') return { ...user, bookingRole: 'owner' };

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { customerId: true, businessId: true },
  });

  if (!booking) {
    logOwnershipCheckFailed(user.id, user.email, 'booking', bookingId, '', '', '');
    throw new Error('Forbidden');
  }

  if (booking.customerId === user.id) return { ...user, bookingRole: 'customer' };

  const business = await db.business.findUnique({
    where: { id: booking.businessId },
    select: { ownerId: true },
  });

  if (business?.ownerId === user.id) return { ...user, bookingRole: 'owner' };

  logOwnershipCheckFailed(user.id, user.email, 'booking', bookingId, '', '', '');
  throw new Error('Forbidden');
}

// ============================================
// REVIEW OWNERSHIP
// ============================================

export async function requireReviewOwnership(reviewId: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role === 'ADMIN') return user;

  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { customerId: true },
  });

  if (!review || review.customerId !== user.id) {
    logOwnershipCheckFailed(user.id, user.email, 'review', reviewId, '', '', '');
    throw new Error('Forbidden');
  }

  return user;
}

// ============================================
// PAYMENT OWNERSHIP
// ============================================

export async function requirePaymentOwnership(paymentId: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role === 'ADMIN') return user;

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  });

  if (!payment || payment.userId !== user.id) {
    logOwnershipCheckFailed(user.id, user.email, 'payment', paymentId, '', '', '');
    throw new Error('Forbidden');
  }

  return user;
}

// ============================================
// CONVERSATION OWNERSHIP
// ============================================

export async function requireConversationAccess(conversationId: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role === 'ADMIN') return user;

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { customerId: true, businessId: true },
  });

  if (!conversation) {
    logOwnershipCheckFailed(user.id, user.email, 'conversation', conversationId, '', '', '');
    throw new Error('Forbidden');
  }

  if (conversation.customerId === user.id) return user;

  const business = await db.business.findUnique({
    where: { id: conversation.businessId },
    select: { ownerId: true },
  });

  if (business?.ownerId === user.id) return user;

  logOwnershipCheckFailed(user.id, user.email, 'conversation', conversationId, '', '', '');
  throw new Error('Forbidden');
}

// ============================================
// PROFILE OWNERSHIP
// ============================================

export async function requireProfileAccess(targetUserId: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role === 'ADMIN' || user.id === targetUserId) return user;

  logOwnershipCheckFailed(user.id, user.email, 'profile', targetUserId, '', '', '');
  throw new Error('Forbidden');
}

// ============================================
// NOTIFICATION OWNERSHIP
// ============================================

export async function requireNotificationOwnership(notificationId: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role === 'ADMIN') return user;

  const notification = await db.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  if (!notification || notification.userId !== user.id) {
    logOwnershipCheckFailed(user.id, user.email, 'notification', notificationId, '', '', '');
    throw new Error('Forbidden');
  }

  return user;
}
