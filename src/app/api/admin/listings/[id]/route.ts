import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch single premium listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const listing = await db.premiumListing.findUnique({
      where: { id },
      include: {
        business: {
          select: { id: true, name: true },
        },
      },
    });

    if (!listing) {
      return errorResponse('Listing not found', 404);
    }

    return successResponse({ listing });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update premium listing (approve, reject, modify)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const { status, plan, price, endDate, rejectionReason } = body;

    // Verify listing exists
    const existingListing = await db.premiumListing.findUnique({
      where: { id },
    });

    if (!existingListing) {
      return errorResponse('Listing not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (plan !== undefined) updateData.plan = plan;
    if (price !== undefined) updateData.price = price;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const listing = await db.premiumListing.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ listing });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete premium listing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existingListing = await db.premiumListing.findUnique({
      where: { id },
    });

    if (!existingListing) {
      return errorResponse('Listing not found', 404);
    }

    await db.premiumListing.delete({
      where: { id },
    });

    return successResponse({ message: 'Listing deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
