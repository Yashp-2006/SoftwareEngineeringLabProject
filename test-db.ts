import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const { adminDb } = await import('./backend/lib/firebase-admin');
  const compId = 'UA8g4E7C9F50lu6fqkQo';
  
  try {
    const compSnap = await adminDb.collection('competitions').doc(compId).get();
    const compData = compSnap.data() || {};
    
    // Load actual categories from Firestore
    console.log("Loading categories from Firestore...");
    const catsSnap = await adminDb.collection('competitions').doc(compId).collection('categories').get();
    console.log("Loaded", catsSnap.size, "categories.");
    
    const categoriesPayload = catsSnap.docs.map(doc => {
      const c = doc.data();
      
      const numOrUndef = (val: any) => {
        if (val === undefined || val === null || val === '') return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      };

      return {
        id: doc.id,
        name: c.name,
        entries: numOrUndef(c.entries || c.athletes?.length) || 0,
        isKata: c.isKata === true || c.isKata === 'true',
        isSpecial: c.isSpecial === true || c.isSpecial === 'true',
        minAge: numOrUndef(c.minAge),
        maxAge: numOrUndef(c.maxAge),
        minWeight: numOrUndef(c.minWeight),
        maxWeight: numOrUndef(c.maxWeight),
        judgeCount: numOrUndef(c.judgeCount),
        matchTime: numOrUndef(c.matchTime),
        restTime: numOrUndef(c.restTime),
        medicalTime: numOrUndef(c.medicalTime),
        bunkaiTime: numOrUndef(c.bunkaiTime),
      };
    });

    const payload = {
      competitionId: compId,
      compName: compData.name || 'a',
      matsCount: compData.mats || 6,
      poolSize: 8,
      compRules: compData.rules || 'custom',
      compType: compData.type || 'national',
      bronzeRule: 'two',
      wkfMode: 'standard',
      wkfKataJudgeCount: 3,
      categories: categoriesPayload,
      hideEmpty: false,
      scoreboardLogo: compData.scoreboardLogo || null,
      tournamentDays: compData.tournamentDays || 2,
      globalMatchTime: compData.globalMatchTime || 3,
      globalRestTime: compData.globalRestTime || 1,
      globalMedicalTime: compData.globalMedicalTime || 1,
      globalBunkaiTime: compData.globalBunkaiTime || 5,
      poolsSchedule: {}
    };

    console.log("Simulating deployTournament action...");
    const { deployTournamentSchema } = await import('./backend/types/schemas');
    const data = deployTournamentSchema.parse(payload);
    
    const batches: any[] = [];
    let currentBatch = adminDb.batch();
    let opCount = 0;

    const addOp = (fn: (b: any) => void) => {
      fn(currentBatch);
      opCount++;
      if (opCount === 400) {
        batches.push(currentBatch);
        currentBatch = adminDb.batch();
        opCount = 0;
      }
    };

    console.log("Fetching dependencies...");
    const [catsSnapshot, compDocSnap, existingMatsSnap] = await Promise.all([
      adminDb.collection('competitions').doc(data.competitionId).collection('categories').select('name').get(),
      adminDb.collection('competitions').doc(data.competitionId).get(),
      adminDb.collection('competitions').doc(data.competitionId).collection('mats').get()
    ]);

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
    const poolSize = data.poolSize || 8;

    const scheduledPoolsList: any[] = [];
    let unassignedCount = 0;
    allCats.forEach((cat) => {
      const athleteCount = cat.entries || 0;
      if (athleteCount === 0) return;

      const poolCount = Math.ceil(athleteCount / poolSize);
      const baseEntries = Math.floor(athleteCount / poolCount);
      const extraEntries = athleteCount % poolCount;

      const mTime = cat.matchTime ?? data.globalMatchTime ?? 3;
      const rTime = cat.restTime ?? data.globalRestTime ?? 1;
      const medTime = cat.medicalTime ?? data.globalMedicalTime ?? 1;

      let assignedMatId = 1;

      for (let p = 1; p <= poolCount; p++) {
        const poolId = `${cat.id || cat.name}_pool_${p}`;
        const poolSched = data.poolsSchedule?.[poolId];

        const entriesInPool = baseEntries + (p - 1 < extraEntries ? 1 : 0);
        const matchesInPool = cat.isKata ? entriesInPool : Math.max(0, entriesInPool - 1);
        const estTime = poolSched?.estTime || Math.ceil((mTime + rTime) * matchesInPool + rTime + medTime);

        let matId = 1;
        if (poolSched && poolSched.matId !== -1) {
          matId = poolSched.matId;
        } else {
          matId = (unassignedCount % numMats) + 1;
          unassignedCount++;
        }
        assignedMatId = matId;

        scheduledPoolsList.push({
          id: poolId,
          categoryId: cat.id || cat.name,
          categoryName: cat.name,
          poolLabel: String(p),
          matId: matId,
          day: poolSched && poolSched.day !== -1 ? poolSched.day : 1,
          order: poolSched ? poolSched.order : 0,
          duration: estTime,
          isFinals: false
        });
      }

      if (poolCount > 1) {
        const finalsId = `${cat.id || cat.name}_finals`;
        const finalsSched = data.poolsSchedule?.[finalsId];

        const matchesInFinals = cat.isKata ? poolCount : Math.max(0, poolCount - 1);
        const estTime = finalsSched?.estTime || Math.ceil((mTime + rTime) * matchesInFinals + rTime + medTime);

        let finalsMatId = 1;
        if (finalsSched && finalsSched.matId !== -1) {
          finalsMatId = finalsSched.matId;
        } else {
          finalsMatId = assignedMatId;
        }

        scheduledPoolsList.push({
          id: finalsId,
          categoryId: cat.id || cat.name,
          categoryName: cat.name,
          poolLabel: 'finals',
          matId: finalsMatId,
          day: finalsSched && finalsSched.day !== -1 ? finalsSched.day : 1,
          order: finalsSched ? finalsSched.order : 0,
          duration: estTime,
          isFinals: true
        });
      }
    });

    console.log("Scheduled pools list size:", scheduledPoolsList.length);
    
    // Group pools and calculate times
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

    allCats.forEach((cat) => {
      const catPools = scheduledPoolsList.filter(p => p.categoryId === (cat.id || cat.name));
      catPools.sort((a, b) => {
        if (a.isFinals) return 1;
        if (b.isFinals) return -1;
        return parseInt(a.poolLabel) - parseInt(b.poolLabel);
      });

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

    const existingMatIds = new Set(existingMatsSnap.docs.map((d: any) => d.id));

    for (let i = 1; i <= numMats; i++) {
      const matId = `mat-${i}`;
      const matRef = adminDb.collection('competitions').doc(data.competitionId).collection('mats').doc(matId);
      addOp((b) => b.set(matRef, { name: `MAT ${String(i).padStart(2, '0')}`, order: i }, { merge: true }));
      existingMatIds.delete(matId);
    }

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

    addOp((b) => b.update(adminDb.collection('competitions').doc(data.competitionId), JSON.parse(JSON.stringify(compUpdateData))));

    if (opCount > 0) {
      batches.push(currentBatch);
    }

    console.log("Committing", batches.length, "batches...");
    if (batches.length > 0) {
      await Promise.all(batches.map(b => b.commit()));
    }
    console.log("SUCCESS! Deployed UA8g4E7C9F50lu6fqkQo locally.");
  } catch (err: any) {
    console.error("DEPLOYMENT SIMULATION EXCEPTION:", err);
  }
}

test();
