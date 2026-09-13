import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Critical environment variables required for production
const CRITICAL_ENV_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

// Initialize Redis lazily only when credentials are provided
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Create a new ratelimiter if Redis is configured
const ratelimit = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(30, '10 s'),
      analytics: true,
    })
  : null;

export default async function middleware(request: NextRequest) {
  try {
    // 1. Validate Environment Variables (production only)
    if (process.env.NODE_ENV === 'production') {
      const missingVars = CRITICAL_ENV_VARS.filter(v => !process.env[v]);
      if (missingVars.length > 0) {
        console.error(`[Configuration Error] Missing critical env vars: ${missingVars.join(', ')}`);
        return new NextResponse(
          JSON.stringify({
            error: 'Configuration Error',
            message: 'Application misconfigured. Critical environment variables are missing.',
            correlationId: crypto.randomUUID(),
          }),
          {
            status: 500,
            headers: {
              'content-type': 'application/json',
              'x-content-type-options': 'nosniff',
            },
          }
        );
      }
    }

    // Define protected routes that require Firebase Session Cookie or valid headers
    const protectedPaths = ['/setup', '/operator', '/settings'];
    const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.includes(path));

    if (isProtectedPath) {
      const session = request.cookies.get('session');
      // If no session exists, we could redirect to /login
    }

    let response = NextResponse.next();

    // 2. Rate Limiting for API Routes (only when ratelimit is initialized)
    if (ratelimit && request.nextUrl.pathname.startsWith('/api/')) {
      try {
        // Determine user IP or a fallback identifier
        const ip = (request as any).ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
        const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_${ip}`);

        if (!success) {
          return new NextResponse(
            JSON.stringify({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded.',
              correlationId: crypto.randomUUID(),
            }),
            {
              status: 429,
              headers: {
                'content-type': 'application/json',
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': reset.toString(),
                'x-content-type-options': 'nosniff',
              },
            }
          );
        }

        response.headers.set('X-RateLimit-Limit', limit.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Reset', reset.toString());
      } catch (limitErr) {
        console.warn('Ratelimiter failed (non-fatal, allowing request):', limitErr);
      }
    }

    // 3. Inject Security Headers on ALL Responses
    response.headers.set('x-request-id', crypto.randomUUID());
    response.headers.set('x-content-type-options', 'nosniff');
    response.headers.set('x-frame-options', 'DENY');
    response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
    
    // CSP: Default secure policy allowing self and necessary Firebase/Algolia/Dicebear endpoints
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.upstash.io https://*.algolia.net https://*.algolianet.com",
      "img-src 'self' data: https://*.dicebear.com https://lh3.googleusercontent.com https://firebasestorage.googleapis.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "frame-src 'self' https://*.firebaseapp.com",
    ].join('; ');
    
    response.headers.set('content-security-policy', csp);

    return response;
  } catch (err) {
    console.error('Middleware exception:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
