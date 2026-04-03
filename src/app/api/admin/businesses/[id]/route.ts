import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Get business details (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        },
        services: true,
        staff: true,
        portfolio: true,
        _count: {
          select: { bookings: true, reviews: true, favorites: true },
        },
      },
    });

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    return successResponse(business);
  } catch (error) {
    return handleApiError(error);
  }
}

// Update business verification status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { verificationStatus, reason } = body;

    // Map verificationStatus to isVerified boolean
    const isVerified = verificationStatus === 'APPROVED';
    const isActive = verificationStatus !== 'REJECTED';

    const business = await db.business.update({
      where: { id },
      data: {
        isVerified,
        isActive,
      },
    });

    // Create notification for business owner
    await db.notification.create({
      data: {
        userId: business.ownerId,
        title: 'Verification Update',
        message: reason || `Your business verification status is now ${verificationStatus}`,
        type: 'VERIFICATION_UPDATE',
        link: `/business/${id}`,
      },
    });

    return successResponse({
      ...business,
      verificationStatus: isVerified ? 'APPROVED' : (isActive ? 'PENDING' : 'REJECTED'),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Delete business
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await db.business.delete({
      where: { id },
    });

    return successResponse({ message: 'Business deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
