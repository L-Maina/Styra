/**
 * Status helpers for bookings and payments.
 *
 * Canonical values are UPPERCASE ("COMPLETED", "IN_PROGRESS"). Some older write
 * paths stored lowercase ("pending", "in_progress"), so every read goes through
 * these helpers and matches either spelling.
 */

export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type BookingStatusValue = (typeof BookingStatus)[keyof typeof BookingStatus];

/** "in_progress", "In Progress" and "IN-PROGRESS" all become "IN_PROGRESS". */
export function normalizeStatus(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase();
}

/** True when the stored status matches any of the given statuses, ignoring case. */
export function isStatus(value: string | null | undefined, ...statuses: string[]): boolean {
  const current = normalizeStatus(value);
  return statuses.some((status) => normalizeStatus(status) === current);
}

/** Both spellings of the given statuses, for Prisma `in` filters over older rows. */
export function statusVariants(...statuses: BookingStatusValue[]): string[] {
  const variants = new Set<string>();
  for (const status of statuses) {
    variants.add(status);
    variants.add(status.toLowerCase());
  }
  return Array.from(variants);
}

/** "IN_PROGRESS" -> "in progress", for messages shown to people. */
export function statusLabel(value: string | null | undefined): string {
  return normalizeStatus(value).toLowerCase().replace(/_/g, ' ');
}

// ── Verification window and display helpers (safe to import from client components) ──────────

/** Hours the customer has to confirm or report a problem after the provider marks a booking complete. */
export const VERIFICATION_WINDOW_HOURS = 24;

/** When the customer's window closes: 24 hours after completion. Older rows fall back to updatedAt. */
export function verificationDeadline(booking: {
  completedAt?: string | Date | null;
  updatedAt?: string | Date | null;
}): Date | null {
  const start = booking.completedAt ?? booking.updatedAt;
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return null;
  return new Date(startMs + VERIFICATION_WINDOW_HOURS * 60 * 60 * 1000);
}

/** Booked but not finished: waiting for the appointment, or in the middle of it. */
export function isUpcoming(value: string | null | undefined): boolean {
  return isStatus(value, BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS);
}

/** The provider did the work: the payment is held (COMPLETED) or has been released (VERIFIED). */
export function isDone(value: string | null | undefined): boolean {
  return isStatus(value, BookingStatus.COMPLETED, BookingStatus.VERIFIED);
}

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BookingStatusMeta {
  /** Short text for a badge. */
  label: string;
  tone: StatusTone;
}

const STATUS_META: Record<BookingStatusValue, BookingStatusMeta> = {
  [BookingStatus.PENDING]: { label: 'Pending', tone: 'warning' },
  [BookingStatus.CONFIRMED]: { label: 'Confirmed', tone: 'success' },
  [BookingStatus.IN_PROGRESS]: { label: 'In progress', tone: 'info' },
  [BookingStatus.COMPLETED]: { label: 'Awaiting confirmation', tone: 'info' },
  [BookingStatus.VERIFIED]: { label: 'Completed', tone: 'success' },
  [BookingStatus.DISPUTED]: { label: 'Under review', tone: 'warning' },
  [BookingStatus.CANCELLED]: { label: 'Cancelled', tone: 'neutral' },
  [BookingStatus.NO_SHOW]: { label: 'No-show', tone: 'danger' },
};

/** Badge text and tone for any stored status, including older lowercase rows. */
export function bookingStatusMeta(value: string | null | undefined): BookingStatusMeta {
  const known = STATUS_META[normalizeStatus(value) as BookingStatusValue];
  if (known) return known;
  const text = statusLabel(value);
  return { label: text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown', tone: 'neutral' };
}
