'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Edit3, Archive, Trash2, ArrowRight, X, Eye, EyeOff, UploadCloud, FileJson } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'react-hot-toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function CompetitionsPage() {
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '', dates: '', venue: '', type: 'national', rules: 'wkf', mats: '6', password: '',
    startTime: '09:00', endTime: '18:00', estMinsPerCategory: '60'
  });
  const [presetCategories, setPresetCategories] = useState<any[] | null>(null);
  const [presetFileName, setPresetFileName] = useState<string>('');
  const { user, role, loading: authLoading } = useAuth();
  
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; title: string; message: string; isDestructive: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', isDestructive: false, onConfirm: () => {} });

  const closeConfirm = () => setConfirmState(prev => ({ ...prev, isOpen: false }));

  React.useEffect(() => {
    let unsubscribe: () => void;
    
    const fetchComps = async () => {
      try {
        const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');
        const { db } = await import('@lib/firebase');
        const q = query(collection(db, 'competitions'), orderBy('createdAt', 'asc'));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          const comps: any[] = [];
          snapshot.forEach((doc) => {
            comps.push({ id: doc.id, ...doc.data() });
          });
          setCompetitions(comps);
          setLoading(false);
        });
      } catch (err) {
        console.error("Failed to fetch competitions", err);
        setLoading(false);
      }
    };

    fetchComps();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!authLoading && role !== 'admin' && role !== 'guest_viewer') {
      setFilter('live');
    }
  }, [role, authLoading]);

  const handleStatusChange = (compId: string, newStatus: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Change Status',
      message: `Are you sure you want to change the status to ${newStatus}?`,
      isDestructive: false,
      onConfirm: async () => {
        closeConfirm();
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('@lib/firebase');
          await updateDoc(doc(db, 'competitions', compId), { status: newStatus });
          toast.success('Status updated');
        } catch (e) {
          console.error(e);
          toast.error('Failed to update status');
        }
      }
    });
  };

  const handleDelete = (compId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Competition',
      message: 'Are you sure you want to delete this competition? This cannot be undone.',
      isDestructive: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          const { doc, deleteDoc } = await import('firebase/firestore');
          const { db } = await import('@lib/firebase');
          await deleteDoc(doc(db, 'competitions', compId));
          toast.success('Competition deleted');
        } catch (e) {
          console.error(e);
          toast.error('Failed to delete competition');
        }
      }
    });
  };

  const handlePresetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPresetFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          // Sanitize: strip entries/athletes so they start fresh
          const cleaned = imported.map((cat: any) => ({
            ...cat,
            id: Math.random().toString(36).substring(2, 9),
            entries: 0,
            athletes: []
          }));
          setPresetCategories(cleaned);
          toast.success(`Preset loaded: ${cleaned.length} categories ready`);
        } else {
          toast.error('Invalid preset format — expected a JSON array');
          setPresetCategories(null);
          setPresetFileName('');
        }
      } catch {
        toast.error('Failed to parse preset file');
        setPresetCategories(null);
        setPresetFileName('');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
      <style dangerouslySetInnerHTML={{__html: `
        .comp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: var(--space-5);
        }
        @media (max-width: 1024px) {
          .comp-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-4);
          }
        }
        @media (max-width: 700px) {
          .comp-grid {
            grid-template-columns: 1fr;
            gap: var(--space-3);
          }
        }
        .comp-card {
          position: relative;
          border-left: 4px solid var(--neutral-300);
          min-width: 0;
        }
        .comp-card.live { border-left-color: var(--aka); }
        .comp-card.upcoming { border-left-color: var(--status-upcoming); }
        .comp-card.done { border-left-color: var(--status-done); }

        .comp-actions {
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
          display: flex;
          gap: var(--space-2);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .comp-card:hover .comp-actions { opacity: 1; }

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
          width: 520px; max-width: min(90vw, 95%);
          max-height: 90dvh; display: flex; flex-direction: column;
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
        
        .modal-body { padding: 24px; overflow-y: auto; flex: 1; }
        .form-group { margin-bottom: 16px; }
        .form-group:last-child { margin-bottom: 0; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--neutral-700); }
        .input-field {
          width: 100%; height: 40px;
          border: 1.5px solid var(--neutral-300); border-radius: 8px;
          padding: 0 12px; font-size: 14px; font-family: var(--font-body); outline: none;
        }
        .input-field:focus { border-color: var(--ao); box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12); }
        
        .modal-footer {
          padding: 16px 24px; border-top: 1px solid var(--neutral-300);
          background: var(--neutral-50); display: flex; justify-content: flex-end; gap: 12px;
        }
        .timing-section {
          background: var(--neutral-50);
          border: 1px solid var(--neutral-200);
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 16px;
        }
        .timing-section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--neutral-500);
          margin-bottom: 12px;
        }
      `}} />

      {(role === 'admin' || role === 'guest_viewer') && (
        <div className="sub-nav">
          <button className={`sub-nav-link ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600}}>All Competitions</button>
          <button className={`sub-nav-link ${filter === 'live' ? 'active' : ''}`} onClick={() => setFilter('live')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600}}>Live</button>
          <button className={`sub-nav-link ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600}}>Upcoming</button>
          <button className={`sub-nav-link ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600}}>Archives</button>
        </div>
      )}

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">TaiKaiX / Competitions</div>
            <h1>Competition Directory</h1>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input type="text" placeholder="Search events..." id="comp-search" style={{ height: '40px', borderRadius: '6px', border: '1.5px solid var(--neutral-300)', padding: '0 var(--space-7) 0 var(--space-4)', fontFamily: 'var(--font-body)' }} />
              <Search style={{ position: 'absolute', right: '12px', top: '11px', width: '18px', color: 'var(--neutral-500)' }} />
            </div>
            {role === 'admin' && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus style={{ width: '18px', marginRight: '6px' }} /> Create New
              </button>
            )}
          </div>
        </header>

        <div className="comp-grid" id="competitions-grid">
          {loading ? (
             <div style={{ gridColumn: '1 / -1', padding: 'var(--space-8)', textAlign: 'center' }}>Loading...</div>
          ) : competitions.filter(c => filter === 'all' ? true : c.status === filter).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: 'var(--space-8)', textAlign: 'center', background: 'var(--shiro)', borderRadius: '16px', border: '1px dashed var(--neutral-300)' }}>
              <h3 style={{ color: 'var(--neutral-900)', marginBottom: '8px' }}>No Competitions Found</h3>
              <p style={{ color: 'var(--neutral-500)' }}>There are currently no events matching your criteria.</p>
              {role === 'admin' && (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                  <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    Create the first competition
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setConfirmState({
                        isOpen: true,
                        title: 'Add Dummy Competitions',
                        message: 'Add 3 dummy competitions to the database for testing?',
                        isDestructive: false,
                        onConfirm: async () => {
                          closeConfirm();
                          try {
                            const { collection, addDoc } = await import('firebase/firestore');
                            const { db } = await import('@lib/firebase');
                            
                            const dummies = [
                              { name: "Tokyo Open 2026", type: "international", rules: "wkf", status: "upcoming", mats: 4, createdAt: new Date().toISOString() },
                              { name: "Kyoto Nationals", type: "national", rules: "wkf", status: "upcoming", mats: 6, createdAt: new Date().toISOString() },
                              { name: "Osaka Regional Qualifier", type: "regional", rules: "wkf", status: "upcoming", mats: 2, createdAt: new Date().toISOString() }
                            ];
                            
                            await Promise.all(dummies.map(d => addDoc(collection(db, 'competitions'), d)));
                            toast.success('Added dummy competitions');
                          } catch (err) {
                            console.error(err);
                            toast.error("Failed to add dummy competitions.");
                          }
                        }
                      });
                    }}
                  >
                    Populate with Demo Data
                  </button>
                </div>
              )}
            </div>
          ) : (
            competitions.filter(c => filter === 'all' ? true : c.status === filter).map(comp => (
              <div key={comp.id} className={`card comp-card ${comp.status} card-interactive`}>
                {role === 'admin' && (
                  <div className="comp-actions">
                    {comp.status === 'upcoming' && (
                      <button className="btn btn-primary" style={{ padding: '6px 12px', height: 'auto', fontSize: '12px' }} onClick={() => handleStatusChange(comp.id, 'live')}>
                        Go Live
                      </button>
                    )}
                    {comp.status === 'live' && (
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', height: 'auto', fontSize: '12px', background: 'var(--status-done)', borderColor: 'var(--status-done)', color: 'white' }} onClick={() => handleStatusChange(comp.id, 'done')}>
                        Finish & Archive
                      </button>
                    )}
                    <button className="btn btn-ghost" style={{ padding: '6px', color: 'var(--aka)' }} onClick={() => handleDelete(comp.id)}>
                      <Trash2 style={{ width: '16px' }} />
                    </button>
                  </div>
                )}
                <div className="flex-between mb-2">
                  <span className={`status-chip status-${comp.status}`}>
                    {comp.status === 'live' ? 'Live Now' : comp.status === 'upcoming' ? 'Upcoming' : 'Completed'}
                  </span>
                  <span className="text-micro" style={{ color: 'var(--neutral-500)' }}>ID: {comp.id}</span>
                </div>
                <h3 style={{ fontSize: '22px', marginBottom: 'var(--space-1)' }}>{comp.name}</h3>
                <div className="text-small mb-2">{comp.dates} • {comp.venue}</div>
                {(comp.startTime || comp.estMinsPerCategory) && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '12px', color: 'var(--neutral-500)' }}>
                    {comp.startTime && <span>🕘 {comp.startTime} – {comp.endTime || '?'}</span>}
                    {comp.estMinsPerCategory && <span>⏱ {comp.estMinsPerCategory} min/category</span>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--neutral-100)' }}>
                  {comp.status === 'done' ? (
                    <>
                      <div>
                        <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Total Entries</div>
                        <div style={{ fontWeight: 600 }}>{comp.athletesCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Winners</div>
                        <div style={{ fontWeight: 600 }}>{comp.categoriesCount || 0}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      {comp.status === 'live' && (
                        <div>
                          <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Athletes</div>
                          <div style={{ fontWeight: 600 }}>{comp.athletesCount || 0}</div>
                        </div>
                      )}
                      {comp.status === 'upcoming' && (
                        <div>
                          <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Registered</div>
                          <div style={{ fontWeight: 600 }}>{comp.athletesCount || 0}</div>
                        </div>
                      )}
                      {comp.status === 'live' && (
                        <div>
                          <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Categories</div>
                          <div style={{ fontWeight: 600 }}>{comp.categoriesCount || 0}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>Mats</div>
                        <div style={{ fontWeight: 600 }}>{comp.mats || 0}</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-4">
                  {comp.status === 'live' && (
                    <Link href={`/competitions/${comp.id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                      {role === 'admin' || role === 'mat_operator' ? 'Manage Operations' : 'View Event'} <ArrowRight style={{ width: '16px', marginLeft: '6px' }} />
                    </Link>
                  )}
                  {comp.status === 'upcoming' && (role === 'admin' || role === 'guest_viewer') && (
                    <Link href={`/setup/${comp.id}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                      {role === 'admin' ? 'Setup Tournament' : 'View Setup'}
                    </Link>
                  )}
                  {comp.status === 'done' && (role === 'admin' || role === 'guest_viewer') && (
                    <Link href={`/archives/${comp.id}`} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', background: 'var(--neutral-50)', textDecoration: 'none' }}>
                      View Archives
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Create Competition Modal */}
      <div className={`modal-overlay ${isModalOpen ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3>Create New Competition</h3>
            <button className="close-btn" onClick={() => setIsModalOpen(false)}><X style={{width: '20px'}} /></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Competition Name</label>
              <input type="text" id="new-comp-name" className="input-field" placeholder="e.g. Kyoto 2026 Finals" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Dates</label>
                <input type="text" id="new-comp-dates" className="input-field" placeholder="e.g. May 15-18, 2026" value={formData.dates} onChange={e => setFormData(p => ({ ...p, dates: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Venue</label>
                <input type="text" id="new-comp-venue" className="input-field" placeholder="e.g. Nippon Budokan" value={formData.venue} onChange={e => setFormData(p => ({ ...p, venue: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Tournament Type</label>
                <select id="new-comp-type" className="input-field" style={{ background: 'white' }} value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}>
                  <option value="national">National Tournament</option>
                  <option value="international">International Tournament</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Rule Settings</label>
                <select
                  id="new-comp-rules"
                  className="input-field"
                  style={{ background: 'white' }}
                  value={formData.rules}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(p => ({ ...p, rules: val }));
                    // Clear preset if switching away from import_preset
                    if (val !== 'import_preset') {
                      setPresetCategories(null);
                      setPresetFileName('');
                    }
                  }}
                >
                  <option value="wkf">WKF</option>
                  <option value="custom">Custom Settings</option>
                  <option value="import_preset">Import Custom Preset</option>
                </select>
              </div>
            </div>

            {/* Inline Preset Upload — shown only when Import Preset is selected */}
            {formData.rules === 'import_preset' && (
              <div style={{ marginBottom: '16px' }}>
                {presetCategories ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--neutral-50)', border: '1.5px solid var(--ao)', borderRadius: '8px', padding: '10px 14px' }}>
                    <FileJson size={16} style={{ color: 'var(--ao)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{presetFileName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--neutral-500)' }}>{presetCategories.length} categories will be pre-loaded in setup</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPresetCategories(null); setPresetFileName(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', padding: '4px', display: 'flex', flexShrink: 0 }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
                      onClick={() => document.getElementById('preset-upload-create')?.click()}
                    >
                      <UploadCloud size={16} /> Choose Preset File (.json)
                    </button>
                    <input
                      id="preset-upload-create"
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={handlePresetUpload}
                    />
                  </>
                )}
                <input
                  type="file"
                  id="preset-upload-create"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handlePresetUpload}
                />
                <p style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '6px', marginBottom: 0 }}>
                  Upload a preset exported from a previous tournament to pre-populate categories in setup.
                </p>
              </div>
            )}

            <div className="form-group">
              <label>Number of Mats</label>
              <input type="number" id="new-comp-mats" className="input-field" placeholder="e.g. 6" min="1" max="20" style={{ width: '120px' }} value={formData.mats} onChange={e => setFormData(p => ({ ...p, mats: e.target.value }))} />
            </div>

            {/* Timing Section */}
            <div className="timing-section">
              <div className="timing-section-title">⏱ Schedule Settings</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--neutral-700)' }}>Start Time</label>
                  <input type="time" id="new-comp-start" className="input-field" value={formData.startTime} onChange={e => setFormData(p => ({ ...p, startTime: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--neutral-700)' }}>End Time</label>
                  <input type="time" id="new-comp-end" className="input-field" value={formData.endTime} onChange={e => setFormData(p => ({ ...p, endTime: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--neutral-700)' }}>Est. Min / Category</label>
                  <input type="number" id="new-comp-est" className="input-field" placeholder="60" min="5" max="240" value={formData.estMinsPerCategory} onChange={e => setFormData(p => ({ ...p, estMinsPerCategory: e.target.value }))} />
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '8px', marginBottom: 0 }}>
                These are used to auto-generate the competition schedule on deploy. Timings adapt automatically when categories finish early or late.
              </p>
            </div>

            <div className="form-group" style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: '16px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Competition Password
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--neutral-500)', background: 'var(--neutral-100)', padding: '2px 8px', borderRadius: '4px' }}>Required to access this competition</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Set a strong password..."
                  value={formData.password}
                  onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-500)', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--neutral-500)', marginTop: '6px' }}>⚠️ Share only with authorized staff.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => { setIsModalOpen(false); setPresetCategories(null); setPresetFileName(''); }}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => {
              const { name, dates, venue, type, rules, mats, password, startTime, endTime, estMinsPerCategory } = formData;
              if (!name.trim()) { toast.error('Competition name is required'); return; }
              if (!password.trim()) { toast.error('A password is required to protect this competition'); return; }
              if (rules === 'import_preset' && (!presetCategories || presetCategories.length === 0)) {
                toast.error('Please upload a preset file before creating'); return;
              }
              
              try {
                const { collection, addDoc, doc, setDoc } = await import('firebase/firestore');
                const { db } = await import('@lib/firebase');
                
                const compData = {
                  name, dates, venue, type,
                  // Store as 'custom' so the setup wizard treats it as custom with preset categories
                  rules: rules === 'import_preset' ? 'custom' : rules,
                  mats: parseInt(mats),
                  password,
                  startTime: startTime || '09:00',
                  endTime: endTime || '18:00',
                  estMinsPerCategory: parseInt(estMinsPerCategory) || 60,
                  status: 'upcoming',
                  createdAt: new Date().toISOString()
                };
                
                const newDocRef = await addDoc(collection(db, 'competitions'), compData);

                // If a preset was loaded, save it as the setup draft so the wizard picks it up
                if (presetCategories && presetCategories.length > 0) {
                  await setDoc(
                    doc(db, 'competitions', newDocRef.id, 'drafts', 'setup'),
                    {
                      compName: name,
                      compRules: rules,
                      compType: type,
                      matsCount: parseInt(mats),
                      categories: presetCategories,
                      lastActivePhase: 1,
                      highestPhase: 1,
                      createdFromPreset: true,
                      presetLoadedAt: new Date().toISOString()
                    }
                  );
                }

                toast.success('Competition created successfully!');
                setIsModalOpen(false);
                setFormData({ name: '', dates: '', venue: '', type: 'national', rules: 'wkf', mats: '6', password: '', startTime: '09:00', endTime: '18:00', estMinsPerCategory: '60' });
                setPresetCategories(null);
                setPresetFileName('');
              } catch (err) {
                console.error(err);
                toast.error('Failed to create competition');
              }
            }}>Create Competition</button>
          </div>
        </div>
      </div>
    </>
  );
}
