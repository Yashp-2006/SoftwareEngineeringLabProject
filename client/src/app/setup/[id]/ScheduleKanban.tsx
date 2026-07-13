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
import { collection, getDocs } from 'firebase/firestore';
import { GripVertical } from 'lucide-react';

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
}

function SortablePoolCard({ pool, id }: { pool: any, id: string }) {
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
    gap: '8px',
    alignItems: 'center'
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GripVertical size={16} color="var(--neutral-400)" />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>{pool.categoryName}</div>
        <div style={{ fontSize: '11px', color: 'var(--neutral-500)' }}>
          {pool.matchesCount} matches • Est. {pool.estTime} mins
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ id, title, pools, totalTime }: { id: string, title: string, pools: any[], totalTime?: number }) {
  const { setNodeRef } = useSortable({
    id,
    data: {
      type: 'Column',
    }
  });

  return (
    <div style={{ background: 'var(--neutral-50)', borderRadius: '12px', border: '1px solid var(--neutral-200)', display: 'flex', flexDirection: 'column', height: '500px' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--neutral-200)', background: 'var(--shiro)', borderRadius: '12px 12px 0 0' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: '#171717' }}>{title}</h4>
        {totalTime !== undefined && (
          <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '4px' }}>Total: {totalTime} mins</div>
        )}
      </div>
      <div ref={setNodeRef} style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
        <SortableContext items={pools.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {pools.map(pool => (
            <SortablePoolCard key={pool.id} id={pool.id} pool={pool} />
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
  compId, tournamentDays, matsCount, globalMatchTime, globalRestTime, globalMedicalTime, globalBunkaiTime, poolsSchedule, setPoolsSchedule, importResult
}: ScheduleKanbanProps) {
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    async function fetchPools() {
      try {
        const snap = await getDocs(collection(db, 'competitions', compId, 'categories'));
        const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const generatedPools: any[] = [];
        cats.forEach(cat => {
          const athleteCount = cat.athletes?.length || cat.entries || 0;
          if (athleteCount === 0) return;
          
          let matchCount = cat.matches?.length;
          if (!matchCount) matchCount = Math.max(0, athleteCount - 1);
          if (cat.isKata) matchCount = athleteCount; 
          
          const mTime = cat.matchTime ?? globalMatchTime;
          const rTime = cat.restTime ?? globalRestTime;
          const medTime = cat.medicalTime ?? globalMedicalTime;
          const bTime = cat.bunkaiTime ?? globalBunkaiTime;
          
          const estTime = Math.ceil((mTime + rTime) * matchCount + medTime + bTime);
          
          generatedPools.push({
            id: cat.id, 
            categoryName: cat.name,
            matchesCount: matchCount,
            estTime,
          });
        });
        
        setPools(generatedPools);
        
        setPoolsSchedule(prev => {
          const next = { ...prev };
          let changed = false;
          generatedPools.forEach(p => {
            if (!next[p.id]) {
              next[p.id] = { matId: -1, day: -1, order: 0, estTime: p.estTime };
              changed = true;
            } else if (next[p.id].estTime !== p.estTime) {
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
  }, [compId, importResult, globalMatchTime, globalRestTime, globalMedicalTime, globalBunkaiTime, setPoolsSchedule]);

  const columns = useMemo(() => {
    const unassigned = pools.filter(p => !poolsSchedule[p.id] || poolsSchedule[p.id].matId === -1).sort((a,b) => (poolsSchedule[a.id]?.order || 0) - (poolsSchedule[b.id]?.order || 0));
    
    const matColumns = Array.from({ length: matsCount }).map((_, i) => {
      const matPools = pools.filter(p => poolsSchedule[p.id]?.day === activeDay && poolsSchedule[p.id]?.matId === (i + 1))
        .sort((a,b) => poolsSchedule[a.id].order - poolsSchedule[b.id].order);
      const totalTime = matPools.reduce((sum, p) => sum + poolsSchedule[p.id].estTime, 0);
      return { id: `mat-${i + 1}`, title: `Mat ${i + 1}`, pools: matPools, totalTime };
    });
    
    return [
      { id: 'unassigned', title: 'Unassigned', pools: unassigned },
      ...matColumns
    ];
  }, [pools, poolsSchedule, activeDay, matsCount]);

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

  if (loading) return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>Loading pools...</div>;

  const activePool = activeId ? pools.find(p => p.id === activeId) : null;

  return (
    <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', background: 'var(--shiro)', borderRadius: '12px', border: '1px solid var(--neutral-300)' }}>
      <div className="flex-between mb-4">
        <div>
          <h3 style={{ margin: 0 }}>Schedule & Mat Assignment</h3>
          <p className="text-small" style={{ color: 'var(--neutral-500)', marginTop: '4px' }}>Drag and drop generated categories onto mats.</p>
        </div>
      </div>
      
      {tournamentDays > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {Array.from({ length: tournamentDays }).map((_, i) => (
            <button
              key={i}
              type="button"
              className="btn"
              style={{
                background: activeDay === i + 1 ? 'var(--ao)' : 'var(--neutral-100)',
                color: activeDay === i + 1 ? '#fff' : 'var(--neutral-700)',
                fontWeight: 600,
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px'
              }}
              onClick={() => setActiveDay(i + 1)}
            >
              Day {i + 1}
            </button>
          ))}
        </div>
      )}

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'grid', gridTemplateColumns: `260px repeat(${matsCount}, 1fr)`, gap: '16px', alignItems: 'start' }}>
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
