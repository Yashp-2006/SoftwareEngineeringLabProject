import { NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { matPasswordSchema } from '@taikaix/backend/types/schemas';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);

    if (role !== 'admin' && role !== 'guest_viewer') {
      return unauthorizedResponse();
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
        const isAlreadyHash = /^[a-f0-9]{64}$/i.test(item.password);
        const hash = isAlreadyHash ? item.password : crypto.createHash('sha256').update(item.password).digest('hex');
        const updatePayload: Record<string, any> = { password: hash };
        if (!isAlreadyHash && item.password) {
          updatePayload.displayPassword = item.password;
        }
        addOp((b) => b.set(matRef, updatePayload, { merge: true }));
      }
    } else if (data.matId && data.password !== undefined) {
      const matRef = adminDb.collection('competitions').doc(competitionId).collection('mats').doc(data.matId);
      const isAlreadyHash = /^[a-f0-9]{64}$/i.test(data.password);
      const hash = isAlreadyHash ? data.password : crypto.createHash('sha256').update(data.password).digest('hex');
      const updatePayload: Record<string, any> = { password: hash };
      if (!isAlreadyHash && data.password) {
        updatePayload.displayPassword = data.password;
      }
      addOp((b) => b.set(matRef, updatePayload, { merge: true }));
    }

    if (opCount > 0) {
      batches.push(currentBatch);
    }

    if (batches.length > 0) {
      await Promise.all(batches.map(b => b.commit()));
    }

    return NextResponse.json({ success: true, message: 'Password(s) saved securely' });
  } catch (error: unknown) {
    console.error('[mats/PATCH] error:', error);
    return errorResponse(error, 'Internal server error');
  }
}
