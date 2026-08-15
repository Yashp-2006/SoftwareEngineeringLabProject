import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { BracketService } from '@/modules/brackets/services/bracket.server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'mat_operator') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 403 });
    }
    const { id, catId } = await params;
    
    const schema = z.object({ matchId: z.string().min(1, 'matchId is required') });
    const body = await req.json();
    const { matchId } = schema.parse(body);

    const result = await BracketService.resolveTie(id, catId, matchId);
    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('[brackets/[catId]/tiebreaker]', error);
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation Error', details: error.issues || error.errors } }, { status: 400 });
    }
    const msg = error?.message || 'Internal server error';
    if (msg.startsWith('BAD_REQUEST:')) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: msg.replace('BAD_REQUEST: ', '') } }, { status: 400 });
    }
    if (msg.startsWith('NOT_FOUND:')) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: msg.replace('NOT_FOUND: ', '') } }, { status: 404 });
    }

    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 });
  }
}
