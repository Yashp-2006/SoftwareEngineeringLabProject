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
    const cacheKey = `comp:public:${id}`;

    // Cache the public details for 60 seconds
    const data = await fetchWithCache(cacheKey, 60, async () => {
      const compSnap = await adminDb.collection('competitions').doc(id).get();
      if (!compSnap.exists) {
        return null;
      }
      
      const compData = compSnap.data() || {};
      
      const catSnap = await adminDb.collection('competitions').doc(id).collection('categories').get();
      const categories = catSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      return {
        ...compData,
        categories
      };
    });

    if (!data) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Failed to fetch public competition data', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
