'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Trophy, Zap } from 'lucide-react';
import PageSkeleton from '@/components/layout/PageSkeleton';
import SpecialCategoryModal from '@/components/SpecialCategoryModal';

interface Athlete {
  id: string; // Document ID
  playerId?: string; // Athlete ID from match node
  name: string;
  academy: string;
  medal?: 'received' | 'not-received';
}

interface Category {
  id: string;
  name: string;
  mat: string;
  status: string;
  order: number;
  athletes: Athlete[];
  matches: any[];
}

export default function MedalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Special tiesheet modal state
  const [specialModalOpen, setSpecialModalOpen] = useState(false);
  const [specialCategoriesList, setSpecialCategoriesList] = useState<any[]>([]);

  useEffect(() => {
    let unsubCats: () => void;
    const athleteUnsubs: Record<string, () => void> = {};

    const setup = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');

      const catQ = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubCats = onSnapshot(catQ, (catSnap) => {
        const rawCats = catSnap.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
          };
        });

        // Keep a list of special categories for the modal
        const specials = rawCats.filter(c => c.isSpecial);
        setSpecialCategoriesList(specials);

        const catList = rawCats
          .filter(c => !c.isSpecial && (c.status === 'live' || c.status === 'completed'))
          .map(d => ({
            id: d.id,
            name: d.name || '',
            mat: d.mat || 'UNASSIGNED',
            status: d.status || 'upcoming',
            order: d.order || 0,
            matches: d.matches || [],
            athletes: []
          }))
          .sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return -1;
            if (a.status !== 'completed' && b.status === 'completed') return 1;
            return a.order - b.order;
          });

        setActiveCategoryId(prev => {
          if (prev && catList.some(c => c.id === prev)) return prev;
          return catList[0]?.id ?? null;
        });

        catList.forEach(cat => {
          if (athleteUnsubs[cat.id]) return;

          const athQ = query(collection(db, 'competitions', id, 'categories', cat.id, 'athletes'));
          athleteUnsubs[cat.id] = onSnapshot(athQ, (athSnap) => {
            const athletes: Athlete[] = athSnap.docs.map(d => ({
              id: d.id,
              playerId: d.data().playerId,
              name: d.data().name || '',
              academy: d.data().academy || '',
              medal: d.data().medal,
            }));

            setCategories(prev => {
              const existing = prev.find(c => c.id === cat.id);
              if (existing) {
                return prev.map(c => c.id === cat.id ? { ...c, athletes } : c);
              }
              return [...prev, { ...cat, athletes }];
            });
          });
        });

        setCategories(prev => {
          const updated = catList.map(cat => {
            const existing = prev.find(c => c.id === cat.id);
            return { ...cat, athletes: existing?.athletes ?? [] };
          });
          return updated;
        });

        setLoading(false);
      });
    };

    setup();

    return () => {
      if (unsubCats) unsubCats();
      Object.values(athleteUnsubs).forEach(u => u());
    };
  }, [id]);

  const activeCategory = categories.find(c => c.id === activeCategoryId);

  // Group winners dynamically by pool
  const winnersByPool = React.useMemo(() => {
    if (!activeCategory || !activeCategory.matches) return {};

    const matches = activeCategory.matches;
    const poolMap = new Map<string, any[]>();
    for (const m of matches) {
      let pool = '1';
      if (m.id.startsWith('Pool')) {
        pool = m.id.split('-')[0].replace('Pool', '');
      }
      if (!poolMap.has(pool)) poolMap.set(pool, []);
      poolMap.get(pool)!.push(m);
    }

    const groups: Record<string, (Athlete & { medalName: string })[]> = {};

    for (const [pool, poolMatches] of poolMap.entries()) {
      const maxRound = Math.max(...poolMatches.map(m => m.round));
      const finalsMatches = poolMatches.filter(m => m.round === maxRound);

      const poolWinners: (Athlete & { medalName: string })[] = [];

      for (const finalMatch of finalsMatches) {
        if (finalMatch.status === 'completed' && finalMatch.winnerId) {
          const goldWinnerId = finalMatch.winnerId;
          const goldAthleteDoc = activeCategory.athletes.find(a => a.playerId === goldWinnerId || a.id === goldWinnerId);
          if (goldAthleteDoc) {
            poolWinners.push({ ...goldAthleteDoc, medalName: 'Gold' });
          }
        }
      }

      const poolKey = poolMap.size === 1 && pool === '1' ? 'General' : pool;
      
      const filteredPoolWinners = poolWinners.filter(a => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.academy.toLowerCase().includes(q);
      });

      if (filteredPoolWinners.length > 0) {
        groups[poolKey] = filteredPoolWinners;
      }
    }

    return groups;
  }, [activeCategory, searchQuery]);

  const poolKeys = Object.keys(winnersByPool).sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return parseInt(a) - parseInt(b);
  });

  const totalWinnersCount = poolKeys.reduce((acc, pk) => acc + winnersByPool[pk].length, 0);

  const updateAthleteMedalStatus = async (athleteId: string, status: 'received' | 'not-received') => {
    // Optimistic update
    setCategories(prev => prev.map(cat => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        athletes: cat.athletes.map(a => a.id === athleteId ? { ...a, medal: status } : a)
      };
    }));

    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const athRef = doc(db, 'competitions', id, 'categories', activeCategoryId!, 'athletes', athleteId);
      await updateDoc(athRef, { medal: status });
    } catch (err) {
      console.error('Failed to update medal status', err);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .medals-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: var(--space-5);
          align-items: start;
        }
        .category-panel {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          padding: var(--space-4);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          position: sticky;
          top: 130px;
          max-height: calc(100vh - 160px);
          overflow-y: auto;
        }
        .category-button {
          width: 100%;
          border: 1px solid var(--neutral-300);
          background: var(--shiro);
          border-radius: 10px;
          padding: 12px;
          text-align: left;
          cursor: pointer;
          margin-bottom: var(--space-2);
          transition: all 0.2s;
        }
        .category-button:hover { border-color: var(--ao); }
        .category-button.active {
          border-color: var(--aka);
          background: var(--aka-light);
          box-shadow: 0 0 0 1px var(--aka-light);
        }
        .category-name {
          font-weight: 600;
          color: var(--neutral-900);
          font-size: 14px;
          margin-bottom: 4px;
        }
        .category-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--neutral-500);
          font-weight: 600;
        }
        .status-completed { color: #16a34a; }
        .status-live { color: var(--aka); }
        .medals-panel {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }
        .medals-panel-header {
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--neutral-300);
          background: var(--neutral-50);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        .medals-panel-header h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        .search-wrap {
          position: relative;
          width: 260px;
          max-width: 100%;
        }
        .search-wrap i {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--neutral-500);
          width: 14px;
        }
        .search-input {
          width: 100%;
          height: 38px;
          border: 1.5px solid var(--neutral-300);
          border-radius: 8px;
          padding: 0 12px 0 32px;
          font-size: 13px;
          font-family: var(--font-body);
          color: var(--neutral-900);
          outline: none;
        }
        .search-input:focus {
          border-color: var(--ao);
          box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12);
        }
        .btn-action {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; background: #d97706; color: white;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: 0.2s; white-space: nowrap; height: 38px;
        }
        .btn-action:hover { background: #b45309; }
        table.medal-table {
          width: 100%;
          border-collapse: collapse;
        }
        .medal-table thead th {
          text-align: left;
          padding: 12px 24px;
          background: var(--neutral-50);
          border-bottom: 1px solid var(--neutral-300);
        }
        .medal-table tbody td {
          padding: 14px 24px;
          border-bottom: 1px solid var(--neutral-100);
          font-size: 14px;
          color: var(--neutral-900);
          vertical-align: middle;
        }
        .medal-table tbody tr:hover { background: var(--neutral-50); }
        .medal-table tbody tr:last-child td { border-bottom: none; }
        .academy-name {
          color: var(--neutral-500);
          font-size: 13px;
        }
        .medal-name {
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          font-size: 12px;
        }
        .medal-name.gold { color: #9a6a00; }
        .medal-name.silver { color: #6b7280; }
        .medal-name.bronze { color: #92400e; }
        .medal-control {
          display: inline-flex;
          border: 1px solid var(--neutral-300);
          border-radius: 999px;
          padding: 2px;
          background: var(--shiro);
          gap: 2px;
        }
        .medal-btn {
          border: none;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          background: transparent;
          color: var(--neutral-500);
        }
        .medal-btn.received.active {
          background: var(--status-live-bg);
          color: var(--status-live);
        }
        .medal-btn.not-received.active {
          background: var(--aka-light);
          color: var(--aka);
        }
        .empty-state {
          padding: var(--space-6);
          text-align: center;
          color: var(--neutral-500);
          font-size: 14px;
        }
        @media (max-width: 1100px) {
          .medals-layout { grid-template-columns: 1fr; }
          .category-panel {
            position: static;
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            max-height: none;
            gap: var(--space-2);
            padding-bottom: var(--space-4);
          }
          .category-button { margin-bottom: 0; min-width: 220px; }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
            </div>
            <h1>Pool Winners & Finals</h1>
          </div>
        </header>

        {loading ? (
          <PageSkeleton />
        ) : categories.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--neutral-900)', marginBottom: '8px' }}>No Live or Completed Categories</h3>
            <p style={{ color: 'var(--neutral-500)' }}>Only categories that are currently live or completed will appear here.</p>
          </div>
        ) : (
          <section className="medals-layout">
            <aside className="category-panel">
              {categories.map((cat) => (
                <button 
                  key={cat.id} 
                  className={`category-button ${cat.id === activeCategoryId ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    setSearchQuery("");
                  }}
                >
                  <div className="category-name">{cat.name}</div>
                  <div className="category-meta">
                    <span>{cat.mat}</span>
                    <span className={cat.status === 'completed' ? 'status-completed' : 'status-live'}>{cat.status}</span>
                  </div>
                </button>
              ))}
            </aside>

            <div className="medals-panel">
              <div className="medals-panel-header">
                <div>
                  <h2>{activeCategory?.name}</h2>
                  <div className="text-small">{activeCategory?.mat} • {activeCategory?.status} • {totalWinnersCount} pool winners</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="search-wrap">
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)' }} />
                    <input 
                      className="search-input" 
                      type="text" 
                      placeholder="Search athlete or academy..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button className="btn-action" onClick={() => setSpecialModalOpen(true)}>
                    <Zap size={16} /> Create Finals Tiesheet
                  </button>
                </div>
              </div>

              <div className="table-responsive">
              {poolKeys.length === 0 ? (
                <div className="empty-state">
                  <Trophy size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto', display: 'block' }} />
                  <div>No pool winners have been determined yet.</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Wait for the final matches in the pools to complete.</div>
                </div>
              ) : (
                poolKeys.map(poolKey => (
                  <div key={poolKey} style={{ marginBottom: '24px' }}>
                    <div style={{ 
                      padding: '10px 24px', 
                      background: 'var(--neutral-50)', 
                      borderTop: '1px solid var(--neutral-200)',
                      borderBottom: '1px solid var(--neutral-200)',
                      fontWeight: 800, 
                      fontSize: '12px', 
                      color: 'var(--neutral-600)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ao)' }}></span>
                      {poolKey === 'General' ? 'General' : `Pool ${poolKey}`}
                      <span style={{ fontWeight: 500, color: 'var(--neutral-400)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>({winnersByPool[poolKey].length} winner{winnersByPool[poolKey].length !== 1 ? 's' : ''})</span>
                    </div>
                    <table className="medal-table">
                      <thead>
                        <tr>
                          <th className="text-micro">Athlete Name</th>
                          <th className="text-micro">Academy</th>
                          <th className="text-micro">Medal</th>
                          <th className="text-micro">Medal Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {winnersByPool[poolKey].map(athlete => (
                          <tr key={athlete.id}>
                            <td>{athlete.name}</td>
                            <td className="academy-name">{athlete.academy}</td>
                            <td className={`medal-name ${athlete.medalName?.toLowerCase()}`}>{athlete.medalName}</td>
                            <td>
                              <div className="medal-control">
                                <button 
                                  className={`medal-btn received ${athlete.medal === 'received' ? 'active' : ''}`}
                                  onClick={() => updateAthleteMedalStatus(athlete.id, 'received')}
                                >
                                  Received
                                </button>
                                <button 
                                  className={`medal-btn not-received ${athlete.medal === 'not-received' ? 'active' : ''}`}
                                  onClick={() => updateAthleteMedalStatus(athlete.id, 'not-received')}
                                >
                                  Not Received
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
              </div>
            </div>
          </section>
        )}
      </main>

      {specialModalOpen && (
        <SpecialCategoryModal
          competitionId={id}
          existingSpecialCats={specialCategoriesList}
          standardCategories={categories}
          onClose={() => setSpecialModalOpen(false)}
          onCreated={(catId) => {
            // The modal handles creation, we can just optionally navigate or do nothing
          }}
        />
      )}
    </>
  );
}
