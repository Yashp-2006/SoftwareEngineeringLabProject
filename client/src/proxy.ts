import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis directly for Edge Middleware
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Create a new ratelimiter that allows 30 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(30, '10 s'),
  analytics: true,
});

export default async function proxy(request: NextRequest) {
  // Define protected routes that require Firebase Session Cookie or valid headers
  const protectedPaths = ['/setup', '/operator', '/settings'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.includes(path));

  if (isProtectedPath) {
    const session = request.cookies.get('session');
    // If no session exists, we could redirect to /login
  }

  // Rate Limiting for API Routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Determine user IP or a fallback identifier
    const ip = (request as any).ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_${ip}`);

    if (!success) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      });
    }

    const response = NextResponse.next();
    response.headers.set('x-request-id', crypto.randomUUID());
    response.headers.set('x-content-type-options', 'nosniff');
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
