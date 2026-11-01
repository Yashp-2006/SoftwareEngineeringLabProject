export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PublicService } from '@/modules/competitions/services/public.server';
import { errorResponse } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await PublicService.getSchedule(id);

    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    console.error('[schedule/GET] error:', err);
    return errorResponse(err, 'Failed to fetch schedule data');
  }
}
