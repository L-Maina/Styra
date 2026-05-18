// ============================================
// AUTO-VERIFY SHARED LOGIC
// ============================================
// Extracted from /api/businesses/auto-verify route so it can be
// called directly from the business creation handler without
// needing an internal HTTP fetch (which has CSRF & URL issues).

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { performIdVerification } from '@/lib/id-verification';

export interface AutoVerifyResult {
  autoVerified: boolean;
  verificationStatus: string;
  message: string;
  result?: {
    verified: boolean;
    documentTypeMatch: boolean;
    appearsAuthentic: boolean;
    extractedName?: string;
    extractedIdNumber?: string;
    confidence: number;
    notes: string;
    webSearchEvidence?: {
      searchQuery: string;
      resultsFound: number;
      relevantResults: Array<{ url: string; snippet: string }>;
      governmentRecordMatch: boolean;
      details: string;
    };
  };
}

/**
 * Run auto-verification for a newly created business.
 *
 * 1. Checks if `autoApproveBusinesses` is enabled in PlatformSetting
 * 2. If enabled, runs comprehensive AI verification (web search + VLM + LLM cross-reference)
 * 3. If verification passes → marks business as AUTO_VERIFIED, updates user role
 * 4. If verification fails or auto-approve is off → leaves business as PENDING
 *
 * This function is safe to call from any server-side context — it does NOT
 * make HTTP requests and therefore bypasses CSRF / URL issues entirely.
 */
export async function performAutoVerify(businessId: string): Promise<AutoVerifyResult> {
  // ── 1. Check if auto-approve is enabled ──
  const autoApproveSetting = await db.platformSetting.findUnique({
    where: { key: 'autoApproveBusinesses' },
  });

  if (!autoApproveSetting || autoApproveSetting.value !== 'true') {
    return {
      autoVerified: false,
      verificationStatus: 'PENDING',
      message: 'Auto-approve is not enabled. Business remains PENDING for manual review.',
    };
  }

  // ── 2. Fetch business ──
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      idType: true,
      idNumber: true,
      idDocumentUrl: true,
      verificationStatus: true,
    },
  });

  if (!business) {
    return {
      autoVerified: false,
      verificationStatus: 'PENDING',
      message: 'Business not found. Business remains PENDING for manual review.',
    };
  }

  // If already verified, skip
  if (
    business.verificationStatus === 'VERIFIED' ||
    business.verificationStatus === 'AUTO_VERIFIED'
  ) {
    return {
      autoVerified: true,
      verificationStatus: business.verificationStatus,
      message: 'Business is already verified.',
    };
  }

  // ── 3. Run comprehensive AI verification (web search + VLM + LLM) ──
  let aiResult;

  try {
    const zai = await ZAI.create();

    // Use the comprehensive verification pipeline with government web search
    aiResult = await performIdVerification({
      zai,
      idType: business.idType,
      idNumber: business.idNumber,
      idDocumentUrl: business.idDocumentUrl,
      businessName: business.name,
    });
  } catch (aiError) {
    console.error('[Auto-Verify] AI SDK error during auto-verification:', aiError);
    return {
      autoVerified: false,
      verificationStatus: 'PENDING',
      message: 'AI verification encountered an error. Business remains PENDING for manual review.',
    };
  }

  // ── 4. Determine verification outcome ──
  const isVerified = aiResult.verified && aiResult.appearsAuthentic;

  if (isVerified) {
    // Auto-verified successfully
    await db.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: 'AUTO_VERIFIED',
        isVerified: true,
        isActive: true,
        verifiedAt: new Date(),
        verificationResult: JSON.stringify(aiResult),
      },
    });

    // ── Update user role to BUSINESS_OWNER ──
    try {
      await db.user.update({
        where: { id: business.ownerId },
        data: { role: 'BUSINESS_OWNER' },
      });
    } catch (roleError) {
      console.error('[Auto-Verify] Failed to update user role:', roleError);
      // Don't fail the whole auto-verify if role update fails
    }

    // ── Notify the business owner ──
    try {
      const govMatch = aiResult.webSearchEvidence?.governmentRecordMatch;
      await db.notification.create({
        data: {
          userId: business.ownerId,
          title: 'Auto-Verified Successfully',
          message: `Your business "${business.name}" has been auto-verified and is now active! ${
            govMatch
              ? 'Government record search confirmed verification services exist for your ID type.'
              : ''
          } ${aiResult.notes ? `Verification notes: ${aiResult.notes}` : ''}`,
          type: 'VERIFICATION_UPDATE',
          link: `/business/${businessId}`,
        },
      });
    } catch (notificationError) {
      console.error('[Auto-Verify] Failed to create auto-verification notification:', notificationError);
    }

    return {
      autoVerified: true,
      verificationStatus: 'AUTO_VERIFIED',
      message: `Your business "${business.name}" has been auto-verified and is now active!`,
      result: aiResult,
    };
  } else {
    // Verification failed — store the result but leave as PENDING
    await db.business.update({
      where: { id: businessId },
      data: {
        verificationResult: JSON.stringify(aiResult),
      },
    });

    return {
      autoVerified: false,
      verificationStatus: 'PENDING',
      message: 'AI verification did not pass. Business remains PENDING for manual review.',
      result: aiResult,
    };
  }
}
