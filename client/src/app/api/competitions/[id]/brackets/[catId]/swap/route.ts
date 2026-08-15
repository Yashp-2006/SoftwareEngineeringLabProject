import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { swapMatchSchema } from '@taikaix/backend/types/schemas';
import { z } from 'zod';
import { BracketService } from '@/modules/brackets/services/bracket.server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 403 });
    }

    const { id, catId } = await params;
    const body = await request.json();
    const validated = swapMatchSchema.parse(body);
    
    // Pass everything as options
    const result = await BracketService.swapAthletes(id, catId, { ...validated, ...body });
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error swapping athletes:', error);
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

    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 });
  }
}
