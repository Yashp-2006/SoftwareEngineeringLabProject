import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { swapMatchSchema } from '@taikaix/backend/types/schemas';
import { BracketService } from '@/modules/brackets/services/bracket.server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin') {
      return unauthorizedResponse();
    }

    const { id, catId } = await params;
    const body = await request.json();
    const validated = swapMatchSchema.parse(body);
    
    // Pass everything as options
    const result = await BracketService.swapAthletes(id, catId, { ...validated, ...body });
    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Error swapping athletes:', error);
    return errorResponse(error, 'Internal server error');
  }
}
