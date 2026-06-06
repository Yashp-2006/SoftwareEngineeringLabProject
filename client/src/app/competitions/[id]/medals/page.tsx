'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, X, Trash2 } from 'lucide-react';

interface Athlete {
  id: string;
  name: string;
  academy: string;
  medalName?: 'Gold' | 'Silver' | 'Bronze';
  medal?: 'received' | 'not-received';
  pool?: string | number;
}

interface Category {
  id: string;
  name: string;
  mat: string;
  status: string;
  order: number;
  athletes: Athlete[];
}

export default function MedalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedAthleteForModal, setSelectedAthleteForModal] = useState<Athlete | null>(null);
  const [modalMedal, setModalMedal] = useState<'Gold'|'Silver'|'Bronze'>('Bronze');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [athleteToDelete, setAthleteToDelete] = useState<string | null>(null);

  useEffect(() => {
    let unsubCats: () => void;
    const athleteUnsubs: Record<string, () => void> = {};

    const setup = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');

      const catQ = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubCats = onSnapshot(catQ, (catSnap) => {
        const catList = catSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name || '',
          mat: d.data().mat || 'UNASSIGNED',
          status: d.data().status || 'upcoming',
          order: d.data().order || 0,
          athletes: []
        }));

        setActiveCategoryId(prev => prev ?? catList[0]?.id ?? null);

        catList.forEach(cat => {
          if (athleteUnsubs[cat.id]) return;

          const athQ = query(collection(db, 'competitions', id, 'categories', cat.id, 'athletes'));
          athleteUnsubs[cat.id] = onSnapshot(athQ, (athSnap) => {
            const athletes: Athlete[] = athSnap.docs.map(d => ({
              id: d.id,
              name: d.data().name || '',
              academy: d.data().academy || '',
              medalName: d.data().medalName,
              medal: d.data().medal,
              pool: d.data().pool,
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

  const winners = activeCategory?.athletes.filter(a => a.medalName) || [];
  
  const filteredWinners = winners.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.academy.toLowerCase().includes(q);
  });

  // Group winners by pool
  const winnersByPool = React.useMemo(() => {
    const groups: Record<string, Athlete[]> = {};
    filteredWinners.forEach(a => {
      const poolKey = a.pool ? String(a.pool) : 'No Pool';
      if (!groups[poolKey]) groups[poolKey] = [];
      groups[poolKey].push(a);
    });
    return groups;
  }, [filteredWinners]);

  const poolKeys = Object.keys(winnersByPool).sort((a, b) => {
    if (a === 'No Pool') return 1;
    if (b === 'No Pool') return -1;
    return parseInt(a) - parseInt(b);
  });

  const updateAthleteMedal = async (athleteId: string, updates: Partial<Athlete>) => {
    // Optimistic
    setCategories(prev => prev.map(cat => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        athletes: cat.athletes.map(a => a.id === athleteId ? { ...a, ...updates } : a)
      };
    }));

    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc, deleteField } = await import('firebase/firestore');
      const athRef = doc(db, 'competitions', id, 'categories', activeCategoryId!, 'athletes', athleteId);
      
      const firestoreUpdates: any = { ...updates };
      if (updates.medalName === undefined && Object.keys(updates).includes('medalName')) {
          firestoreUpdates.medalName = deleteField();
      }
      if (updates.medal === undefined && Object.keys(updates).includes('medal')) {
          firestoreUpdates.medal = deleteField();
      }
      
      await updateDoc(athRef, firestoreUpdates);
    } catch (err) {
      console.error('Failed to update medal', err);
    }
  };

  const handleMedalStatusChange = (athleteId: string, status: 'received' | 'not-received') => {
    updateAthleteMedal(athleteId, { medal: status });
  };

  const openDeleteModal = (athleteId: string) => {
    setAthleteToDelete(athleteId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!athleteToDelete) return;
    updateAthleteMedal(athleteToDelete, { medalName: undefined, medal: undefined });
    setDeleteModalOpen(false);
    setAthleteToDelete(null);
  };

  const availableAthletesForModal = activeCategory?.athletes.filter(a => 
    !a.medalName &&
    (a.name.toLowerCase().includes(modalSearch.toLowerCase()) || a.academy.toLowerCase().includes(modalSearch.toLowerCase()))
  ) || [];

  const addMedalist = () => {
    if (!selectedAthleteForModal) return;
    updateAthleteMedal(selectedAthleteForModal.id, { medalName: modalMedal, medal: 'not-received' });
    setAddModalOpen(false);
  };

  const openAddModal = () => {
    setModalSearch("");
    setSelectedAthleteForModal(null);
    setModalMedal("Bronze");
    setAddModalOpen(true);
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
        .add-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; background: var(--neutral-900); color: var(--shiro);
          border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: 0.2s; white-space: nowrap; height: 38px;
        }
        .add-btn:hover { background: #000; }
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
        .remove-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--neutral-400);
          padding: 6px;
          border-radius: 6px;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .remove-btn:hover {
          color: var(--aka);
          background: var(--aka-light);
        }
        .empty-state {
          padding: var(--space-6);
          text-align: center;
          color: var(--neutral-500);
          font-size: 14px;
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
          opacity: 0; pointer-events: none; transition: 0.2s;
        }
        .modal-overlay.active { opacity: 1; pointer-events: auto; }
        
        .modal {
          background: var(--shiro);
          width: 400px; max-width: 90%;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          overflow: hidden;
          transform: translateY(10px); transition: 0.2s;
        }
        .modal-overlay.active .modal { transform: translateY(0); }
        
        .modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--neutral-300);
          display: flex; justify-content: space-between; align-items: center;
        }
        .modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--neutral-500); padding: 4px; display: flex; }
        .close-btn:hover { color: var(--neutral-900); }
        
        .modal-body { padding: 24px; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--neutral-700); }
        .input-field {
          width: 100%; height: 40px;
          border: 1.5px solid var(--neutral-300); border-radius: 8px;
          padding: 0 12px; font-size: 14px; font-family: var(--font-body); outline: none;
        }
        .input-field:focus { border-color: var(--ao); box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12); }
        
        .search-results {
          margin-top: 8px; max-height: 160px; overflow-y: auto;
          border: 1px solid var(--neutral-300); border-radius: 8px;
          display: block; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .search-result-item {
          padding: 10px 12px; font-size: 13px; cursor: pointer;
          border-bottom: 1px solid var(--neutral-100);
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover, .search-result-item.selected { background: var(--neutral-50); }
        .search-result-item .academy { font-size: 11px; color: var(--neutral-500); margin-top: 2px; }
        
        .modal-footer {
          padding: 16px 24px; border-top: 1px solid var(--neutral-300);
          background: var(--neutral-50); display: flex; justify-content: flex-end; gap: 12px;
        }
        .btn-secondary {
          padding: 8px 16px; background: white; border: 1px solid var(--neutral-300);
          border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s;
        }
        .btn-secondary:hover { background: var(--neutral-50); }
        .btn-primary {
          padding: 8px 16px; background: var(--ao); color: white; border: none;
          border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s;
        }
        .btn-primary:hover { background: #153c8e; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 1100px) {
          .medals-layout { grid-template-columns: 1fr; }
          .category-panel {
            position: static;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: var(--space-2);
          }
          .category-button { margin-bottom: 0; }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
            </div>
            <h1>Medal Tracking</h1>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--neutral-500)' }}>
            Loading categories and medals...
          </div>
        ) : categories.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--neutral-900)', marginBottom: '8px' }}>No Categories Found</h3>
            <p style={{ color: 'var(--neutral-500)' }}>Deploy the tournament setup to generate categories and track medals.</p>
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
                    <span>{cat.status}</span>
                  </div>
                </button>
              ))}
            </aside>

            <div className="medals-panel">
              <div className="medals-panel-header">
                <div>
                  <h2>{activeCategory?.name}</h2>
                  <div className="text-small">{activeCategory?.mat} • {activeCategory?.status} • {filteredWinners.length} medal winners</div>
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
                  <button className="add-btn" onClick={openAddModal}>
                    <Plus size={16} /> Add Medalist
                  </button>
                </div>
              </div>

              <div className="table-responsive">
              {poolKeys.length === 0 ? (
                <div className="empty-state">No medal winners found for this filter.</div>
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
                      {poolKey === 'No Pool' ? 'General' : `Pool ${poolKey}`}
                      <span style={{ fontWeight: 500, color: 'var(--neutral-400)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>({winnersByPool[poolKey].length} winner{winnersByPool[poolKey].length !== 1 ? 's' : ''})</span>
                    </div>
                    <table className="medal-table">
                      <thead>
                        <tr>
                          <th className="text-micro">Athlete Name</th>
                          <th className="text-micro">Academy</th>
                          <th className="text-micro">Medal</th>
                          <th className="text-micro">Medal Received</th>
                          <th className="text-micro" style={{ width: '40px' }}></th>
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
                                  onClick={() => handleMedalStatusChange(athlete.id, 'received')}
                                >
                                  Received
                                </button>
                                <button 
                                  className={`medal-btn not-received ${athlete.medal === 'not-received' ? 'active' : ''}`}
                                  onClick={() => handleMedalStatusChange(athlete.id, 'not-received')}
                                >
                                  Not Received
                                </button>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="remove-btn" title="Remove Medalist" onClick={() => openDeleteModal(athlete.id)}>
                                <Trash2 size={16} />
                              </button>
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

      {/* Delete Confirmation Modal */}
      <div className={`modal-overlay ${deleteModalOpen ? 'active' : ''}`} onClick={(e) => e.target === e.currentTarget && setDeleteModalOpen(false)}>
        <div className="modal">
          <div className="modal-header">
            <h3>Remove Medalist</h3>
            <button className="close-btn" onClick={() => setDeleteModalOpen(false)}><X size={20} /></button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: '14px', color: 'var(--neutral-700)', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to remove this athlete from the medals list?
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
            <button className="btn-primary" style={{ background: 'var(--aka)', color: 'white' }} onClick={confirmDelete}>Remove</button>
          </div>
        </div>
      </div>

      {/* Add Medalist Modal */}
      <div className={`modal-overlay ${addModalOpen ? 'active' : ''}`} onClick={(e) => e.target === e.currentTarget && setAddModalOpen(false)}>
        <div className="modal">
          <div className="modal-header">
            <h3>Add Medalist</h3>
            <button className="close-btn" onClick={() => setAddModalOpen(false)}><X size={20} /></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Search Athlete</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Type athlete name..."
                value={selectedAthleteForModal ? selectedAthleteForModal.name : modalSearch}
                onChange={(e) => {
                  setModalSearch(e.target.value);
                  setSelectedAthleteForModal(null);
                }}
              />
              {modalSearch && !selectedAthleteForModal && (
                <div className="search-results" style={{ display: 'block' }}>
                  {availableAthletesForModal.length > 0 ? (
                    availableAthletesForModal.map(a => (
                      <div key={a.id} className="search-result-item" onClick={() => setSelectedAthleteForModal(a)}>
                        <div>{a.name}</div>
                        <div className="academy">{a.academy}</div>
                      </div>
                    ))
                  ) : (
                    <div className="search-result-item" style={{ color: 'var(--neutral-500)', cursor: 'default' }}>No matching athletes</div>
                  )}
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Select Medal</label>
              <select className="input-field" value={modalMedal} onChange={e => setModalMedal(e.target.value as any)}>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Bronze">Bronze</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setAddModalOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!selectedAthleteForModal} onClick={addMedalist}>Add Medalist</button>
          </div>
        </div>
      </div>
    </>
  );
}
