import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth, requireAdmin } from '@/lib/auth';

/** Default platform settings values */
const DEFAULTS = {
  platformFee: '15',
  minWithdrawal: '50',
  featuredListingPrice: '99',
  premiumListingPrice: '49',
  maintenanceMode: 'false',
  emailNotifications: 'true',
  smsNotifications: 'false',
  autoApproveBusinesses: 'false',
  requireIdVerification: 'true',
};

/** Parse a PlatformSetting's JSON value or return the default */
function getSettingValue(settings: { key: string; value: string }[], key: string): string {
  const entry = settings.find((s) => s.key === key);
  return entry ? entry.value : DEFAULTS[key] ?? '';
}

function parseNumber(val: string, fallback: number): number {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function parseBoolean(val: string, fallback: boolean): boolean {
  return val === 'true' ? true : val === 'false' ? false : fallback;
}

function buildSettingsResponse(allSettings: { key: string; value: string }[]) {
  return {
    platformFee: parseNumber(getSettingValue(allSettings, 'platformFee'), 15),
    minWithdrawal: parseNumber(getSettingValue(allSettings, 'minWithdrawal'), 50),
    featuredListingPrice: parseNumber(getSettingValue(allSettings, 'featuredListingPrice'), 99),
    premiumListingPrice: parseNumber(getSettingValue(allSettings, 'premiumListingPrice'), 49),
    maintenanceMode: parseBoolean(getSettingValue(allSettings, 'maintenanceMode'), false),
    emailNotifications: parseBoolean(getSettingValue(allSettings, 'emailNotifications'), true),
    smsNotifications: parseBoolean(getSettingValue(allSettings, 'smsNotifications'), false),
    autoApproveBusinesses: parseBoolean(getSettingValue(allSettings, 'autoApproveBusinesses'), false),
    requireIdVerification: parseBoolean(getSettingValue(allSettings, 'requireIdVerification'), true),
  };
}

const SETTING_KEYS = Object.keys(DEFAULTS);

async function ensureSettings() {
  const existing = await db.platformSetting.findMany();
  const existingKeys = new Set(existing.map((s) => s.key));
  const toCreate = SETTING_KEYS.filter((k) => !existingKeys.has(k));
  if (toCreate.length > 0) {
    await db.platformSetting.createMany({
      data: toCreate.map((key) => ({ key, value: DEFAULTS[key] })),
    });
  }
  return db.platformSetting.findMany();
}

// GET /api/settings
export async function GET() {
  try {
    await requireAuth();
    const allSettings = await ensureSettings();
    return successResponse({
      settings: buildSettingsResponse(allSettings),
      stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/settings (admin only)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    await ensureSettings();

    for (const key of SETTING_KEYS) {
      if (body[key] !== undefined) {
        const val = String(body[key]);
        await db.platformSetting.upsert({
          where: { key },
          update: { value: val },
          create: { key, value: val },
        });
      }
    }

    const allSettings = await db.platformSetting.findMany();
    return successResponse({
      settings: buildSettingsResponse(allSettings),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
