import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch platform settings
export async function GET() {
  try {
    await requireAdmin();
    // There should only be one settings record
    let settings = await db.platformSetting.findFirst();

    if (!settings) {
      // Create default settings if not exists
      settings = await db.platformSetting.create({
        data: {},
      });
    }

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
    const {
      platformFee,
      minWithdrawal,
      featuredListingPrice,
      premiumListingPrice,
      maintenanceMode,
      emailNotifications,
      smsNotifications,
      autoApproveBusinesses,
      requireIdVerification,
    } = body;

    // Find existing settings
    let settings = await db.platformSetting.findFirst();

    if (!settings) {
      // Create new settings
      settings = await db.platformSetting.create({
        data: {
          platformFee: platformFee ?? 15.0,
          minWithdrawal: minWithdrawal ?? 50.0,
          featuredListingPrice: featuredListingPrice ?? 99.0,
          premiumListingPrice: premiumListingPrice ?? 49.0,
          maintenanceMode: maintenanceMode ?? false,
          emailNotifications: emailNotifications ?? true,
          smsNotifications: smsNotifications ?? false,
          autoApproveBusinesses: autoApproveBusinesses ?? false,
          requireIdVerification: requireIdVerification ?? true,
        },
      });
    } else {
      // Update existing settings
      const updateData: Record<string, unknown> = {};
      
      if (platformFee !== undefined) updateData.platformFee = platformFee;
      if (minWithdrawal !== undefined) updateData.minWithdrawal = minWithdrawal;
      if (featuredListingPrice !== undefined) updateData.featuredListingPrice = featuredListingPrice;
      if (premiumListingPrice !== undefined) updateData.premiumListingPrice = premiumListingPrice;
      if (maintenanceMode !== undefined) updateData.maintenanceMode = maintenanceMode;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
      if (smsNotifications !== undefined) updateData.smsNotifications = smsNotifications;
      if (autoApproveBusinesses !== undefined) updateData.autoApproveBusinesses = autoApproveBusinesses;
      if (requireIdVerification !== undefined) updateData.requireIdVerification = requireIdVerification;

      settings = await db.platformSetting.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    return successResponse({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
