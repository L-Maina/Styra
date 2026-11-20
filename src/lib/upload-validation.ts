// Rules for POST /api/upload. No Next.js or Cloudinary imports, so they can be unit tested.

export const UPLOAD_TYPES = [
  'avatar',
  'logo',
  'cover',
  'portfolio',
  'service',
  'booth-photo',
  'id-document',
  'blog',
  'general',
] as const;

export type UploadType = (typeof UPLOAD_TYPES)[number];

/** Vercel rejects request bodies over 4.5 MB before our code runs, so the limit stays under that. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Types only an admin may upload. */
export const ADMIN_ONLY_UPLOAD_TYPES: readonly UploadType[] = ['blog'];

const FOLDERS: Record<UploadType, string> = {
  avatar: 'styra/avatars',
  logo: 'styra/logos',
  cover: 'styra/covers',
  portfolio: 'styra/portfolio',
  service: 'styra/services',
  'booth-photo': 'styra/booth-photos',
  'id-document': 'styra/id-documents',
  blog: 'styra/blog',
  general: 'styra/uploads',
};

export function isUploadType(value: unknown): value is UploadType {
  return typeof value === 'string' && (UPLOAD_TYPES as readonly string[]).includes(value);
}

export function uploadFolder(type: UploadType): string {
  return FOLDERS[type];
}

export interface DetectedFile {
  mime: string;
  kind: 'image' | 'pdf';
}

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

/**
 * Identify the file from its first bytes. The type the browser or app sends, and the file name,
 * can be anything, so they are not used. SVG and HTML are deliberately not recognised.
 */
export function detectFileType(bytes: Uint8Array): DetectedFile | null {
  if (bytes.length < 12) return null;
  const at = (offset: number, signature: number[]) => signature.every((b, i) => bytes[offset + i] === b);

  if (at(0, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', kind: 'image' };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', kind: 'image' };
  // WebP: "RIFF" .... "WEBP"
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return { mime: 'image/webp', kind: 'image' };
  // HEIC/HEIF (iPhone photos): "ftyp" at byte 4, then the brand
  if (at(4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (HEIF_BRANDS.includes(brand)) return { mime: 'image/heic', kind: 'image' };
  }
  // "%PDF-"
  if (at(0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', kind: 'pdf' };
  return null;
}

export type UploadCheck =
  | { ok: true; file: DetectedFile }
  | { ok: false; status: number; error: string };

/** Check one file against the rules for its upload type. */
export function checkUpload(type: UploadType, bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) {
    return { ok: false, status: 400, error: 'The file is empty.' };
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    const limit = MAX_UPLOAD_BYTES / (1024 * 1024);
    return { ok: false, status: 413, error: `That file is too large. The limit is ${limit} MB, so please choose a smaller photo.` };
  }

  const file = detectFileType(bytes);
  if (!file) {
    return { ok: false, status: 415, error: 'Unsupported file type. Please use a JPG, PNG, WebP or HEIC photo.' };
  }
  if (file.kind === 'pdf' && type !== 'id-document') {
    return { ok: false, status: 415, error: 'PDF files are only accepted for ID documents. Please use a JPG, PNG, WebP or HEIC photo.' };
  }
  return { ok: true, file };
}
