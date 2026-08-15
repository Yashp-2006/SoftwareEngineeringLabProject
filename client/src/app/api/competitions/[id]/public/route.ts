export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PublicService } from '@/modules/competitions/services/public.server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await PublicService.getPublicCompetition(id);

    if (!data) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Competition not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Failed to fetch public competition data', err);
    const msg = err?.message || 'Internal Server Error';

    if (msg.startsWith('NOT_FOUND:')) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: msg.replace('NOT_FOUND: ', '') } }, { status: 404 });
    }

    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 });
  }
}
