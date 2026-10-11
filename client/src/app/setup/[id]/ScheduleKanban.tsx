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
  defaultDropAnimationSideEffects,
  useDroppable
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
import { Search, Calendar, GripVertical, Layers, ChevronDown, Info, X, Clock, Users, Swords } from 'lucide-react';
import { sortCategories, compareCategoryNames } from '@/lib/categoryUtils';
import toast from 'react-hot-toast';

export type AutoAssignStrategy = 'balanced_finish' | 'dedicated_age_mats' | 'synchronized_age_slots' | 'sequential_fill';

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

interface SortablePoolCardProps {
  pool: any;
  id: string;
  orderNum?: number;
  matsCount?: number;
  tournamentDays?: number;
  categoryPoolCount?: number;
  categoryLocation?: { isSplit: boolean; day: number; matId: number };
  onMoveCategory?: (categoryId: string, targetKey: string) => void;
  onOpenDetails?: (pool: any) => void;
}

function SortablePoolCard({ 
  pool, 
  id, 
  orderNum,
  matsCount,
  tournamentDays,
  categoryPoolCount,
  categoryLocation,
  onMoveCategory,
  onOpenDetails
}: SortablePoolCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id,
    data: {
      type: 'Card',
      poolId: id,
    }
  });
  
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
    alignItems: 'center',
    userSelect: 'none' as const
  };

  const isKata = Boolean(pool.isKata || pool.categoryName?.toLowerCase().includes('kata'));
  const catId = pool.categoryId || pool.id.split('_pool_')[0];
  const poolNum = pool.poolNumber || (pool.categoryName?.match(/Pool\s*(\d+)/i)?.[1] ?? 1);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={(e) => {
        // Prevent click if user clicked Move Category dropdown or drag handle
        if ((e.target as HTMLElement).closest('select') || (e.target as HTMLElement).closest('button')) return;
        if (onOpenDetails) onOpenDetails(pool);
      }}
      title={`Click to view pool details\nCategory: ${pool.categoryName}\nPool: #${poolNum}\nAthletes: ${pool.athletesCount ?? 'N/A'}\nMatches: ${pool.matchesCount}\nEst Time: ${pool.estTime} mins`}
    >
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
            <span style={{ 
              fontSize: '9px', 
              fontWeight: 700, 
              padding: '1px 5px', 
              borderRadius: '4px', 
              background: '#f3f4f6', 
              color: '#374151',
              letterSpacing: '0.04em'
            }}>
              POOL {poolNum}
            </span>
          </div>

          {onMoveCategory && (
            <div 
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            >
              <button
                type="button"
                tabIndex={-1}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-700)',
                  border: '1px solid var(--neutral-300)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  lineHeight: '1.3',
                  whiteSpace: 'nowrap',
                  userSelect: 'none'
                }}
              >
                <Layers size={11} color="var(--neutral-600)" />
                <span>Move Cat{categoryPoolCount && categoryPoolCount > 1 ? ` (${categoryPoolCount})` : ''}</span>
                <ChevronDown size={10} color="var(--neutral-400)" />
              </button>
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && onMoveCategory) {
                    onMoveCategory(catId, val);
                  }
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                title={`Move all ${categoryPoolCount || 1} pool(s) in this category to a mat`}
              >
                <option value="" disabled>Move all pools in category to...</option>
                {tournamentDays && tournamentDays <= 1 ? (
                  <>
                    {Array.from({ length: matsCount || 1 }).map((_, i) => {
                      const matNum = i + 1;
                      const isCurrent = !categoryLocation?.isSplit && categoryLocation?.matId === matNum && categoryLocation?.day === 1;
                      return (
                        <option key={`mat-${matNum}`} value={`mat-1-${matNum}`}>
                          Mat {matNum} {isCurrent ? '(Current)' : ''}
                        </option>
                      );
                    })}
                    <option value="unassigned">
                      Unassigned {!categoryLocation?.isSplit && categoryLocation?.matId === -1 ? '(Current)' : ''}
                    </option>
                  </>
                ) : (
                  <>
                    {Array.from({ length: tournamentDays || 1 }).map((_, d) => {
                      const dayNum = d + 1;
                      return (
                        <optgroup key={`day-${dayNum}`} label={`Day ${dayNum}`}>
                          {Array.from({ length: matsCount || 1 }).map((_, i) => {
                            const matNum = i + 1;
                            const isCurrent = !categoryLocation?.isSplit && categoryLocation?.matId === matNum && categoryLocation?.day === dayNum;
                            return (
                              <option key={`day-${dayNum}-mat-${matNum}`} value={`mat-${dayNum}-${matNum}`}>
                                Day {dayNum} — Mat {matNum} {isCurrent ? '(Current)' : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                    <optgroup label="Other">
                      <option value="unassigned">
                        Unassigned {!categoryLocation?.isSplit && categoryLocation?.matId === -1 ? '(Current)' : ''}
                      </option>
                    </optgroup>
                  </>
                )}
              </select>
            </div>
          )}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pool.categoryName}>
          {pool.categoryName}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {pool.athletesCount !== undefined ? `${pool.athletesCount} athletes • ` : ''}
            {pool.matchesCount} matches • Est. {pool.estTime}m
          </span>
          {categoryPoolCount && categoryPoolCount > 1 && (
            <span style={{ fontSize: '10px', color: 'var(--neutral-400)', fontWeight: 500 }}>
              {categoryPoolCount} pools
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function computeAutoSchedule(
  poolsList: any[],
  matsCount: number,
  tournamentDays: number,
  strategy: AutoAssignStrategy = 'balanced_finish'
): Record<string, { matId: number; day: number; order: number; estTime: number }> {
  if (!poolsList || poolsList.length === 0) return {};

  // 1. Group pools by their parent category so all pools of a category stay together on the same mat
  const categoryMap = new Map<string, { categoryId: string; categoryName: string; pools: any[]; totalEstTime: number }>();
  poolsList.forEach(p => {
    const catId = p.categoryId || p.id.split('_pool_')[0];
    if (!categoryMap.has(catId)) {
      const baseName = p.categoryName
        .replace(/\s*-\s*Pool\s*\d+/i, '')
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

  // 3. Within each group, order: Pool 1 -> Pool 2 -> ... -> Pool N
  sortedGroups.forEach(group => {
    group.pools.sort((a, b) => {
      const numA = a.poolNumber ?? (parseInt(a.id.split('_pool_')[1], 10) || 0);
      const numB = b.poolNumber ?? (parseInt(b.id.split('_pool_')[1], 10) || 0);
      return numA - numB;
    });
  });

  const schedule: Record<string, { matId: number; day: number; order: number; estTime: number }> = {};
  const orderCounters: Record<string, number> = {};

  const getNextOrder = (day: number, mat: number) => {
    const key = `${day}-${mat}`;
    orderCounters[key] = (orderCounters[key] || 0) + 1;
    return orderCounters[key];
  };

  if (strategy === 'balanced_finish') {
    // BALANCED FINISH: All mats finish at the same time!
    // We balance the total estimated load across mats so every mat's total run time is virtually identical.
    // Within each mat, categories remain sorted by age so all mats start youngest and progress to oldest.
    const matBuckets: { day: number; matId: number; totalTime: number; groups: typeof sortedGroups }[] = [];
    for (let d = 1; d <= tournamentDays; d++) {
      for (let m = 1; m <= matsCount; m++) {
        matBuckets.push({ day: d, matId: m, totalTime: 0, groups: [] });
      }
    }

    // Assign categories using least-loaded bucket heuristic while preserving age balance
    // To ensure all mats have a balanced progression and finish simultaneously,
    // iterate over sorted groups and place each onto the bucket with the currently lowest total duration
    sortedGroups.forEach(group => {
      let minBucket = matBuckets[0];
      for (let i = 1; i < matBuckets.length; i++) {
        if (matBuckets[i].totalTime < minBucket.totalTime) {
          minBucket = matBuckets[i];
        }
      }
      minBucket.groups.push(group);
      minBucket.totalTime += group.totalEstTime;
    });

    // Optional local optimization to further reduce variance between mats
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 50) {
      improved = false;
      iterations++;
      matBuckets.sort((a, b) => b.totalTime - a.totalTime);
      const maxB = matBuckets[0];
      const minB = matBuckets[matBuckets.length - 1];
      const currentDiff = maxB.totalTime - minB.totalTime;

      if (currentDiff > 10 && maxB.groups.length > 1) {
        let bestSwapIdx = -1;
        let bestNewDiff = currentDiff;

        for (let gIdx = 0; gIdx < maxB.groups.length; gIdx++) {
          const gTime = maxB.groups[gIdx].totalEstTime;
          const newDiff = Math.abs((maxB.totalTime - gTime) - (minB.totalTime + gTime));
          if (newDiff < bestNewDiff) {
            bestNewDiff = newDiff;
            bestSwapIdx = gIdx;
          }
        }

        if (bestSwapIdx !== -1 && bestNewDiff < currentDiff) {
          const [movedGroup] = maxB.groups.splice(bestSwapIdx, 1);
          maxB.totalTime -= movedGroup.totalEstTime;
          minB.groups.push(movedGroup);
          minB.totalTime += movedGroup.totalEstTime;
          improved = true;
        }
      }
    }

    // Now write out the schedule, sorting each mat's groups by age progression
    matBuckets.forEach(bucket => {
      bucket.groups.sort((a, b) => compareCategoryNames(a.categoryName, b.categoryName));
      bucket.groups.forEach(group => {
        group.pools.forEach(pool => {
          schedule[pool.id] = {
            matId: bucket.matId,
            day: bucket.day,
            order: getNextOrder(bucket.day, bucket.matId),
            estTime: pool.estTime
          };
        });
      });
    });

  } else if (strategy === 'dedicated_age_mats') {
    // Dedicated age mats: Mat 1 youngest, Mat 2 older...
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
    // sequential_fill
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

interface DroppableColumnProps {
  id: string;
  title: string;
  pools: any[];
  totalTime?: number;
  matsCount: number;
  tournamentDays: number;
  categoryPoolCounts: Record<string, number>;
  categoryLocations: Record<string, { isSplit: boolean; day: number; matId: number }>;
  onMoveCategory: (categoryId: string, targetKey: string) => void;
  onOpenDetails: (pool: any) => void;
}

function DroppableColumn({ 
  id, 
  title, 
  pools, 
  totalTime,
  matsCount,
  tournamentDays,
  categoryPoolCounts,
  categoryLocations,
  onMoveCategory,
  onOpenDetails
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'Column',
      columnId: id
    }
  });

  const hours = totalTime ? (totalTime / 60).toFixed(1) : '0';

  return (
    <div 
      ref={setNodeRef}
      style={{ 
        background: isOver ? '#f0fdf4' : 'var(--neutral-50)', 
        borderRadius: '12px', 
        border: isOver ? '2px dashed #16a34a' : '1px solid var(--neutral-200)', 
        display: 'flex', 
        flexDirection: 'column', 
        height: '540px',
        transition: 'background 0.15s ease, border-color 0.15s ease'
      }}
    >
      <div style={{ padding: '12px', borderBottom: '1px solid var(--neutral-200)', background: 'var(--shiro)', borderRadius: '12px 12px 0 0' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: '#171717' }}>{title}</h4>
        {totalTime !== undefined && (
          <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '4px' }}>
            {pools.length} pool{pools.length !== 1 ? 's' : ''} • {totalTime} mins (~{hours} hrs)
          </div>
        )}
      </div>
      <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
        <SortableContext items={pools.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {pools.map((pool, idx) => {
            const catId = pool.categoryId || pool.id.split('_pool_')[0];
            return (
              <SortablePoolCard 
                key={pool.id} 
                id={pool.id} 
                pool={pool} 
                orderNum={idx + 1}
                matsCount={matsCount}
                tournamentDays={tournamentDays}
                categoryPoolCount={categoryPoolCounts[catId] || 1}
                categoryLocation={categoryLocations[catId]}
                onMoveCategory={onMoveCategory}
                onOpenDetails={onOpenDetails}
              />
            );
          })}
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
  const [autoAssignStrategy, setAutoAssignStrategy] = useState<AutoAssignStrategy>('balanced_finish');
  const [selectedPoolForDetails, setSelectedPoolForDetails] = useState<any | null>(null);

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
          const poolCount = Math.max(1, Math.ceil(athleteCount / catPoolSize));
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
              baseCategoryName: cat.name,
              poolNumber: p,
              poolLabel: `Pool ${p}`,
              totalPoolsInCategory: poolCount,
              athletesCount: entriesInPool,
              matchesCount: matchesInPool,
              estTime,
              isKata: Boolean(cat.isKata),
              matchTime: mTime,
              restTime: rTime,
              medicalTime: medTime,
              bunkaiTime: bTime,
              athletes: Array.isArray(cat.athletes) ? cat.athletes.slice((p - 1) * entriesInPool, p * entriesInPool) : []
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
            
            // If all or most pools are unscheduled, compute fresh balanced schedule
            if (Object.keys(next).length === 0 || Object.values(next).every((v: any) => v.matId === -1)) {
              const freshSchedule = computeAutoSchedule(generatedPools, matsCount, tournamentDays, 'balanced_finish');
              Object.assign(next, freshSchedule);
            } else {
              // Append new pools using balanced order
              const appendSchedule = computeAutoSchedule(newPools, matsCount, tournamentDays, 'balanced_finish');
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
    const unassigned = filteredPools.filter(p => !poolsSchedule[p.id] || poolsSchedule[p.id].matId === -1)
      .sort((a,b) => (poolsSchedule[a.id]?.order || 0) - (poolsSchedule[b.id]?.order || 0));
    
    return [
      { id: 'unassigned', title: 'Unassigned Pools', pools: unassigned, totalTime: 0 },
      ...Array.from({ length: matsCount }).map((_, i) => {
        const matNum = i + 1;
        const matPools = filteredPools.filter(p => poolsSchedule[p.id]?.day === activeDay && poolsSchedule[p.id]?.matId === matNum)
          .sort((a,b) => (poolsSchedule[a.id]?.order || 0) - (poolsSchedule[b.id]?.order || 0));
        const totalTime = matPools.reduce((sum, p) => sum + (poolsSchedule[p.id]?.estTime || 0), 0);
        return { id: `mat-${matNum}`, title: `Mat ${matNum} (Day ${activeDay})`, pools: matPools, totalTime };
      })
    ];
  }, [pools, poolsSchedule, activeDay, matsCount, searchQuery]);

  const categoryPoolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pools.forEach(p => {
      const catId = p.categoryId || p.id.split('_pool_')[0];
      counts[catId] = (counts[catId] || 0) + 1;
    });
    return counts;
  }, [pools]);

  const categoryLocations = useMemo(() => {
    const locs: Record<string, { isSplit: boolean; day: number; matId: number }> = {};
    pools.forEach(p => {
      const catId = p.categoryId || p.id.split('_pool_')[0];
      const s = poolsSchedule[p.id];
      const day = s?.day ?? -1;
      const matId = s?.matId ?? -1;
      if (!locs[catId]) {
        locs[catId] = { isSplit: false, day, matId };
      } else {
        if (locs[catId].day !== day || locs[catId].matId !== matId) {
          locs[catId].isSplit = true;
        }
      }
    });
    return locs;
  }, [pools, poolsSchedule]);

  const handleMoveCategory = (categoryId: string, targetKey: string) => {
    let targetDay = -1;
    let targetMatId = -1;
    if (targetKey !== 'unassigned') {
      const parts = targetKey.split('-');
      targetDay = parseInt(parts[1], 10);
      targetMatId = parseInt(parts[2], 10);
    }

    const catPools = pools.filter(p => {
      const pCatId = p.categoryId || p.id.split('_pool_')[0];
      return pCatId === categoryId || p.id.startsWith(categoryId);
    });

    if (catPools.length === 0) return;

    const baseCatName = catPools[0].baseCategoryName || catPools[0].categoryName.replace(/\s*-\s*Pool\s*\d+/i, '').trim();

    const sortedCatPools = [...catPools].sort((a, b) => {
      const numA = a.poolNumber ?? (parseInt(a.id.split('_pool_')[1], 10) || 0);
      const numB = b.poolNumber ?? (parseInt(b.id.split('_pool_')[1], 10) || 0);
      return numA - numB;
    });

    const catPoolIds = new Set(sortedCatPools.map(p => p.id));

    setPoolsSchedule(prev => {
      const next = { ...prev };

      if (targetMatId === -1) {
        let maxOrder = Object.values(next)
          .filter(p => p.matId === -1)
          .reduce((max, p) => Math.max(max, p.order || 0), 0);

        sortedCatPools.forEach(p => {
          maxOrder += 1;
          next[p.id] = {
            matId: -1,
            day: -1,
            order: maxOrder,
            estTime: p.estTime
          };
        });
      } else {
        const existingOnTarget = Object.entries(next)
          .filter(([id, val]) => val.day === targetDay && val.matId === targetMatId && !catPoolIds.has(id));

        let maxOrder = existingOnTarget.reduce((max, [_, val]) => Math.max(max, val.order || 0), -1);

        sortedCatPools.forEach(p => {
          maxOrder += 1;
          next[p.id] = {
            matId: targetMatId,
            day: targetDay,
            order: maxOrder,
            estTime: p.estTime
          };
        });
      }

      return next;
    });

    if (targetDay > 0 && targetDay !== activeDay) {
      setActiveDay(targetDay);
    }

    if (targetMatId === -1) {
      toast.success(`Moved all ${catPools.length} pool(s) of "${baseCatName}" to Unassigned`);
    } else {
      const daySuffix = tournamentDays > 1 ? ` (Day ${targetDay})` : '';
      toast.success(`Moved all ${catPools.length} pool(s) of "${baseCatName}" to Mat ${targetMatId}${daySuffix}`);
    }
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Detect destination container
    let destMatId: number | null = null;
    let destDay: number | null = null;

    if (overId === 'unassigned') {
      destMatId = -1;
      destDay = -1;
    } else if (overId.startsWith('mat-')) {
      destMatId = parseInt(overId.split('-')[1], 10);
      destDay = activeDay;
    } else {
      const overSched = poolsSchedule[overId];
      if (overSched) {
        destMatId = overSched.matId;
        destDay = overSched.day;
      }
    }

    if (destMatId === null || destDay === null) return;

    const currentSched = poolsSchedule[activeId];
    if (!currentSched) return;

    // Only update container if card moved across columns
    if (currentSched.matId !== destMatId || currentSched.day !== destDay) {
      setPoolsSchedule(prev => {
        const next = { ...prev };
        const destItems = Object.values(next).filter(p => p.matId === destMatId && p.day === destDay);
        const maxOrder = destItems.reduce((max, p) => Math.max(max, p.order || 0), -1);
        next[activeId] = {
          ...next[activeId],
          matId: destMatId!,
          day: destDay!,
          order: maxOrder + 1
        };
        return next;
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setPoolsSchedule(prev => {
      const next = { ...prev };
      const currentActive = next[activeId];
      if (!currentActive) return prev;

      let targetMatId = currentActive.matId;
      let targetDay = currentActive.day;

      if (overId === 'unassigned') {
        targetMatId = -1;
        targetDay = -1;
      } else if (overId.startsWith('mat-')) {
        targetMatId = parseInt(overId.split('-')[1], 10);
        targetDay = activeDay;
      } else if (next[overId]) {
        targetMatId = next[overId].matId;
        targetDay = next[overId].day;
      }

      // Collect target mat pools in order
      const targetList = Object.entries(next)
        .filter(([id, val]) => val.matId === targetMatId && val.day === targetDay && id !== activeId)
        .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
        .map(([id]) => id);

      let insertIdx = targetList.length; // default bottom
      if (next[overId] && overId !== activeId && next[overId].matId === targetMatId && next[overId].day === targetDay) {
        const overIdx = targetList.indexOf(overId);
        if (overIdx !== -1) {
          insertIdx = overIdx;
        }
      }

      // Insert activeId into target list
      targetList.splice(insertIdx, 0, activeId);

      // Re-index target column
      targetList.forEach((id, idx) => {
        next[id] = {
          ...next[id],
          matId: targetMatId,
          day: targetDay,
          order: idx
        };
      });

      // If moved from another column, re-index source column
      if (currentActive.matId !== targetMatId || currentActive.day !== targetDay) {
        const sourceList = Object.entries(next)
          .filter(([id, val]) => val.matId === currentActive.matId && val.day === currentActive.day && id !== activeId)
          .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
          .map(([id]) => id);

        sourceList.forEach((id, idx) => {
          next[id] = {
            ...next[id],
            order: idx
          };
        });
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
      balanced_finish: 'Balanced Finish (Equal mat finish times)',
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
            Auto-balance finishing times across all mats, or drag individual pools and categories freely.
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
            <option value="balanced_finish">Balanced Finish (All mats finish at the same time)</option>
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
            <DroppableColumn 
              key={col.id} 
              id={col.id} 
              title={col.title} 
              pools={col.pools} 
              totalTime={col.totalTime}
              matsCount={matsCount}
              tournamentDays={tournamentDays}
              categoryPoolCounts={categoryPoolCounts}
              categoryLocations={categoryLocations}
              onMoveCategory={handleMoveCategory}
              onOpenDetails={(p) => setSelectedPoolForDetails(p)}
            />
          ))}
        </div>
        
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activePool ? (
            <SortablePoolCard 
              id={activePool.id} 
              pool={activePool} 
              categoryPoolCount={categoryPoolCounts[activePool.categoryId || activePool.id.split('_pool_')[0]] || 1}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Pool Details Modal */}
      {selectedPoolForDetails && (
        <div 
          onClick={() => setSelectedPoolForDetails(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--neutral-200)',
              position: 'relative'
            }}
          >
            <button 
              onClick={() => setSelectedPoolForDetails(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--neutral-400)',
                padding: '4px',
                display: 'flex',
                borderRadius: '6px'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                padding: '2px 8px', 
                borderRadius: '6px', 
                background: selectedPoolForDetails.isKata ? '#eff6ff' : '#fff1f2', 
                color: selectedPoolForDetails.isKata ? '#1d4ed8' : '#be123c',
                letterSpacing: '0.04em'
              }}>
                {selectedPoolForDetails.isKata ? 'KATA' : 'KUMITE'}
              </span>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                padding: '2px 8px', 
                borderRadius: '6px', 
                background: '#f3f4f6', 
                color: '#374151',
                letterSpacing: '0.04em'
              }}>
                POOL {selectedPoolForDetails.poolNumber} OF {selectedPoolForDetails.totalPoolsInCategory || 1}
              </span>
            </div>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#171717', lineHeight: '1.3' }}>
              {selectedPoolForDetails.categoryName}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neutral-500)', fontSize: '12px', marginBottom: '4px' }}>
                  <Users size={14} />
                  <span>Athletes in Pool</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#171717' }}>
                  {selectedPoolForDetails.athletesCount ?? 'N/A'}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neutral-500)', fontSize: '12px', marginBottom: '4px' }}>
                  <Swords size={14} />
                  <span>Matches</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#171717' }}>
                  {selectedPoolForDetails.matchesCount ?? 0}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neutral-500)', fontSize: '12px', marginBottom: '4px' }}>
                  <Clock size={14} />
                  <span>Est. Duration</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#171717' }}>
                  {selectedPoolForDetails.estTime} mins
                </div>
              </div>

              <div style={{ padding: '12px', background: 'var(--neutral-50)', borderRadius: '8px', border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neutral-500)', fontSize: '12px', marginBottom: '4px' }}>
                  <Calendar size={14} />
                  <span>Current Mat</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#171717' }}>
                  {poolsSchedule[selectedPoolForDetails.id]?.matId > 0 
                    ? `Mat ${poolsSchedule[selectedPoolForDetails.id].matId} (Day ${poolsSchedule[selectedPoolForDetails.id].day})`
                    : 'Unassigned'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedPoolForDetails(null)}
                style={{ fontSize: '13px', padding: '6px 16px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
