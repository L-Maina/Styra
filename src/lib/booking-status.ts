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
