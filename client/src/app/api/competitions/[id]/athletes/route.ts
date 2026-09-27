import { NextResponse } from 'next/server';
import { db } from '@lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'attendance_volunteer') {
      return unauthorizedResponse();
    }
    const { id: competitionId } = await params;
    const body = await request.json();
    
    // We can just manually validate since it's simple or use a local schema
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      categoryId: z.string().min(1, 'Category ID is required'),
      gender: z.string().optional(),
      age: z.union([z.number(), z.string()]).optional(),
      weight: z.union([z.number(), z.string()]).optional(),
      academy: z.string().optional()
    });

    const validated = schema.parse(body);
    const { name, gender, age, weight, categoryId, academy } = validated;

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

  } catch (error: unknown) {
    console.error('[athletes/POST] error:', error);
    return errorResponse(error, 'Failed to add late athlete');
  }
}
