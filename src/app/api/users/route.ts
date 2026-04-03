import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { updateProfileSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizeUser } from '@/lib/response-sanitizer';

// Get current user profile
export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return errorResponse('Not authenticated', 401);
    }

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            verificationStatus: true,
            subscriptionPlan: true,
          },
        },
      },
    });

    return successResponse(sanitizeUser(fullUser as unknown as Record<string, unknown>));
  } catch (error) {
    return handleApiError(error);
  }
}

// Update current user profile
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    // Check phone uniqueness if updating
    if (validated.phone) {
      const existingPhone = await db.user.findFirst({
        where: {
          phone: validated.phone,
          NOT: { id: user.id },
        },
      });
      if (existingPhone) {
        return errorResponse('This phone number is already in use', 409);
      }
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: validated,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        phone: true,
        role: true,
      },
    });

    return successResponse(sanitizeUser(updatedUser as unknown as Record<string, unknown>));
  } catch (error) {
    return handleApiError(error);
  }
}

// Delete current user account
export async function DELETE() {
  try {
    const user = await requireAuth();

    await db.user.delete({
      where: { id: user.id },
    });

    return successResponse({ message: 'Account deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
