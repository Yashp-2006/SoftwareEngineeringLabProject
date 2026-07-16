import { Redis } from '@upstash/redis';

let cbFailures = 0;
let cbOpenUntil = 0;
const CB_MAX_FAILURES = 5;
const CB_RESET_MS = 30000;

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  fetch: (input: any, init: any) => {
    if (Date.now() < cbOpenUntil) {
      return Promise.reject(new Error('Circuit breaker open for Redis'));
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    return fetch(input, { ...init, signal: controller.signal })
      .then(res => {
        if (!res.ok && res.status >= 500) {
          cbFailures++;
          if (cbFailures >= CB_MAX_FAILURES) cbOpenUntil = Date.now() + CB_RESET_MS;
        } else {
          cbFailures = 0;
        }
        return res;
      })
      .catch(err => {
        cbFailures++;
        if (cbFailures >= CB_MAX_FAILURES) cbOpenUntil = Date.now() + CB_RESET_MS;
        throw err;
      })
      .finally(() => clearTimeout(timeoutId));
  }
} as any);

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


