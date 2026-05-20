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
  // SSRF Protection: Validate URL before passing to Cloudinary
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL provided for image upload');
  }

  // Only allow HTTPS protocol
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed for image upload');
  }

  // Block private/internal IPs to prevent SSRF
  const hostname = parsedUrl.hostname.toLowerCase();

  // Block loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('URLs pointing to local addresses are not allowed');
  }

  // Block link-local
  if (hostname.startsWith('169.254.') || hostname.startsWith('fe80:')) {
    throw new Error('URLs pointing to link-local addresses are not allowed');
  }

  // Block private IPv4 ranges
  if (
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    throw new Error('URLs pointing to private addresses are not allowed');
  }

  // Block IPv6 unique local addresses (fc00::/7)
  if (hostname.startsWith('fc') || hostname.startsWith('fd')) {
    throw new Error('URLs pointing to local addresses are not allowed');
  }

  // Optional: Allowlist known image hosts
  const allowedHosts = [
    'cloudinary.com',
    'res.cloudinary.com',
    'images.unsplash.com',
    'unsplash.com',
    'imgur.com',
    'i.imgur.com',
  ];
  const isAllowedHost = allowedHosts.some(
    host => hostname === host || hostname.endsWith('.' + host)
  );
  if (!isAllowedHost) {
    throw new Error('Image URL must be from an allowed image host (Cloudinary, Unsplash, Imgur)');
  }

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
