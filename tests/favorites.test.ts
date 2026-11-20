import { describe, expect, test } from 'bun:test';
import { publicBusinessWhere, toFavoriteListing } from '@/lib/favorites';

const cloudinary = 'https://res.cloudinary.com/demo/image/upload/v1/styra/logos/abc.jpg';
const dataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(5000);

function business(overrides: Record<string, unknown> = {}) {
  return {
    id: 'biz_1',
    ownerId: 'user_1',
    name: 'Fade Lab',
    coverImage: null as string | null,
    logo: null as string | null,
    boothPhotoUrl: null as string | null,
    idNumber: '12345678',
    idDocumentUrl: 'https://example.test/id.jpg',
    bankAccountDetails: '{"iban":"KE00"}',
    totalEarnings: 900,
    services: [{ id: 'svc_1', name: 'Haircut' }],
    _count: { reviews: 7, portfolio: 3 },
    ...overrides,
  };
}

describe('toFavoriteListing', () => {
  test('marks the business as a favorite and adds the counts the cards read', () => {
    const listing = toFavoriteListing(business());
    expect(listing.isFavorite).toBe(true);
    expect(listing.reviewCount).toBe(7);
    expect(listing.portfolioCount).toBe(3);
    expect(listing.reviews).toEqual([]);
    expect(listing.services).toHaveLength(1);
  });

  test('never carries the owner-only columns', () => {
    const listing = toFavoriteListing(business()) as Record<string, unknown>;
    expect('idNumber' in listing).toBe(false);
    expect('idDocumentUrl' in listing).toBe(false);
    expect('bankAccountDetails' in listing).toBe(false);
    expect('totalEarnings' in listing).toBe(false);
  });

  test('keeps short image links', () => {
    const listing = toFavoriteListing(business({ logo: cloudinary, coverImage: cloudinary, boothPhotoUrl: cloudinary }));
    expect(listing.logo).toBe(cloudinary);
    expect(listing.coverImage).toBe(cloudinary);
    expect(listing.boothPhotoUrl).toBe(cloudinary);
    expect(listing.hasLogo).toBe(true);
    expect(listing.hasCoverImage).toBe(true);
  });

  test('leaves out base64 images but says they exist, so the card can fetch them', () => {
    const listing = toFavoriteListing(business({ logo: dataUrl, coverImage: dataUrl }));
    expect(listing.logo).toBeNull();
    expect(listing.coverImage).toBeNull();
    expect(listing.hasLogo).toBe(true);
    expect(listing.hasCoverImage).toBe(true);
  });

  test('falls back to the booth photo for the cover image', () => {
    const listing = toFavoriteListing(business({ boothPhotoUrl: cloudinary }));
    expect(listing.coverImage).toBe(cloudinary);
    expect(listing.hasCoverImage).toBe(true);
  });

  test('says there is no image when there is none', () => {
    const listing = toFavoriteListing(business());
    expect(listing.coverImage).toBeNull();
    expect(listing.logo).toBeNull();
    expect(listing.hasCoverImage).toBe(false);
    expect(listing.hasLogo).toBe(false);
  });
});

describe('publicBusinessWhere', () => {
  test('is the rule GET /api/businesses uses for the public', () => {
    expect(publicBusinessWhere()).toEqual({
      isActive: true,
      verificationStatus: { in: ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED'] },
    });
  });

  test('returns a new object each time, so callers cannot change it for others', () => {
    expect(publicBusinessWhere()).not.toBe(publicBusinessWhere());
  });
});
