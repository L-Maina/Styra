import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch all page content
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');

    if (page) {
      // Fetch single page
      const pageContent = await db.pageContent.findUnique({
        where: { page },
      });

      if (!pageContent) {
        // Create default content if not exists
        const defaultContent = await db.pageContent.create({
          data: {
            page,
            title: getDefaultTitle(page),
            content: getDefaultContent(page),
          },
        });
        return successResponse({ pageContent: defaultContent });
      }

      return successResponse({ pageContent });
    }

    // Fetch all pages
    const pages = await db.pageContent.findMany({
      orderBy: { page: 'asc' },
    });

    // Ensure all default pages exist
    const defaultPages = ['about', 'privacy', 'terms', 'safety'];
    const existingPages = pages.map(p => p.page);
    const missingPages = defaultPages.filter(p => !existingPages.includes(p));

    if (missingPages.length > 0) {
      for (const missingPage of missingPages) {
        const newPage = await db.pageContent.create({
          data: {
            page: missingPage,
            title: getDefaultTitle(missingPage),
            content: getDefaultContent(missingPage),
          },
        });
        pages.push(newPage);
      }
    }

    return successResponse({ pages });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update page content
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { page, title, content, updatedBy } = body;

    if (!page) {
      return errorResponse('Page identifier is required', 400);
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (updatedBy !== undefined) updateData.updatedBy = updatedBy;

    const pageContent = await db.pageContent.upsert({
      where: { page },
      create: {
        page,
        title: title || getDefaultTitle(page),
        content: content || getDefaultContent(page),
        updatedBy,
      },
      update: updateData,
    });

    return successResponse({ pageContent });
  } catch (error) {
    return handleApiError(error);
  }
}

// Helper functions for default content
function getDefaultTitle(page: string): string {
  const titles: Record<string, string> = {
    about: 'About Styra',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    safety: 'Safety Guidelines',
  };
  return titles[page] || 'Page Title';
}

function getDefaultContent(page: string): string {
  const contents: Record<string, string> = {
    about: 'Styra is the leading platform connecting customers with professional grooming services. Our mission is to make it easy for people to find and book appointments with skilled barbers, hairstylists, nail technicians, and other grooming professionals in their area.',
    privacy: 'Your privacy is important to us. This policy outlines how we collect, use, and protect your personal information when you use our platform.',
    terms: 'By using Styra, you agree to the following terms and conditions. Please read them carefully before using our services.',
    safety: 'Our safety guidelines ensure a secure experience for all users. We are committed to maintaining a safe environment for both customers and service providers.',
  };
  return contents[page] || 'Content goes here...';
}
