import React, { useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { X, Plus, Star, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SpecialCategoryModal({
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
