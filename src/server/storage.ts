import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { AppError } from '../core/errors';

const BUCKET = 'business-photos';

/** Real image types only, checked by their first bytes (the declared type is not trusted). */
export function sniffImage(bytes: Uint8Array): { ext: 'jpg' | 'png' | 'webp'; type: string } | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: 'webp', type: 'image/webp' };
  return null;
}

const supabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
};

const devDir = () => process.env.STYRA_DEV_UPLOAD_DIR ?? join(process.cwd(), 'public', 'dev-uploads');

/** Stores a photo and returns its public URL. Supabase Storage in production; a local folder in development only. */
export async function putPhoto(path: string, bytes: Uint8Array, type: string): Promise<string> {
  const sb = supabase();
  if (sb) {
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false, cacheControl: '31536000' });
    if (error) throw new AppError('STORAGE_FAILED', `upload failed: ${error.message}`, 502);
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV) throw new AppError('STORAGE_UNAVAILABLE', 'photo storage is not set up', 503);
  const file = join(devDir(), path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return `/dev-uploads/${path}`;
}

export async function removePhoto(path: string): Promise<void> {
  const sb = supabase();
  if (sb) {
    await sb.storage.from(BUCKET).remove([path]);
    return;
  }
  await unlink(join(devDir(), path)).catch(() => {});
}
