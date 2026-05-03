import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { performIdVerification } from '@/lib/id-verification';

// POST /api/businesses/verify-id — AI-powered ID document verification (admin only)
// Now includes web search for government records + VLM + LLM cross-referencing
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { businessId } = await request.json();

    if (!businessId) {
      return errorResponse('businessId is required', 400);
    }

    // Fetch business with ID verification fields
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        idType: true,
        idNumber: true,
        idDocumentUrl: true,
        verificationStatus: true,
      },
    });

    if (!business) {
      return errorResponse('Business not found', 404);
    }

    // Initialize the AI SDK (auto-loads config from /etc/.z-ai-config)
    const zai = await ZAI.create();

    // ── Full verification pipeline: web search + VLM + LLM cross-reference ──
    const aiResult = await performIdVerification({
      zai,
      idType: business.idType,
      idNumber: business.idNumber,
      idDocumentUrl: business.idDocumentUrl,
      businessName: business.name,
    });

    // Determine overall verification outcome
    const isVerified = aiResult.verified && aiResult.appearsAuthentic;
    const newStatus = isVerified ? 'VERIFIED' : 'REJECTED';

    // Update the business record
    const updateData: Record<string, unknown> = {
      verificationStatus: newStatus,
      verificationResult: JSON.stringify(aiResult),
    };

    if (isVerified) {
      updateData.isVerified = true;
      updateData.verifiedAt = new Date();
    } else {
      updateData.rejectionReason = aiResult.notes || 'AI verification failed: document does not appear authentic';
    }

    await db.business.update({
      where: { id: businessId },
      data: updateData,
    });

    // Create notification for business owner
    try {
      const businessWithOwner = await db.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });
      if (businessWithOwner) {
        await db.notification.create({
          data: {
            userId: businessWithOwner.ownerId,
            title: isVerified ? 'ID Verified Successfully' : 'ID Verification Failed',
            message: isVerified
              ? `Your ${business.idType || 'ID'} document has been verified successfully.`
              : `Your ${business.idType || 'ID'} document verification did not pass. Reason: ${aiResult.notes || 'Document did not appear authentic'}`,
            type: 'VERIFICATION_UPDATE',
            link: `/business/${businessId}`,
          },
        });
      }
    } catch (notificationError) {
      console.error('Failed to create verification notification:', notificationError);
    }

    return successResponse({
      businessId,
      verificationStatus: newStatus,
      result: aiResult,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return handleApiError(error);
  }
}
