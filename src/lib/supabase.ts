import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — only create the client when first accessed.
// This prevents crashes when NEXT_PUBLIC_SUPABASE_URL is not set (e.g., on Vercel).
let _supabase: SupabaseClient | null = null;
let _supabaseInitAttempted = false;

function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseInitAttempted) return _supabase;
  _supabaseInitAttempted = true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Only warn in development — silently return null in production
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[SUPABASE] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
        'Supabase features (storage, etc.) will be unavailable.'
      );
    }
    return null;
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey);
  return _supabase;
}

// Export a proxy so the client is created lazily
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    if (!client) return undefined;
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Server-side admin client (use in API routes)
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  PORTFOLIO: 'portfolio',
  BUSINESS_LOGOS: 'business-logos',
  SERVICE_IMAGES: 'service-images',
} as const;

// Helper function to get public URL
export function getPublicUrl(bucket: string, path: string) {
  const client = getSupabaseClient();
  if (!client) return '';
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Helper function to upload file
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Buffer,
  contentType?: string
) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured');
  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, {
      contentType: contentType || 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return getPublicUrl(bucket, data.path);
}

// Helper function to delete file
export async function deleteFile(bucket: string, path: string) {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) {
    throw error;
  }
}
