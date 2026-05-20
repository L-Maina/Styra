/**
 * Simple in-memory cache with TTL for frequently accessed data.
 * Used for platform settings, fee calculations, etc.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Don't prevent process exit
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = 60_000): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton
export const cache = new MemoryCache();

// Cached platform fee fetcher
export async function getCachedPlatformFee(): Promise<number> {
  const cached = cache.get<number>('platformFee');
  if (cached !== null) return cached;
  
  const { db } = await import('@/lib/db');
  const setting = await db.platformSetting.findFirst({ where: { key: 'platformFee' } });
  const fee = setting ? parseFloat(setting.value) : 15.0;
  cache.set('platformFee', fee, 5 * 60 * 1000); // Cache for 5 minutes
  return fee;
}

// Cached platform settings
export async function getCachedPlatformSettings() {
  const cached = cache.get<Record<string, string>>('platformSettings');
  if (cached) return cached;
  
  const { db } = await import('@/lib/db');
  const settings = await db.platformSetting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  cache.set('platformSettings', map, 5 * 60 * 1000);
  return map;
}

// Cached minimum withdrawal
export async function getCachedMinWithdrawal(): Promise<number> {
  const cached = cache.get<number>('minWithdrawal');
  if (cached !== null) return cached;
  
  const { db } = await import('@/lib/db');
  const setting = await db.platformSetting.findFirst({ where: { key: 'minWithdrawal' } });
  const min = setting ? parseFloat(setting.value) : 50;
  cache.set('minWithdrawal', min, 5 * 60 * 1000);
  return min;
}
