import { redisClient } from '@shared/redis';

/**
 * Generic cache-aside helper backed by Redis.
 * Failures in Redis never break the caller - they just fall through to `fetcher`.
 */
export async function getOrSetCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const cached = await redisClient.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.error(`Cache read failed for key "${key}":`, err instanceof Error ? err.message : err);
  }

  const value = await fetcher();

  if (value !== null && value !== undefined) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      console.error(`Cache write failed for key "${key}":`, err instanceof Error ? err.message : err);
    }
  }

  return value;
}

/**
 * Delete one or more cache keys. Safe to call even if the key was never cached.
 */
export async function invalidateCache(keys: string | string[]): Promise<void> {
  const list = Array.isArray(keys) ? keys : [keys];
  if (list.length === 0) return;

  try {
    await redisClient.del(list);
  } catch (err) {
    console.error(`Cache invalidation failed for keys [${list.join(', ')}]:`, err instanceof Error ? err.message : err);
  }
}

export const CACHE_TTL = {
  TEMPLATE: 600,
  APP_EMAIL_PROVIDER: 300,
  API_KEY: 300,
  SUBSCRIPTION: 120,
} as const;

export const cacheKeys = {
  template: (id: string) => `cache:template:${id}`,
  appEmailProvider: (appId: string) => `cache:app-email-provider:${appId}`,
  apiKeyByHash: (keyHash: string) => `cache:api-key:hash:${keyHash}`,
  apiKeyById: (id: string) => `cache:api-key:id:${id}`,
  subscription: (accountId: string) => `cache:subscription:${accountId}`,
};
