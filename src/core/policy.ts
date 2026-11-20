export interface CancellationTier {
  hoursBefore: number;
  refundBps: number;
}

export interface Settings {
  commissionBps: number;
  verificationWindowHours: number;
  holdMinutes: number;
  cancellationPolicy: CancellationTier[];
  payoutMinMinor: bigint;
}

/** Seed values (blueprint section 5 decision); the live values come from the `settings` table. */
export const DEFAULT_SETTINGS: Settings = {
  commissionBps: 1000,
  verificationWindowHours: 24,
  holdMinutes: 15,
  cancellationPolicy: [
    { hoursBefore: 24, refundBps: 10000 },
    { hoursBefore: 4, refundBps: 5000 },
    { hoursBefore: 0, refundBps: 0 },
  ],
  payoutMinMinor: 10000n,
};

const HOUR = 3_600_000;

/**
 * Refund share for a customer cancellation: the first tier (sorted by hoursBefore, descending) whose
 * hoursBefore is at most the hours left until start. At or after the start time, nothing.
 */
export function customerRefundBps(policy: CancellationTier[], startAt: Date, now: Date): number {
  const msLeft = startAt.getTime() - now.getTime();
  if (msLeft <= 0) return 0;
  const tiers = [...policy].sort((a, b) => b.hoursBefore - a.hoursBefore);
  for (const t of tiers) if (t.hoursBefore * HOUR <= msLeft) return t.refundBps;
  return 0;
}

export function verificationDeadline(completedAt: Date, windowHours: number): Date {
  return new Date(completedAt.getTime() + windowHours * HOUR);
}

export function holdExpiresAt(createdAt: Date, holdMinutes: number): Date {
  return new Date(createdAt.getTime() + holdMinutes * 60_000);
}
