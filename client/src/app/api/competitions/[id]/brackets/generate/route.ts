import { NextResponse } from 'next/server';
import { generateBracket } from '@lib/tiesheet-generator';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: competitionId } = await params;
    const body = await request.json();
    const { categoryId, athletes, compType = 'international' } = body;

    if (!categoryId || !athletes) {
      return NextResponse.json(
        { success: false, error: { code: 'bad_request', message: 'Missing categoryId or athletes' } },
        { status: 400 }
      );
    }

    const matches = generateBracket(athletes, compType);

    return NextResponse.json({
      success: true,
      data: {
        categoryId,
        competitionId,
        matches,
      },
    });
  } catch (error: any) {
    console.error('Bracket Generation Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'internal_error', message: 'Failed to generate bracket' } },
      { status: 500 }
    );
  }
}
