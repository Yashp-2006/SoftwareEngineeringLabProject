export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PublicService } from '@/modules/competitions/services/public.server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await PublicService.getSchedule(id);

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Failed to fetch schedule data', err);
    const msg = err?.message || 'Internal Server Error';
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 });
  }
}
