import { redisClient } from '@shared/redis';
import { logger } from '../config/logger';

/**
 * Read-through Redis cache. On any Redis failure, falls back to `fetcher`
 * so a down cache never takes the endpoint down with it.
 */
export async function getOrSetCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    logger.warn({ error, key }, 'Cache read failed, falling back to source');
  }

  const data = await fetcher();

  try {
    await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (error) {
    logger.warn({ error, key }, 'Cache write failed');
  }

  return data;
}

export function buildCacheKey(namespace: string, params: Record<string, unknown> = {}): string {
  const sortedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  const suffix = sortedEntries.map(([key, value]) => `${key}=${value}`).join('&');
  return suffix ? `${namespace}:${suffix}` : namespace;
}
