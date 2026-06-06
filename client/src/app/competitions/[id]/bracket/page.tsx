'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@lib/firebase';
import { collection, onSnapshot, query, doc, getDoc } from 'firebase/firestore';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';
import { Eye, Trophy, Target, Clock, X, Plus, Star, Zap, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Special Category Modal ─────────────────────────────────────────────────
function SpecialCategoryModal({
  competitionId,
  existingSpecialCats,
  standardCategories,
  onClose,
  onCreated,
}: {
  competitionId: string;
  existingSpecialCats: any[];
  standardCategories: any[];
  onClose: () => void;
  onCreated: (catId: string) => void;
}) {
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [poolSize, setPoolSize] = useState(8);

  // New category form
  const [newName, setNewName] = useState('');
  const [newMedal, setNewMedal] = useState<'Gold' | 'Silver' | 'Bronze' | 'Any Medal'>('Gold');
  const [newSourceCategoryId, setNewSourceCategoryId] = useState('');
  const [newMinAge, setNewMinAge] = useState('');
  const [newMaxAge, setNewMaxAge] = useState('');
  const [newMinWeight, setNewMinWeight] = useState('');
  const [newMaxWeight, setNewMaxWeight] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);

  const undeployedSpecials = existingSpecialCats.filter(c => !c.matches || c.matches.length === 0);

  const handleGenerateExisting = async () => {
    if (!selectedCatId) { toast.error('Select a special category first'); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/competitions/${competitionId}/brackets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialCategoryId: selectedCatId, poolSize }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Tiesheet created! ${data.athletesSeeded} athletes seeded.`);
      onCreated(selectedCatId);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate tiesheet');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateAndGenerate = async () => {
    if (!newName.trim()) { toast.error('Category name is required'); return; }
    setCreatingNew(true);
    try {
      const { addDoc } = await import('firebase/firestore');
      const catData: any = {
        name: newName.trim(),
        medal: newMedal,
        isSpecial: true,
        status: 'upcoming',
        athletes: [],
        matches: [],
        order: 9999,
        createdAt: new Date().toISOString(),
      };
      if (newSourceCategoryId) catData.sourceCategoryId = newSourceCategoryId;
      if (newMinAge) catData.minAge = parseInt(newMinAge);
      if (newMaxAge) catData.maxAge = parseInt(newMaxAge);
      if (newMinWeight) catData.minWeight = parseFloat(newMinWeight);
      if (newMaxWeight) catData.maxWeight = parseFloat(newMaxWeight);

      const colRef = collection(db, 'competitions', competitionId, 'categories');
      const newCatRef = await addDoc(colRef, catData);

      // Now generate the bracket
      const res = await fetch(`/api/competitions/${competitionId}/brackets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialCategoryId: newCatRef.id, poolSize }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Special category "${newName}" created & tiesheet generated! ${data.athletesSeeded} athletes seeded.`);
      onCreated(newCatRef.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create special category');
    } finally {
      setCreatingNew(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Create Special Category Tiesheet</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Seed from completed standard tiesheets</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setMode('select')}
            style={{ flex: 1, padding: '12px', fontWeight: 600, fontSize: '13px', border: 'none', cursor: 'pointer', borderBottom: mode === 'select' ? '2px solid #d97706' : '2px solid transparent', color: mode === 'select' ? '#d97706' : '#6b7280', background: 'none' }}
          >
            From Setup ({undeployedSpecials.length} available)
          </button>
          <button
            onClick={() => setMode('new')}
            style={{ flex: 1, padding: '12px', fontWeight: 600, fontSize: '13px', border: 'none', cursor: 'pointer', borderBottom: mode === 'new' ? '2px solid #d97706' : '2px solid transparent', color: mode === 'new' ? '#d97706' : '#6b7280', background: 'none' }}
          >
            Create New
          </button>
        </div>

        <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {mode === 'select' ? (
            <>
              {undeployedSpecials.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#6b7280' }}>
                  <Star size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>No available special categories</div>
                  <div style={{ fontSize: '13px' }}>All pre-defined special categories already have tiesheets, or none were created in Setup. Use the "Create New" tab to add one on the spot.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {undeployedSpecials.map((cat: any) => (
                    <label key={cat.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px',
                      border: `2px solid ${selectedCatId === cat.id ? '#d97706' : '#e5e7eb'}`,
                      borderRadius: '10px', cursor: 'pointer',
                      background: selectedCatId === cat.id ? '#fffbeb' : 'white',
                      transition: 'all 0.15s'
                    }}>
                      <input
                        type="radio"
                        name="specialCat"
                        value={cat.id}
                        checked={selectedCatId === cat.id}
                        onChange={() => setSelectedCatId(cat.id)}
                        style={{ marginTop: '2px', accentColor: '#d97706' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{cat.name}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>
                            {cat.medal || 'Any Medal'}
                          </span>
                          {cat.minAge && <span style={{ fontSize: '11px', color: '#6b7280' }}>Age: {cat.minAge}–{cat.maxAge || '∞'}</span>}
                          {cat.minWeight && <span style={{ fontSize: '11px', color: '#6b7280' }}>Weight: {cat.minWeight}–{cat.maxWeight || '∞'} kg</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Super Gold, Bronze Play-off, Open Weight"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Seed From (Medal Tier)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['Gold', 'Silver', 'Bronze', 'Any Medal'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setNewMedal(m)}
                      style={{
                        flex: 1, padding: '8px 6px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer',
                        border: `2px solid ${newMedal === m ? '#d97706' : '#e5e7eb'}`,
                        background: newMedal === m ? '#fffbeb' : 'white',
                        color: newMedal === m ? '#92400e' : '#374151'
                      }}
                    >{m === 'Any Medal' ? 'Any' : m}</button>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                  Athletes who won {newMedal === 'Any Medal' ? 'any match' : `a ${newMedal} medal`} per pool will be seeded into this category.
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Source Category (Optional)</label>
                <select
                  value={newSourceCategoryId}
                  onChange={e => setNewSourceCategoryId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: 'white' }}
                >
                  <option value="">Any Category (Filter by age/weight)</option>
                  {standardCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                  If selected, athletes will ONLY be drawn from this specific category's pools.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: '#6b7280' }}>Min Age (optional)</label>
                  <input type="number" placeholder="e.g. 18" value={newMinAge} onChange={e => setNewMinAge(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: '#6b7280' }}>Max Age (optional)</label>
                  <input type="number" placeholder="e.g. 35" value={newMaxAge} onChange={e => setNewMaxAge(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: '#6b7280' }}>Min Weight kg (optional)</label>
                  <input type="number" placeholder="e.g. 60" value={newMinWeight} onChange={e => setNewMinWeight(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: '#6b7280' }}>Max Weight kg (optional)</label>
                  <input type="number" placeholder="e.g. 90" value={newMaxWeight} onChange={e => setNewMaxWeight(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
          )}

          {/* Pool size (shared) */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Pool Size</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[4, 8, 16, 32].map(n => (
                <button key={n} onClick={() => setPoolSize(n)} style={{
                  padding: '7px 16px', fontWeight: 700, fontSize: '13px', borderRadius: '7px', cursor: 'pointer',
                  border: `2px solid ${poolSize === n ? '#3b82f6' : '#e5e7eb'}`,
                  background: poolSize === n ? '#eff6ff' : 'white', color: poolSize === n ? '#1d4ed8' : '#374151'
                }}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f9fafb' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          {mode === 'select' ? (
            <button
              onClick={handleGenerateExisting}
              disabled={!selectedCatId || generating}
              style={{ padding: '9px 20px', background: generating || !selectedCatId ? '#e5e7eb' : '#d97706', color: generating || !selectedCatId ? '#9ca3af' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: generating || !selectedCatId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Zap size={14} />
              {generating ? 'Generating...' : 'Generate Tiesheet'}
            </button>
          ) : (
            <button
              onClick={handleCreateAndGenerate}
              disabled={!newName.trim() || creatingNew}
              style={{ padding: '9px 20px', background: creatingNew || !newName.trim() ? '#e5e7eb' : '#d97706', color: creatingNew || !newName.trim() ? '#9ca3af' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: creatingNew || !newName.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={14} />
              {creatingNew ? 'Creating...' : 'Create & Generate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const handleDownloadTiesheets = async () => {
    if (downloadingTiesheets || categories.length === 0) return;
    setDownloadingTiesheets(true);
    try {
      const { exportTiesheetsPDF } = await import('@lib/tiesheet-pdf-exporter');
      await exportTiesheetsPDF({
        competitionName: compData?.name || 'TaikaiX Competition',
        categories: categories.map((c: any) => ({
          name: c.name,
          matches: c.matches ?? [],
          athletes: c.athletes ?? [],
          matNo: c.mat || '',
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

  const standardCategories = categories.filter(c => !c.isSpecial);
  const liveCategories = standardCategories.filter(c => c.status === 'live');
  const upcomingCategories = standardCategories.filter(c => c.status !== 'live' && c.status !== 'completed');
  const completedCategories = standardCategories.filter(c => c.status === 'completed');

  const liveSpecial = specialCategories.filter(c => c.status === 'live');
  const upcomingSpecial = specialCategories.filter(c => c.status !== 'live' && c.status !== 'completed' && c.matches?.length > 0);
  const completedSpecial = specialCategories.filter(c => c.status === 'completed');

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
        <div className="tiesheet-hero">
          <div>
            <h2 style={{ fontSize: '24px', margin: '0 0 4px 0' }}>Tiesheet Management</h2>
            <p style={{ fontSize: '14px', color: 'var(--neutral-500)', margin: 0 }}>
              {categories.length} categories • Click any category to open its bracket
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {categories.length > 0 && (
              <div className="search-container">
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
                    <button 
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
            <button className="btn-create-special" onClick={() => setSpecialModalOpen(true)}>
              <Star size={14} />
              Create Special Tiesheet
            </button>
            {categories.length > 0 && (
              <button 
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
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => openModal()}>
                <Eye size={16} />
                Open All Brackets
              </button>
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
          onClose={() => {
            setModalOpen(false);
            setHighlightMatchId(null);
          }}
          onPromote={handlePromote}
          onAssignMat={handleAssignMat}
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
            {cat.mat ? `MAT ${cat.mat.padStart(2, '0')} • LIVE` : 'LIVE'}
          </div>
        ) : isCompleted ? (
          <div style={{ color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            COMPLETED
          </div>
        ) : (
          <div style={{ color: isSpecial ? '#d97706' : 'var(--status-upcoming)' }}>
            {cat.mat ? `MAT ${cat.mat.padStart(2, '0')} • UPCOMING` : 'NOT ASSIGNED'}
          </div>
        )}
        <div>{athleteCount} ATHLETES</div>
      </div>
      {isSpecial && cat.medal && (
        <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>🥇 Seeded from: {cat.medal}</div>
      )}
      <div className="tiesheet-card-footer">
        <button className="btn-view-tiesheet">
          <Eye size={12} />
          View Tiesheet
        </button>
      </div>
    </div>
  );
}
