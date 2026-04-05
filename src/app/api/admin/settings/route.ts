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
  // Website Contact & Location Settings
  company_name: 'Styra',
  company_tagline: 'Your Style, On Demand',
  company_description: '',
  support_email: 'hello@styra.app',
  press_email: 'press@styra.app',
  phone: '+254 712 345 678',
  address: 'Nairobi, Kenya',
  social_instagram: 'https://instagram.com/styra',
  social_twitter: 'https://twitter.com/styra',
  social_facebook: 'https://facebook.com/styra',
  social_tiktok: 'https://tiktok.com/@styra',
  social_linkedin: 'https://linkedin.com/company/styra',
  social_youtube: '',
  whatsapp_number: '+254 712 345 678',
  business_hours: 'Mon-Sat: 8:00 AM - 8:00 PM',
  support_response_time: 'Within 24 hours',
  website_url: 'https://styra.app',
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

    // Save all keys that we recognize (platform settings + website contact info)
    const toSave: Record<string, any> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in body) {
        toSave[key] = body[key];
      }
    }
    // Also allow saving arbitrary website settings prefixed with "company_", "social_", etc.
    const extraKeys = ['company_name', 'company_tagline', 'company_description', 'support_email', 'press_email', 'phone', 'address', 'social_instagram', 'social_twitter', 'social_facebook', 'social_tiktok', 'social_linkedin', 'social_youtube', 'whatsapp_number', 'business_hours', 'support_response_time', 'website_url'];
    for (const key of extraKeys) {
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
