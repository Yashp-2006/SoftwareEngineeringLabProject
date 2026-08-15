import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { addAthleteSchema } from '@taikaix/backend/types/schemas';
import { z } from 'zod';
import { AthleteService } from '@/modules/competitions/services/athlete.server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'attendance_volunteer') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 403 });
    }

    const { id: competitionId } = await params;
    const body = await req.json();
    const { categoryId, athleteData } = addAthleteSchema.parse(body);

    const result = await AthleteService.addAthlete(competitionId, categoryId, athleteData);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[athletes/add] error:', error);
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation Error', details: error.issues || error.errors } }, { status: 400 });
    }
    
    const msg = error?.message || 'Internal server error';
    if (msg.startsWith('NOT_FOUND:')) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: msg.replace('NOT_FOUND: ', '') } }, { status: 404 });
    }
    if (msg.startsWith('BAD_REQUEST:')) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: msg.replace('BAD_REQUEST: ', '') } }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 });
  }
}
