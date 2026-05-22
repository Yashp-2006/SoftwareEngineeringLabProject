'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Save, CheckCircle, Combine, Plus, Edit2, Trash2, Star, FileSpreadsheet, RefreshCw, Key, ChevronDown, Eye, EyeOff, UploadCloud, X } from 'lucide-react';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';

export default function SetupWizard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [activePhase, setActivePhase] = useState(1);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [matsCount, setMatsCount] = useState(8);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});
  const [deploying, setDeploying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatedData, setGeneratedData] = useState<any[]>([]);
  const [modalType, setModalType] = useState<'standard'|'special'|'merge'|null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewCatIndex, setPreviewCatIndex] = useState<number | null>(null);
  const [modalFormData, setModalFormData] = useState<any>({});
  
  const [compRules, setCompRules] = useState<string>('');
  const [compType, setCompType] = useState<string>('international');
  const [categories, setCategories] = useState<any[]>([]);
  const [specialCategories, setSpecialCategories] = useState<any[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchComp = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@lib/firebase');
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists()) {
          const data = snap.data();
          setCompRules(data.rules);
          setCompType(data.type || 'international');
          
          if (data.rules === 'wkf') {
            const { WKF_CATEGORIES } = await import('@lib/wkf-categories');
            setCategories(WKF_CATEGORIES.map(name => ({ id: name, name, entries: 0 })));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchComp();
  }, [id]);

  const toggleCategorySelection = (catId: string) => {
    const newSet = new Set(selectedCats);
    if (newSet.has(catId)) newSet.delete(catId);
    else newSet.add(catId);
    setSelectedCats(newSet);
  };

  const handleMerge = () => {
    if (selectedCats.size < 2) {
      alert("Select at least 2 categories to merge.");
      return;
    }
    const newName = prompt("Enter the name for the merged category:", Array.from(selectedCats).join(' / '));
    if (newName) {
      const remaining = categories.filter(c => !selectedCats.has(c.id));
      remaining.unshift({ id: newName, name: newName, entries: 0 });
      setCategories(remaining);
      setSelectedCats(new Set());
    }
  };

  const togglePassword = (idx: number) => {
    setShowPasswordMap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleNext = () => {
    if (activePhase < 5) setActivePhase(activePhase + 1);
  };
  const handleBack = () => {
    if (activePhase > 1) setActivePhase(activePhase - 1);
  };

  const setPhase = (p: number) => {
    setActivePhase(p);
    if (p < 5) setIsReviewMode(false);
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('compType', compType);
      formData.append('specialCategories', JSON.stringify(specialCategories));
      
      const res = await fetch(`/api/competitions/${id}/import`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        setGeneratedData(data.data);
        alert('Tiesheet successfully generated! Review Phase 3.');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload and generate tiesheet.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const { db } = await import('@lib/firebase');
      const { writeBatch, doc, collection } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const allCats = [...categories, ...specialCategories];
      // Auto-distribute evenly across mats starting at 09:00
      // Track the current end time for each mat
      const matTimes = Array.from({ length: matsCount }).map(() => ({ hours: 9, minutes: 0 }));
      
      allCats.forEach((cat, index) => {
        const matIndex = index % matsCount;
        const matName = `MAT ${String(matIndex + 1).padStart(2, '0')}`;
        const estimatedDuration = (cat.entries || 1) * 2; // 2 mins per entry default
        
        const startH = matTimes[matIndex].hours;
        const startM = matTimes[matIndex].minutes;
        const startTimeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
        
        let endM = startM + estimatedDuration;
        let endH = startH + Math.floor(endM / 60);
        endM = endM % 60;
        const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        
        matTimes[matIndex].hours = endH;
        matTimes[matIndex].minutes = endM;
        
        const catRef = doc(collection(db, 'competitions', id, 'categories'));
        batch.set(catRef, {
          name: cat.name,
          entries: cat.entries || 0,
          status: 'upcoming',
          mat: matName,
          estimatedDuration: estimatedDuration,
          scheduledStartTime: startTimeStr,
          scheduledEndTime: endTimeStr,
          order: index,
          isSpecial: !!cat.medal
        });
      });
      
      await batch.commit();
      alert("Deployment successful! Schedule generated and saved.");
    } catch (err) {
      console.error(err);
      alert("Failed to deploy tournament.");
    } finally {
      setDeploying(false);
    }
  };

  const handleFinalize = async () => {
    try {
      const { collection, doc, writeBatch } = await import('firebase/firestore');
      const { db } = await import('@lib/firebase');
      
      const batch = writeBatch(db);
      
      // Save all generated categories with matches EMBEDDED as array field
      // This allows the bracket page to read cat.matches directly without subcollection query
      for (const cat of generatedData) {
        const catRef = doc(collection(db, 'competitions', id, 'categories'));
        batch.set(catRef, {
          competitionId: id,
          name: cat.categoryName,
          status: 'upcoming',
          athletes: cat.athletes,
          // Embed matches array directly on the category doc for easy real-time reading
          matches: cat.matches.map((match: any) => ({
            id: match.id,
            round: match.round,
            matchNumber: match.matchNumber,
            aka: match.aka || null,
            ao: match.ao || null,
            akaScore: 0,
            aoScore: 0,
            winnerId: match.winnerId || null,
            nextMatchId: match.nextMatchId || null,
            akaFromMatchId: match.akaFromMatchId || null,
            aoFromMatchId: match.aoFromMatchId || null,
            status: 'upcoming',
            mat: null
          }))
        });
      }
      
      await batch.commit();
      alert('Tournament Setup Finalized and saved to database!');
    } catch (err) {
      console.error(err);
      alert('Failed to save to database.');
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .setup-grid { display: flex; flex-direction: column; gap: var(--space-5); }
        .wizard-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); flex-wrap: wrap; }
        .wizard-stepper { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--space-3); }
        .wizard-step { border: 1px solid var(--neutral-300); background: var(--shiro); padding: 12px 14px; border-radius: 10px; text-align: left; cursor: pointer; transition: all 0.2s; }
        .wizard-step:hover { border-color: var(--neutral-400); transform: translateY(-1px); }
        .wizard-step-number { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 999px; background: var(--neutral-100); color: var(--neutral-600); font-weight: 700; font-size: 12px; margin-bottom: 6px; }
        .wizard-step.active { border-color: var(--ao); box-shadow: 0 6px 18px rgba(39, 122, 255, 0.15); }
        .wizard-step.active .wizard-step-number { background: var(--ao); color: var(--shiro); }
        .wizard-step.completed { border-color: var(--neutral-200); background: var(--neutral-50); }
        .wizard-step-label { font-size: 13px; font-weight: 600; color: var(--neutral-800); }
        .review-banner { background: var(--neutral-50); border: 1px dashed var(--neutral-300); border-radius: 14px; padding: var(--space-5); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
        .phase-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-4); }
        .wizard-actions { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--neutral-200); }
        .pool-size-options { display: flex; gap: var(--space-3); flex-wrap: wrap; }
        .pool-size-option { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
        .pool-size-option input { display: none; }
        .pool-size-option span { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; height: 40px; border-radius: 999px; border: 1px solid var(--neutral-300); background: var(--shiro); font-weight: 600; }
        .pool-size-option input:checked + span { background: var(--ao); color: var(--shiro); border-color: var(--ao); }
        .tiesheet-preview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4); margin-top: var(--space-4); }
        .category-manager { display: flex; flex-direction: column; gap: var(--space-6); }
        .cat-group { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-5); }
        .cat-table { width: 100%; border-collapse: collapse; margin-top: var(--space-4); }
        .cat-table th { text-align: left; padding: 12px; border-bottom: 2px solid var(--neutral-100); }
        .cat-table td { padding: 12px; border-bottom: 1px solid var(--neutral-100); }
        .dropzone { border: 2px dashed var(--neutral-300); border-radius: 12px; padding: var(--space-8); text-align: center; background: var(--neutral-50); transition: all 0.2s; cursor: pointer; }
        .dropzone:hover { border-color: var(--ao); background: var(--ao-light); }
        .mat-setup-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4); }
        .mat-setup-card { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-4); }
        .mat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
        .mat-number-badge { font-family: var(--font-display); font-size: 20px; color: var(--neutral-900); }
        .password-input-group { position: relative; }
        .password-input-group input { width: 100%; height: 40px; border: 1.5px solid var(--neutral-300); border-radius: 8px; padding: 0 40px 0 12px; font-family: var(--font-mono); font-size: 14px; outline: none; }
        .password-input-group input:focus { border-color: var(--ao); }
        .toggle-password { position: absolute; right: 12px; top: 10px; color: var(--neutral-400); cursor: pointer; }
        @media (max-width: 1100px) { .wizard-stepper { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 700px) { .wizard-stepper { grid-template-columns: 1fr; } }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">Kyoto 2026 Finals / Setup</div>
            <h1>Tournament Setup Wizard</h1>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary">
              <Save size={16} /> Save Draft
            </button>
            <button className="btn btn-primary" onClick={handleFinalize} disabled={generatedData.length === 0}>
              <CheckCircle size={16} /> Finalize Setup
            </button>
          </div>
        </header>

        <div className="setup-grid">
          <div className="wizard-header">
            <div>
              <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Setup Wizard</div>
              <h2 style={{ margin: 0 }}>Guided Tournament Setup</h2>
              <p className="text-small" style={{ marginTop: '4px' }}>Move through five phases and skip straight to review if you already know what to fix.</p>
            </div>
            <div>
              <button className="btn btn-ghost" onClick={() => { setIsReviewMode(true); setActivePhase(5); }}>
                Skip to Review <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </button>
            </div>
          </div>

          <div className="wizard-stepper">
            <button className={`wizard-step ${activePhase === 1 ? 'active' : ''} ${activePhase > 1 || isReviewMode ? 'completed' : ''}`} onClick={() => setPhase(1)}>
              <div className="wizard-step-number">1</div>
              <div className="wizard-step-label">Categories + Mats</div>
            </button>
            <button className={`wizard-step ${activePhase === 2 ? 'active' : ''} ${activePhase > 2 || isReviewMode ? 'completed' : ''}`} onClick={() => setPhase(2)}>
              <div className="wizard-step-number">2</div>
              <div className="wizard-step-label">Pool Size + Import</div>
            </button>
            <button className={`wizard-step ${activePhase === 3 ? 'active' : ''} ${activePhase > 3 || isReviewMode ? 'completed' : ''}`} onClick={() => setPhase(3)}>
              <div className="wizard-step-number">3</div>
              <div className="wizard-step-label">Tiesheet Preview</div>
            </button>
            <button className={`wizard-step ${activePhase === 4 ? 'active' : ''} ${activePhase > 4 || isReviewMode ? 'completed' : ''}`} onClick={() => setPhase(4)}>
              <div className="wizard-step-number">4</div>
              <div className="wizard-step-label">Staff + Mat Security</div>
            </button>
            <button className={`wizard-step ${activePhase === 5 ? 'active' : ''}`} onClick={() => setPhase(5)}>
              <div className="wizard-step-number">5</div>
              <div className="wizard-step-label">Review & Edit</div>
            </button>
          </div>

          <div className="wizard-actions">
            <div className="text-small">Step {activePhase} of 5</div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" disabled={activePhase === 1} onClick={handleBack}>Back</button>
              <button className="btn btn-primary" disabled={activePhase === 5} onClick={handleNext}>Next</button>
            </div>
          </div>

          {(activePhase === 5 || isReviewMode) && (
            <section className="wizard-phase active">
              <div className="review-banner">
                <div>
                  <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Phase 5</div>
                  <h3 style={{ margin: 0 }}>Review & Edit Everything</h3>
                  <p className="text-small" style={{ marginTop: '4px' }}>All sections are unlocked. Edit any step and the tiesheet preview will flag for regeneration.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost" onClick={() => setPhase(4)}>Return to Step 4</button>
                  <button className="btn btn-primary" disabled={deploying} onClick={handleDeploy}>
                    {deploying ? 'Deploying...' : 'Deploy Tournament'}
                  </button>
                </div>
              </div>
              <div className="category-manager" style={{ marginTop: 'var(--space-4)' }}>
                <div className="cat-group">
                  <h3>Tournament Profile</h3>
                  <p className="text-small mb-4">Basic information about the event.</p>
                  <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Tournament Name</label>
                    <input type="text" className="input-field" defaultValue="Kyoto 2026 Finals" style={{ marginBottom: 0 }} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {(activePhase === 1 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 1 — Categories + Mats</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Define divisions and set how many mats will be active for the tournament.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                <div className="cat-group">
                  <div className="flex-between">
                    <div>
                      <h3>Mats & Capacity</h3>
                      <p className="text-small">The mat count drives score operator assignments and security setup.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', marginTop: 'var(--space-4)' }}>
                    <div style={{ flex: 1 }}>
                      <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Total Active Mats</label>
                      <input type="number" className="input-field" value={matsCount} onChange={e => setMatsCount(parseInt(e.target.value) || 1)} min="1" max="20" style={{ marginBottom: 0 }} />
                    </div>
                    <button className="btn btn-primary" style={{ height: '44px', padding: '0 24px' }}>Apply Capacity</button>
                  </div>
                </div>

                <div className="cat-group">
                  <div className="flex-between">
                    <div>
                      <h3>Standard Categories</h3>
                      <p className="text-small">Generic weight and age divisions without complex prerequisite rules.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      {compRules === 'wkf' ? (
                        <button className="btn btn-secondary" onClick={handleMerge} disabled={selectedCats.size < 2}>
                          <Combine size={16} /> Merge Selected
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-ghost" onClick={() => setModalType('merge')}>
                            <Combine size={16} /> Merge Categories
                          </button>
                          <button className="btn btn-secondary" onClick={() => setModalType('standard')}>
                            <Plus size={16} /> Add Standard
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="cat-table">
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--shiro)', zIndex: 10 }}>
                        <tr>
                          {compRules === 'wkf' && <th style={{ width: '40px' }}></th>}
                          <th>Category Name</th>
                          <th>Requirements</th>
                          <th>Entries</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat, idx) => (
                          <tr key={cat.id || idx}>
                            {compRules === 'wkf' && (
                              <td>
                                <input 
                                  type="checkbox" 
                                  checked={selectedCats.has(cat.id)}
                                  onChange={() => toggleCategorySelection(cat.id)}
                                />
                              </td>
                            )}
                            <td style={{ fontWeight: 500 }}>{cat.name}</td>
                            <td>
                              <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>Standard</span>
                            </td>
                            <td>{cat.entries}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button className="btn btn-ghost" style={{ padding: '4px' }}><Edit2 size={16} /></button>
                              <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--aka)' }} onClick={() => setCategories(categories.filter(c => c.id !== cat.id))}><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                        {categories.length === 0 && (
                          <tr>
                            <td colSpan={compRules === 'wkf' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--neutral-500)', padding: 'var(--space-6)' }}>
                              No categories defined.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="cat-group">
                  <div className="flex-between">
                    <div>
                      <h3>Special Categories</h3>
                      <p className="text-small">Custom divisions with specific prerequisite rules (e.g. Gold Medalists only).</p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setModalType('special')}>
                      <Star size={16} /> Add Special Category
                    </button>
                  </div>
                  <div className="table-responsive">
                    <table className="cat-table">
                      <thead>
                      <tr>
                        <th className="text-micro">Category Name</th>
                        <th className="text-micro">Applied Rules</th>
                        <th className="text-micro">Est. Athletes</th>
                        <th className="text-micro" style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specialCategories.map((cat, idx) => (
                        <tr key={cat.id || idx}>
                          <td style={{ fontWeight: 500 }}>{cat.name}</td>
                          <td>
                            <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>Medal: {cat.medal || 'Any'}</span>
                            <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>
                              Age: {cat.minAge || 0}-{cat.maxAge || 99}
                            </span>
                            <span className="status-chip status-live" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}>
                              Weight: {cat.minWeight || 0}-{cat.maxWeight || 300}kg
                            </span>
                          </td>
                          <td>{cat.entries || 0}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-ghost" style={{ padding: '4px' }}><Edit2 size={16} /></button>
                            <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--aka)' }} onClick={() => setSpecialCategories(specialCategories.filter(c => c.id !== cat.id))}><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                      {specialCategories.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--neutral-500)', padding: 'var(--space-6)' }}>
                            No special categories defined.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {(activePhase === 2 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 2 — Match Pool Size + Excel Import</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Choose a pool size and import athletes to generate tiesheets.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                <div className="cat-group">
                  <h3>Match Pool Size</h3>
                  <p className="text-small">Pick a standard pool size. Max supported size is 32.</p>
                  <div className="pool-size-options" style={{ marginTop: 'var(--space-4)' }}>
                    <label className="pool-size-option"><input type="radio" name="pool-size" value="4" /><span>4</span></label>
                    <label className="pool-size-option"><input type="radio" name="pool-size" value="8" defaultChecked /><span>8</span></label>
                    <label className="pool-size-option"><input type="radio" name="pool-size" value="16" /><span>16</span></label>
                    <label className="pool-size-option"><input type="radio" name="pool-size" value="32" /><span>32</span></label>
                  </div>
                </div>

                <div className="cat-group">
                  <div className="flex-between mb-4">
                    <div>
                      <h3>Tiesheet Data Import</h3>
                      <p className="text-small">Upload your CSV or Excel files to automatically generate brackets.</p>
                    </div>
                  </div>
                  <div className="dropzone" onClick={() => document.getElementById('excel-upload')?.click()}>
                    <FileSpreadsheet className="dropzone-icon" />
                    <h3>Drag & drop your registration file here</h3>
                    <p className="text-small" style={{ marginBottom: 'var(--space-4)' }}>Supports .csv, .xls, .xlsx (Max 10MB)</p>
                    <button className="btn btn-primary" disabled={uploading}>
                      {uploading ? 'Processing...' : 'Browse Files'}
                    </button>
                    <input type="file" id="excel-upload" style={{ display: 'none' }} accept=".csv, .xls, .xlsx" onChange={handleFileUpload} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {(activePhase === 3 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 3 — Tiesheet Generation Preview</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Preview tiesheets per category and regenerate if changes were made.</p>
                  </div>
                  <button className="btn btn-secondary">
                    <RefreshCw size={16} /> Regenerate
                  </button>
                </div>
              )}
              <div className="cat-group">
                <p className="text-small">Pool size: 8 (max 32)</p>
                {generatedData.length === 0 ? (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--neutral-50)', borderRadius: '12px', border: '1px dashed var(--neutral-300)' }}>
                    <p style={{ color: 'var(--neutral-500)' }}>Upload an Excel file in Phase 2 to generate tiesheets.</p>
                  </div>
                ) : (
                  <div className="mat-setup-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0' }}>{generatedData.length} Categories Generated</h4>
                      <p className="text-small" style={{ color: 'var(--neutral-500)', margin: 0 }}>
                        {generatedData.reduce((acc: number, cat: any) => acc + cat.athletes.length, 0)} Total Athletes • {generatedData.reduce((acc: number, cat: any) => acc + cat.matches.length, 0)} Total Matches
                      </p>
                    </div>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => setPreviewModalOpen(true)}
                    >
                      <Eye size={16} style={{ marginRight: '8px' }} />
                      Open Preview
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {(activePhase === 4 || isReviewMode) && (
            <section className="wizard-phase active">
              {!isReviewMode && (
                <div className="phase-header">
                  <div>
                    <h3 style={{ margin: 0 }}>Phase 4 — Staff Assignment + Mat Security</h3>
                    <p className="text-small" style={{ marginTop: '4px' }}>Lock in who runs each mat, attendance coverage, medal distribution, and passwords.</p>
                  </div>
                </div>
              )}
              <div className="category-manager">
                <div className="cat-group">
                  <div className="flex-between mb-4">
                    <div>
                      <h3>Mat Security</h3>
                      <p className="text-small">Set unique access passwords for each mat score table.</p>
                    </div>
                    <button className="btn btn-ghost">
                      <Key size={16} /> Bulk Set
                    </button>
                  </div>
                  <div className="mat-setup-list">
                    {Array.from({ length: matsCount }).map((_, i) => (
                      <div key={i} className="mat-setup-card">
                        <div className="mat-header">
                          <div className="mat-number-badge">{i + 1}</div>
                          <span className="status-chip" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)' }}>Pending</span>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="text-micro">Scoreboard Access Password</label>
                          <div className="password-input-group">
                            <input type={showPasswordMap[i] ? "text" : "password"} placeholder="Enter mat password" />
                            <div className="toggle-password" onClick={() => togglePassword(i)}>
                              {showPasswordMap[i] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cat-group">
                  <div className="flex-between">
                    <div>
                      <h3>Attendance Volunteers</h3>
                      <p className="text-small">Assign volunteers to manage athlete attendance per category.</p>
                    </div>
                  </div>
                  <table className="cat-table">
                    <thead>
                      <tr>
                        <th className="text-micro">Category</th>
                        <th className="text-micro">Assigned Volunteer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 500 }}>Senior Male -75kg</td>
                        <td>
                          <select className="input-field" style={{ height: '36px', marginBottom: 0 }}>
                            <option value="">Unassigned</option>
                            <option value="john">John Doe</option>
                            <option value="jane">Jane Smith</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>

      <div className={`modal-overlay ${modalType ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3>
              {modalType === 'standard' && 'Add Standard Category'}
              {modalType === 'special' && 'Create Special Category'}
              {modalType === 'merge' && 'Merge Categories'}
            </h3>
            <button className="close-btn" onClick={() => { setModalType(null); setModalFormData({}); }}><X size={16} /></button>
          </div>
          <div className="modal-body">
            {modalType === 'standard' && (
              <>
                <div className="form-group">
                  <label>Category Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Senior Male -75kg" value={modalFormData.name || ''} onChange={e => setModalFormData({...modalFormData, name: e.target.value})} />
                </div>
              </>
            )}
            {modalType === 'special' && (
              <>
                <div className="form-group">
                  <label>Special Category Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Super Gold Open" value={modalFormData.name || ''} onChange={e => setModalFormData({...modalFormData, name: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Medal Requirement</label>
                    <select className="input-field" style={{ background: 'white' }} value={modalFormData.medal || ''} onChange={e => setModalFormData({...modalFormData, medal: e.target.value})}>
                      <option value="">Any Medal</option>
                      <option value="Gold Only">Gold Only</option>
                      <option value="Silver or Above">Silver or Above</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Min Age</label>
                    <input type="number" className="input-field" placeholder="0" value={modalFormData.minAge || ''} onChange={e => setModalFormData({...modalFormData, minAge: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Max Age</label>
                    <input type="number" className="input-field" placeholder="99" value={modalFormData.maxAge || ''} onChange={e => setModalFormData({...modalFormData, maxAge: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Min Weight (kg)</label>
                    <input type="number" className="input-field" placeholder="0" value={modalFormData.minWeight || ''} onChange={e => setModalFormData({...modalFormData, minWeight: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Max Weight (kg)</label>
                    <input type="number" className="input-field" placeholder="300" value={modalFormData.maxWeight || ''} onChange={e => setModalFormData({...modalFormData, maxWeight: e.target.value})} />
                  </div>
                </div>
              </>
            )}
            {modalType === 'merge' && (
              <>
                <div className="form-group">
                  <label>New Merged Category Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Cadet Female +61kg merged" value={modalFormData.name || ''} onChange={e => setModalFormData({...modalFormData, name: e.target.value})} />
                </div>
                <p className="text-small" style={{ color: 'var(--neutral-500)' }}>Select categories to merge from the list in WKF mode, or type the name manually here if custom.</p>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setModalType(null); setModalFormData({}); }}>Cancel</button>
            <button className="btn btn-primary" onClick={() => {
              if (modalType === 'standard' && modalFormData.name) {
                setCategories([...categories, { id: modalFormData.name, name: modalFormData.name, entries: 0 }]);
              } else if (modalType === 'special' && modalFormData.name) {
                setSpecialCategories([...specialCategories, { 
                  id: modalFormData.name, 
                  name: modalFormData.name, 
                  medal: modalFormData.medal, 
                  minAge: parseInt(modalFormData.minAge) || 0,
                  maxAge: parseInt(modalFormData.maxAge) || 99,
                  minWeight: parseFloat(modalFormData.minWeight) || 0,
                  maxWeight: parseFloat(modalFormData.maxWeight) || 300,
                  entries: 0 
                }]);
              } else if (modalType === 'merge' && modalFormData.name) {
                 setCategories([...categories, { id: modalFormData.name, name: modalFormData.name, entries: 0 }]);
              }
              setModalType(null);
              setModalFormData({});
            }}>Confirm Action</button>
          </div>
        </div>
      </div>

      {/* Fullscreen Tiesheet Preview Modal — for Phase 3 */}
      {previewModalOpen && generatedData.length > 0 && (
        <FullscreenBracketModal
          categories={generatedData.map((cat: any, idx: number) => ({
            id: String(idx),
            name: cat.categoryName,
            matches: cat.matches,
            athletes: cat.athletes,
            status: 'upcoming'
          }))}
          initialCategoryId="0"
          onClose={() => setPreviewModalOpen(false)}
        />
      )}
    </>
  );
}
