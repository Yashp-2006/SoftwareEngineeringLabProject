import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { BracketService } from '@/modules/brackets/services/bracket.server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'mat_operator') {
      return unauthorizedResponse();
    }
    const { id, catId } = await params;
    
    const schema = z.object({ matchId: z.string().min(1, 'matchId is required') });
    const body = await req.json();
    const { matchId } = schema.parse(body);

    const result = await BracketService.resolveTie(id, catId, matchId);
    return NextResponse.json({ success: true, ...result });

  } catch (error: unknown) {
    console.error('[brackets/[catId]/tiebreaker]', error);
    return errorResponse(error, 'Internal server error');
  }
}
