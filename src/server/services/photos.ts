import { AppError } from '../../core/errors';
import type { SessionUser } from '../auth';
import type { Db } from '../db';
import { putPhoto, removePhoto, sniffImage } from '../storage';
import { iso, ownedBusiness } from './common';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY = 24;
type Kind = 'LOGO' | 'COVER' | 'GALLERY';

const dto = (p: Record<string, unknown>) => ({
  id: String(p.id),
  kind: String(p.kind) as Kind,
  url: String(p.url),
  caption: p.caption == null ? null : String(p.caption),
  createdAt: iso(p.created_at),
});

export async function listOwnPhotos(db: Db, user: SessionUser) {
  const biz = await ownedBusiness(db, user);
  const rows = await db.query<Record<string, unknown>>('select * from styra.business_photos where business_id = $1 order by kind, position, created_at', [biz.id]);
  return rows.map(dto);
}

export async function addPhoto(db: Db, user: SessionUser, input: { kind: Kind; caption?: string; file: File }) {
  const biz = await ownedBusiness(db, user);
  if (input.file.size > MAX_PHOTO_BYTES) throw new AppError('FILE_TOO_LARGE', 'photos can be up to 5 MB', 413);
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const img = sniffImage(bytes);
  if (!img) throw new AppError('FILE_TYPE', 'only JPEG, PNG or WebP photos', 422);
  if (input.kind === 'GALLERY') {
    const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from styra.business_photos where business_id = $1 and kind = 'GALLERY'`, [biz.id]);
    if (n >= MAX_GALLERY) throw new AppError('GALLERY_FULL', 'the gallery holds 24 photos', 422);
  }
  const path = `${biz.id}/${input.kind.toLowerCase()}-${crypto.randomUUID()}.${img.ext}`;
  const url = await putPhoto(path, bytes, img.type);
  const caption = input.caption?.trim().slice(0, 140) || null;
  // A new logo or cover replaces the old one (row and stored file).
  const old =
    input.kind === 'GALLERY'
      ? []
      : await db.query<{ storage_path: string }>(`delete from styra.business_photos where business_id = $1 and kind = $2 returning storage_path`, [biz.id, input.kind]);
  const [row] = await db.query<Record<string, unknown>>(
    `insert into styra.business_photos (business_id, kind, url, storage_path, caption, position)
     values ($1, $2, $3, $4, $5, (select coalesce(max(position), -1) + 1 from styra.business_photos where business_id = $1 and kind = $2))
     returning *`,
    [biz.id, input.kind, url, path, caption],
  );
  for (const o of old) await removePhoto(o.storage_path);
  return dto(row);
}

export async function deletePhoto(db: Db, user: SessionUser, id: string) {
  const biz = await ownedBusiness(db, user);
  const [row] = await db.query<{ storage_path: string }>('delete from styra.business_photos where id = $1 and business_id = $2 returning storage_path', [id, biz.id]);
  if (!row) throw new AppError('NOT_FOUND', 'photo not found', 404);
  await removePhoto(row.storage_path);
}
