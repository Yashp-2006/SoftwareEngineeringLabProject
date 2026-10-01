"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { 
  DndContext, 
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { db } from '@lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Search, Calendar, GripVertical } from 'lucide-react';
import { sortCategories, compareCategoryNames } from '@/lib/categoryUtils';
import toast from 'react-hot-toast';

export type AutoAssignStrategy = 'dedicated_age_mats' | 'synchronized_age_slots' | 'sequential_fill';

interface ScheduleKanbanProps {
  compId: string;
  tournamentDays: number;
  matsCount: number;
  globalMatchTime: number;
  globalRestTime: number;
  globalMedicalTime: number;
  globalBunkaiTime: number;
  poolsSchedule: Record<string, { matId: number; day: number; order: number; estTime: number }>;
  setPoolsSchedule: React.Dispatch<React.SetStateAction<Record<string, { matId: number; day: number; order: number; estTime: number }>>>;
  importResult: any;
  poolSize: number;
}

function SortablePoolCard({ pool, id, orderNum }: { pool: any, id: string, orderNum?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: 'white',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--neutral-300)',
    marginBottom: '8px',
    cursor: 'grab',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  };

  const isFinals = pool.id.includes('finals') || pool.categoryName.toLowerCase().includes('finals');
  const isKata = pool.categoryName.toLowerCase().includes('kata');

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GripVertical size={16} color="var(--neutral-400)" style={{ flexShrink: 0 }} />
      {orderNum !== undefined && (
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minWidth: '24px', 
          height: '24px', 
          borderRadius: '6px', 
          background: 'var(--neutral-100)', 
          color: 'var(--neutral-700)', 
          fontSize: '11px', 
          fontWeight: 700,
          flexShrink: 0
        }}>
          #{orderNum}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
          <span style={{ 
            fontSize: '9px', 
            fontWeight: 700, 
            padding: '1px 5px', 
            borderRadius: '4px', 
            background: isKata ? '#eff6ff' : '#fff1f2', 
            color: isKata ? '#1d4ed8' : '#be123c',
            letterSpacing: '0.04em'
          }}>
            {isKata ? 'KATA' : 'KUMITE'}
          </span>
          {isFinals && (
            <span style={{ 
              fontSize: '9px', 
              fontWeight: 700, 
              padding: '1px 5px', 
              borderRadius: '4px', 
              background: '#fef3c7', 
              color: '#92400e',
              letterSpacing: '0.04em'
            }}>
              FINALS
            </span>
          )}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pool.categoryName}>
          {pool.categoryName}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '2px' }}>
          {pool.matchesCount} matches • Est. {pool.estTime} mins
        </div>
      </div>
    </div>
  );
}

export function computeAutoSchedule(
  poolsList: any[],
  matsCount: number,
  tournamentDays: number,
  strategy: AutoAssignStrategy = 'dedicated_age_mats'
): Record<string, { matId: number; day: number; order: number; estTime: number }> {
  if (!poolsList || poolsList.length === 0) return {};

  // 1. Group pools by their parent category so all pools of a category stay together
  const categoryMap = new Map<string, { categoryId: string; categoryName: string; pools: any[]; totalEstTime: number }>();
  poolsList.forEach(p => {
    const catId = p.categoryId || p.id.split('_pool_')[0].split('_finals')[0];
    if (!categoryMap.has(catId)) {
      const baseName = p.categoryName
        .replace(/\s*-\s*Pool\s*\d+/i, '')
        .replace(/\s*-\s*Finals/i, '')
        .trim();
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: baseName,
        pools: [],
        totalEstTime: 0
      });
    }
    const group = categoryMap.get(catId)!;
    group.pools.push(p);
    group.totalEstTime += (p.estTime || 0);
  });

  // 2. Sort category groups strictly in proper tournament order:
  // Youngest -> Oldest, Female -> Male, Kata -> Kumite, Weight ascending
  const sortedGroups = Array.from(categoryMap.values()).sort((a, b) => 
    compareCategoryNames(a.categoryName, b.categoryName)
  );

  // 3. Within each group, order: Pool 1 -> Pool 2 -> ... -> Finals
  sortedGroups.forEach(group => {
    group.pools.sort((a, b) => {
      const isFinalsA = a.id.includes('finals');
      const isFinalsB = b.id.includes('finals');
      if (isFinalsA && !isFinalsB) return 1;
      if (!isFinalsA && isFinalsB) return -1;
      return a.categoryName.localeCompare(b.categoryName);
    });
  });

  const schedule: Record<string, { matId: number; day: number; order: number; estTime: number }> = {};
  const orderCounters: Record<string, number> = {};

  const getNextOrder = (day: number, mat: number) => {
    const key = `${day}-${mat}`;
    orderCounters[key] = (orderCounters[key] || 0) + 1;
    return orderCounters[key];
  };

  if (strategy === 'dedicated_age_mats') {
    // Divided by age brackets across mats:
    // Mat 1 gets youngest categories, Mat 2 gets the next age bracket, Mat 3 older...
    // All pools of each category run back-to-back on that mat so the category finishes together.
    const totalTime = sortedGroups.reduce((sum, g) => sum + g.totalEstTime, 0);
    const totalBuckets = Math.max(1, matsCount * tournamentDays);

    let currentDay = 1;
    let currentMat = 1;
    let currentBucketTime = 0;
    let remainingTime = totalTime;
    let remainingBuckets = totalBuckets;

    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i];
      const dynamicTarget = remainingTime / remainingBuckets;

      const wouldOverfill = (currentBucketTime + group.totalEstTime) - dynamicTarget;
      const isBetterToAdvance = currentBucketTime > 0 && (currentBucketTime >= dynamicTarget || wouldOverfill > (dynamicTarget - currentBucketTime));

      if (remainingBuckets > 1 && isBetterToAdvance) {
        if (currentMat < matsCount) {
          currentMat++;
        } else if (currentDay < tournamentDays) {
          currentDay++;
          currentMat = 1;
        }
        remainingBuckets--;
        currentBucketTime = 0;
      }

      // Assign all pools of this category group consecutively to (currentDay, currentMat)
      group.pools.forEach(pool => {
        schedule[pool.id] = {
          matId: currentMat,
          day: currentDay,
          order: getNextOrder(currentDay, currentMat),
          estTime: pool.estTime
        };
        currentBucketTime += pool.estTime;
        remainingTime -= pool.estTime;
      });
    }
  } else if (strategy === 'synchronized_age_slots') {
    // Parallel age progression: All mats start with youngest categories simultaneously at slot 1,
    // and progress through age groups together.
    const matLoads: Record<string, number> = {};
    for (let d = 1; d <= tournamentDays; d++) {
      for (let m = 1; m <= matsCount; m++) {
        matLoads[`${d}-${m}`] = 0;
      }
    }

    sortedGroups.forEach(group => {
      let minLoad = Infinity;
      let bestDay = 1;
      let bestMat = 1;

      for (let d = 1; d <= tournamentDays; d++) {
        for (let m = 1; m <= matsCount; m++) {
          const load = matLoads[`${d}-${m}`];
          if (load < minLoad) {
            minLoad = load;
            bestDay = d;
            bestMat = m;
          }
        }
      }

      group.pools.forEach(pool => {
        schedule[pool.id] = {
          matId: bestMat,
          day: bestDay,
          order: getNextOrder(bestDay, bestMat),
          estTime: pool.estTime
        };
      });

      matLoads[`${bestDay}-${bestMat}`] += group.totalEstTime;
    });
  } else {
    // sequential_fill: Fill Mat 1 up to day capacity, then Mat 2, then Mat 3
    const totalTime = sortedGroups.reduce((sum, g) => sum + g.totalEstTime, 0);
    const targetTimePerMat = Math.ceil(totalTime / matsCount);

    let currentDay = 1;
    let currentMat = 1;
    let currentMatTime = 0;

    sortedGroups.forEach(group => {
      if (currentMat < matsCount && currentMatTime >= targetTimePerMat) {
        currentMat++;
        currentMatTime = 0;
      }

      group.pools.forEach(pool => {
        schedule[pool.id] = {
          matId: currentMat,
          day: currentDay,
          order: getNextOrder(currentDay, currentMat),
          estTime: pool.estTime
        };
        currentMatTime += pool.estTime;
      });
    });
  }

  return schedule;
}

function DroppableColumn({ id, title, pools, totalTime }: { id: string, title: string, pools: any[], totalTime?: number }) {
  const { setNodeRef } = useSortable({
    id,
    data: {
      type: 'Column',
    }
  });

  const hours = totalTime ? (totalTime / 60).toFixed(1) : '0';

  return (
    <div style={{ background: 'var(--neutral-50)', borderRadius: '12px', border: '1px solid var(--neutral-200)', display: 'flex', flexDirection: 'column', height: '520px' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--neutral-200)', background: 'var(--shiro)', borderRadius: '12px 12px 0 0' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: '#171717' }}>{title}</h4>
        {totalTime !== undefined && (
          <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '4px' }}>
            {pools.length} pool{pools.length !== 1 ? 's' : ''} • {totalTime} mins (~{hours} hrs)
          </div>
        )}
      </div>
      <div ref={setNodeRef} style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
        <SortableContext items={pools.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {pools.map((pool, idx) => (
            <SortablePoolCard key={pool.id} id={pool.id} pool={pool} orderNum={idx + 1} />
          ))}
        </SortableContext>
        {pools.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-400)', fontSize: '12px', border: '2px dashed var(--neutral-300)', borderRadius: '8px' }}>
            Drop pools here
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScheduleKanban({
  compId, tournamentDays, matsCount, globalMatchTime, globalRestTime, globalMedicalTime, globalBunkaiTime, poolsSchedule, setPoolsSchedule, importResult, poolSize
}: ScheduleKanbanProps) {
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoAssignStrategy, setAutoAssignStrategy] = useState<AutoAssignStrategy>('dedicated_age_mats');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    async function fetchPools() {
      try {
        const compSnap = await getDoc(doc(db, 'competitions', compId));
        const compDocData = compSnap.data() as any;
        const poolSizeVal = poolSize || compDocData?.poolSize || 8;

        const snap = await getDocs(collection(db, 'competitions', compId, 'categories'));
        const cats = sortCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        
        const generatedPools: any[] = [];
        cats.forEach(cat => {
          const athleteCount = cat.athletes?.length || cat.entries || 0;
          if (athleteCount === 0) return;
          
          const catPoolSize = cat.poolSize || poolSizeVal;
          const poolCount = Math.ceil(athleteCount / catPoolSize);
          const baseEntries = Math.floor(athleteCount / poolCount);
          const extraEntries = athleteCount % poolCount;
          
          const mTime = cat.matchTime ?? globalMatchTime;
          const rTime = cat.restTime ?? globalRestTime;
          const medTime = cat.medicalTime ?? globalMedicalTime;
          const bTime = cat.bunkaiTime ?? globalBunkaiTime;
          
          for (let p = 1; p <= poolCount; p++) {
            const entriesInPool = baseEntries + (p - 1 < extraEntries ? 1 : 0);
            const matchesInPool = cat.isKata ? entriesInPool : Math.max(0, entriesInPool - 1);
            const estTime = Math.ceil((mTime + rTime) * matchesInPool + globalRestTime + globalMedicalTime);
            
            generatedPools.push({
              id: `${cat.id}_pool_${p}`,
              categoryId: cat.id,
              categoryName: `${cat.name} - Pool ${p}`,
              matchesCount: matchesInPool,
              estTime,
            });
          }
          
          if (poolCount > 1) {
            const matchesInFinals = cat.isKata ? poolCount : Math.max(0, poolCount - 1);
            const estTime = Math.ceil((mTime + rTime) * matchesInFinals + globalRestTime + globalMedicalTime);
            
            generatedPools.push({
              id: `${cat.id}_finals`,
              categoryId: cat.id,
              categoryName: `${cat.name} - Finals`,
              matchesCount: matchesInFinals,
              estTime,
            });
          }
        });
        
        setPools(generatedPools);
        
        setPoolsSchedule(prev => {
          const next = { ...prev };
          let changed = false;

          // Re-assign invalid pools (if matsCount or tournamentDays shrank)
          Object.keys(next).forEach(pid => {
            if (next[pid].matId > matsCount || next[pid].day > tournamentDays) {
              next[pid].matId = -1;
              next[pid].day = -1;
              changed = true;
            }
          });
          
          const newPools = generatedPools.filter(p => !next[p.id]);
          
          if (newPools.length > 0) {
            changed = true;
            
            // If all or most pools are unscheduled, compute fresh age-ordered schedule
            if (Object.keys(next).length === 0 || Object.values(next).every((v: any) => v.matId === -1)) {
              const freshSchedule = computeAutoSchedule(generatedPools, matsCount, tournamentDays, 'dedicated_age_mats');
              Object.assign(next, freshSchedule);
            } else {
              // Append new pools using age order
              const appendSchedule = computeAutoSchedule(newPools, matsCount, tournamentDays, 'dedicated_age_mats');
              Object.assign(next, appendSchedule);
            }
          }
          
          generatedPools.forEach(p => {
            if (next[p.id] && next[p.id].estTime !== p.estTime) {
              next[p.id].estTime = p.estTime;
              changed = true;
            }
          });
          
          return changed ? next : prev;
        });
      } catch (err) {
        console.error("Failed to load pools", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPools();
  }, [compId, importResult, globalMatchTime, globalRestTime, globalMedicalTime, globalBunkaiTime, setPoolsSchedule, matsCount, tournamentDays, poolSize]);

  const columns = useMemo(() => {
    const filteredPools = pools.filter(p => p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()));
    const unassigned = filteredPools.filter(p => !poolsSchedule[p.id] || poolsSchedule[p.id].matId === -1).sort((a,b) => (poolsSchedule[a.id]?.order || 0) - (poolsSchedule[b.id]?.order || 0));
    
    return [
      { id: 'unassigned', title: 'Unassigned Pools', pools: unassigned, totalTime: 0 },
      ...Array.from({ length: matsCount }).map((_, i) => {
        const matPools = filteredPools.filter(p => poolsSchedule[p.id]?.day === activeDay && poolsSchedule[p.id]?.matId === (i + 1))
          .sort((a,b) => poolsSchedule[a.id].order - poolsSchedule[b.id].order);
        const totalTime = matPools.reduce((sum, p) => sum + poolsSchedule[p.id].estTime, 0);
        return { id: `mat-${i + 1}`, title: `Mat ${i + 1} (Day ${activeDay})`, pools: matPools, totalTime };
      })
    ];
  }, [pools, poolsSchedule, activeDay, matsCount, searchQuery]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.sortable;
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    setPoolsSchedule(prev => {
      const next = { ...prev };
      
      if (isOverColumn) {
        if (overId === 'unassigned') {
          next[activeId] = { ...next[activeId], matId: -1, day: -1 };
        } else {
          const matId = parseInt(overId.split('-')[1]);
          next[activeId] = { ...next[activeId], matId, day: activeDay };
        }
      } else {
        const overItem = prev[overId];
        if (overItem) {
          next[activeId] = { ...next[activeId], matId: overItem.matId, day: overItem.day };
        }
      }
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    setPoolsSchedule(prev => {
      const next = { ...prev };
      
      const activeItem = next[activeId];
      const overItem = next[overId];
      
      if (activeItem && overItem && activeItem.matId === overItem.matId && activeItem.day === overItem.day) {
        const sameColItems = Object.entries(next)
          .filter(([_, v]) => v.matId === activeItem.matId && v.day === activeItem.day)
          .sort((a,b) => a[1].order - b[1].order)
          .map(e => e[0]);
          
        const oldIndex = sameColItems.indexOf(activeId);
        let newIndex = sameColItems.indexOf(overId);
        
        // If moving to the bottom of a column
        if (newIndex === -1) {
          newIndex = sameColItems.length - 1;
        }

        if (oldIndex !== -1 && newIndex !== -1) {
          const newArray = arrayMove(sameColItems, oldIndex, newIndex);
          newArray.forEach((id, idx) => {
            next[id] = { ...next[id], order: idx };
          });
        }
      }
      
      return next;
    });
  }

  const handleManualAssign = () => {
    setPoolsSchedule(prev => {
      const next = { ...prev };
      pools.forEach((pool, index) => {
        next[pool.id] = {
          matId: -1,
          day: -1,
          order: index + 1,
          estTime: pool.estTime
        };
      });
      return next;
    });
    toast.success('Reset all pools to Unassigned');
  };

  const handleAutoAssign = (strategyToUse?: AutoAssignStrategy) => {
    const strat = strategyToUse || autoAssignStrategy;
    const computed = computeAutoSchedule(pools, matsCount, tournamentDays, strat);
    setPoolsSchedule(computed);
    const stratLabels: Record<AutoAssignStrategy, string> = {
      dedicated_age_mats: 'Dedicated Age Mats (Youngest on Mat 1)',
      synchronized_age_slots: 'Synchronized Age Slots (All mats start youngest)',
      sequential_fill: 'Sequential Fill (Fill Mat 1, then Mat 2...)'
    };
    toast.success(`Assigned ${pools.length} pools across ${matsCount} mat${matsCount > 1 ? 's' : ''} (${stratLabels[strat]})`);
  };

  if (loading) return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>Loading pools...</div>;

  const activePool = activeId ? pools.find(p => p.id === activeId) : null;

  return (
    <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', background: 'var(--shiro)', borderRadius: '12px', border: '1px solid var(--neutral-300)' }}>
      <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Schedule & Mat Assignment</h3>
          <p className="text-small" style={{ color: 'var(--neutral-500)', marginTop: '4px' }}>
            Auto-order by age, keep category pools together, or drag-and-drop between mats.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="input-field"
            value={autoAssignStrategy}
            onChange={(e) => setAutoAssignStrategy(e.target.value as any)}
            title="Auto-assignment ordering strategy"
            style={{ 
              height: '38px', 
              fontSize: '13px', 
              padding: '0 10px', 
              marginBottom: 0, 
              background: 'white',
              border: '1px solid var(--neutral-300)',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <option value="dedicated_age_mats">Dedicated Age Mats (Mat 1 Youngest → Mat 2 Older)</option>
            <option value="synchronized_age_slots">Synchronized Age Slots (All mats start youngest)</option>
            <option value="sequential_fill">Sequential Fill (Fill Mat 1, then Mat 2...)</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleManualAssign}
            style={{ fontSize: '13px', fontWeight: 600, padding: '8px 14px', height: '38px' }}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleAutoAssign(autoAssignStrategy)}
            style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px', height: '38px' }}
          >
            Auto Assign
          </button>
        </div>
      </div>
      
      {tournamentDays >= 1 && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {Array.from({ length: tournamentDays }).map((_, i) => (
              <button
                key={`day-${i+1}`}
                onClick={() => setActiveDay(i + 1)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: activeDay === i + 1 ? '1px solid #171717' : '1px solid var(--neutral-300)',
                  background: activeDay === i + 1 ? '#171717' : 'white',
                  color: activeDay === i + 1 ? 'white' : 'var(--neutral-600)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Day {i + 1}
              </button>
            ))}
          </div>
          
          <div style={{ flex: 1 }}></div>

          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--neutral-600)', padding: '0 12px' }}>
            Total Pools: {pools.length}
          </div>

          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)' }} />
            <input 
              type="text" 
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid var(--neutral-300)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      )}

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${matsCount}, minmax(280px, 1fr))`, gap: '16px', alignItems: 'start', overflowX: 'auto', paddingBottom: '16px' }}>
          {columns.map(col => (
            <DroppableColumn key={col.id} id={col.id} title={col.title} pools={col.pools} totalTime={col.totalTime} />
          ))}
        </div>
        
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activePool ? <SortablePoolCard id={activePool.id} pool={activePool} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
