import { rateLimiter } from '@lib/rate-limiter';
import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { ImportService } from '@/modules/competitions/services/import.server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

// Parses file + generates brackets only — NO Firestore writes.
// Firestore writes are done client-side to avoid Vercel timeout.
// Parse+bracket is ~200ms even for 5000 athletes — safe within 10s limit.
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer') {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    let rateLimitResult = { success: true, limit: 10, reset: 0, remaining: 10 };
    try {
      rateLimitResult = await rateLimiter.limit(`import_${ip}`);
    } catch (e: any) {
      console.warn('[rate-limiter] Redis error, bypassing:', e.message);
    }

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' } },
        { status: 429 }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let options: any = { isJson };

    if (isJson) {
      options.jsonBody = await req.json();
    } else {
      options.formData = await req.formData();
    }

    const result = await ImportService.processImport(id, options);

    return NextResponse.json({ success: true, competitionId: id, ...result });
  } catch (error: unknown) {
    console.error('[import/route]', error);
    return errorResponse(error, 'Internal server error');
  }
}
