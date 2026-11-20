import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { AppError } from '@/lib/app-error';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { slidingWindowRateLimit, rateLimitResponse, type SlidingWindowConfig } from '@/lib/rate-limit';
import { isCloudinaryConfigured, uploadImage, type UploadResult } from '@/lib/cloudinary';
import {
  ADMIN_ONLY_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
  checkUpload,
  isUploadType,
  uploadFolder,
} from '@/lib/upload-validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

const uploadRateLimit: SlidingWindowConfig = {
  windowMs: 10 * 60 * 1000,
  maxRequests: 40,
  message: 'You are uploading too quickly. Please wait a few minutes and try again.',
};

/**
 * POST /api/upload: multipart form with `file` and `type` (see UPLOAD_TYPES).
 * Signed-in users only. The CSRF header is checked in middleware.
 * Responds with { success, data: { url, publicId, width, height, bytes, format, type } }.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const limit = await slidingWindowRateLimit(uploadRateLimit)(request, session.userId);
    if (limit?.limited) return rateLimitResponse(limit, uploadRateLimit);

    // Turn away obviously oversized bodies before reading them (the form adds a little overhead)
    const declaredBytes = Number(request.headers.get('content-length') || 0);
    if (declaredBytes > MAX_UPLOAD_BYTES + 256 * 1024) {
      throw new AppError(
        `That file is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB, so please choose a smaller photo.`,
        413
      );
    }

    if (!isCloudinaryConfigured()) {
      console.error('[upload] Cloudinary credentials are not set');
      throw new AppError('Image uploads are temporarily unavailable. Please try again later.', 503);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError('Send the file as multipart/form-data with a "file" field and a "type" field.', 400);
    }

    const rawType = form.get('type');
    const type = rawType === null || rawType === '' ? 'general' : rawType;
    if (!isUploadType(type)) {
      throw new AppError(`Unknown upload type. Use one of: ${UPLOAD_TYPES.join(', ')}.`, 400);
    }
    if (ADMIN_ONLY_UPLOAD_TYPES.includes(type) && (session.role || '').toUpperCase() !== 'ADMIN') {
      throw new AppError('Only admins can upload this kind of image.', 403);
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new AppError('No file was sent. Add it to the form as "file".', 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppError(
        `That file is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB, so please choose a smaller photo.`,
        413
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkUpload(type, bytes);
    if (!check.ok) throw new AppError(check.error, check.status);

    const isPdf = check.file.kind === 'pdf';
    let result: UploadResult;
    try {
      result = await uploadImage(Buffer.from(bytes), {
        folder: uploadFolder(type),
        // Photos are shrunk to at most 2000 px a side. PDFs are stored as they are.
        transformation: isPdf ? [] : [{ width: 2000, height: 2000, crop: 'limit' }, { quality: 'auto:good' }],
      });
    } catch (error) {
      // Cloudinary rejects with a plain object, not an Error
      const detail = error as { message?: string; http_code?: number } | undefined;
      console.error(`[upload] Cloudinary refused a "${type}" upload: ${detail?.message ?? 'unknown error'} (${detail?.http_code ?? 'no status'})`);
      throw new AppError('We could not store that file. Please try again.', 502);
    }

    // Cloudinary blocks direct delivery of PDFs on new accounts, so hand back the first page as a JPG
    const url = isPdf ? result.secure_url.replace(/\.pdf$/i, '.jpg') : result.secure_url;

    return successResponse({
      url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
      type,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
