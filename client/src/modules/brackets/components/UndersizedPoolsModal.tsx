import React, { useState, useMemo } from 'react';
import { X, Combine, Trash2, AlertTriangle } from 'lucide-react';
import { db } from '@lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

// We must import buildSingleElimination dynamically if it's a server/client hybrid, 
// but since this is a client component, we can import it statically if it's safe.
// To be safe, we'll fetch it via an API call OR import it if it's isomorphic.
// tiesheet-generator is in lib, which is isomorphic.
import { buildSingleElimination } from '@taikaix/backend/services/tiesheet/generator';

interface UndersizedPoolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  compId: string;
  poolSize: number;
  categories: any[];
  onCategoriesUpdated: (cats: any[]) => void;
}

export default function UndersizedPoolsModal({ isOpen, onClose, compId, poolSize, categories, onCategoriesUpdated }: UndersizedPoolsModalProps) {
  const [processing, setProcessing] = useState(false);

  // Group athletes by pool for each category by analyzing matches
  const undersizedData = useMemo(() => {
    const data: any[] = [];
    categories.forEach(cat => {
      if (!cat.matches || cat.matches.length === 0) return;
      
      const poolCounts = new Map<string, Set<string>>();
      cat.matches.forEach((m: any) => {
        let pool = 'Pool 1';
        if (m.id && m.id.includes('Pool')) {
          pool = m.id.split('-')[0].replace('Pool', 'Pool ');
        }
        if (!poolCounts.has(pool)) poolCounts.set(pool, new Set());
        if (m.aka?.playerId) poolCounts.get(pool)!.add(m.aka.playerId);
        if (m.ao?.playerId) poolCounts.get(pool)!.add(m.ao.playerId);
      });

      const allPools = Array.from(poolCounts.keys());
      
      Array.from(poolCounts.entries()).forEach(([pool, athletesSet]) => {
        if (athletesSet.size > 0 && athletesSet.size < 4) {
          data.push({
            categoryId: cat.id,
            categoryName: cat.name,
            pool,
            count: athletesSet.size,
            availableTargets: allPools.filter(p => p !== pool)
          });
        }
      });
    });
    return data;
  }, [categories]);

  if (!isOpen) return null;

  const handleMerge = async (categoryId: string, sourcePool: string, targetPool: string) => {
    if (!targetPool) {
      toast.error("Please select a target pool");
      return;
    }
    setProcessing(true);
    try {
      const catRef = doc(db, 'competitions', compId, 'categories', categoryId);
      const catSnap = await getDoc(catRef);
      if (!catSnap.exists()) throw new Error("Category not found");
      
      const catData = catSnap.data();
      const athletes = catData.athletes || [];
      const matches = catData.matches || [];

      // We need to move athletes from sourcePool to targetPool.
      // Since athletes don't have a pool attribute, we find them by looking at matches.
      const sourcePoolPrefix = sourcePool.replace(' ', '');
      const targetPoolPrefix = targetPool.replace(' ', '');
      
      const sourceAthleteIds = new Set<string>();
      matches.forEach((m: any) => {
        const p = m.id.includes('Pool') ? m.id.split('-')[0] : 'Pool1';
        if (p === sourcePoolPrefix) {
          if (m.aka?.playerId) sourceAthleteIds.add(m.aka.playerId);
          if (m.ao?.playerId) sourceAthleteIds.add(m.ao.playerId);
        }
      });

      const targetAthleteIds = new Set<string>();
      matches.forEach((m: any) => {
        const p = m.id.includes('Pool') ? m.id.split('-')[0] : 'Pool1';
        if (p === targetPoolPrefix) {
          if (m.aka?.playerId) targetAthleteIds.add(m.aka.playerId);
          if (m.ao?.playerId) targetAthleteIds.add(m.ao.playerId);
        }
      });

      // Combine athletes from both pools
      const combinedAthletes = athletes.filter((a: any) => 
        sourceAthleteIds.has(a.playerId) || targetAthleteIds.has(a.playerId)
      );
      
      // Keep matches from other pools intact
      const otherMatches = matches.filter((m: any) => {
        const p = m.id.includes('Pool') ? m.id.split('-')[0] : 'Pool1';
        return p !== sourcePoolPrefix && p !== targetPoolPrefix;
      });
      
      // Build new matches for target pool
      const newTargetMatches = buildSingleElimination(combinedAthletes, 'international', poolSize as 4|8|16|32);

      // Re-label match IDs with targetPoolPrefix
      const finalTargetMatches = newTargetMatches.map((m: any) => ({
        ...m,
        id: `${targetPoolPrefix}-${m.id}`,
        akaFromMatchId: m.akaFromMatchId ? `${targetPoolPrefix}-${m.akaFromMatchId}` : null,
        aoFromMatchId: m.aoFromMatchId ? `${targetPoolPrefix}-${m.aoFromMatchId}` : null,
        nextMatchId: m.nextMatchId ? `${targetPoolPrefix}-${m.nextMatchId}` : null
      }));

      const finalMatches = [...otherMatches, ...finalTargetMatches];

      await updateDoc(catRef, {
        matches: finalMatches
      });

      // Update local state
      const newCats = categories.map(c => 
        c.id === categoryId ? { ...c, matches: finalMatches } : c
      );
      onCategoriesUpdated(newCats);
      toast.success(`Merged ${sourcePool} into ${targetPool}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to merge pools");
    } finally {
      setProcessing(false);
    }
  };

  const handleDiscard = async (categoryId: string, sourcePool: string) => {
    if (!window.confirm(`Are you sure you want to discard ${sourcePool}? Athletes in this pool will be removed from the bracket.`)) return;
    
    setProcessing(true);
    try {
      const catRef = doc(db, 'competitions', compId, 'categories', categoryId);
      const catSnap = await getDoc(catRef);
      if (!catSnap.exists()) throw new Error("Category not found");
      
      const catData = catSnap.data();
      const athletes = catData.athletes || [];
      const matches = catData.matches || [];

      // Remove matches in sourcePool
      const sourcePoolPrefix = sourcePool.replace(' ', '');
      const updatedMatches = matches.filter((m: any) => {
        const p = m.id.includes('Pool') ? m.id.split('-')[0] : 'Pool1';
        return p !== sourcePoolPrefix;
      });

      await updateDoc(catRef, {
        matches: updatedMatches
      });

      // Update local state
      const newCats = categories.map(c => 
        c.id === categoryId ? { ...c, matches: updatedMatches } : c
      );
      onCategoriesUpdated(newCats);
      toast.success(`Discarded ${sourcePool}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to discard pool");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <button type="button" className="modal-close" onClick={onClose}><X size={20} /></button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={24} color="#f59e0b" /> Manage Undersized Pools
        </h2>
        <p className="text-small" style={{ marginBottom: 'var(--space-4)' }}>
          The following pools have fewer than 4 athletes. You can merge them into another pool in the same category, or discard them.
        </p>

        {undersizedData.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--neutral-50)', borderRadius: '8px' }}>
            <p style={{ color: 'var(--neutral-500)', margin: 0 }}>All pools are appropriately sized! (≥ 4 athletes)</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {undersizedData.map((data, idx) => (
              <div key={idx} style={{ padding: '16px', background: 'var(--shiro)', border: '1px solid var(--neutral-200)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0 }}>{data.categoryName}</h4>
                  <span className="status-chip status-live" style={{ background: '#fef3c7', color: '#b45309' }}>
                    {data.count} Athletes
                  </span>
                </div>
                <p className="text-small" style={{ margin: '0 0 16px 0', color: 'var(--neutral-500)' }}>
                  <strong>{data.pool}</strong> is undersized.
                </p>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    className="input-field" 
                    style={{ marginBottom: 0, flex: 1 }}
                    id={`merge-target-${idx}`}
                  >
                    <option value="">-- Select Target Pool --</option>
                    {data.availableTargets.map((t: string) => (
                      <option key={t} value={t}>Merge into {t}</option>
                    ))}
                  </select>
                  <button type="button" 
                    className="btn btn-primary" 
                    disabled={processing || data.availableTargets.length === 0}
                    onClick={() => {
                      const sel = document.getElementById(`merge-target-${idx}`) as HTMLSelectElement;
                      if (sel) handleMerge(data.categoryId, data.pool, sel.value);
                    }}
                  >
                    <Combine size={16} /> Merge
                  </button>
                  <button type="button" 
                    className="btn btn-ghost" 
                    style={{ color: 'var(--aka)' }}
                    disabled={processing}
                    onClick={() => handleDiscard(data.categoryId, data.pool)}
                  >
                    <Trash2 size={16} /> Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
