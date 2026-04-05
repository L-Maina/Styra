import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { uploadImage, FOLDERS } from '@/lib/cloudinary';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { getSession } from '@/lib/auth';

// ── Supported upload types mapped to Cloudinary folders ──────────────────────

const UPLOAD_FOLDER_MAP: Record<string, string> = {
  avatar: FOLDERS.AVATARS,
  logo: FOLDERS.BUSINESS_LOGOS,
  portfolio: FOLDERS.PORTFOLIO,
  cover: FOLDERS.COVER_IMAGES,
  service: FOLDERS.SERVICE_IMAGES,
  general: 'styra/general',
  blog: 'styra/blog',
  document: 'styra/documents',
  'brand-kit': 'styra/brand-kit',
  'press-kit': 'styra/press-kit',
} as const;

const SUPPORTED_TYPES = Object.keys(UPLOAD_FOLDER_MAP);

// ── File size & type constraints ─────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
];

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // --- Parse multipart form data ---
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse('Invalid request body. Expected multipart/form-data.', 400);
    }

    const file = formData.get('file');
    const type = (formData.get('type') as string) || 'general';

    // --- Validate file presence ---
    if (!file || !(file instanceof File)) {
      return errorResponse('No file provided. Send a file under the "file" field.', 400);
    }

    // --- Validate upload type ---
    if (!SUPPORTED_TYPES.includes(type)) {
      return errorResponse(
        `Unsupported upload type "${type}". Supported types: ${SUPPORTED_TYPES.join(', ')}`,
        400
      );
    }

    // --- Validate file size ---
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`,
        400
      );
    }

    // --- Validate MIME type (basic check) ---
    const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
      file.type.startsWith(prefix)
    );
    if (!isAllowed) {
      return errorResponse(
        `File type "${file.type || 'unknown'}" is not supported.`,
        400
      );
    }

    // --- Optional auth: get user session if available ---
    let userId: string | undefined;
    try {
      const session = await getSession();
      if (session?.userId) {
        userId = session.userId;
      } else {
        console.warn(
          '[Upload] No authenticated session found. Proceeding without user association.'
        );
      }
    } catch {
      // Session check failed — proceed without auth (public upload context)
      console.warn(
        '[Upload] Session check failed. Proceeding without user association.'
      );
    }

    // --- Read file as ArrayBuffer, convert to Buffer ---
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- Resolve Cloudinary folder ---
    const folder = UPLOAD_FOLDER_MAP[type] || 'styra/general';

    // --- Upload to Cloudinary ---
    const result = await uploadImage(buffer, { folder });

    // --- Determine media type from MIME ---
    const mediaType = file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';

    // --- Optionally save Media record to database ---
    try {
      await db.media.create({
        data: {
          userId,
          url: result.secure_url,
          type: mediaType,
          publicId: result.public_id,
          width: result.width || null,
          height: result.height || null,
          sizeBytes: result.bytes || null,
          format: result.format || null,
          folder,
        },
      });
    } catch (dbError) {
      // DB save is non-critical — log the error but don't fail the upload
      console.error(
        '[Upload] Failed to save Media record to database:',
        dbError instanceof Error ? dbError.message : dbError
      );
    }

    // --- Return success ---
    return successResponse({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
