import { NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { matPasswordSchema } from '@taikaix/backend/types/schemas';
import crypto from 'crypto';
import { z } from 'zod';
import { cookies } from 'next/headers';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);

    if (role !== 'admin' && role !== 'guest_viewer') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 403 });
    }

    const { id: competitionId } = await params;
    const body = await req.json();

    const data = matPasswordSchema.parse(body);

    const batches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = adminDb.batch();
    let opCount = 0;

    const addOp = (fn: (b: FirebaseFirestore.WriteBatch) => void) => {
      fn(currentBatch);
      opCount++;
      if (opCount === 400) {
        batches.push(currentBatch);
        currentBatch = adminDb.batch();
        opCount = 0;
      }
    };

    if (data.bulkPasswords && data.bulkPasswords.length > 0) {
      for (const item of data.bulkPasswords) {
        const matRef = adminDb.collection('competitions').doc(competitionId).collection('mats').doc(item.id);
        const hash = /^[a-f0-9]{64}$/i.test(item.password) ? item.password : crypto.createHash('sha256').update(item.password).digest('hex');
        addOp((b) => b.set(matRef, { password: hash }, { merge: true }));
      }
    } else if (data.matId && data.password !== undefined) {
      const matRef = adminDb.collection('competitions').doc(competitionId).collection('mats').doc(data.matId);
      const hash = /^[a-f0-9]{64}$/i.test(data.password) ? data.password : crypto.createHash('sha256').update(data.password).digest('hex');
      addOp((b) => b.set(matRef, { password: hash }, { merge: true }));
    }

    if (opCount > 0) {
      batches.push(currentBatch);
    }

    if (batches.length > 0) {
      await Promise.all(batches.map(b => b.commit()));
    }

    return NextResponse.json({ success: true, message: 'Password(s) saved securely' });
  } catch (error: any) {
    console.error('[mats/PATCH] error:', error);
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation Error', details: error.issues || error.errors } }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 });
  }
}
