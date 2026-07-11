import { NextResponse } from 'next/server';
import { db } from '@lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStr = request.headers.get('cookie') || '';
    const token = cookieStr.match(/(?:^|;)\s*session\s*=\s*([^;]+)/)?.[1];
    const { role } = await verifySession(token);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'attendance_volunteer') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    const { id: competitionId } = await params;
    const body = await request.json();
    const { name, gender, age, weight, categoryId, academy } = body;

    if (!name || !categoryId) {
      return NextResponse.json(
        { success: false, error: { code: 'bad_request', message: 'Name and Category ID are required' } },
        { status: 400 }
      );
    }

    const athleteId = `late-${Date.now()}`;
    const newAthlete = {
      id: athleteId,
      competitionId,
      categoryId,
      name,
      gender: gender || 'M',
      age: age || 0,
      weight: weight || 0,
      country: 'Late Add', // Default for late additions to ensure they are seeded safely
      state: '',
      district: '',
      academy: academy || 'Unknown',
      attendance: 'present', // Late adds are physically present
      readiness: 'ready',
      disqualified: false
    };

    const athleteRef = doc(db, 'competitions', competitionId, 'categories', categoryId, 'athletes', athleteId);
    await setDoc(athleteRef, newAthlete);

    return NextResponse.json({
      success: true,
      data: newAthlete
    });

  } catch (error) {
    console.error('Athlete Add Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'internal_error', message: 'Failed to add late athlete' } },
      { status: 500 }
    );
  }
}
