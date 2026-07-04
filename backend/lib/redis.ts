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

export interface BatchResult {
  successfulKeys: string[];
  failedKeys: string[];
  errors: Error[];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function batchGet<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  
  const chunks = chunkArray(keys, 100);
  const results: (T | null)[] = [];
  
  // Max 3 concurrent chunks
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const chunkPromises = batch.map(async (chunk) => {
      const p = redis.pipeline();
      chunk.forEach(k => p.get(k));
      const res = await p.exec();
      
      // Upstash pipeline.exec() returns results directly, but throws if the whole request fails.
      // If a specific command failed, we must manually inspect it (Upstash returns an error object in the array for that slot)
      for (let j = 0; j < res.length; j++) {
        if (res[j] && typeof res[j] === 'object' && 'error' in (res[j] as any)) {
          throw new Error(`Chunk error on get: ${(res[j] as any).error}`);
        }
      }
      return res as (T | null)[];
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(cr => results.push(...cr));
  }
  
  return results;
}

export async function batchSet(entries: {key: string, value: any, ttlSeconds?: number}[]): Promise<BatchResult> {
  const result: BatchResult = { successfulKeys: [], failedKeys: [], errors: [] };
  if (entries.length === 0) return result;

  const chunks = chunkArray(entries, 100);
  
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    await Promise.all(batch.map(async (chunk) => {
      const p = redis.pipeline();
      chunk.forEach(e => {
        if (e.ttlSeconds !== undefined) {
          p.set(e.key, e.value, { ex: e.ttlSeconds });
        } else {
          p.set(e.key, e.value);
        }
      });
      
      try {
        const res = await p.exec();
        chunk.forEach((e, idx) => {
          if (res[idx] && typeof res[idx] === 'object' && 'error' in (res[idx] as any)) {
            result.failedKeys.push(e.key);
            result.errors.push(new Error(`Set failed for ${e.key}`));
          } else {
            result.successfulKeys.push(e.key);
          }
        });
      } catch (err: any) {
        chunk.forEach(e => result.failedKeys.push(e.key));
        result.errors.push(err);
      }
    }));
  }
  
  return result;
}

export async function batchDelete(keys: string[]): Promise<BatchResult> {
  const result: BatchResult = { successfulKeys: [], failedKeys: [], errors: [] };
  if (keys.length === 0) return result;

  const chunks = chunkArray(keys, 100);
  
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    await Promise.all(batch.map(async (chunk) => {
      const p = redis.pipeline();
      chunk.forEach(k => p.del(k));
      
      try {
        const res = await p.exec();
        chunk.forEach((k, idx) => {
          if (res[idx] && typeof res[idx] === 'object' && 'error' in (res[idx] as any)) {
            result.failedKeys.push(k);
            result.errors.push(new Error(`Del failed for ${k}`));
          } else {
            result.successfulKeys.push(k);
          }
        });
      } catch (err: any) {
        chunk.forEach(k => result.failedKeys.push(k));
        result.errors.push(err);
      }
    }));
  }
  
  return result;
}
