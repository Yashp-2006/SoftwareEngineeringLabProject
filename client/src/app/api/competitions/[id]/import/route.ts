import { rateLimiter } from '@lib/rate-limiter';
import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { ImportService } from '@/modules/competitions/services/import.server';

// Parses file + generates brackets only — NO Firestore writes.
// Firestore writes are done client-side to avoid Vercel timeout.
// Parse+bracket is ~200ms even for 5000 athletes — safe within 10s limit.
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 403 });
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
  } catch (error: any) {
    console.error('[import/route]', error);
    const msg = error?.message || 'Internal server error';

    if (msg.startsWith('BAD_REQUEST:')) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: msg.replace('BAD_REQUEST: ', '') } }, { status: 400 });
    }
    if (msg.startsWith('UNPROCESSABLE_ENTITY:')) {
      return NextResponse.json({ success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: msg.replace('UNPROCESSABLE_ENTITY: ', '') } }, { status: 422 });
    }

    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 });
  }
}
