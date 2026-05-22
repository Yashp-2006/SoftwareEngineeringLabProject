import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: competitionId } = await params;
    const body = await request.json();
    const { name, gender, age, weight, categoryId, academy } = body;

    // Validate simple required fields for late on-the-spot registration
    if (!name || !categoryId) {
      return NextResponse.json(
        { success: false, error: { code: 'bad_request', message: 'Name and Category ID are required' } },
        { status: 400 }
      );
    }

    // In a real implementation:
    // 1. Generate a UUID for the new athlete.
    // 2. Save the athlete to the 'athletes' subcollection in Firestore.
    // 3. Return the newly created athlete.
    
    // Once this returns success to the client, the UI will display a prompt: 
    // "Athlete added. The Tiesheet for this category must be re-generated. [Re-generate Now]"

    const newAthlete = {
      id: `late-${Date.now()}`,
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
