import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

/**
 * Utility to fetch data from cache or fallback to a provided fetcher function.
 * @param key The Redis cache key
 * @param ttlSeconds Time-to-live in seconds
 * @param fetcher Async function to fetch fresh data
 * @returns Cached or fresh data
 */
export async function fetchWithCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get<T>(key);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn(`Redis get failed for key ${key}:`, error);
  }

  const freshData = await fetcher();

  try {
    // Only cache if data isn't null or undefined
    if (freshData !== null && freshData !== undefined) {
      await redis.set(key, freshData, { ex: ttlSeconds });
    }
  } catch (error) {
    console.warn(`Redis set failed for key ${key}:`, error);
  }

  return freshData;
}


