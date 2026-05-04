import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { getPusherServer } from '@/lib/pusher';

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

    // Include verification details in the response
    const response = {
      ...business,
      rejectionReason: business.rejectionReason,
      verificationResult: business.verificationResult
        ? (() => { try { return JSON.parse(business.verificationResult); } catch { return business.verificationResult; } })()
        : null,
    };

    return successResponse(response);
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

    // Validate verification status
    const validStatuses = ['PENDING', 'VERIFIED', 'REJECTED', 'APPROVED', 'AUTO_VERIFIED'];
    if (!verificationStatus || !validStatuses.includes(verificationStatus)) {
      return errorResponse(`Invalid verificationStatus. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // When REJECTED, require a reason
    if (verificationStatus === 'REJECTED' && !reason) {
      return errorResponse('A reason is required when rejecting a business', 400);
    }

    // Build update data based on verification status
    const updateData: Record<string, unknown> = {
      verificationStatus,
    };

    if (verificationStatus === 'APPROVED') {
      updateData.isVerified = true;
      updateData.isActive = true;
      updateData.verifiedAt = new Date();
      updateData.rejectionReason = null;
    } else if (verificationStatus === 'VERIFIED') {
      updateData.isVerified = true;
      updateData.isActive = true;
      updateData.verifiedAt = new Date();
      updateData.rejectionReason = null;
    } else if (verificationStatus === 'AUTO_VERIFIED') {
      updateData.isVerified = true;
      updateData.isActive = true;
      updateData.verifiedAt = new Date();
      updateData.rejectionReason = null;
    } else if (verificationStatus === 'REJECTED') {
      updateData.isVerified = false;
      updateData.isActive = false;
      updateData.rejectionReason = reason;
      updateData.verifiedAt = null;
    } else if (verificationStatus === 'PENDING') {
      updateData.isVerified = false;
      updateData.isActive = true;
      updateData.rejectionReason = null;
    }

    const business = await db.business.update({
      where: { id },
      data: updateData,
    });

    // ── Update user role to BUSINESS_OWNER when business is approved/verified ──
    if (verificationStatus === 'APPROVED' || verificationStatus === 'VERIFIED' || verificationStatus === 'AUTO_VERIFIED') {
      try {
        const currentUser = await db.user.findUnique({
          where: { id: business.ownerId },
          select: { role: true },
        });
        // Only upgrade role — never downgrade an ADMIN to BUSINESS_OWNER
        if (currentUser && currentUser.role !== 'ADMIN' && currentUser.role !== 'BUSINESS_OWNER') {
          await db.user.update({
            where: { id: business.ownerId },
            data: { role: 'BUSINESS_OWNER' },
          });
        }
      } catch (roleError) {
        console.error('Failed to update user role on business approval:', roleError);
        // Don't fail the approval if role update fails
      }
    }

    // Create notification for business owner
    try {
      await db.notification.create({
        data: {
          userId: business.ownerId,
          title: 'Verification Update',
          message:
            verificationStatus === 'REJECTED'
              ? `Your business verification has been rejected. Reason: ${reason}`
              : verificationStatus === 'APPROVED'
                ? `Your business "${business.name}" has been approved and is now active!`
                : verificationStatus === 'VERIFIED'
                  ? `Your business "${business.name}" ID verification has been confirmed.`
                  : `Your business verification status has been updated to ${verificationStatus}.`,
          type: 'VERIFICATION_UPDATE',
          link: `/business/${id}`,
        },
      });

      // Push real-time notification to the business owner
      const pusher = getPusherServer();
      if (pusher) {
        pusher.trigger(`user-${business.ownerId}`, 'new-notification', {
          title: 'Verification Update',
          message:
            verificationStatus === 'REJECTED'
              ? `Your business verification has been rejected.`
              : `Your business "${business.name}" has been ${verificationStatus.toLowerCase()}!`,
          type: 'VERIFICATION_UPDATE',
          link: `/business/${id}`,
        }).catch((err: unknown) => console.error('Pusher notify error:', err));
      }
    } catch (notificationError) {
      console.error('Failed to create verification notification:', notificationError);
    }

    // Push real-time update to admin channel so other admin tabs refresh
    try {
      const pusher = getPusherServer();
      if (pusher) {
        pusher.trigger('admin-channel', 'business-status-changed', {
          businessId: id,
          verificationStatus,
          businessName: business.name,
        }).catch((err: unknown) => console.error('Pusher admin update error:', err));
      }
    } catch (pushError) {
      console.error('Failed to push admin update:', pushError);
    }

    // Log the admin action
    try {
      await db.auditLog.create({
        data: {
          action: `BUSINESS_${verificationStatus}`,
          resource: `business:${id}`,
          details: reason || `Status changed to ${verificationStatus}`,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    return successResponse({
      ...business,
      rejectionReason: business.rejectionReason,
      verificationResult: business.verificationResult
        ? (() => { try { return JSON.parse(business.verificationResult); } catch { return business.verificationResult; } })()
        : null,
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
