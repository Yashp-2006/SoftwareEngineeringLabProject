'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/auth/AuthProvider';
import { LayoutGrid, Plus, Timer, Activity, Coffee, CalendarPlus, Key, Eye, EyeOff, Trash2, Image as ImageIcon, X, Trophy, Medal } from 'lucide-react';
import toast from 'react-hot-toast';
import { sortCategories } from '@/lib/categoryUtils';

interface MatData {
  id: string; // e.g. 'mat-1'
  name: string; // e.g. 'MAT 01'
  order: number;
  password?: string;
}

interface RTDBMatState {
  status: 'live' | 'standby' | 'paused' | 'upcoming';
  currentCategory?: string;
  currentMatch?: string; // e.g. "Semi-Final"
  scores?: {
    aka: number;
    ao: number;
    akaPen: number;
    aoPen: number;
  };
  timeRemaining?: string; // e.g. "01:42"
}

export default function MatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { role } = useAuth();

  // Viewers: anyone who is not admin/guest_viewer or mat_operator
  const isViewer = role !== 'admin' && role !== 'guest_viewer' && role !== 'mat_operator';
  // Config/write ops: only admin or guest_viewer (not mat_operator)
  const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';

  const [mats, setMats] = useState<MatData[]>([]);
  const [liveStates, setLiveStates] = useState<Record<string, RTDBMatState>>({});
  const [categoryByMat, setCategoryByMat] = useState<Record<string, { name: string; status: string; entries: number; athletes: any[] }[]>>({});
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [compMatsCount, setCompMatsCount] = useState<number>(6);
  const [showConfig, setShowConfig] = useState(false);
  const [scoreboardLogo, setScoreboardLogo] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});

  useEffect(() => {
    let unsubFirestore: () => void;
    let unsubCats: () => void;
    let rtdbUnsubs: Record<string, () => void> = {};

    const setup = async () => {
      const [{ db, rtdb }, { collection, onSnapshot, query, orderBy, getDoc, doc }, { ref, onValue, off }] = await Promise.all([
        import('@lib/firebase'),
        import('firebase/firestore'),
        import('firebase/database'),
      ]);

      // Start all listeners in parallel
      const [compSnap] = await Promise.all([
        getDoc(doc(db, 'competitions', id)),
      ]);
      if (compSnap.exists()) {
        const cData = compSnap.data();
        if (cData.mats) setCompMatsCount(cData.mats);
        if (cData.scoreboardLogo) setScoreboardLogo(cData.scoreboardLogo);
      }

      // Categories listener
      const catsQ = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubCats = onSnapshot(catsQ, (snap) => {
        const byMat: Record<string, { name: string; status: string; entries: number; athletes: any[] }[]> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          const matName = (data.mat || '').toUpperCase();
          if (!byMat[matName]) byMat[matName] = [];
          byMat[matName].push({ name: data.name, status: data.status || 'upcoming', entries: data.entries || 0, athletes: data.athletes || [] });
        });
        Object.keys(byMat).forEach(matName => {
          byMat[matName] = sortCategories(byMat[matName]);
        });
        setCategoryByMat(byMat);
      });

      // Mats listener
      const matsQ = query(collection(db, 'competitions', id, 'mats'), orderBy('order'));
      unsubFirestore = onSnapshot(matsQ, (snap) => {
        const matsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as MatData));
        setMats(matsList);
        setLoading(false);

        // Subscribe to RTDB for each mat (skip already-subscribed)
        matsList.forEach(mat => {
          if (!rtdbUnsubs[mat.id]) {
            const matRef = ref(rtdb, `live_scores/${id}/mats/${mat.id}`);
            const listener = onValue(matRef, (snapshot) => {
              const data = snapshot.val();
              setLiveStates(prev => ({ ...prev, [mat.id]: data || { status: 'standby' } }));
            });
            rtdbUnsubs[mat.id] = () => off(matRef, 'value', listener);
          }
        });
      });
    };

    setup();

    return () => {
      if (unsubFirestore) unsubFirestore();
      if (unsubCats) unsubCats();
      Object.values(rtdbUnsubs).forEach(unsub => unsub());
    };
  }, [id]);

  // Removed GSAP stagger animation per user request (no fades)

  const handleSeedMats = async () => {
    setIsSeeding(true);
    try {
      const { db } = await import('@lib/firebase');
      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      for (let i = 1; i <= compMatsCount; i++) {
        const matRef = doc(db, 'competitions', id, 'mats', `mat-${i}`);
        batch.set(matRef, {
          name: `MAT ${String(i).padStart(2, '0')}`,
          order: i
        });
      }
      
      await batch.commit();
    } catch (err) {
      console.error('Failed to seed mats', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setScoreboardLogo(b64);
      try {
        const { db } = await import('@lib/firebase');
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'competitions', id), { scoreboardLogo: b64 });
        toast.success('Scoreboard logo updated!');
      } catch (err) {
        toast.error('Failed to update logo');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveMatPassword = async (matId: string, pwd: string) => {
    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'competitions', id, 'mats', matId), { password: pwd });
      toast.success('Password updated');
    } catch (err) {
      toast.error('Failed to update password');
    }
  };

  const togglePassword = (matId: string) => {
    setShowPasswordMap(prev => ({ ...prev, [matId]: !prev[matId] }));
  };

  const activeCount = Object.values(liveStates).filter(s => s.status === 'live').length;
  const standbyCount = mats.length - activeCount;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .mat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: var(--space-5);
          margin-top: var(--space-5);
        }
        .mat-card {
          background-color: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 12px;
          padding: var(--space-5);
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          display: flex;
          flex-direction: column;
          position: relative;
          text-decoration: none;
          color: inherit;
          transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .mat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
          border-color: var(--neutral-300);
        }
        .mat-card.live {
          background-color: #dcfce7;
          border-color: #22c55e;
          box-shadow: 0 8px 24px rgba(34, 197, 94, 0.15);
        }
        .mat-card.standby {
          background-color: var(--neutral-100);
          border-color: var(--neutral-300);
        }
        .mat-number {
          font-family: var(--font-display);
          font-size: 32px;
          line-height: 1;
          color: var(--neutral-900);
          letter-spacing: 0.02em;
        }
        .mat-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-4);
        }
        .category-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-1);
        }
        .category-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--neutral-900);
          margin-bottom: var(--space-4);
          min-height: 48px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        }
        .score-board {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: var(--space-2);
          align-items: center;
          background: var(--neutral-50);
          border-radius: 8px;
          border: 1px solid var(--neutral-200);
          padding: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .score-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-2) 0;
          border-radius: 6px;
        }
        .score-side.aka { background: var(--aka-light); box-shadow: inset 0 0 0 1px rgba(217, 38, 44, 0.1); }
        .score-side.ao { background: var(--ao-light); box-shadow: inset 0 0 0 1px rgba(26, 77, 181, 0.1); }
        
        .score-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: var(--space-1);
        }
        .score-label.aka { color: var(--aka); }
        .score-label.ao { color: var(--ao); }
        
        .score-value {
          font-family: var(--font-mono);
          font-size: 32px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.05em;
        }
        .score-value.aka { color: var(--aka); }
        .score-value.ao { color: var(--ao); }
        
        .score-pen {
          font-size: 10px;
          font-weight: 700;
          color: var(--neutral-500);
          margin-top: var(--space-1);
          background: var(--shiro);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--neutral-200);
        }
        
        .score-divider {
          font-size: 11px;
          font-weight: 800;
          color: var(--neutral-400);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .mat-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: var(--space-4);
          border-top: 1px solid var(--neutral-100);
        }
        .time-remaining {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          color: var(--neutral-700);
        }
        .time-remaining i {
          width: 14px;
          height: 14px;
          color: var(--status-live);
        }
        .btn-action {
          background: var(--neutral-100);
          color: var(--neutral-700);
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn-action:hover {
          background: var(--neutral-200);
          color: var(--neutral-900);
        }
        .btn-action.primary {
          background: var(--kuro);
          color: var(--shiro);
        }
        .btn-action.primary:hover {
          background: var(--neutral-700);
        }
        
        /* Standby State */
        .standby-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 154px;
          background: var(--neutral-50);
          border: 1px dashed var(--neutral-300);
          border-radius: 8px;
          margin-bottom: var(--space-4);
          transition: all 0.2s;
        }
        .mat-card:hover .standby-state {
          border-color: var(--neutral-400);
          background: var(--neutral-100);
        }
        .standby-state i {
          color: var(--neutral-400);
          margin-bottom: var(--space-2);
          width: 28px;
          height: 28px;
        }
        .standby-state span {
          font-size: 14px;
          font-weight: 600;
          color: var(--neutral-500);
        }
        
        .status-chip {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .status-chip.status-live { background: var(--status-live-bg); color: var(--status-live); }
        .status-chip.status-live::before {
          content: '';
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--status-live);
          box-shadow: 0 0 0 2px var(--status-live-bg);
          animation: pulse 2s infinite;
        }
        .status-chip.status-done { background: var(--neutral-100); color: var(--neutral-500); }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(98, 224, 145, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(98, 224, 145, 0); }
          100% { box-shadow: 0 0 0 0 rgba(98, 224, 145, 0); }
        }
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        
        .filters {
          display: flex;
          gap: var(--space-2);
        }
        .filter-btn {
          background: transparent;
          border: 1px solid var(--neutral-200);
          color: var(--neutral-600);
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .filter-btn:hover {
          background: var(--neutral-50);
          color: var(--neutral-900);
        }
        .filter-btn.active {
          background: var(--kuro);
          color: var(--shiro);
          border-color: var(--kuro);
        }
        

        .controls-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
        }
        
        .empty-state {
          padding: var(--space-10);
          text-align: center;
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          margin-top: var(--space-5);
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
            </div>
            <h1>{isViewer ? 'Live Mats' : 'Mat Management'}</h1>
          </div>
          {isAdminOrGuest && (
            <div className="page-header-actions">
              <div className="controls-row">
                <button className="btn btn-secondary" onClick={() => setShowConfig(!showConfig)}>
                  <Activity style={{ width: '16px', marginRight: '6px' }} /> {showConfig ? 'Hide Settings' : 'Mat Settings'}
                </button>
                <button className="btn btn-primary" onClick={handleSeedMats} disabled={isSeeding || mats.length > 0}>
                  <Plus style={{ width: '16px', marginRight: '6px' }} /> 
                  {isSeeding ? 'Adding...' : 'Add Mats'}
                </button>
              </div>
            </div>
          )}
        </header>

        {isAdminOrGuest && showConfig && (
          <div style={{ background: 'var(--shiro)', padding: 'var(--space-5)', borderRadius: '12px', border: '1px solid var(--neutral-200)', marginBottom: 'var(--space-5)', display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div className="flex-between mb-4">
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>Scoreboard Logo (Optional)</h4>
                  <p className="text-small" style={{ marginTop: '4px', color: 'var(--neutral-500)' }}>Upload a 1:1 ratio logo to display on all scoreboards.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {scoreboardLogo && (
                  <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: '#fff', border: '1px solid var(--neutral-200)', flexShrink: 0 }}>
                    <Image src={scoreboardLogo} alt="Logo" fill style={{ objectFit: 'contain' }} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="input-field" style={{ padding: '8px', height: 'auto', background: '#fff', width: '100%' }} />
                </div>
                {scoreboardLogo && (
                  <button className="btn btn-ghost" onClick={async () => {
                    setScoreboardLogo(null);
                    const { db } = await import('@lib/firebase');
                    const { doc, updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'competitions', id), { scoreboardLogo: null });
                  }} style={{ color: 'var(--aka)' }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ flex: '1 1 300px' }}>
              <div className="flex-between mb-4">
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>Bulk Mat Passwords</h4>
                  <p className="text-small" style={{ marginTop: '4px', color: 'var(--neutral-500)' }}>Set a generic password for all mats.</p>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => {
                const pwd = prompt("Enter generic password for all mats:");
                if (pwd) {
                  mats.forEach(m => saveMatPassword(m.id, pwd));
                  toast.success('Bulk password applied to all mats');
                }
              }} style={{ width: '100%', justifyContent: 'center' }}>
                <Key size={16} style={{ marginRight: '8px' }}/> Set Bulk Passwords
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mat-grid">
            {Array.from({ length: compMatsCount || 6 }).map((_, i) => (
              <div key={i} className="mat-card standby" style={{ minHeight: 220 }}>
                <div className="mat-header">
                  <div style={{ width: 80, height: 32, borderRadius: 6, background: 'var(--neutral-200)', animation: 'shimmer 1.4s infinite' }} />
                  <div style={{ width: 60, height: 22, borderRadius: 6, background: 'var(--neutral-200)', animation: 'shimmer 1.4s infinite' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[80, 60, 60].map((w, j) => (
                    <div key={j} style={{ height: 12, width: `${w}%`, borderRadius: 4, background: 'var(--neutral-200)', animation: 'shimmer 1.4s infinite' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : mats.length === 0 ? (
          <div className="empty-state">
            <h3 style={{ marginBottom: '8px' }}>No Mats Configured</h3>
            <p style={{ color: 'var(--neutral-500)', marginBottom: '24px' }}>{isAdminOrGuest ? `Click 'Add Mats' to generate the ${compMatsCount} mats for this tournament.` : 'Mats have not been configured yet.'}</p>
            {isAdminOrGuest && (
              <button className="btn btn-primary" onClick={handleSeedMats} disabled={isSeeding}>
                <Plus size={16} style={{ marginRight: '6px' }} />
                {isSeeding ? 'Seeding...' : 'Add Mats'}
              </button>
            )}
          </div>
        ) : (
          <div className="mat-grid">
            {mats.map(mat => {
              const liveState = liveStates[mat.id] || { status: 'standby' };
              const isLive = liveState.status === 'live' || liveState.status === 'paused';
              const assignedCats = categoryByMat[mat.name] || [];
              const liveCat = assignedCats.find(c => c.status === 'live');
              const upcomingCats = assignedCats.filter(c => c.status === 'upcoming');
              const doneCats = assignedCats.filter(c => c.status === 'done');

              // Viewer-friendly card: no links to operator
              if (isViewer) {
                return (
                  <div
                    key={mat.id}
                    className={`mat-card ${isLive || liveCat || upcomingCats.length > 0 ? 'live' : 'standby'}`}
                  >
                    <div className="mat-header">
                      <span className="mat-number">{mat.name}</span>
                      {isLive || liveCat ? (
                        <span className="status-chip status-live">Live</span>
                      ) : upcomingCats.length > 0 ? (
                        <span className="status-chip" style={{ background: '#bbf7d0', color: '#166534' }}>
                          {upcomingCats.length} Scheduled
                        </span>
                      ) : (
                        <span className="status-chip status-done">Inactive</span>
                      )}
                    </div>

                    {isLive ? (
                      <>
                        <div className="category-label">Current Category</div>
                        <div className="category-title">
                          {liveState.currentCategory || liveCat?.name || 'Unknown Category'}
                          <br />
                          <span style={{ color: 'var(--neutral-500)', fontWeight: 500, fontSize: '14px' }}>
                            {liveState.currentMatch || 'Match'}
                          </span>
                        </div>
                        <div className="score-board">
                          <div className="score-side aka">
                            <div className="score-label aka">AKA</div>
                            <div className="score-value aka">{liveState.scores?.aka || 0}</div>
                            <div className="score-pen">PEN {liveState.scores?.akaPen || 0}</div>
                          </div>
                          <div className="score-divider">PTS</div>
                          <div className="score-side ao">
                            <div className="score-label ao">AO</div>
                            <div className="score-value ao">{liveState.scores?.ao || 0}</div>
                            <div className="score-pen">PEN {liveState.scores?.aoPen || 0}</div>
                          </div>
                        </div>
                        <div className="mat-footer">
                          <div className="time-remaining">
                            <Timer size={14} style={{ color: 'var(--status-live)' }} />
                            {liveState.timeRemaining || '00:00'}
                          </div>
                        </div>
                      </>
                    ) : assignedCats.length > 0 ? (
                      <>
                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--space-3)' }}>
                          {liveCat && (
                            <div style={{ padding: '8px 10px', background: 'var(--status-live-bg)', borderRadius: '6px', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--status-live)' }}>
                              🔴 {liveCat.name}
                            </div>
                          )}
                          {upcomingCats.slice(0, 4).map((c, i) => (
                            <div key={i} style={{ padding: '6px 10px', background: 'var(--neutral-50)', borderRadius: '6px', marginBottom: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--neutral-700)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{c.name}</span>
                              <span style={{ color: 'var(--neutral-400)', fontSize: '10px' }}>{c.entries} ATH</span>
                            </div>
                          ))}
                          {upcomingCats.length > 4 && (
                            <div style={{ fontSize: '10px', color: 'var(--neutral-400)', textAlign: 'center', padding: '4px' }}>+{upcomingCats.length - 4} more</div>
                          )}
                          {upcomingCats.length === 0 && doneCats.length > 0 && (
                            <div style={{ padding: '8px 10px', background: 'var(--neutral-50)', borderRadius: '6px', fontSize: '12px', color: 'var(--neutral-500)', textAlign: 'center' }}>✅ All categories completed</div>
                          )}
                        </div>
                        <div className="mat-footer" style={{ justifyContent: 'flex-start' }}>
                          <span style={{ fontSize: '11px', color: 'var(--neutral-500)' }}>{doneCats.length}/{assignedCats.length} done</span>
                        </div>
                      </>
                    ) : (
                      <div className="standby-state">
                        <Coffee size={28} style={{ color: 'var(--neutral-400)', marginBottom: 'var(--space-2)' }} />
                        <span>No Categories Assigned</span>
                      </div>
                    )}
                  </div>
                );
              }

              // Admin/operator card (unchanged — includes password + action buttons)
              return (
                <a key={mat.id} href={`/competitions/${id}/operator?mat=${mat.id}`} className={`mat-card ${isLive || liveCat || upcomingCats.length > 0 ? 'live' : 'standby'}`}>
                  <div className="mat-header">
                    <span className="mat-number">{mat.name}</span>
                    {isLive || liveCat ? (
                      <span className="status-chip status-live">Live</span>
                    ) : upcomingCats.length > 0 ? (
                      <span className="status-chip" style={{ background: '#bbf7d0', color: '#166534' }}>
                        {upcomingCats.length} Scheduled
                      </span>
                    ) : (
                      <span className="status-chip status-done">Inactive</span>
                    )}
                  </div>

                  {isLive ? (
                    <>
                      <div className="category-label">Current Category</div>
                      <div className="category-title">
                        {liveState.currentCategory || liveCat?.name || 'Unknown Category'}
                        <br />
                        <span style={{ color: 'var(--neutral-500)', fontWeight: 500, fontSize: '14px' }}>
                          {liveState.currentMatch || 'Match'}
                        </span>
                      </div>
                      
                      <div className="score-board">
                        <div className="score-side aka">
                          <div className="score-label aka">AKA</div>
                          <div className="score-value aka">{liveState.scores?.aka || 0}</div>
                          <div className="score-pen">PEN {liveState.scores?.akaPen || 0}</div>
                        </div>
                        <div className="score-divider">PTS</div>
                        <div className="score-side ao">
                          <div className="score-label ao">AO</div>
                          <div className="score-value ao">{liveState.scores?.ao || 0}</div>
                          <div className="score-pen">PEN {liveState.scores?.aoPen || 0}</div>
                        </div>
                      </div>
                      
                      <div className="mat-footer">
                        <div className="time-remaining">
                          <Timer size={14} style={{ color: 'var(--status-live)' }} /> 
                          {liveState.timeRemaining || '00:00'}
                        </div>
                        <button className="btn-action">Manage</button>
                      </div>
                    </>
                  ) : assignedCats.length > 0 ? (
                    <>
                      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--space-3)' }}>
                        {liveCat && (
                          <div style={{ padding: '8px 10px', background: 'var(--status-live-bg)', borderRadius: '6px', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--status-live)' }}>
                            🔴 {liveCat.name}
                          </div>
                        )}
                        {upcomingCats.slice(0, 4).map((c, i) => (
                          <div key={i} style={{ padding: '6px 10px', background: 'var(--neutral-50)', borderRadius: '6px', marginBottom: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--neutral-700)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{c.name}</span>
                            <span style={{ color: 'var(--neutral-400)', fontSize: '10px' }}>{c.entries} ATH</span>
                          </div>
                        ))}
                        {upcomingCats.length > 4 && (
                          <div style={{ fontSize: '10px', color: 'var(--neutral-400)', textAlign: 'center', padding: '4px' }}>+{upcomingCats.length - 4} more categories</div>
                        )}
                        {upcomingCats.length === 0 && doneCats.length > 0 && (
                          <div style={{ padding: '8px 10px', background: 'var(--neutral-50)', borderRadius: '6px', fontSize: '12px', color: 'var(--neutral-500)', textAlign: 'center' }}>
                            ✅ All categories completed
                          </div>
                        )}
                      </div>
                      <div className="mat-footer" style={{ justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: 'var(--neutral-500)' }}>{doneCats.length}/{assignedCats.length} done</span>
                        <button className="btn-action primary">
                          <CalendarPlus size={16} style={{ marginRight: '6px' }} /> Open Mat
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="standby-state">
                        <Coffee size={28} style={{ color: 'var(--neutral-400)', marginBottom: 'var(--space-2)' }} />
                        <span>No Categories Assigned</span>
                      </div>
                      
                      <div className="mat-footer" style={{ justifyContent: 'center' }}>
                        <button className="btn-action primary" style={{ width: '100%', justifyContent: 'center' }}>
                          <CalendarPlus size={16} style={{ marginRight: '6px' }} /> Assign Event
                        </button>
                      </div>
                    </>
                  )}
                  
                  {/* Mat Password Field — admin/operator only */}
                  <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 'var(--space-3)' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral-500)', display: 'block', marginBottom: '4px' }}>Mat Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showPasswordMap[mat.id] ? "text" : "password"} 
                        value={tempPasswords[mat.id] !== undefined ? tempPasswords[mat.id] : (mat.password || '')}
                        onChange={e => setTempPasswords(prev => ({...prev, [mat.id]: e.target.value}))}
                        onBlur={() => {
                          if (tempPasswords[mat.id] !== undefined && tempPasswords[mat.id] !== mat.password) {
                            saveMatPassword(mat.id, tempPasswords[mat.id]);
                          }
                        }}
                        onClick={e => e.preventDefault()}
                        placeholder="Set password..."
                        style={{ width: '100%', padding: '6px 30px 6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--neutral-300)', background: 'var(--shiro)' }}
                      />
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); togglePassword(mat.id); }}
                        style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: 'var(--neutral-500)', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        {showPasswordMap[mat.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
