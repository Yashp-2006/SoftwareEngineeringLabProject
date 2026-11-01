import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { generateBracketSchema } from '@taikaix/backend/types/schemas';
import { BracketService } from '@/modules/brackets/services/bracket.server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

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
      return unauthorizedResponse();
    }
    
    const { id } = await params;
    const body = await req.json();
    const validated = generateBracketSchema.parse(body);

    const result = await BracketService.generateBrackets(id, validated);
    return NextResponse.json({ success: true, ...result });

  } catch (error: unknown) {
    console.error('[brackets/generate]', error);
    return errorResponse(error, 'Internal server error');
  }
}
