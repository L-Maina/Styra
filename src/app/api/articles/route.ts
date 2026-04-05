import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin, requireAuth } from '@/lib/auth';

// GET - Fetch published articles (public)
// Use admin=true query param to fetch all articles (requires admin auth)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const slug = searchParams.get('slug');
    const adminParam = searchParams.get('admin');

    // Fetch single article by slug
    if (slug) {
      const article = await db.blogArticle.findUnique({
        where: { slug },
      });

      if (!article) {
        return errorResponse('Article not found', 404);
      }

      // Only return published articles to non-admins
      if (!article.isPublished) {
        // Verify admin access for unpublished articles
        await requireAdmin();
      }

      return successResponse({ article });
    }

    // SECURITY FIX: Require admin auth to query unpublished articles.
    // Previously, anyone could pass admin=true to see drafts.
    let includeUnpublished = false;
    if (adminParam === 'true') {
      // Verify the caller is actually an admin
      await requireAdmin();
      includeUnpublished = true;
    }

    // Build filter
    const where: Record<string, unknown> = {};

    if (!includeUnpublished) {
      where.isPublished = true;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (featured === 'true') {
      where.isFeatured = true;
    }

    const articles = await db.blogArticle.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return successResponse({ articles });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create new article (admin only)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const {
      title,
      excerpt,
      content,
      image,
      category,
      author,
      authorImage,
      authorId,
      authorType,
      readTime,
      isPublished,
      isFeatured
    } = body;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existingArticle = await db.blogArticle.findUnique({
      where: { slug },
    });

    if (existingArticle) {
      return errorResponse('An article with this title already exists', 400);
    }

    const article = await db.blogArticle.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        image,
        category,
        author,
        authorImage,
        readTime,
        isPublished: isPublished ?? false,
        isFeatured: isFeatured ?? false,
        publishedAt: isPublished ? new Date() : null,
        // New fields — will be saved once Prisma client is regenerated
        ...(authorId ? { authorId } : {}),
        ...(authorType ? { authorType } : {}),
      } as any,
    });

    return successResponse({ article }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update article (admin only)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (!body.id) {
      return errorResponse('Article ID is required', 400);
    }
    const { id } = body;

    // SECURITY: Only allow explicit fields to be updated.
    // Prevents arbitrary field injection (e.g., createdAt, authorId, etc.)
    const allowedFields = ['title', 'slug', 'content', 'excerpt', 'category', 'tags', 'image', 'featuredImage', 'author', 'authorImage', 'readTime'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Boolean fields handled separately
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // If updating title, regenerate slug
    if (updateData.title) {
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
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Article ID is required', 400);
    }

    await db.blogArticle.delete({
      where: { id },
    });

    return successResponse({ message: 'Article deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
