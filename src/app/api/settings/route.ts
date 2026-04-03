import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth, requireAdmin } from '@/lib/auth';

// GET /api/settings - Get platform settings (authenticated users only)
export async function GET(request: NextRequest) {
  try {
    // Require authentication — platform fee structure is sensitive info
    await requireAuth();

    // Get or create platform settings
    let settings = await db.platformSetting.findFirst();

    if (!settings) {
      // Create default settings if none exist
      settings = await db.platformSetting.create({
        data: {
          platformFee: 15.0,
          minWithdrawal: 50.0,
          featuredListingPrice: 99.0,
          premiumListingPrice: 49.0,
          maintenanceMode: false,
          emailNotifications: true,
          smsNotifications: false,
          autoApproveBusinesses: false,
          requireIdVerification: true,
        },
      });
    }

    return successResponse({
      settings: {
        platformFee: settings.platformFee,
        minWithdrawal: settings.minWithdrawal,
        featuredListingPrice: settings.featuredListingPrice,
        premiumListingPrice: settings.premiumListingPrice,
        maintenanceMode: settings.maintenanceMode,
        emailNotifications: settings.emailNotifications,
        smsNotifications: settings.smsNotifications,
        autoApproveBusinesses: settings.autoApproveBusinesses,
        requireIdVerification: settings.requireIdVerification,
      },
      // Stripe publishable key for frontend integration
      stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/settings - Update platform settings (admin only)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    let settings = await db.platformSetting.findFirst();

    if (!settings) {
      settings = await db.platformSetting.create({
        data: {
          platformFee: body.platformFee ?? 15.0,
          minWithdrawal: body.minWithdrawal ?? 50.0,
          featuredListingPrice: body.featuredListingPrice ?? 99.0,
          premiumListingPrice: body.premiumListingPrice ?? 49.0,
          maintenanceMode: body.maintenanceMode ?? false,
          emailNotifications: body.emailNotifications ?? true,
          smsNotifications: body.smsNotifications ?? false,
          autoApproveBusinesses: body.autoApproveBusinesses ?? false,
          requireIdVerification: body.requireIdVerification ?? true,
        },
      });
    } else {
      settings = await db.platformSetting.update({
        where: { id: settings.id },
        data: {
          ...(body.platformFee !== undefined && { platformFee: body.platformFee }),
          ...(body.minWithdrawal !== undefined && { minWithdrawal: body.minWithdrawal }),
          ...(body.featuredListingPrice !== undefined && { featuredListingPrice: body.featuredListingPrice }),
          ...(body.premiumListingPrice !== undefined && { premiumListingPrice: body.premiumListingPrice }),
          ...(body.maintenanceMode !== undefined && { maintenanceMode: body.maintenanceMode }),
          ...(body.emailNotifications !== undefined && { emailNotifications: body.emailNotifications }),
          ...(body.smsNotifications !== undefined && { smsNotifications: body.smsNotifications }),
          ...(body.autoApproveBusinesses !== undefined && { autoApproveBusinesses: body.autoApproveBusinesses }),
          ...(body.requireIdVerification !== undefined && { requireIdVerification: body.requireIdVerification }),
        },
      });
    }

    return successResponse({
      settings: {
        platformFee: settings.platformFee,
        minWithdrawal: settings.minWithdrawal,
        featuredListingPrice: settings.featuredListingPrice,
        premiumListingPrice: settings.premiumListingPrice,
        maintenanceMode: settings.maintenanceMode,
        emailNotifications: settings.emailNotifications,
        smsNotifications: settings.smsNotifications,
        autoApproveBusinesses: settings.autoApproveBusinesses,
        requireIdVerification: settings.requireIdVerification,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
