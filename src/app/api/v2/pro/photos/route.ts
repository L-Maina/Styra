import { z } from 'zod';
import { AppError } from '@/core/errors';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db-pool';
import { ok, route } from '@/server/http';
import { addPhoto, listOwnPhotos } from '@/server/services/photos';

const kind = z.enum(['LOGO', 'COVER', 'GALLERY']);

export const GET = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  return ok({ items: await listOwnPhotos(db, user) });
});

/** multipart/form-data: file, kind (LOGO | COVER | GALLERY), caption? */
export const POST = route(async (req) => {
  const db = getDb();
  const user = await requireUser(db, req, ['PROVIDER']);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) throw new AppError('VALIDATION', 'attach a photo', 422);
  const photo = await addPhoto(db, user, { kind: kind.parse(form.get('kind')), caption: String(form.get('caption') ?? ''), file });
  return ok({ photo }, 201);
});
