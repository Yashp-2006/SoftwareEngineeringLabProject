import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    // Initialize Firebase Admin SDK (singleton)
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const adminDb = getFirestore();
    const { id, catId } = await params;

    const catDoc = await adminDb
      .collection('competitions')
      .doc(id)
      .collection('categories')
      .doc(catId)
      .get();

    if (!catDoc.exists) {
      return NextResponse.json(
        { success: false, error: { code: 'not_found', message: 'Category not found' } },
        { status: 404 }
      );
    }

    const data = catDoc.data()!;

    return NextResponse.json({
      success: true,
      data: {
        categoryId: catId,
        categoryName: data.name,
        status: data.status,
        mat: data.mat || null,
        athletes: data.athletes || [],
        matches: data.matches || [],
        scheduledStartTime: data.scheduledStartTime || null,
        scheduledEndTime: data.scheduledEndTime || null,
      },
    });
  } catch (error: any) {
    console.error('Bracket fetch error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'internal_error', message: 'Failed to fetch bracket data' } },
      { status: 500 }
    );
  }
}
