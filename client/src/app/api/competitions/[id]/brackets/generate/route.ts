import { NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { generateBracketSchema } from '@taikaix/backend/types/schemas';
import { z } from 'zod';
import { BracketService } from '@/modules/brackets/services/bracket.server';

/**
 * POST /api/competitions/{id}/brackets/generate
 * Body: {
 *   categoryId?: string        // standard category — regenerate bracket from its athletes
 *   specialCategoryId?: string // special category — seed from sibling categories
 *   poolSize?: 4 | 8 | 16 | 32
 *   compType?: string
 * }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 403 });
    }
    
    const { id } = await params;
    const body = await req.json();
    const validated = generateBracketSchema.parse(body);

    const result = await BracketService.generateBrackets(id, validated);
    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('[brackets/generate]', error);
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
