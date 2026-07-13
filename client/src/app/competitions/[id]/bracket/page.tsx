'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@lib/firebase';
import { collection, onSnapshot, query, doc, getDoc } from 'firebase/firestore';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';
import { Eye, Trophy, Target, Clock, X, Plus, Star, Zap, Download, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';

import SpecialCategoryModal from '@/components/SpecialCategoryModal';

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [categories, setCategories] = useState<any[]>([]);
  const [mats, setMats] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightMatchId, setHighlightMatchId] = useState<string | null>(null);
  const [specialModalOpen, setSpecialModalOpen] = useState(false);
  const [downloadingTiesheets, setDownloadingTiesheets] = useState(false);
  const [compData, setCompData] = useState<any>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<'All' | 'Kumite' | 'Kata'>('All');

  const { role } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const addingAthleteRef = useRef(false);
  const [addForm, setAddForm] = useState({
    name: '', academy: '', age: '', weight: '', gender: 'Male', categoryId: '',
    phone: '', email: '', coachName: '', interestSpecialIds: [] as string[]
  });

  const specialCategories = categories.filter(c => c.isSpecial);

  const searchResults = React.useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2 || !isDropdownOpen) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: any[] = [];
    
    categories.forEach(cat => {
      if (!cat.matches) return;
      const catMatch = (cat.name || '').toLowerCase().includes(q);
      cat.matches.forEach((m: any) => {
        const akaObj = typeof m.aka === 'object' && m.aka !== null ? m.aka : { name: typeof m.aka === 'string' ? m.aka : '' };
        const aoObj = typeof m.ao === 'object' && m.ao !== null ? m.ao : { name: typeof m.ao === 'string' ? m.ao : '' };
        
        const akaName = akaObj.name || '';
        const aoName = aoObj.name || '';
        const akaAcademy = akaObj.academy || akaObj.dojo || akaObj.team || '';
        const aoAcademy = aoObj.academy || aoObj.dojo || aoObj.team || '';
        
        const akaMatch = akaName.toLowerCase().includes(q) || akaAcademy.toLowerCase().includes(q);
        const aoMatch = aoName.toLowerCase().includes(q) || aoAcademy.toLowerCase().includes(q);
        
        if (akaMatch || aoMatch || catMatch) {
          const isAo = aoMatch && !akaMatch;
          results.push({
            categoryId: cat.id,
            categoryName: cat.name,
            matchId: m.id,
            athleteName: isAo ? aoName : (akaName || 'No player assigned'),
            teamName: isAo ? aoAcademy : akaAcademy,
            pool: (m.id || '').split('-')[0].replace('Pool', ''),
          });
        }
      });
    });
    
    const uniqueResults = results.filter((v, i, a) => a.findIndex(t => (t.matchId === v.matchId)) === i);
    return uniqueResults.slice(0, 50);
  }, [categories, searchQuery, isDropdownOpen]);

  const handleSearchResultClick = (result: any) => {
    setActiveCategoryId(result.categoryId);
    setHighlightMatchId(result.matchId);
    setSearchQuery(`${result.athleteName} - ${result.categoryName}`);
    setIsDropdownOpen(false);
    setModalOpen(true);
  };

  // Fetch categories with their match data
  useEffect(() => {
    const fetchComp = async () => {
      const snap = await getDoc(doc(db, 'competitions', id));
      if (snap.exists()) setCompData(snap.data());
    };
    fetchComp();

    const q = query(collection(db, 'competitions', id, 'categories'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      cats.sort((a, b) => {
        const order = { live: 0, upcoming: 1, completed: 2 };
        const ao = order[a.status as keyof typeof order] ?? 1;
        const bo = order[b.status as keyof typeof order] ?? 1;
        if (ao !== bo) return ao - bo;
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
      });
      setCategories(cats);
    });
    return () => unsubscribe();
  }, [id]);

  // Fetch mats for the competition
  useEffect(() => {
    const q = query(collection(db, 'competitions', id, 'mats'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matList = snapshot.docs.map(d => d.data().name || d.id);
      setMats(matList);
    });
    return () => unsubscribe();
  }, [id]);

  const openModal = (catId?: string) => {
    setActiveCategoryId(catId || categories[0]?.id || null);
    setHighlightMatchId(null);
    setModalOpen(true);
  };

  const handleAssignMat = async (categoryId: string, mat: string) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'competitions', id, 'categories', categoryId), { mat, updatedAt: new Date().toISOString() });
      toast.success(`Mat updated to ${mat}`);
    } catch (err) {
      console.error('Error assigning mat:', err);
      toast.error('Failed to assign mat. Please try again.');
    }
  };

  const handlePromote = async (matchId: string, winnerId: string, _nextMatchId: string | null, byeFor?: 'aka' | 'ao') => {
    if (!activeCategoryId) return;
    try {
      const res = await fetch(`/api/competitions/${id}/brackets/${activeCategoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, winnerId, ...(byeFor ? { byeFor } : {}) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(byeFor ? `Advanced by BYE (${byeFor.toUpperCase()} absent/DQ)` : 'Athlete advanced successfully!');
      } else {
        toast.error('Failed to advance athlete: ' + data.error);
      }
    } catch (err) {
      console.error('Error promoting athlete:', err);
      toast.error('Failed to promote athlete. Please try again.');
    }
  };

  const handleSwapAthletes = async (
    categoryId: string, 
    sourceMatchId: string, 
    sourceSide: 'aka' | 'ao', 
    targetMatchId: string, 
    targetSide: 'aka' | 'ao',
    targetCategoryId?: string,
    action?: 'swap' | 'move'
  ) => {
    try {
      const res = await fetch(`/api/competitions/${id}/brackets/${categoryId}/swap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceMatchId, sourceSide, targetMatchId, targetSide, targetCategoryId, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'move' ? 'Athlete moved successfully!' : 'Athletes swapped successfully!');
      } else {
        toast.error('Failed to update tiesheet: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating tiesheet:', err);
      toast.error('Failed to update tiesheet. Please try again.');
    }
  };

  const handleRevertMatch = async (categoryId: string, matchId: string) => {
    try {
      const res = await fetch(`/api/competitions/${id}/brackets/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, action: 'revert' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Match reverted successfully!');
      } else {
        toast.error('Failed to revert match: ' + data.error);
      }
    } catch (err) {
      console.error('Error reverting match:', err);
      toast.error('Failed to revert match. Please try again.');
    }
  };

  const handleDownloadTiesheets = async () => {
    if (downloadingTiesheets || categories.length === 0) return;
    setDownloadingTiesheets(true);
    try {
      const { exportTiesheetsPDF } = await import('@taikaix/backend/services/tiesheet-pdf-exporter');
      await exportTiesheetsPDF({
        competitionName: compData?.name || 'TaikaiX Competition',
        categories: categories.map((c: any) => ({
          name: c.name,
          matches: c.matches ?? [],
          athletes: c.athletes ?? [],
          matNo: c.mat || '',
          isKata: c.isKata === true || (typeof c.name === 'string' && c.name.toLowerCase().includes('kata')),
        })),
        isArchived: false,
        venue: compData?.venue || '',
        date: compData?.dates || '',
      });
      toast.success('Tiesheets PDF downloaded!');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to generate tiesheets: ' + e.message);
    } finally {
      setDownloadingTiesheets(false);
    }
  };

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingAthleteRef.current) return; // prevent double-submit
    addingAthleteRef.current = true;
    setAddingAthlete(true);
    try {
      const res = await fetch(`/api/competitions/${id}/athletes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: addForm.categoryId,
          athleteData: {
            name: addForm.name,
            academy: addForm.academy,
            age: parseInt(addForm.age),
            weight: parseFloat(addForm.weight),
            gender: addForm.gender,
            phone: addForm.phone,
            email: addForm.email,
            coachName: addForm.coachName,
            interestSpecial: addForm.interestSpecialIds.join(', '),
          }
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setIsAddModalOpen(false);
      setAddForm({ name: '', academy: '', age: '', weight: '', gender: 'Male', categoryId: '', phone: '', email: '', coachName: '', interestSpecialIds: [] });
      toast.success('Athlete added successfully!');
    } catch (err: any) {
      toast.error(`Failed to add athlete: ${err.message}`);
    } finally {
      addingAthleteRef.current = false;
      setAddingAthlete(false);
    }
  };

  const standardCategories = categories.filter(c => !c.isSpecial);

  const applyFilter = (cats: any[]) => cats.filter(c => {
    if (disciplineFilter === 'All') return true;
    const isKata = c.isKata === true || (typeof c.name === 'string' && c.name.toLowerCase().includes('kata'));
    if (disciplineFilter === 'Kata') return isKata;
    return !isKata; // Kumite
  });

  const liveCategories = applyFilter(standardCategories).filter(c => c.status === 'live');
  const upcomingCategories = applyFilter(standardCategories).filter(c => c.status !== 'live' && c.status !== 'completed');
  const completedCategories = applyFilter(standardCategories).filter(c => c.status === 'completed');

  const liveSpecial = applyFilter(specialCategories).filter(c => c.status === 'live');
  const upcomingSpecial = applyFilter(specialCategories).filter(c => c.status !== 'live' && c.status !== 'completed' && c.matches?.length > 0);
  const completedSpecial = applyFilter(specialCategories).filter(c => c.status === 'completed');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .tiesheet-page {
          padding: var(--space-6);
          max-width: 1200px;
          margin: 0 auto;
        }
        .tiesheet-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-6);
        }
        .search-container {
          position: relative;
          width: 320px;
        }
        .search-input {
          width: 100%;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--neutral-300);
          background: var(--shiro);
          font-size: 14px;
          color: var(--neutral-900);
          transition: all 0.2s;
        }
        .search-input:focus {
          outline: none;
          border-color: var(--aka);
          box-shadow: 0 0 0 3px rgba(225,29,72,0.1);
        }
        .search-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          z-index: 100;
          max-height: 400px;
          overflow-y: auto;
        }
        .search-result-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--neutral-100);
          cursor: pointer;
          transition: background 0.2s;
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover { background: var(--neutral-50); }
        .search-result-name { font-weight: 700; font-size: 14px; color: var(--neutral-900); margin-bottom: 2px; }
        .search-result-meta { font-size: 11px; color: var(--neutral-500); font-weight: 600; }
        .tiesheet-section-title {
          font-family: var(--font-display);
          font-size: 13px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--neutral-500);
          margin-bottom: var(--space-3);
          padding-left: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tiesheet-section-title::after { content: ''; flex: 1; height: 1px; background: var(--neutral-200); }
        .tiesheet-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: var(--space-3);
          margin-bottom: var(--space-6);
        }
        .tiesheet-card {
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 16px;
          padding: var(--space-4);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tiesheet-card:hover { border-color: var(--neutral-400); transform: translateY(-4px); box-shadow: 0 12px 32px -8px rgba(0,0,0,0.1); }
        .tiesheet-card.live-card { border-color: var(--status-live); box-shadow: 0 0 0 2px var(--status-live-bg), 0 8px 24px -8px rgba(217,38,44,0.15); }
        .tiesheet-card.completed-card { opacity: 1; border-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
        .tiesheet-card.special-card { border-color: #f59e0b; box-shadow: 0 0 0 2px #fffbeb; }
        .tiesheet-card-name { font-size: 14px; font-weight: 700; color: var(--neutral-900); line-height: 1.3; }
        .tiesheet-card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; color: var(--neutral-500); text-transform: uppercase; letter-spacing: 0.05em; }
        .live-badge { display: flex; align-items: center; gap: 5px; color: var(--status-live); font-weight: 800; font-size: 11px; }
        .live-dot-sm { width: 6px; height: 6px; background: var(--status-live); border-radius: 50%; box-shadow: 0 0 8px var(--status-live); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
        .tiesheet-card-footer { display: flex; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid var(--neutral-100); }
        .btn-view-tiesheet {
          flex: 1; height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px;
          background: transparent; border: 1px solid var(--neutral-300); border-radius: 8px;
          font-size: 12px; font-weight: 700; color: var(--neutral-700); cursor: pointer; transition: all 0.2s;
        }
        .btn-view-tiesheet:hover { background: var(--neutral-100); border-color: var(--neutral-500); color: var(--neutral-900); }
        .tiesheet-card.live-card .btn-view-tiesheet { background: var(--aka); border-color: var(--aka); color: white; }
        .tiesheet-card.live-card .btn-view-tiesheet:hover { background: var(--aka-hover); }
        .tiesheet-card.completed-card .btn-view-tiesheet { background: #10b981; border-color: #10b981; color: white; }
        .tiesheet-card.completed-card .btn-view-tiesheet:hover { background: #059669; }
        .tiesheet-card.special-card .btn-view-tiesheet { background: #f59e0b; border-color: #f59e0b; color: white; }
        .btn-create-special {
          display: flex; align-items: center; gap: 8px; padding: 8px 16px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }
        .btn-create-special:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(217,119,6,0.4); }
        .empty-state { padding: var(--space-12); text-align: center; color: var(--neutral-400); display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .special-badge { display: inline-flex; align-items: center; gap: 4px; padding: '2px 8px'; background: #fffbeb; color: #92400e; font-size: 10px; font-weight: 700; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
      `}} />

      <div className="tiesheet-page">
        {/* Page Hero */}
        <div className="tiesheet-hero" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '24px', margin: '0 0 4px 0' }}>Tiesheet Management</h2>
              <p style={{ fontSize: '14px', color: 'var(--neutral-500)', margin: 0 }}>
                {categories.length} categories • Click any category to open its bracket
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {role === 'admin' && (
                <button type="button" className="btn-create-special" onClick={() => setSpecialModalOpen(true)}>
                  <Star size={14} />
                  Create Special Tiesheet
                </button>
              )}
              {role === 'admin' && (
                <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsAddModalOpen(true)}>
                  <UserPlus size={16} />
                  Add On-Spot Entry
                </button>
              )}
              {categories.length > 0 && role === 'admin' && (
                <button type="button" 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }} 
                  onClick={handleDownloadTiesheets}
                  disabled={downloadingTiesheets}
                >
                  <Download size={16} />
                  {downloadingTiesheets ? 'Generating...' : 'Download PDF'}
                </button>
              )}
              {categories.length > 0 && (
                <button type="button" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => openModal()}>
                  <Eye size={16} />
                  Open All Brackets
                </button>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%', padding: '16px', background: 'var(--shiro)', border: '1px solid var(--neutral-200)', borderRadius: '12px' }}>
            <select
              value={disciplineFilter}
              onChange={e => setDisciplineFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--neutral-300)',
                background: 'var(--shiro)',
                fontSize: '14px',
                color: 'var(--neutral-900)',
                cursor: 'pointer',
                minWidth: '140px'
              }}
            >
              <option value="All">All Disciplines</option>
              <option value="Kumite">Kumite Only</option>
              <option value="Kata">Kata Only</option>
            </select>
            {categories.length > 0 && (
              <div className="search-container" style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="Search player name..." 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchResults.length > 0) {
                        handleSearchResultClick(searchResults[0]);
                      }
                    }}
                  />
                  {searchQuery && (
                    <button type="button" 
                      onClick={() => { setSearchQuery(''); setIsDropdownOpen(false); }}
                      style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="search-dropdown">
                    {searchResults.map((result, idx) => (
                      <div key={idx} className="search-result-item" onClick={() => handleSearchResultClick(result)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <div className="search-result-name">{result.athleteName}</div>
                          {result.teamName && (
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', textAlign: 'right', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {result.teamName}
                            </div>
                          )}
                        </div>
                        <div className="search-result-meta">
                          {result.categoryName} (Pool {result.pool})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.length > 1 && searchResults.length === 0 && (
                  <div className="search-dropdown" style={{ padding: '16px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '12px' }}>
                    No athletes found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px' }}>⚔️</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>No tiesheets generated yet</div>
            <p style={{ fontSize: '14px', maxWidth: '320px' }}>
              Go to the Setup Wizard and complete Phase 2 (Import Athletes) to generate tiesheets for this competition.
            </p>
          </div>
        ) : (
          <>
            {/* Live Standard Categories */}
            {liveCategories.length > 0 && (
              <>
                <div className="tiesheet-section-title"><span>🔴</span> Live Now</div>
                <div className="tiesheet-grid">
                  {liveCategories.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}

            {/* Live Special Categories */}
            {liveSpecial.length > 0 && (
              <>
                <div className="tiesheet-section-title"><span>⭐</span> Special — Live</div>
                <div className="tiesheet-grid">
                  {liveSpecial.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} isSpecial onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}

            {/* Upcoming Standard */}
            {upcomingCategories.length > 0 && (
              <>
                <div className="tiesheet-section-title"><span>🕐</span> Upcoming</div>
                <div className="tiesheet-grid">
                  {upcomingCategories.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}

            {/* Upcoming Special */}
            {upcomingSpecial.length > 0 && (
              <>
                <div className="tiesheet-section-title"><span>⭐</span> Special — Upcoming</div>
                <div className="tiesheet-grid">
                  {upcomingSpecial.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} isSpecial onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}

            {/* Completed Standard */}
            {completedCategories.length > 0 && (
              <>
                <div className="tiesheet-section-title"><span>✅</span> Completed</div>
                <div className="tiesheet-grid">
                  {completedCategories.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}

            {/* Completed Special */}
            {completedSpecial.length > 0 && (
              <>
                <div className="tiesheet-section-title"><span>⭐</span> Special — Completed</div>
                <div className="tiesheet-grid">
                  {completedSpecial.map(cat => (
                    <TiesheetCard key={cat.id} cat={cat} isSpecial onClick={() => openModal(cat.id)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Fullscreen Modal */}
      {modalOpen && (
        <FullscreenBracketModal
          categories={categories}
          initialCategoryId={activeCategoryId || undefined}
          highlightMatchId={highlightMatchId}
          mats={mats}
          isAdmin={role === 'admin'}
          onClose={() => {
            setModalOpen(false);
            setHighlightMatchId(null);
          }}
          onPromote={(role === 'admin' || role === 'guest_viewer') ? handlePromote : undefined}
          onAssignMat={(role === 'admin' || role === 'guest_viewer') ? handleAssignMat : undefined}
          onSwapDrop={role === 'admin' ? handleSwapAthletes : undefined}
          onRevertMatch={role === 'admin' ? handleRevertMatch : undefined}
        />
      )}

      {/* Special Category Modal */}
      {specialModalOpen && (
        <SpecialCategoryModal
          competitionId={id}
          existingSpecialCats={specialCategories}
          standardCategories={standardCategories}
          onClose={() => setSpecialModalOpen(false)}
          onCreated={(catId) => {
            setActiveCategoryId(catId);
          }}
        />
      )}

      {/* Add On-Spot Entry Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => !addingAthlete && setIsAddModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '20px' }}>Add On-Spot Entry</h2>
            <form onSubmit={handleAddAthlete}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Full Name</label>
                <input required style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} value={addForm.name} onChange={e => setAddForm(p => ({...p, name: e.target.value}))} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Academy / Dojo</label>
                <input required style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} value={addForm.academy} onChange={e => setAddForm(p => ({...p, academy: e.target.value}))} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Coach Name</label>
                <input style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} placeholder="Coach's full name" value={addForm.coachName} onChange={e => setAddForm(p => ({...p, coachName: e.target.value}))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Phone Number</label>
                  <input type="tel" style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} placeholder="e.g. +91 98765 43210" value={addForm.phone} onChange={e => setAddForm(p => ({...p, phone: e.target.value}))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Email</label>
                  <input type="email" style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} placeholder="athlete@email.com" value={addForm.email} onChange={e => setAddForm(p => ({...p, email: e.target.value}))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Age</label>
                  <input required type="number" style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} value={addForm.age} onChange={e => setAddForm(p => ({...p, age: e.target.value}))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Weight (kg)</label>
                  <input required type="number" step="0.1" style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} value={addForm.weight} onChange={e => setAddForm(p => ({...p, weight: e.target.value}))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Gender</label>
                  <select style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} value={addForm.gender} onChange={e => setAddForm(p => ({...p, gender: e.target.value}))}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Category</label>
                <select required style={{ width: '100%', padding: '10px', border: '1px solid var(--neutral-300)', borderRadius: '6px' }} value={addForm.categoryId} onChange={e => setAddForm(p => ({...p, categoryId: e.target.value}))}>
                  <option value="" disabled>Select Category</option>
                  {standardCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {specialCategories.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Interest in Special Categories</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid var(--neutral-300)', borderRadius: '8px', background: 'var(--neutral-50)' }}>
                    {specialCategories.map(sc => {
                      const checked = addForm.interestSpecialIds.includes(sc.id);
                      return (
                        <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                          <span style={{ width: '20px', height: '20px', border: `2px solid ${checked ? 'var(--ao)' : 'var(--neutral-300)'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: checked ? 'var(--ao)' : 'white', flexShrink: 0, transition: 'all 0.15s' }}>
                            {checked && <span style={{ color: 'white', fontWeight: 900, fontSize: '13px', lineHeight: 1 }}>&#10003;</span>}
                          </span>
                          <input type="checkbox" style={{ display: 'none' }} checked={checked} onChange={() => {
                            setAddForm(p => ({ ...p, interestSpecialIds: checked ? p.interestSpecialIds.filter(x => x !== sc.id) : [...p.interestSpecialIds, sc.id] }));
                          }} />
                          <span>{sc.name}</span>
                          {sc.medal && <span style={{ fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 600 }}>({sc.medal})</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={addingAthlete}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addingAthlete}>
                  {addingAthlete ? 'Adding...' : 'Add Athlete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── TiesheetCard sub-component ─────────────────────────────────────────────
function TiesheetCard({ cat, onClick, isSpecial = false }: { cat: any; onClick: () => void; isSpecial?: boolean }) {
  const isLive = cat.status === 'live';
  const isCompleted = cat.status === 'completed' || cat.status === 'done';
  const matchCount = (cat.matches || []).filter((m: any) => m.round === 1 && (m.aka || m.ao)).length;
  const athleteCount = cat.athletes?.length || matchCount * 2;

  return (
    <div
      className={`tiesheet-card${isLive ? ' live-card' : ''}${isCompleted ? ' completed-card' : ''}${isSpecial && !isLive ? ' special-card' : ''}`}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
        <div className="tiesheet-card-name">{cat.name}</div>
        {isSpecial && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', background: '#fffbeb', color: '#92400e', fontSize: '10px', fontWeight: 700, borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Star size={9} /> Special
          </span>
        )}
      </div>
      <div className="tiesheet-card-meta">
        {isLive ? (
          <div className="live-badge">
            <div className="live-dot-sm" />
            {cat.mat ? `${cat.mat.toUpperCase().includes('MAT') ? cat.mat : `MAT ${cat.mat.padStart(2, '0')}`} • LIVE` : 'LIVE'}
          </div>
        ) : isCompleted ? (
          <div style={{ color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            COMPLETED
          </div>
        ) : (
          <div style={{ color: isSpecial ? '#d97706' : 'var(--status-upcoming)' }}>
            {cat.mat ? `${cat.mat.toUpperCase().includes('MAT') ? cat.mat : `MAT ${cat.mat.padStart(2, '0')}`} • UPCOMING` : 'NOT ASSIGNED'}
          </div>
        )}
        <div>{athleteCount} ATHLETES</div>
      </div>
      {isSpecial && cat.medal && (
        <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>🥇 Seeded from: {cat.medal}</div>
      )}
      <div className="tiesheet-card-footer">
        <button type="button" className="btn-view-tiesheet">
          <Eye size={12} />
          View Tiesheet
        </button>
      </div>
    </div>
  );
}
