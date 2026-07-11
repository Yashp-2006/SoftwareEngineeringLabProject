export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { saveSetupDraftSchema } from '@taikaix/backend/types/schemas';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session')?.value;
    const { role } = await verifySession(sessionToken);

    if (role !== 'admin' && role !== 'guest_viewer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'saveSetupDraft': {
        const data = saveSetupDraftSchema.parse(payload);
        // Strip undefined values which firestore doesn't support
        const cleanData = JSON.parse(JSON.stringify(data));
        
        await adminDb.collection('competitions').doc(data.competitionId).collection('drafts').doc('setup').set({
          ...cleanData,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({ success: true, message: 'Draft saved securely' });
      }

      case 'deployTournament': {
        const { deployTournamentSchema } = await import('@taikaix/backend/types/schemas');
        const data = deployTournamentSchema.parse(payload);
        
        const batch = adminDb.batch();
        const catsSnapshot = await adminDb.collection('competitions').doc(data.competitionId).collection('categories').get();
        const existingCatsMap: Record<string, any> = {};
        catsSnapshot.docs.forEach((d: any) => {
          existingCatsMap[d.data().name] = d.ref;
        });

        const allCats = [
          ...data.categories.filter((c: any) => data.hideEmpty ? (c.entries || 0) > 0 : true).map((c: any) => ({...c, isSpecial: false}))
        ];
        const numMats = data.matsCount || 1;

        const compDocSnap = await adminDb.collection('competitions').doc(data.competitionId).get();
        const compDocData = compDocSnap.exists ? compDocSnap.data() : {};

        const parseTimeMins = (t: string) => {
          if (!t) return 9 * 60;
          const [h, m] = t.split(':').map(Number);
          return h * 60 + (m || 0);
        };
        const configStartMins = parseTimeMins(compDocData?.startTime || '09:00');
        const configEstMins = parseInt(compDocData?.estMinsPerCategory) || 0;

        const matTotalMins = Array.from({ length: numMats }).map(() => configStartMins);

        allCats.forEach((cat, index) => {
          const matIndex = index % numMats;
          const matName = `MAT ${String(matIndex + 1).padStart(2, '0')}`;
          const estimatedDuration = configEstMins > 0
            ? configEstMins
            : Math.min((cat.entries || 1) * 2, 90);

          const startTotalMins = matTotalMins[matIndex];
          const endTotalMins = startTotalMins + estimatedDuration;
          matTotalMins[matIndex] = endTotalMins;

          const fmtTime = (totalMins: number) => {
            const h = Math.floor(totalMins / 60) % 24;
            const m = totalMins % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          };

          const startTimeStr = fmtTime(startTotalMins);
          const endTimeStr = fmtTime(endTotalMins);

          const catRef = existingCatsMap[cat.name] || adminDb.collection('competitions').doc(data.competitionId).collection('categories').doc();

          const updateData: any = {
            name: cat.name,
            entries: cat.entries || 0,
            status: 'upcoming',
            mat: matName,
            estimatedDuration: estimatedDuration,
            scheduledStartTime: startTimeStr,
            scheduledEndTime: endTimeStr,
            order: index,
            isSpecial: cat.isSpecial
          };

          if (cat.name.toLowerCase().includes('kata')) {
            updateData.isKata = true;
            updateData.judgeCount = cat.judgeCount || data.wkfKataJudgeCount || 3;
            updateData.numberOfJudges = cat.judgeCount || data.wkfKataJudgeCount || 3;
          }

          if (cat.isSpecial) {
            if (cat.minAge !== undefined) updateData.minAge = cat.minAge;
            if (cat.maxAge !== undefined) updateData.maxAge = cat.maxAge;
            if (cat.minWeight !== undefined) updateData.minWeight = cat.minWeight;
            if (cat.maxWeight !== undefined) updateData.maxWeight = cat.maxWeight;
          }

          if (existingCatsMap[cat.name]) {
            batch.update(catRef, updateData);
          } else {
            batch.set(catRef, updateData);
          }
        });

        for (let i = 1; i <= numMats; i++) {
          const matRef = adminDb.collection('competitions').doc(data.competitionId).collection('mats').doc(`mat-${i}`);
          batch.set(matRef, { name: `MAT ${String(i).padStart(2, '0')}`, order: i }, { merge: true });
        }

        const compUpdateData: any = {
          name: data.compName,
          mats: data.matsCount || 1,
          type: data.compType,
          bronzeRule: data.bronzeRule,
          isSetupComplete: true,
          status: 'live',
          updatedAt: new Date().toISOString()
        };

        if (data.scoreboardLogo) {
          compUpdateData.scoreboardLogo = data.scoreboardLogo;
        }

        batch.update(adminDb.collection('competitions').doc(data.competitionId), compUpdateData);
        await batch.commit();

        const { redis } = await import('@taikaix/backend/lib/redis');
        await redis.del(`comp:public:${data.competitionId}`);
        await redis.del(`comp:schedule:${data.competitionId}`);

        // Algolia Indexing
        try {
          const { indexCompetition } = await import('@taikaix/backend/lib/algolia');
          await indexCompetition({
            id: data.competitionId,
            ...compUpdateData
          });
        } catch (algoliaErr) {
          console.error("Failed to index competition to Algolia", algoliaErr);
        }

        return NextResponse.json({ success: true, message: 'Tournament deployed successfully' });
      }

      case 'assignStaff': {
        const { assignStaffSchema } = await import('@taikaix/backend/types/schemas');
        const data = assignStaffSchema.parse(payload);
        const { redis } = await import('@taikaix/backend/lib/redis');

        // 1. Acquire Redis Lock to prevent double assignments
        const lockKey = `lock:assignStaff:${data.competitionId}:${data.assignmentId}`;
        const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 10 }); // Lock expires in 10s
        
        if (!acquired) {
          return NextResponse.json({ error: 'This assignment is currently being processed by another user.' }, { status: 409 });
        }

        try {
          // 2. Perform the assignment
          const staffRef = adminDb.collection('competitions').doc(data.competitionId).collection('staff').doc(data.assignmentId);
          
          // Optionally: Double-check if already assigned to someone else
          const snap = await staffRef.get();
          if (snap.exists) {
            const current = snap.data();
            // If it's already assigned to someone who isn't 'Unassigned' and isn't the new operator, we could reject it
            // but for now, we just proceed as requested.
          }

          await staffRef.update(data.updates);

          return NextResponse.json({ success: true, message: 'Staff assigned successfully' });
        } finally {
          // 3. Release Lock
          await redis.del(lockKey);
        }
      }

      case 'updateSchedule': {
        const { updateScheduleSchema } = await import('@taikaix/backend/types/schemas');
        const data = updateScheduleSchema.parse(payload);
        const { redis } = await import('@taikaix/backend/lib/redis');

        const batch = adminDb.batch();
        for (const row of data.changes) {
          const ref = adminDb.collection('competitions').doc(data.competitionId).collection('categories').doc(row.id);
          batch.update(ref, {
            scheduledStartTime: row.scheduledStartTime,
            scheduledEndTime: row.scheduledEndTime
          });
        }
        await batch.commit();

        // Invalidate the schedule cache for this competition
        await redis.del(`comp:schedule:${data.competitionId}`);

        return NextResponse.json({ success: true, message: 'Schedule updated successfully' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API Gateway Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
