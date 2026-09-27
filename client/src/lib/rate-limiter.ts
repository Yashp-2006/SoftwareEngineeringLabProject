import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Lazily initialized — prevents module-load crash when env vars are absent
let _ratelimit: Ratelimit | null = null;

function getRateLimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!_ratelimit) {
    const redis = new Redis({ url, token });
    _ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: '@upstash/ratelimit',
    });
  }
  return _ratelimit;
}

// Thin wrapper used by route handlers
export const rateLimiter = {
  limit: async (key: string) => {
    const rl = getRateLimiter();
    if (!rl) return { success: true, limit: 10, reset: 0, remaining: 10 };
    return rl.limit(key);
  },
};
