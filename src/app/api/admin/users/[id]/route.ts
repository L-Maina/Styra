import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizeResponse } from '@/lib/response-sanitizer';

// Zod schema for admin user update (PATCH /api/admin/users/:id)
const adminUpdateUserSchema = z.object({
  role: z.enum(['CUSTOMER', 'BUSINESS_OWNER', 'ADMIN']).optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
        business: {
          include: {
            services: true,
            _count: { select: { bookings: true, reviews: true } },
          },
        },
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { bookings: true, payments: true, reviews: true },
        },
      },
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return successResponse(sanitizeResponse(user));
  } catch (error) {
    return handleApiError(error);
  }
}

// Update user (PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // Validate with Zod schema
    const validated = adminUpdateUserSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse(validated.error.issues.map(e => e.message).join(', '), 400);
    }

    const user = await db.user.update({
      where: { id },
      data: validated.data,
    });

    return successResponse(sanitizeResponse(user));
  } catch (error) {
    return handleApiError(error);
  }
}

// Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await db.user.delete({
      where: { id },
    });

    return successResponse({ message: 'User deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
