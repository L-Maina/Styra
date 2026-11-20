// What the public may see of a Business row.
//
// `Business` mixes public profile data with ID verification and payout details. Public routes
// must never send the second group. Only the owner and admins may see it.

const PRIVATE_BUSINESS_FIELDS = [
  // ID verification
  'idType',
  'idNumber',
  'idDocumentUrl',
  'verificationResult',
  'rejectionReason',
  // Payouts and earnings
  'stripeAccountId',
  'stripeOnboardingComplete',
  'payoutPreference',
  'paypalEmail',
  'bankAccountDetails',
  'mpesaPhone',
  'totalEarnings',
] as const;

export type PrivateBusinessField = (typeof PRIVATE_BUSINESS_FIELDS)[number];

/** A copy of the business without the owner-only columns. */
export function omitPrivateBusinessFields<T extends object>(business: T): Omit<T, PrivateBusinessField> {
  const copy = { ...business } as Record<string, unknown>;
  for (const field of PRIVATE_BUSINESS_FIELDS) delete copy[field];
  return copy as Omit<T, PrivateBusinessField>;
}

/** The owner of a business and admins may see its owner-only columns. */
export function canSeePrivateBusinessFields(
  session: { userId?: string; id?: string; role?: string } | null | undefined,
  ownerId: string
): boolean {
  if (!session) return false;
  if ((session.role ?? '').toUpperCase() === 'ADMIN') return true;
  return (session.userId ?? session.id) === ownerId;
}
