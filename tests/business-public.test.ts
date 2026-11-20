import { describe, expect, test } from 'bun:test';
import { canSeePrivateBusinessFields, omitPrivateBusinessFields } from '@/lib/business-public';

const business = {
  id: 'biz_1',
  ownerId: 'user_1',
  name: 'Fade Lab',
  city: 'Nairobi',
  phone: '+254700000000',
  rating: 4.8,
  isVerified: true,
  verificationStatus: 'VERIFIED',
  idType: 'NATIONAL_ID',
  idNumber: '12345678',
  idDocumentUrl: 'https://example.test/id.jpg',
  verificationResult: '{"verified":true}',
  rejectionReason: null,
  stripeAccountId: 'acct_123',
  stripeOnboardingComplete: true,
  payoutPreference: 'MPESA',
  paypalEmail: 'owner@example.test',
  bankAccountDetails: '{"iban":"KE00"}',
  mpesaPhone: '+254711111111',
  totalEarnings: 1200,
};

describe('omitPrivateBusinessFields', () => {
  test('removes ID, payout and earnings columns', () => {
    const safe = omitPrivateBusinessFields(business) as Record<string, unknown>;
    for (const field of [
      'idType',
      'idNumber',
      'idDocumentUrl',
      'verificationResult',
      'rejectionReason',
      'stripeAccountId',
      'stripeOnboardingComplete',
      'payoutPreference',
      'paypalEmail',
      'bankAccountDetails',
      'mpesaPhone',
      'totalEarnings',
    ]) {
      expect(field in safe).toBe(false);
    }
  });

  test('keeps the public profile, including contact details and the verified badge', () => {
    const safe = omitPrivateBusinessFields(business);
    expect(safe.name).toBe('Fade Lab');
    expect(safe.city).toBe('Nairobi');
    expect(safe.phone).toBe('+254700000000');
    expect(safe.rating).toBe(4.8);
    expect(safe.isVerified).toBe(true);
    expect(safe.verificationStatus).toBe('VERIFIED');
    expect(safe.ownerId).toBe('user_1');
  });

  test('returns a copy and leaves the original untouched', () => {
    omitPrivateBusinessFields(business);
    expect(business.idNumber).toBe('12345678');
    expect(business.bankAccountDetails).toBe('{"iban":"KE00"}');
  });
});

describe('canSeePrivateBusinessFields', () => {
  test('the owner can', () => {
    expect(canSeePrivateBusinessFields({ userId: 'user_1', role: 'BUSINESS_OWNER' }, 'user_1')).toBe(true);
    expect(canSeePrivateBusinessFields({ id: 'user_1', role: 'CUSTOMER' }, 'user_1')).toBe(true);
  });

  test('admins can, whatever the casing of the role', () => {
    expect(canSeePrivateBusinessFields({ userId: 'admin_1', role: 'ADMIN' }, 'user_1')).toBe(true);
    expect(canSeePrivateBusinessFields({ userId: 'admin_1', role: 'admin' }, 'user_1')).toBe(true);
  });

  test('other signed-in users and visitors cannot', () => {
    expect(canSeePrivateBusinessFields({ userId: 'user_2', role: 'CUSTOMER' }, 'user_1')).toBe(false);
    expect(canSeePrivateBusinessFields({ userId: 'user_2', role: 'BUSINESS_OWNER' }, 'user_1')).toBe(false);
    expect(canSeePrivateBusinessFields(null, 'user_1')).toBe(false);
    expect(canSeePrivateBusinessFields(undefined, 'user_1')).toBe(false);
  });

  test('a session without an id matches nobody', () => {
    expect(canSeePrivateBusinessFields({ role: 'CUSTOMER' }, 'user_1')).toBe(false);
  });
});
