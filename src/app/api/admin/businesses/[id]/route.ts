import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { updateBusinessStatusSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizeResponse } from '@/lib/response-sanitizer';

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
            avatar: true,
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

    return successResponse(sanitizeResponse(business));
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
    const validated = updateBusinessStatusSchema.parse(body);

    const business = await db.business.update({
      where: { id },
      data: {
        verificationStatus: validated.verificationStatus,
      },
    });

    // Create notification for business owner
    await db.notification.create({
      data: {
        userId: business.ownerId,
        title: 'Verification Update',
        message: validated.reason || `Your business verification status is now ${validated.verificationStatus}`,
        type: 'VERIFICATION_UPDATE',
        data: JSON.stringify({ businessId: id, status: validated.verificationStatus }),
      },
    });

    return successResponse(business);
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
