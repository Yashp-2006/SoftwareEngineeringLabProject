// gateway v2 – auth via REST API (no jose ESM)
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for large deployments
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { saveSetupDraftSchema, deployTournamentSchema, assignStaffSchema, updateScheduleSchema } from '@taikaix/backend/types/schemas';
import { redis } from '@taikaix/backend/lib/redis';
import { indexCompetition } from '@taikaix/backend/lib/algolia';
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
        console.log('[deploy] start compId:', payload?.competitionId, 'cats:', payload?.categories?.length);
        const data = deployTournamentSchema.parse(payload);
        console.log('[deploy] zod OK, cats:', data.categories.length);
        
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

        console.log('[deploy] fetching Firestore docs...');
        const [catsSnapshot, compDocSnap, existingMatsSnap] = await Promise.all([
          adminDb.collection('competitions').doc(data.competitionId).collection('categories').select('name').get(),
          adminDb.collection('competitions').doc(data.competitionId).get(),
          adminDb.collection('competitions').doc(data.competitionId).collection('mats').get()
        ]);
        console.log('[deploy] docs fetched. compExists:', compDocSnap.exists, 'existingCats:', catsSnapshot.size, 'existingMats:', existingMatsSnap.size);

        const existingCatsMap: Record<string, any> = {};
        catsSnapshot.docs.forEach((d: any) => {
          existingCatsMap[d.data().name] = d.ref;
        });

        const allCats = [
          ...data.categories.filter((c: any) => data.hideEmpty ? (c.entries || 0) > 0 : true).map((c: any) => ({...c, isSpecial: c.isSpecial === true}))
        ];
        const numMats = data.matsCount || 1;

        const compDocData = compDocSnap.exists ? compDocSnap.data() : {};

        const parseTimeMins = (t: string) => {
          if (!t) return 9 * 60;
          const [h, m] = t.split(':').map(Number);
          return h * 60 + (m || 0);
        };
        const configStartMins = parseTimeMins(compDocData?.startTime || '09:00');
        const configEndMins = parseTimeMins(compDocData?.endTime || '18:00');
        const configEstMins = parseInt(compDocData?.estMinsPerPool) || parseInt(compDocData?.estMinsPerCategory) || 45;
        const poolSize = data.poolSize || 8;

        // 1. Gather all pools and finals for all categories
        const scheduledPoolsList: any[] = [];
        const matTrackers = Array.from({ length: numMats }, () => ({
          currentMins: configStartMins,
          day: 1
        }));
        allCats.forEach((cat) => {
          const athleteCount = cat.entries || 0;
          if (athleteCount === 0) return;

          const poolCount = Math.ceil(athleteCount / poolSize);
          const baseEntries = Math.floor(athleteCount / poolCount);
          const extraEntries = athleteCount % poolCount;

          const mTime = cat.matchTime ?? data.globalMatchTime ?? 3;
          const rTime = cat.restTime ?? data.globalRestTime ?? 1;
          const medTime = cat.medicalTime ?? data.globalMedicalTime ?? 1;
          const bTime = cat.bunkaiTime ?? data.globalBunkaiTime ?? 5;

          let assignedMatId = 1;

          for (let p = 1; p <= poolCount; p++) {
            const poolId = `${cat.id || cat.name}_pool_${p}`;
            const poolSched = data.poolsSchedule?.[poolId];

            const entriesInPool = baseEntries + (p - 1 < extraEntries ? 1 : 0);
            const matchesInPool = cat.isKata ? entriesInPool : Math.max(0, entriesInPool - 1);
            const estTime = poolSched?.estTime || configEstMins;

            let matId = 1;
            let day = 1;
            if (poolSched && poolSched.matId !== -1) {
              matId = poolSched.matId;
              day = poolSched.day !== -1 ? poolSched.day : 1;
            } else {
              let bestMatIdx = 0;
              for (let i = 1; i < numMats; i++) {
                if (matTrackers[i].day < matTrackers[bestMatIdx].day || 
                    (matTrackers[i].day === matTrackers[bestMatIdx].day && matTrackers[i].currentMins < matTrackers[bestMatIdx].currentMins)) {
                  bestMatIdx = i;
                }
              }
              const tracker = matTrackers[bestMatIdx];
              if (tracker.currentMins + estTime > configEndMins && tracker.currentMins > configStartMins) {
                tracker.day++;
                tracker.currentMins = configStartMins;
              }
              matId = bestMatIdx + 1;
              day = tracker.day;
              tracker.currentMins += estTime;
            }
            assignedMatId = matId;

            scheduledPoolsList.push({
              id: poolId,
              categoryId: cat.id || cat.name,
              categoryName: cat.name,
              poolLabel: String(p),
              matId: matId,
              day: day,
              order: poolSched ? poolSched.order : 0,
              duration: estTime,
              isFinals: false
            });
          }

          if (poolCount > 1) {
            const finalsId = `${cat.id || cat.name}_finals`;
            const finalsSched = data.poolsSchedule?.[finalsId];

            const matchesInFinals = cat.isKata ? poolCount : Math.max(0, poolCount - 1);
            const estTime = finalsSched?.estTime || configEstMins;

            let finalsMatId = 1;
            let finalsDay = 1;
            if (finalsSched && finalsSched.matId !== -1) {
              finalsMatId = finalsSched.matId;
              finalsDay = finalsSched.day !== -1 ? finalsSched.day : 1;
            } else {
              let bestMatIdx = assignedMatId - 1;
              const tracker = matTrackers[bestMatIdx];
              if (tracker.currentMins + estTime > configEndMins && tracker.currentMins > configStartMins) {
                tracker.day++;
                tracker.currentMins = configStartMins;
              }
              finalsMatId = bestMatIdx + 1;
              finalsDay = tracker.day;
              tracker.currentMins += estTime;
            }

            scheduledPoolsList.push({
              id: finalsId,
              categoryId: cat.id || cat.name,
              categoryName: cat.name,
              poolLabel: 'finals',
              matId: finalsMatId,
              day: finalsDay,
              order: finalsSched ? finalsSched.order : 0,
              duration: estTime,
              isFinals: true
            });
          }
        });

        // 2. Group pools by Day and Mat, and calculate start/end times sequentially
        const groupedPools: Record<string, any[]> = {};
        scheduledPoolsList.forEach(p => {
          const key = `${p.day}-${p.matId}`;
          if (!groupedPools[key]) groupedPools[key] = [];
          groupedPools[key].push(p);
        });

        const fmtTime = (totalMins: number) => {
          const h = Math.floor(totalMins / 60) % 24;
          const m = totalMins % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        Object.keys(groupedPools).forEach(key => {
          groupedPools[key].sort((a, b) => a.order - b.order);
          let currentMins = configStartMins;
          
          groupedPools[key].forEach(p => {
            p.startTime = fmtTime(currentMins);
            currentMins += p.duration;
            p.endTime = fmtTime(currentMins);
          });
        });

        // 3. Update category documents in batch
        allCats.forEach((cat) => {
          const catPools = scheduledPoolsList.filter(p => p.categoryId === (cat.id || cat.name));
          
          // Sort pools: Pool 1, Pool 2, ..., Finals
          catPools.sort((a, b) => {
            if (a.isFinals) return 1;
            if (b.isFinals) return -1;
            return parseInt(a.poolLabel) - parseInt(b.poolLabel);
          });

          // Build database pool representation
          const dbPools = catPools.map(p => ({
            pool: p.poolLabel,
            matId: p.matId,
            mat: `MAT ${String(p.matId).padStart(2, '0')}`,
            day: p.day,
            order: p.order,
            duration: p.duration,
            startTime: p.startTime || '—',
            endTime: p.endTime || '—'
          }));

          const firstPool = catPools[0] || {};
          const lastPool = catPools[catPools.length - 1] || {};

          const totalDuration = catPools.reduce((sum, p) => sum + p.duration, 0);

          const catRef = existingCatsMap[cat.name] || adminDb.collection('competitions').doc(data.competitionId).collection('categories').doc();

          const updateData: any = {
            name: cat.name,
            entries: cat.entries || 0,
            status: 'upcoming',
            mat: firstPool.matId ? `MAT ${String(firstPool.matId).padStart(2, '0')}` : 'MAT 01',
            day: firstPool.day || 1,
            estimatedDuration: totalDuration,
            scheduledStartTime: firstPool.startTime || '09:00',
            scheduledEndTime: lastPool.endTime || '18:00',
            order: firstPool.order || 0,
            isSpecial: cat.isSpecial,
            pools: dbPools
          };

          if (cat.matchTime !== undefined) updateData.matchTime = cat.matchTime;
          if (cat.restTime !== undefined) updateData.restTime = cat.restTime;
          if (cat.medicalTime !== undefined) updateData.medicalTime = cat.medicalTime;
          if (cat.bunkaiTime !== undefined) updateData.bunkaiTime = cat.bunkaiTime;

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

          addOp((b) => b.set(catRef, JSON.parse(JSON.stringify(updateData)), { merge: true }));
        });

        // Create mats up to numMats and clean up any extra mats from previous configurations
        const existingMatIds = new Set(existingMatsSnap.docs.map((d: any) => d.id));

        for (let i = 1; i <= numMats; i++) {
          const matId = `mat-${i}`;
          const matRef = adminDb.collection('competitions').doc(data.competitionId).collection('mats').doc(matId);
          addOp((b) => b.set(matRef, { name: `MAT ${String(i).padStart(2, '0')}`, order: i }, { merge: true }));
          existingMatIds.delete(matId);
        }

        // Delete any leftover/extra mats
        existingMatIds.forEach(extraMatId => {
          const matRef = adminDb.collection('competitions').doc(data.competitionId).collection('mats').doc(extraMatId);
          addOp((b) => b.delete(matRef));
        });

        const compUpdateData: any = {
          name: data.compName,
          mats: data.matsCount || 1,
          type: data.compType,
          bronzeRule: data.bronzeRule,
          isSetupComplete: true,
          status: 'live',
          updatedAt: new Date().toISOString(),
          tournamentDays: data.tournamentDays || 1,
          globalMatchTime: data.globalMatchTime || 3,
          globalRestTime: data.globalRestTime || 1,
          globalMedicalTime: data.globalMedicalTime || 1,
          globalBunkaiTime: data.globalBunkaiTime || 5
        };

        if (data.scoreboardLogo) {
          compUpdateData.scoreboardLogo = data.scoreboardLogo;
        }

        addOp((b) => b.set(adminDb.collection('competitions').doc(data.competitionId), JSON.parse(JSON.stringify(compUpdateData)), { merge: true }));

        if (opCount > 0) {
          batches.push(currentBatch);
        }

        console.log('[deploy] total ops:', opCount + batches.length > 0 ? 'approx ' + (batches.length * 400 + opCount) : opCount, 'batches:', batches.length);

        if (batches.length > 0) {
          await Promise.all(batches.map((b, i) => b.commit().then(() => console.log(`[deploy] batch ${i} OK`)).catch((err: any) => {
            console.error(`[deploy] Batch ${i} commit failed:`, err?.message || err, err?.code);
            throw err;
          })));
        }

        // Secondary tasks (cache invalidation, indexing) in parallel, raced with a 2-second timeout to prevent Vercel serverless function timeouts
        try {
          const secondaryTasks = [];

          if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            secondaryTasks.push((async () => {
              try {
                await Promise.all([
                  redis.del(`comp:public:${data.competitionId}`),
                  redis.del(`comp:schedule:${data.competitionId}`)
                ]);
              } catch (redisErr) {
                console.warn('Redis cache invalidation failed (non-fatal):', redisErr);
              }
            })());
          }

          secondaryTasks.push((async () => {
            try {
              await indexCompetition({
                id: data.competitionId,
                ...compUpdateData
              });
            } catch (algoliaErr) {
              console.error("Algolia indexing failed (non-fatal):", algoliaErr);
            }
          })());

          if (secondaryTasks.length > 0) {
            await Promise.race([
              Promise.all(secondaryTasks),
              new Promise((resolve) => setTimeout(resolve, 2000))
            ]);
          }
        } catch (postDeployErr) {
          console.error("Post-deploy non-critical steps error:", postDeployErr);
        }

        return NextResponse.json({ success: true, message: 'Tournament deployed successfully' });
      }

      case 'assignStaff': {
        const data = assignStaffSchema.parse(payload);

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
        const data = updateScheduleSchema.parse(payload);

        const batches = [];
        let currentBatch = adminDb.batch();
        let opCount = 0;

        for (const row of data.changes) {
          const ref = adminDb.collection('competitions').doc(data.competitionId).collection('categories').doc(row.id);
          currentBatch.update(ref, {
            scheduledStartTime: row.scheduledStartTime,
            scheduledEndTime: row.scheduledEndTime
          });
          opCount++;
          if (opCount === 400) {
            batches.push(currentBatch);
            currentBatch = adminDb.batch();
            opCount = 0;
          }
        }

        if (opCount > 0) {
          batches.push(currentBatch);
        }

        if (batches.length > 0) {
          await Promise.all(batches.map(b => b.commit()));
        }

        // Invalidate the schedule cache for this competition
        await redis.del(`comp:schedule:${data.competitionId}`);

        return NextResponse.json({ success: true, message: 'Schedule updated successfully' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API Gateway Error:', error);
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: error.issues || error.errors }, { status: 400 });
    }
    // Since gateway is authorized (admin/guest_viewer), it's safe to return the actual error message to help debugging
    const errMsg = error?.message || String(error);
    const errDetail = { stack: error?.stack };
    return NextResponse.json({ error: errMsg, detail: errDetail }, { status: 500 });
  }
}
