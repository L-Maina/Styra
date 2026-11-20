import { z } from 'zod';

export const createBusinessInput = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(['BARBER', 'HAIR', 'BRAIDS', 'NAILS', 'MASSAGE', 'SPA', 'MAKEUP', 'OTHER']),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
  description: z.string().trim().max(1000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const serviceInput = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(30),
  description: z.string().trim().max(500).optional(),
  durationMin: z.number().int().min(5).max(720),
  priceMinor: z.number().int().min(0).max(100_000_000),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const availabilityInput = z.object({
  staffId: z.string().uuid().optional(),
  rules: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }).refine((r) => r.end > r.start, { message: 'end must be after start' }))
    .max(50),
});

export const businessListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(30).optional(),
  city: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.coerce.number().int().min(0).default(0),
});

export const slotsQuery = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid().optional(),
});

export const createBookingInput = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  startAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(500).optional(),
});

export const payInput = z.object({
  method: z.enum(['MPESA', 'PAYSTACK', 'FAKE']),
  phone: z.string().trim().max(20).optional(),
});

export const cancelInput = z.object({ reason: z.string().trim().max(300).optional() });
export const disputeInput = z.object({ reason: z.string().trim().min(10).max(2000), details: z.string().trim().max(4000).optional() });
export const reviewInput = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });

export type BookingAction = 'pay' | 'cancel' | 'confirm' | 'dispute' | 'review' | 'complete' | 'no-show' | 'decline';

export interface BookingDto {
  id: string;
  code: string;
  status: string;
  escrowState: string;
  startAt: string;
  endAt: string;
  priceMinor: number;
  currency: string;
  expiresAt: string | null;
  autoConfirmAt: string | null;
  notes: string | null;
  business: { id: string; name: string; slug: string; phone: string | null; address: string | null };
  service: { id: string; name: string; durationMin: number };
  staff: { id: string; name: string };
  customer: { id: string; name: string };
  refund: { amountMinor: number; status: string } | null;
  hasReview: boolean;
  actions: BookingAction[];
}

export const payoutInput = z.object({
  amountMinor: z.number().int().positive().max(100_000_000_00),
  method: z.enum(['MPESA', 'BANK']),
  destination: z.string().trim().min(4).max(60),
});
export const payoutActionInput = z.object({ providerRef: z.string().trim().max(80).optional(), reason: z.string().trim().max(300).optional() });
export const refundPaidInput = z.object({ providerRef: z.string().trim().min(1).max(80) });
export const resolveDisputeInput = z.object({
  outcome: z.enum(['RELEASE', 'REFUND', 'SPLIT']),
  refundBps: z.number().int().min(0).max(10000).optional(),
  note: z.string().trim().min(2).max(2000),
});
