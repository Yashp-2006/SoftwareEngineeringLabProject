'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@lib/firebase';
import { collection, onSnapshot, query, doc, getDoc } from 'firebase/firestore';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';
import { Eye, Trophy, Target, Clock, X, Plus, Star, Zap, Download, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';

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
  const [newMedals, setNewMedals] = useState<string[]>(['Gold']);
  const [newSourceCategoryIds, setNewSourceCategoryIds] = useState<string[]>([]);
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
        medals: newMedals,
        isSpecial: true,
        status: 'upcoming',
        athletes: [],
        matches: [],
        order: 9999,
        createdAt: new Date().toISOString(),
      };
      if (newSourceCategoryIds.length > 0) {
        catData.sourceCategoryIds = newSourceCategoryIds;
        const selectedCats = standardCategories.filter(c => newSourceCategoryIds.includes(c.id));
        if (selectedCats.length > 0) {
          const minAges = selectedCats.map(c => c.minAge ?? 0).filter(a => !isNaN(a));
          const maxAges = selectedCats.map(c => c.maxAge ?? 999).filter(a => !isNaN(a));
          const minWeights = selectedCats.map(c => c.minWeight ?? 0).filter(w => !isNaN(w));
          const maxWeights = selectedCats.map(c => c.maxWeight ?? 999).filter(w => !isNaN(w));
          if (minAges.length > 0) catData.minAge = Math.min(...minAges);
          if (maxAges.length > 0) catData.maxAge = Math.max(...maxAges);
          if (minWeights.length > 0) catData.minWeight = Math.min(...minWeights);
          if (maxWeights.length > 0) catData.maxWeight = Math.max(...maxWeights);
        }
      }

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
                  {(['Gold', 'Silver', 'Bronze'] as const).map(m => {
                    const isSelected = newMedals.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          if (isSelected) {
                            if (newMedals.length > 1) {
                              setNewMedals(prev => prev.filter(x => x !== m));
                            } else {
                              toast.error('Must select at least one medal tier');
                            }
                          } else {
                            setNewMedals(prev => [...prev, m]);
                          }
                        }}
                        style={{
                          flex: 1, padding: '8px 6px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer',
                          border: `2px solid ${isSelected ? '#d97706' : '#e5e7eb'}`,
                          background: isSelected ? '#fffbeb' : 'white',
                          color: isSelected ? '#92400e' : '#374151'
                        }}
                      >{m}</button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                  Athletes who won the selected medals per pool will be seeded into this category.
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Source Categories (Optional)</label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1.5px solid #d1d5db', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {standardCategories.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={newSourceCategoryIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewSourceCategoryIds(prev => [...prev, c.id]);
                          else setNewSourceCategoryIds(prev => prev.filter(id => id !== c.id));
                        }}
                      />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                  If selected, athletes will ONLY be drawn from these specific categories. The age and weight rules will automatically be derived from these source categories.
                </p>
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
  const [disciplineFilter, setDisciplineFilter] = useState<'All' | 'Kumite' | 'Kata'>('All');

  const { role } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
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
                <button className="btn-create-special" onClick={() => setSpecialModalOpen(true)}>
                  <Star size={14} />
                  Create Special Tiesheet
                </button>
              )}
              {role === 'admin' && (
                <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsAddModalOpen(true)}>
                  <UserPlus size={16} />
                  Add On-Spot Entry
                </button>
              )}
              {categories.length > 0 && role === 'admin' && (
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
        <button className="btn-view-tiesheet">
          <Eye size={12} />
          View Tiesheet
        </button>
      </div>
    </div>
  );
}
