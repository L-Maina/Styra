import { bookingStatusLabel } from '@/core/copy';
import type { BookingStatus } from '@/core/statuses';
import { StatusPill } from './ui';

const TONE: Record<BookingStatus, 'neutral' | 'good' | 'attention' | 'warning'> = {
  PENDING: 'warning',
  CONFIRMED: 'good',
  COMPLETED: 'attention',
  NO_SHOW: 'warning',
  DISPUTED: 'warning',
  VERIFIED: 'good',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

export function BookingStatus({ status, viewer = 'CUSTOMER' }: { status: BookingStatus; viewer?: 'CUSTOMER' | 'PROVIDER' }) {
  return <StatusPill tone={TONE[status]}>{bookingStatusLabel(status, viewer)}</StatusPill>;
}
