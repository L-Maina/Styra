import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch single article by ID (public for published, admin for drafts)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await db.blogArticle.findUnique({
      where: { id },
    });

    if (!article) {
      return errorResponse('Article not found', 404);
    }

    // Only return published articles to non-admins
    if (!article.isPublished) {
      await requireAdmin();
    }

    return successResponse({ article });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update article (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const allowedFields = ['title', 'slug', 'content', 'excerpt', 'category', 'tags', 'image', 'author', 'authorImage', 'readTime'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Boolean fields
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // If title changed and no explicit slug provided, regenerate slug
    if (updateData.title && !updateData.slug) {
      updateData.slug = String(updateData.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // If publishing for the first time, set publishedAt
    if (updateData.isPublished) {
      const existingArticle = await db.blogArticle.findUnique({
        where: { id },
      });

      if (existingArticle && !existingArticle.isPublished) {
        updateData.publishedAt = new Date();
      }
    }

    const article = await db.blogArticle.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ article });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Delete article (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Verify article exists
    const article = await db.blogArticle.findUnique({
      where: { id },
    });

    if (!article) {
      return errorResponse('Article not found', 404);
    }

    await db.blogArticle.delete({
      where: { id },
    });

    return successResponse({ message: 'Article deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
