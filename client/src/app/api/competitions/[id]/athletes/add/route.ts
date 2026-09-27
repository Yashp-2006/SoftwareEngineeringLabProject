import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { addAthleteSchema } from '@taikaix/backend/types/schemas';
import { AthleteService } from '@/modules/competitions/services/athlete.server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'attendance_volunteer') {
      return unauthorizedResponse();
    }

    const { id: competitionId } = await params;
    const body = await req.json();
    const { categoryId, athleteData } = addAthleteSchema.parse(body);

    const result = await AthleteService.addAthlete(competitionId, categoryId, athleteData);

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('[athletes/add] error:', error);
    return errorResponse(error, 'Internal server error');
  }
}
