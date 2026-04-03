import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

const DEFAULT_SETTINGS: Record<string, string | number | boolean> = {
  platformFee: 15,
  minWithdrawal: 50,
  featuredListingPrice: 99,
  premiumListingPrice: 49,
  maintenanceMode: false,
  emailNotifications: true,
  smsNotifications: false,
  autoApproveBusinesses: false,
  requireIdVerification: true,
};

// Parse all settings rows into a flat object
async function loadSettings(): Promise<Record<string, any>> {
  const rows = await db.platformSetting.findMany();
  const settings: Record<string, any> = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.value);
      if (typeof parsed === 'object' && parsed !== null) {
        // Value was stored as a complex object, merge it
        Object.assign(settings, parsed);
      } else {
        settings[row.key] = parsed;
      }
    } catch {
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else if (!isNaN(Number(row.value)) && row.value.trim() !== '') settings[row.key] = Number(row.value);
      else settings[row.key] = row.value;
    }
  }

  return settings;
}

// Upsert settings as key-value rows
async function saveSettings(data: Record<string, any>): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    if (key in DEFAULT_SETTINGS) {
      await db.platformSetting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(value) },
        update: { value: JSON.stringify(value) },
      });
    }
  }
}

// GET - Fetch platform settings
export async function GET() {
  try {
    await requireAdmin();
    const settings = await loadSettings();
    return successResponse({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update platform settings
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    // Only save keys that we recognize
    const toSave: Record<string, any> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in body) {
        toSave[key] = body[key];
      }
    }

    await saveSettings(toSave);
    const settings = await loadSettings();

    return successResponse({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
