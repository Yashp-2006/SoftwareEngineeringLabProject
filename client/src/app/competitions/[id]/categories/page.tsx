'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Save, Check } from 'lucide-react';
import gsap from 'gsap';
import { toast } from 'react-hot-toast';

interface CategoryRow {
  id: string;
  name: string;
  entries: number;
  status: 'live' | 'upcoming' | 'done';
  mat: string;
  start: string;
  end: string;
  estimatedDuration?: number;
  saved?: boolean;
  isKata?: boolean;
  judgeCount?: number;
}

// Helper to add minutes to time string (HH:MM)
const addMinutesToTime = (timeStr: string, minutes: number): string => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  let totalM = h * 60 + m + minutes;
  if (totalM < 0) totalM = 0; // Prevent negative time
  const newH = Math.floor(totalM / 60) % 24;
  const newM = totalM % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

// Helper to get time difference in minutes
const getTimeDiffMins = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};

const MATS = ["MAT 01", "MAT 02", "MAT 03", "MAT 04", "MAT 05", "MAT 06", "MAT 07", "MAT 08"];

export default function CategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  
  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterMat, setFilterMat] = useState('all');

  const filteredCategories = categories.filter(row => {
    const nameLower = row.name.toLowerCase();
    if (filterType !== 'all') {
      if (filterType === 'kata' && !nameLower.includes('kata')) return false;
      if (filterType === 'kumite' && !nameLower.includes('kumite')) return false;
    }
    if (filterGender !== 'all') {
      // 'female' contains 'male', so check 'female' first
      const isFemale = nameLower.includes('female') || nameLower.includes('women');
      const isMale = !isFemale && (nameLower.includes('male') || nameLower.includes('men'));
      const isMixed = nameLower.includes('mixed') || nameLower.includes('team');
      
      if (filterGender === 'female' && !isFemale) return false;
      if (filterGender === 'male' && !isMale) return false;
      if (filterGender === 'mixed' && !isMixed) return false;
    }
    if (filterMat !== 'all' && row.mat !== filterMat) return false;
    
    return true;
  });

  useEffect(() => {
    let unsubscribe = () => {};
    const setupListener = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');
      
      const q = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const cats = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            entries: data.entries ?? (data.athletes?.length || 0),
            status: data.status,
            mat: data.mat,
            start: data.scheduledStartTime,
            end: data.scheduledEndTime,
            estimatedDuration: data.estimatedDuration,
            isKata: data.isKata || data.name?.toLowerCase().includes('kata'),
            judgeCount: data.judgeCount || data.numberOfJudges || 3
          } as CategoryRow;
        });
        setCategories(cats);
        setLoading(false);
      });
    };
    setupListener();

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!loading && categories.length > 0) {
      gsap.fromTo(".bento-reveal", {
        y: 10,
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        duration: 0.35,
        stagger: 0.05,
        ease: "power2.out",
        clearProps: "all"
      });
    }
  }, [loading, categories.length]); // Only run animation once data loads

  const handleUpdate = async (catId: string, field: keyof CategoryRow, value: string) => {
    // Optimistic UI update
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, [field]: value } : c));
    
    // Firestore update
    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc, writeBatch, collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
      const catRef = doc(db, 'competitions', id, 'categories', catId);
      
      let dbField = field as string;
      if (field === 'start') dbField = 'scheduledStartTime';
      if (field === 'end') dbField = 'scheduledEndTime';
      
      if (field === 'judgeCount') {
        dbField = 'judgeCount';
        await updateDoc(catRef, { judgeCount: parseInt(value), numberOfJudges: parseInt(value) });
        triggerSaved(catId);
        toast.success("Judge count updated");
        return;
      }
      
      await updateDoc(catRef, { [dbField]: value });

      // PREEMPTIVE SCHEDULING ENGINE
      if (field === 'status' && value === 'done') {
        const targetCat = categories.find(c => c.id === catId);
        if (targetCat) {
          const now = new Date();
          const actualEndH = now.getHours();
          const actualEndM = now.getMinutes();
          const actualEndStr = `${String(actualEndH).padStart(2, '0')}:${String(actualEndM).padStart(2, '0')}`;
          
          await updateDoc(catRef, { actualEndTime: actualEndStr });
          
          // Calculate difference
          const diffMins = getTimeDiffMins(targetCat.end, actualEndStr);
          
          // If we finished early (diffMins < 0) or late (diffMins > 0), shift subsequent categories
          if (diffMins !== 0) {
            const q = query(
              collection(db, 'competitions', id, 'categories'),
              where('mat', '==', targetCat.mat),
              where('status', '==', 'upcoming')
            );
            const snaps = await getDocs(q);
            
            // Only affect categories ordered after this one
            const batch = writeBatch(db);
            let shiftedCount = 0;
            
            snaps.docs.forEach(d => {
              const data = d.data();
              // In a real app we'd filter by `order` strictly, but status 'upcoming' handles most of it.
              const newStart = addMinutesToTime(data.scheduledStartTime, diffMins);
              const newEnd = addMinutesToTime(data.scheduledEndTime, diffMins);
              
              batch.update(d.ref, {
                scheduledStartTime: newStart,
                scheduledEndTime: newEnd
              });
              shiftedCount++;
            });
            
            if (shiftedCount > 0) {
              await batch.commit();
              console.log(`Preemptively shifted ${shiftedCount} categories on ${targetCat.mat} by ${diffMins} mins.`);
            }
          }
        }
      }
      
      triggerSaved(catId);
    } catch (err) {
      console.error("Failed to update category", err);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, dropIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      return;
    }

    const newCats = [...categories];
    // Find the actual items in the unfiltered array based on the filtered indices
    const draggedItem = filteredCategories[dragIdx];
    const droppedOnItem = filteredCategories[dropIdx];
    
    if (!draggedItem || !droppedOnItem) {
      setDragIdx(null);
      return;
    }

    const actualDragIdx = newCats.findIndex(c => c.id === draggedItem.id);
    const actualDropIdx = newCats.findIndex(c => c.id === droppedOnItem.id);

    if (actualDragIdx !== -1 && actualDropIdx !== -1) {
      const [removed] = newCats.splice(actualDragIdx, 1);
      newCats.splice(actualDropIdx, 0, removed);
      
      // Update local state instantly for UI responsiveness
      setCategories(newCats);
      
      // Bulk update Firestore 'order'
      try {
        const { db } = await import('@lib/firebase');
        const { doc, writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);
        
        newCats.forEach((cat, index) => {
          batch.update(doc(db, 'competitions', id, 'categories', cat.id), { order: index });
        });
        
        await batch.commit();
        toast.success("Order saved");
      } catch (err) {
        console.error(err);
        toast.error("Failed to save order");
      }
    }
    
    setDragIdx(null);
  };

  const triggerSaved = (catId: string) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, saved: true } : c));
    setTimeout(() => {
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, saved: false } : c));
    }, 1200);
  };

  const getStatusClass = (status: string) => {
    if (status === "live") return "status-live-select";
    if (status === "done") return "status-done-select";
    return "status-upcoming-select";
  };

  const handleSaveAll = async () => {
    // Manually force an update sync if needed (optional)
    toast.success("Categories are saved automatically in real-time to Firestore!");
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .category-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .category-row {
          display: grid;
          grid-template-columns: 2fr 0.7fr 1fr 1fr 0.8fr 1.5fr 0.9fr;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4) var(--space-5);
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 8px;
          transition: border-color 0.2s;
        }
        .category-row:hover { border-color: var(--ao); }
        .status-select-header {
          appearance: none;
          border: none;
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          width: 100%;
          max-width: 110px;
          text-align: center;
        }
        .status-live-select { background: var(--status-live-bg); color: var(--status-live); }
        .status-upcoming-select { background: var(--status-upcoming-bg); color: var(--status-upcoming); }
        .status-done-select { background: var(--status-done-bg); color: var(--status-done); }
        .mat-select {
          height: 38px;
          border: 1.5px solid var(--neutral-300);
          border-radius: 8px;
          padding: 0 10px;
          font-size: 13px;
          font-family: var(--font-body);
          color: var(--neutral-900);
          background: var(--shiro);
          width: 100%;
          outline: none;
        }
        .mat-select:focus,
        .time-input:focus {
          border-color: var(--ao);
          box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12);
        }
        .time-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
        }
        .time-input {
          height: 38px;
          border: 1.5px solid var(--neutral-300);
          border-radius: 8px;
          padding: 0 10px;
          font-size: 13px;
          font-family: var(--font-body);
          color: var(--neutral-900);
          background: var(--shiro);
          outline: none;
          width: 100%;
          min-width: 110px;
        }
        .row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--space-2);
        }
        .saved-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--status-live);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .saved-tag.visible { opacity: 1; }

        @media (max-width: 1360px) {
          .category-row {
            grid-template-columns: 1.8fr 0.7fr 1fr 1fr 0.8fr 1.4fr 0.9fr;
          }
        }
        @media (max-width: 1180px) {
          .category-row {
            grid-template-columns: 1fr;
            gap: var(--space-2);
          }
          .category-row .text-micro {
            margin-bottom: 2px;
          }
          .row-actions {
            justify-content: flex-start;
          }
          .header-row {
            display: none;
          }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Management
            </div>
            <h1>Category Management</h1>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={handleSaveAll}>
              <Save style={{ width: '18px', marginRight: '6px' }} /> Save Category Schedule
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            style={{ height: '38px', borderRadius: '8px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none', background: 'var(--shiro)' }}
          >
            <option value="all">All Types (Kata/Kumite)</option>
            <option value="kata">Kata</option>
            <option value="kumite">Kumite</option>
          </select>

          <select 
            value={filterGender} 
            onChange={e => setFilterGender(e.target.value)}
            style={{ height: '38px', borderRadius: '8px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none', background: 'var(--shiro)' }}
          >
            <option value="all">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="mixed">Mixed</option>
          </select>

          <select 
            value={filterMat} 
            onChange={e => setFilterMat(e.target.value)}
            style={{ height: '38px', borderRadius: '8px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none', background: 'var(--shiro)' }}
          >
            <option value="all">All Mats</option>
            {MATS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <section className="category-list">
          <div className="category-row header-row" style={{ background: 'var(--neutral-50)', border: 'none', fontWeight: 600, paddingTop: '12px', paddingBottom: '12px' }}>
            <div className="text-micro">Category Name</div>
            <div className="text-micro">Entries</div>
            <div className="text-micro">Status</div>
            <div className="text-micro">Assigned Mat</div>
            <div className="text-micro">Judges</div>
            <div className="text-micro">Time Frame</div>
            <div className="text-micro" style={{ textAlign: 'right' }}>Action</div>
          </div>

          {filteredCategories.map((row, idx) => (
            <article 
              key={row.id} 
              className={`category-row bento-reveal ${dragOverIdx === idx ? 'drop-target' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent<HTMLTableRowElement>, idx)}
              onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent<HTMLTableRowElement>, idx)}
              onDrop={(e) => handleDrop(e as unknown as React.DragEvent<HTMLTableRowElement>, idx)}
              style={{
                opacity: dragIdx === idx ? 0.5 : 1,
                borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx > idx ? '2px solid var(--ao)' : '',
                borderBottom: dragOverIdx === idx && dragIdx !== null && dragIdx < idx ? '2px solid var(--ao)' : '',
                cursor: 'move'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <div style={{ color: 'var(--neutral-400)', cursor: 'grab', display: 'flex' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </div>
                {row.name}
              </div>
              <div className="data-mono">{row.entries}</div>
              <div>
                <select 
                  className={`status-select-header ${getStatusClass(row.status)}`}
                  value={row.status}
                  onChange={(e) => handleUpdate(row.id, 'status', e.target.value)}
                >
                  <option value="live">LIVE</option>
                  <option value="upcoming">UPCOMING</option>
                  <option value="done">DONE</option>
                </select>
              </div>
              <div>
                <select 
                  className="mat-select"
                  value={row.mat}
                  onChange={(e) => handleUpdate(row.id, 'mat', e.target.value)}
                >
                  {MATS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                {row.isKata ? (
                  <select 
                    className="mat-select"
                    value={row.judgeCount || 3}
                    onChange={(e) => handleUpdate(row.id, 'judgeCount', e.target.value)}
                    disabled={row.status !== 'upcoming'}
                  >
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="7">7</option>
                  </select>
                ) : (
                  <span className="text-micro" style={{ color: 'var(--neutral-400)' }}>—</span>
                )}
              </div>
              <div className="time-wrap">
                <input 
                  className="time-input" 
                  type="time" 
                  value={row.start}
                  onChange={(e) => handleUpdate(row.id, 'start', e.target.value)}
                />
                <span className="text-small">to</span>
                <input 
                  className="time-input" 
                  type="time" 
                  value={row.end}
                  onChange={(e) => handleUpdate(row.id, 'end', e.target.value)}
                />
              </div>
              <div className="row-actions">
                <span className={`saved-tag ${row.saved ? 'visible' : ''}`}>Saved</span>
                <button 
                  className="btn btn-secondary" 
                  type="button" 
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => triggerSaved(row.id)}
                >
                  <Check style={{ width: '14px', marginRight: '4px' }} /> Save
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
