import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  bytes: number;
}

// Upload image from base64 or buffer
export async function uploadImage(
  file: string | Buffer,
  options?: {
    folder?: string;
    public_id?: string;
    transformation?: object;
  }
): Promise<UploadResult> {
  const uploadOptions: Record<string, unknown> = {
    folder: options?.folder || 'styra',
    resource_type: 'image',
    transformation: options?.transformation || [
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
  };

  if (options?.public_id) {
    uploadOptions.public_id = options.public_id;
  }

  return new Promise((resolve, reject) => {
    const uploadCallback = (
      error: UploadApiErrorResponse | undefined,
      result: UploadApiResponse | undefined
    ) => {
      if (error || !result) {
        reject(error || new Error('Upload failed'));
        return;
      }
      resolve({
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        resource_type: result.resource_type,
        bytes: result.bytes,
      });
    };

    if (Buffer.isBuffer(file)) {
      cloudinary.uploader
        .upload_stream(uploadOptions, uploadCallback)
        .end(file);
    } else {
      cloudinary.uploader.upload(file, uploadOptions, uploadCallback);
    }
  });
}

// Upload image from URL
export async function uploadImageFromUrl(
  url: string,
  options?: { folder?: string; public_id?: string }
): Promise<UploadResult> {
  return uploadImage(url, options);
}

// Delete image
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch {
    return false;
  }
}

// Generate transformation URL
export function getTransformedImageUrl(
  publicId: string,
  transformations: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
  } = {}
): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        width: transformations.width,
        height: transformations.height,
        crop: transformations.crop || 'fill',
        quality: transformations.quality || 'auto:good',
        fetch_format: transformations.format || 'auto',
      },
    ],
  });
}

// Get optimized URL for existing image
export function getOptimizedUrl(url: string, width = 800): string {
  // If it's already a Cloudinary URL, add transformations
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/c_fill,w_${width},q_auto:good/${parts[1]}`;
    }
  }
  return url;
}

// Generate thumbnail
export function getThumbnail(url: string, size = 200): string {
  return getOptimizedUrl(url, size);
}

// Folder paths
export const FOLDERS = {
  AVATARS: 'styra/avatars',
  BUSINESS_LOGOS: 'styra/business-logos',
  PORTFOLIO: 'styra/portfolio',
  SERVICE_IMAGES: 'styra/services',
  COVER_IMAGES: 'styra/covers',
} as const;
