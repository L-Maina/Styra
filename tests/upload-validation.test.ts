import { describe, expect, test } from 'bun:test';
import {
  ADMIN_ONLY_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
  checkUpload,
  detectFileType,
  isUploadType,
  uploadFolder,
} from '@/lib/upload-validation';

/** A buffer that starts with the given bytes and is padded to `size`. */
function file(head: number[] | string, size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  const start = typeof head === 'string' ? Array.from(head).map((c) => c.charCodeAt(0)) : head;
  bytes.set(start);
  return bytes;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function webp(): Uint8Array {
  const bytes = file('RIFF');
  bytes.set(Array.from('WEBP').map((c) => c.charCodeAt(0)), 8);
  return bytes;
}

function heic(brand = 'heic'): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0, 0, 0, 24], 0);
  bytes.set(Array.from('ftyp' + brand).map((c) => c.charCodeAt(0)), 4);
  return bytes;
}

describe('detectFileType', () => {
  test('recognises JPEG, PNG, WebP, HEIC and PDF from their first bytes', () => {
    expect(detectFileType(file(JPEG))?.mime).toBe('image/jpeg');
    expect(detectFileType(file(PNG))?.mime).toBe('image/png');
    expect(detectFileType(webp())?.mime).toBe('image/webp');
    expect(detectFileType(heic())?.mime).toBe('image/heic');
    expect(detectFileType(heic('mif1'))?.mime).toBe('image/heic');
    expect(detectFileType(file('%PDF-1.7'))).toEqual({ mime: 'application/pdf', kind: 'pdf' });
  });

  test('rejects SVG, HTML, scripts and other formats even if the name says image', () => {
    expect(detectFileType(file('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 80))).toBeNull();
    expect(detectFileType(file('<!DOCTYPE html><script>alert(1)</script>', 80))).toBeNull();
    expect(detectFileType(file('GIF89a'))).toBeNull();
    expect(detectFileType(file('MZ\u0090\u0000'))).toBeNull();
  });

  test('rejects an MP4 even though it has an ftyp box', () => {
    expect(detectFileType(heic('isom'))).toBeNull();
  });

  test('rejects files too short to identify', () => {
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(detectFileType(new Uint8Array(0))).toBeNull();
  });
});

describe('checkUpload', () => {
  test('accepts a photo for any type', () => {
    for (const type of UPLOAD_TYPES) {
      expect(checkUpload(type, file(JPEG)).ok).toBe(true);
    }
  });

  test('accepts a PDF only for ID documents', () => {
    expect(checkUpload('id-document', file('%PDF-1.4')).ok).toBe(true);
    const logo = checkUpload('logo', file('%PDF-1.4'));
    expect(logo.ok).toBe(false);
    if (!logo.ok) expect(logo.status).toBe(415);
  });

  test('rejects an empty file', () => {
    const result = checkUpload('avatar', new Uint8Array(0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  test('rejects a file over the limit with 413', () => {
    const result = checkUpload('avatar', file(JPEG, MAX_UPLOAD_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.error).toContain('4 MB');
    }
    expect(checkUpload('avatar', file(JPEG, MAX_UPLOAD_BYTES)).ok).toBe(true);
  });

  test('rejects an unknown format with 415', () => {
    const result = checkUpload('avatar', file('<html>hello there</html>', 80));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(415);
  });
});

describe('upload types', () => {
  test('knows every type the web app and the mobile app send', () => {
    for (const type of ['avatar', 'portfolio', 'logo', 'id-document', 'booth-photo', 'blog', 'cover', 'service', 'general']) {
      expect(isUploadType(type)).toBe(true);
    }
    expect(isUploadType('video')).toBe(false);
    expect(isUploadType('')).toBe(false);
    expect(isUploadType(null)).toBe(false);
  });

  test('every type has its own folder, and only blog is admin-only', () => {
    const folders = UPLOAD_TYPES.map(uploadFolder);
    expect(new Set(folders).size).toBe(UPLOAD_TYPES.length);
    expect(folders.every((folder) => folder.startsWith('styra/'))).toBe(true);
    expect(ADMIN_ONLY_UPLOAD_TYPES).toEqual(['blog']);
  });
});
