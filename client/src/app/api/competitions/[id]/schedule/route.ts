export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { fetchWithCache } from '@taikaix/backend/lib/redis';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cacheKey = `comp:schedule:${id}`;

    // Cache the schedule details for 60 seconds
    const data = await fetchWithCache(cacheKey, 60, async () => {
      const catSnap = await adminDb.collection('competitions').doc(id).collection('categories').orderBy('scheduledStartTime').get();
      const categories = catSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      return {
        categories
      };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Failed to fetch schedule data', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
