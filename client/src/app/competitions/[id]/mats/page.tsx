'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import { 
  Plus, 
  Timer, 
  Coffee, 
  Eye, 
  EyeOff, 
  Image as ImageIcon, 
  X, 
  Trophy, 
  Medal, 
  CheckCircle2, 
  Tv, 
  ArrowLeft, 
  User, 
  ListOrdered, 
  Activity,
  CalendarPlus,
  Play,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { sortCategories } from '@/lib/categoryUtils';
import KumiteLiveScoreboard from '@/modules/kumite/components/KumiteLiveScoreboard';
import KataLiveScoreboard, { deriveJudgeVotes } from '@/modules/kata/components/KataLiveScoreboard';
import ScaleWrapper from '@/modules/shared/components/ScaleWrapper';

interface MatData {
  id: string; // e.g. 'mat-1'
  name: string; // e.g. 'MAT 01'
  order: number;
  password?: string;
  displayPassword?: string;
}

interface RTDBMatState {
  status: 'live' | 'standby' | 'paused' | 'upcoming';
  category?: string;
  currentCategory?: string;
  isKata?: boolean;
  currentMatch?: string;
  matchDisplayId?: string;
  scores?: {
    aka: number;
    ao: number;
    akaPen: number;
    aoPen: number;
  };
  aka?: {
    name?: string;
    country?: string;
    academy?: string;
    score?: number;
    ippon?: number;
    waza?: number;
    yuko?: number;
    c1?: number;
    c2?: number;
    senshu?: boolean;
  };
  ao?: {
    name?: string;
    country?: string;
    academy?: string;
    score?: number;
    ippon?: number;
    waza?: number;
    yuko?: number;
    c1?: number;
    c2?: number;
    senshu?: boolean;
  };
  winner?: {
    name?: string;
    color?: 'aka' | 'ao';
  };
  timeRemaining?: string;
  timerRunning?: boolean;
}

interface StaffMember {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  userId?: string;
  role?: string;
  assignedMats?: string[];
  assignedCategories?: string[];
}

export default function MatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user, role, loading: authLoading } = useAuth();

  const isAdmin = role === 'admin';
  const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';

  const [mats, setMats] = useState<MatData[]>([]);
  const [liveStates, setLiveStates] = useState<Record<string, RTDBMatState>>({});
  const [categoryByMat, setCategoryByMat] = useState<Record<string, { name: string; status: string; entries: number; athletes: any[] }[]>>({});
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [compMatsCount, setCompMatsCount] = useState<number>(6);
  const [compName, setCompName] = useState<string>('Tournament');
  const [showConfig, setShowConfig] = useState(false);
  const [scoreboardLogo, setScoreboardLogo] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});

  // Spectator View State: selected mat for spectating
  const [selectedMat, setSelectedMat] = useState<string | null>(null);
  const [spectateTab, setSpectateTab] = useState<'scoreboard' | 'upcoming' | 'leaderboard'>('scoreboard');

  // Search & Filter State for Mats Overview
  const [matSearchQuery, setMatSearchQuery] = useState('');
  const [matFilterStatus, setMatFilterStatus] = useState<'all' | 'live' | 'standby'>('all');

  // Check URL on load for pre-selected mat (?spectate=mat-1 or ?mat=mat-1)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const spectateParam = sp.get('spectate') || sp.get('mat');
      if (spectateParam) {
        setSelectedMat(spectateParam);
      }
    }
  }, []);

  // Sync selectedMat back to URL without full refresh
  const handleSelectMat = (matId: string) => {
    setSelectedMat(matId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('spectate', matId);
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleBackToAllMats = () => {
    setSelectedMat(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('spectate');
      url.searchParams.delete('mat');
      window.history.pushState({}, '', url.toString());
    }
  };

  useEffect(() => {
    let unsubFirestore: () => void;
    let unsubCats: () => void;
    let unsubStaff: () => void;
    let rtdbUnsubs: Record<string, () => void> = {};

    const setup = async () => {
      const [{ db, rtdb }, { collection, onSnapshot, query, orderBy, getDoc, doc }, { ref, onValue, off }] = await Promise.all([
        import('@lib/firebase'),
        import('firebase/firestore'),
        import('firebase/database'),
      ]);

      // Competition metadata
      const compSnap = await getDoc(doc(db, 'competitions', id));
      if (compSnap.exists()) {
        const cData = compSnap.data();
        if (cData.name) setCompName(cData.name);
        if (cData.mats) setCompMatsCount(cData.mats);
        if (cData.scoreboardLogo) setScoreboardLogo(cData.scoreboardLogo);
      }

      // Staff listener
      const staffQ = collection(db, 'competitions', id, 'staff');
      unsubStaff = onSnapshot(staffQ, (snap) => {
        const staff = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as StaffMember[];
        setStaffList(staff);
      });

      // Categories listener
      const catsQ = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubCats = onSnapshot(catsQ, (snap) => {
        const byMat: Record<string, { name: string; status: string; entries: number; athletes: any[] }[]> = {};
        const rawCats: any[] = [];

        snap.docs.forEach(d => {
          const data = d.data();
          rawCats.push({ id: d.id, ...data });
          const matName = (data.mat || '').toUpperCase();
          if (!byMat[matName]) byMat[matName] = [];
          byMat[matName].push({ 
            name: data.name, 
            status: data.status || 'upcoming', 
            entries: data.entries || 0, 
            athletes: data.athletes || [] 
          });
        });

        Object.keys(byMat).forEach(matName => {
          byMat[matName] = sortCategories(byMat[matName]);
        });
        setCategoryByMat(byMat);
        setAllCategories(rawCats);
      });

      // Mats listener
      const matsQ = query(collection(db, 'competitions', id, 'mats'), orderBy('order'));
      unsubFirestore = onSnapshot(matsQ, (snap) => {
        const matsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as MatData));
        setMats(matsList);
        setLoading(false);

        // Subscribe to RTDB for each mat
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
      if (unsubStaff) unsubStaff();
      Object.values(rtdbUnsubs).forEach(unsub => unsub());
    };
  }, [id]);

  // Determine current user's operator status
  const currentStaff = useMemo(() => {
    if (!user) return null;
    return staffList.find(s => s.userId === user.uid || (user.email && s.email?.toLowerCase() === user.email.toLowerCase()));
  }, [staffList, user]);

  const staffRole = currentStaff?.role;
  const isMatOperator = role === 'mat_operator' || staffRole === 'score';
  const assignedMats = useMemo(() => {
    return currentStaff?.assignedMats || [];
  }, [currentStaff]);

  // Handle seeding mats
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
      toast.success(`Generated ${compMatsCount} mats successfully!`);
    } catch (err) {
      console.error('Failed to seed mats', err);
      toast.error('Failed to generate mats');
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
      await updateDoc(doc(db, 'competitions', id, 'mats', matId), { 
        password: pwd,
        displayPassword: pwd
      });
      setMats(prev => prev.map(m => m.id === matId ? { ...m, password: pwd, displayPassword: pwd } : m));
      toast.success('Password updated');
    } catch (err) {
      toast.error('Failed to update password');
    }
  };

  const togglePassword = (matId: string) => {
    setShowPasswordMap(prev => ({ ...prev, [matId]: !prev[matId] }));
  };

  // Spectator View Calculations for selectedMat
  const selectedMatData = useMemo(() => {
    if (!selectedMat) return null;
    return mats.find(m => m.id === selectedMat) || {
      id: selectedMat,
      name: `MAT ${selectedMat.replace('mat-', '').padStart(2, '0')}`,
      order: 1
    };
  }, [mats, selectedMat]);

  const selectedMatName = selectedMatData?.name || 'MAT 01';
  const selectedLiveState = selectedMat ? (liveStates[selectedMat] || { status: 'standby' }) : null;

  // Categories and matches for selected mat
  const categoriesOnSelectedMat = useMemo(() => {
    return allCategories.filter(c => (c.mat || '').toUpperCase() === selectedMatName.toUpperCase());
  }, [allCategories, selectedMatName]);

  const upcomingMatchesOnMat = useMemo(() => {
    const list: any[] = [];
    categoriesOnSelectedMat.forEach(cat => {
      (cat.matches || []).forEach((m: any, idx: number) => {
        if (m.status !== 'completed') {
          list.push({
            ...m,
            categoryName: cat.name,
            categoryId: cat.id,
            isKata: Boolean(cat.isKata),
            orderNum: idx + 1
          });
        }
      });
    });
    return list;
  }, [categoriesOnSelectedMat]);

  const completedMatchesOnMat = useMemo(() => {
    const list: any[] = [];
    categoriesOnSelectedMat.forEach(cat => {
      (cat.matches || []).forEach((m: any) => {
        if (m.status === 'completed' && m.winnerId) {
          list.push({
            ...m,
            categoryName: cat.name,
            categoryId: cat.id,
            isKata: Boolean(cat.isKata)
          });
        }
      });
    });
    return list;
  }, [categoriesOnSelectedMat]);

  const filteredMats = useMemo(() => {
    return mats.filter(mat => {
      const liveState = liveStates[mat.id] || { status: 'standby' };
      const isLive = liveState.status === 'live' || liveState.status === 'paused';

      if (matFilterStatus === 'live' && !isLive) return false;
      if (matFilterStatus === 'standby' && isLive) return false;

      if (!matSearchQuery.trim()) return true;
      const q = matSearchQuery.toLowerCase().trim();

      if (mat.name.toLowerCase().includes(q)) return true;
      if (mat.id.toLowerCase().includes(q)) return true;

      // Check assigned categories
      const assignedCats = categoryByMat[mat.name] || [];
      if (assignedCats.some(c => c.name.toLowerCase().includes(q))) return true;

      // Check current live match / categories
      if (liveState.category?.toLowerCase().includes(q)) return true;
      if (liveState.currentCategory?.toLowerCase().includes(q)) return true;
      if (liveState.currentMatch?.toLowerCase().includes(q)) return true;
      if (liveState.aka?.name?.toLowerCase().includes(q)) return true;
      if (liveState.ao?.name?.toLowerCase().includes(q)) return true;

      // Check assigned operator
      const assignedOperator = staffList.find(s => 
        s.role === 'score' && (s.assignedMats || []).some(m => m.toUpperCase() === mat.name.toUpperCase() || m.toLowerCase() === mat.id.toLowerCase())
      );
      if (assignedOperator) {
        const opName = (assignedOperator.displayName || assignedOperator.name || assignedOperator.email || '').toLowerCase();
        if (opName.includes(q)) return true;
      }

      return false;
    });
  }, [mats, liveStates, matFilterStatus, matSearchQuery, categoryByMat, staffList]);

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
          cursor: pointer;
          transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1), border-color 200ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        .mat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
          border-color: var(--neutral-400);
        }
        .mat-card.live {
          background-color: #dcfce7;
          border-color: #22c55e;
          box-shadow: 0 8px 24px rgba(34, 197, 94, 0.15);
        }
        .mat-card.standby {
          background-color: var(--shiro);
          border-color: var(--neutral-300);
        }
        .mat-card.assigned-station {
          border: 2px solid var(--status-live);
          box-shadow: 0 0 16px rgba(34, 197, 94, 0.25);
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
        .btn-action {
          background: var(--neutral-100);
          color: var(--neutral-700);
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 160ms ease, color 160ms ease;
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
          background: var(--neutral-900);
        }
        .spectate-tab-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 160ms ease;
          background: var(--neutral-100);
          color: var(--neutral-700);
        }
        .spectate-tab-btn.active {
          background: var(--kuro);
          color: #fff;
          border-color: var(--kuro);
        }
        .operator-hero-card {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #ffffff;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
        }
        @media (max-width: 768px) {
          .mat-grid {
            grid-template-columns: 1fr !important;
            gap: var(--space-4) !important;
          }
          .operator-hero-card {
            padding: 16px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .mats-search-bar {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .score-board {
            padding: var(--space-2) !important;
          }
        }
      `}} />

      <main className="container" style={{ paddingBottom: '60px' }}>
        {/* ========================================================
            VIEW A: SPECTATOR DEDICATED MAT VIEW (When selectedMat is set)
            ======================================================== */}
        {selectedMat ? (
          <div>
            {/* Top Navigation Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleBackToAllMats}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <ArrowLeft size={16} /> All Mats
                </button>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 style={{ fontSize: '32px', margin: 0 }}>{selectedMatName} Live Spectate</h1>
                    {selectedLiveState?.status === 'live' ? (
                      <span className="status-chip status-live">Live</span>
                    ) : (
                      <span className="status-chip status-done">Standby</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--neutral-500)', fontWeight: 600 }}>
                    {compName} • {selectedLiveState?.category || selectedLiveState?.currentCategory || 'Kumite'}
                  </div>
                </div>
              </div>

              {/* View Mode Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`spectate-tab-btn ${spectateTab === 'scoreboard' ? 'active' : ''}`}
                  onClick={() => setSpectateTab('scoreboard')}
                >
                  <Tv size={16} /> Live Scoreboard
                </button>
                <button
                  type="button"
                  className={`spectate-tab-btn ${spectateTab === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setSpectateTab('upcoming')}
                >
                  <ListOrdered size={16} /> Upcoming Matches ({upcomingMatchesOnMat.length})
                </button>
                <button
                  type="button"
                  className={`spectate-tab-btn ${spectateTab === 'leaderboard' ? 'active' : ''}`}
                  onClick={() => setSpectateTab('leaderboard')}
                >
                  <Trophy size={16} /> Mat Leaderboard
                </button>

                {isAdmin && (
                  <Link
                    href={`/competitions/${id}/operator?mat=${selectedMat}`}
                    className="btn btn-primary"
                    style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    Open Operator Controls →
                  </Link>
                )}
              </div>
            </div>

            {/* TAB 1: LIVE SCOREBOARD */}
            {spectateTab === 'scoreboard' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <Link
                    href={`/competitions/${id}/scoreboard?mat=${selectedMat}&auto=1`}
                    target="_blank"
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <Tv size={16} /> Open Dedicated Fullscreen Display
                  </Link>
                </div>

                <div style={{ width: '100%', minHeight: '600px', background: '#000', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
                  <ScaleWrapper>
                    {selectedLiveState?.isKata ? (
                      <KataLiveScoreboard
                        akaName={selectedLiveState?.aka?.name || 'AKA'}
                        aoName={selectedLiveState?.ao?.name || 'AO'}
                        akaAcademy={selectedLiveState?.aka?.academy || ''}
                        aoAcademy={selectedLiveState?.ao?.academy || ''}
                        akaCountry={selectedLiveState?.aka?.country || ''}
                        aoCountry={selectedLiveState?.ao?.country || ''}
                        numberOfJudges={3}
                        judgeVotes={[null, null, null]}
                        akaFlags={0}
                        aoFlags={0}
                        revealVotes={false}
                        revealCountdown={0}
                        timeRemaining={selectedLiveState?.timeRemaining || '03:00'}
                        matchStatus={selectedLiveState?.status === 'live' ? 'LIVE' : (selectedLiveState?.status?.toUpperCase() || 'STANDBY')}
                        title={`${selectedMatName}: Kata Scoreboard`}
                        subtitle={`${compName} • ${selectedLiveState?.category || 'Kata'}`}
                        isFullscreen={false}
                        winnerName={selectedLiveState?.winner?.name}
                      />
                    ) : (
                      <KumiteLiveScoreboard
                        akaName={selectedLiveState?.aka?.name || 'AKA'}
                        aoName={selectedLiveState?.ao?.name || 'AO'}
                        akaAcademy={selectedLiveState?.aka?.academy || ''}
                        aoAcademy={selectedLiveState?.ao?.academy || ''}
                        akaCountry={selectedLiveState?.aka?.country || ''}
                        aoCountry={selectedLiveState?.ao?.country || ''}
                        akaScore={selectedLiveState?.scores?.aka || 0}
                        aoScore={selectedLiveState?.scores?.ao || 0}
                        akaIppon={selectedLiveState?.aka?.ippon || 0}
                        aoIppon={selectedLiveState?.ao?.ippon || 0}
                        akaWazaari={selectedLiveState?.aka?.waza || 0}
                        aoWazaari={selectedLiveState?.ao?.waza || 0}
                        akaYuko={selectedLiveState?.aka?.yuko || 0}
                        aoYuko={selectedLiveState?.ao?.yuko || 0}
                        akaC1={selectedLiveState?.scores?.akaPen || selectedLiveState?.aka?.c1 || 0}
                        aoC1={selectedLiveState?.scores?.aoPen || selectedLiveState?.ao?.c1 || 0}
                        akaC2={selectedLiveState?.aka?.c2 || 0}
                        aoC2={selectedLiveState?.ao?.c2 || 0}
                        akaC3={(selectedLiveState as any)?.aka?.c3 || 0}
                        aoC3={(selectedLiveState as any)?.ao?.c3 || 0}
                        akaHC={(selectedLiveState as any)?.aka?.hc || 0}
                        aoHC={(selectedLiveState as any)?.ao?.hc || 0}
                        akaH={(selectedLiveState as any)?.aka?.h || 0}
                        aoH={(selectedLiveState as any)?.ao?.h || 0}
                        akaPenalties={(selectedLiveState as any)?.akaPenalties || (selectedLiveState as any)?.aka?.penalties}
                        aoPenalties={(selectedLiveState as any)?.aoPenalties || (selectedLiveState as any)?.ao?.penalties}
                        akaSenshu={selectedLiveState?.aka?.senshu || false}
                        aoSenshu={selectedLiveState?.ao?.senshu || false}
                        timerDisplay={selectedLiveState?.timeRemaining || '03:00'}
                        timerColor={selectedLiveState?.timerRunning ? 'var(--status-live)' : 'var(--neutral-400)'}
                        matchStatus={selectedLiveState?.status === 'live' ? 'MATCH LIVE' : (selectedLiveState?.status?.toUpperCase() || 'STANDBY')}
                        title={compName}
                        categoryName={selectedLiveState?.category || selectedLiveState?.currentCategory || 'KUMITE'}
                        matchId={`${selectedMatName} - ${selectedLiveState?.currentMatch || selectedLiveState?.matchDisplayId || 'MATCH'}`}
                        winnerName={selectedLiveState?.winner?.name}
                        winnerColor={selectedLiveState?.winner?.color}
                        isFullscreen={false}
                      />
                    )}
                  </ScaleWrapper>
                </div>
              </div>
            )}

            {/* TAB 2: UPCOMING MATCHES */}
            {spectateTab === 'upcoming' && (
              <div style={{ background: 'var(--shiro)', borderRadius: '16px', border: '1px solid var(--neutral-300)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Upcoming Matches on {selectedMatName}</h2>
                    <p style={{ fontSize: '13px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>Scheduled bouts queued for this mat station.</p>
                  </div>
                  <span className="status-chip" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)' }}>
                    {upcomingMatchesOnMat.length} in queue
                  </span>
                </div>

                {upcomingMatchesOnMat.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                    <CheckCircle2 size={36} style={{ color: 'var(--status-live)', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 700, fontSize: '16px', margin: 0 }}>No Pending Matches in Queue</p>
                    <p style={{ fontSize: '13px', margin: '4px 0 0' }}>All categories on this mat are either completed or awaiting generation.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {upcomingMatchesOnMat.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: '1px solid var(--neutral-200)',
                          background: idx === 0 ? 'rgba(34, 197, 94, 0.05)' : 'var(--neutral-50)',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '16px', color: 'var(--neutral-400)' }}>
                            #{idx + 1}
                          </span>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neutral-500)', display: 'block' }}>
                              {m.categoryName} {m.pool ? `• Pool ${m.pool}` : ''}
                            </span>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--neutral-900)', marginTop: '2px' }}>
                              <span style={{ color: 'var(--aka)' }}>{m.aka?.name || m.aka || 'AKA'}</span>
                              <span style={{ color: 'var(--neutral-400)', margin: '0 8px' }}>vs</span>
                              <span style={{ color: 'var(--ao)' }}>{m.ao?.name || m.ao || 'AO'}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          {idx === 0 ? (
                            <span className="status-chip status-live" style={{ fontSize: '11px' }}>NEXT BOUT</span>
                          ) : (
                            <span className="status-chip" style={{ background: 'var(--neutral-200)', color: 'var(--neutral-700)', fontSize: '11px' }}>QUEUED</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MAT LEADERBOARD & RESULTS */}
            {spectateTab === 'leaderboard' && (
              <div style={{ background: 'var(--shiro)', borderRadius: '16px', border: '1px solid var(--neutral-300)', padding: '24px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{selectedMatName} Leaderboard & Completed Matches</h2>
                  <p style={{ fontSize: '13px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>Finished bouts and podium results recorded on this mat.</p>
                </div>

                {completedMatchesOnMat.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                    <Coffee size={36} style={{ color: 'var(--neutral-400)', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 700, fontSize: '16px', margin: 0 }}>No Matches Completed Yet</p>
                    <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Results will appear here as soon as the mat operator completes matches.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {completedMatchesOnMat.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          border: '1px solid var(--neutral-200)',
                          background: 'var(--neutral-50)',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neutral-500)' }}>
                            {m.categoryName} {m.pool ? `• Pool ${m.pool}` : ''}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>
                            <span style={{ color: m.winner === 'aka' ? 'var(--aka)' : 'var(--neutral-700)', fontWeight: m.winner === 'aka' ? 800 : 500 }}>
                              {m.aka?.name || m.aka || 'AKA'} ({m.scores?.aka ?? m.akaScore ?? 0})
                            </span>
                            <span style={{ color: 'var(--neutral-400)', margin: '0 8px' }}>vs</span>
                            <span style={{ color: m.winner === 'ao' ? 'var(--ao)' : 'var(--neutral-700)', fontWeight: m.winner === 'ao' ? 800 : 500 }}>
                              {m.ao?.name || m.ao || 'AO'} ({m.scores?.ao ?? m.aoScore ?? 0})
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neutral-700)', background: 'var(--neutral-200)', padding: '4px 10px', borderRadius: '6px' }}>
                            Winner: {m.winnerName || (m.winner === 'aka' ? m.aka?.name : m.ao?.name) || 'Winner Declared'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================
             VIEW B: TOURNAMENT MATS OVERVIEW (When no mat is selected)
             ======================================================== */
          <div>
            {/* MAT OPERATOR HERO: When current user is assigned to a mat */}
            {isMatOperator && assignedMats.length > 0 && (
              <div className="operator-hero-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-live)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8' }}>
                      Official Staff Assignment
                    </span>
                  </div>
                  <h2 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>
                    Assigned Station: {assignedMats.join(', ')}
                  </h2>
                  <p style={{ fontSize: '14px', color: '#cbd5e1', margin: '6px 0 0' }}>
                    You are registered as the active Mat Operator. Click below to launch your operator control station.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {assignedMats.map(matName => {
                    const matNum = matName.replace(/[^0-9]/g, '');
                    const mId = `mat-${parseInt(matNum, 10) || 1}`;
                    return (
                      <Link
                        key={matName}
                        href={`/competitions/${id}/operator?mat=${mId}`}
                        className="btn btn-primary"
                        style={{
                          background: 'var(--status-live)',
                          color: '#000',
                          fontWeight: 800,
                          fontSize: '14px',
                          padding: '12px 20px',
                          borderRadius: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
                        }}
                      >
                        <Play size={16} /> Operate {matName} Control Panel →
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standard Header */}
            <header className="page-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div className="breadcrumb" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--neutral-500)', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  {compName ? compName.toUpperCase() : 'TOURNAMENT'} • MAT COVERAGE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '36px', margin: 0 }}>Tournament Mats</h1>
                  <span className="status-chip status-live">
                    {Object.values(liveStates).filter(s => s.status === 'live').length} Active
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
                  Select any mat below to spectate the live scoreboard, monitor upcoming fights, or operate.
                </p>
              </div>

              {/* Admin Actions */}
              {isAdminOrGuest && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowConfig(!showConfig)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ImageIcon size={16} /> Scoreboard Logo
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={handleSeedMats}
                    disabled={isSeeding}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> {isSeeding ? 'Configuring...' : `Generate ${compMatsCount} Mats`}
                  </button>
                </div>
              )}
            </header>

            {/* Scoreboard Logo Config Panel */}
            {showConfig && isAdminOrGuest && (
              <div style={{ background: 'var(--shiro)', border: '1px solid var(--neutral-300)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Scoreboard Branding Logo</h3>
                  <button onClick={() => setShowConfig(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--neutral-500)', marginBottom: '16px' }}>
                  Upload a competition or sponsor logo to display on all mat scoreboards.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: '13px' }} />
                  {scoreboardLogo && (
                    <img src={scoreboardLogo} alt="Scoreboard logo" style={{ height: '36px', objectFit: 'contain' }} />
                  )}
                </div>
              </div>
            )}

            {/* Mats Grid */}
            {loading ? (
              <div className="mat-grid">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="mat-card standby" style={{ minHeight: 220, opacity: 0.6 }}>
                    <div style={{ height: '24px', background: 'var(--neutral-200)', borderRadius: '4px', width: '40%', marginBottom: '16px' }} />
                    <div style={{ height: '40px', background: 'var(--neutral-100)', borderRadius: '8px', marginBottom: '16px' }} />
                    <div style={{ height: '60px', background: 'var(--neutral-100)', borderRadius: '8px' }} />
                  </div>
                ))}
              </div>
            ) : mats.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--shiro)', borderRadius: '16px', border: '1px solid var(--neutral-300)', marginTop: '24px' }}>
                <Coffee size={40} style={{ color: 'var(--neutral-400)', margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>No Mats Configured</h3>
                <p style={{ color: 'var(--neutral-500)', marginBottom: '20px' }}>
                  {isAdminOrGuest ? `Click 'Generate ${compMatsCount} Mats' to set up the tatami stations.` : 'Mats have not been set up for this tournament yet.'}
                </p>
                {isAdminOrGuest && (
                  <button className="btn btn-primary" onClick={handleSeedMats} disabled={isSeeding}>
                    <Plus size={16} style={{ marginRight: '6px' }} />
                    {isSeeding ? 'Generating...' : `Generate ${compMatsCount} Mats`}
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Mats Search & Filter Controls */}
                <div
                  className="mats-search-bar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginTop: '20px',
                    marginBottom: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      flex: '1 1 240px',
                      minWidth: '220px'
                    }}
                  >
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--neutral-400)',
                        pointerEvents: 'none'
                      }}
                    />
                    <input
                      type="text"
                      value={matSearchQuery}
                      onChange={(e) => setMatSearchQuery(e.target.value)}
                      placeholder="Search mat, category, athlete, or operator..."
                      style={{
                        width: '100%',
                        padding: '10px 34px 10px 38px',
                        borderRadius: '8px',
                        border: '1px solid var(--neutral-300)',
                        background: 'var(--shiro)',
                        fontSize: '13px',
                        fontWeight: 500,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {matSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMatSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--neutral-400)',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setMatFilterStatus('all')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid',
                        borderColor: matFilterStatus === 'all' ? 'var(--kuro)' : 'var(--neutral-300)',
                        background: matFilterStatus === 'all' ? 'var(--kuro)' : 'var(--shiro)',
                        color: matFilterStatus === 'all' ? '#fff' : 'var(--neutral-700)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease'
                      }}
                    >
                      All ({mats.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatFilterStatus('live')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid',
                        borderColor: matFilterStatus === 'live' ? '#22c55e' : 'var(--neutral-300)',
                        background: matFilterStatus === 'live' ? '#dcfce7' : 'var(--shiro)',
                        color: matFilterStatus === 'live' ? '#15803d' : 'var(--neutral-700)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease'
                      }}
                    >
                      ● Live ({Object.values(liveStates).filter(s => s.status === 'live' || s.status === 'paused').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatFilterStatus('standby')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid',
                        borderColor: matFilterStatus === 'standby' ? 'var(--neutral-700)' : 'var(--neutral-300)',
                        background: matFilterStatus === 'standby' ? 'var(--neutral-100)' : 'var(--shiro)',
                        color: matFilterStatus === 'standby' ? 'var(--neutral-900)' : 'var(--neutral-700)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease'
                      }}
                    >
                      Standby
                    </button>
                  </div>
                </div>

                {filteredMats.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--shiro)', borderRadius: '12px', border: '1px solid var(--neutral-300)', marginTop: '20px' }}>
                    <Search size={32} style={{ color: 'var(--neutral-400)', margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>No mats match your search</div>
                    <p style={{ color: 'var(--neutral-500)', fontSize: '13px', margin: '4px 0 12px' }}>Try clearing your search query or status filter.</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setMatSearchQuery(''); setMatFilterStatus('all'); }}
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="mat-grid">
                    {filteredMats.map(mat => {
                  const liveState = liveStates[mat.id] || { status: 'standby' };
                  const isLive = liveState.status === 'live' || liveState.status === 'paused';
                  const assignedCats = categoryByMat[mat.name] || [];
                  const liveCat = assignedCats.find(c => c.status === 'live');
                  const upcomingCats = assignedCats.filter(c => c.status === 'upcoming');
                  const doneCats = assignedCats.filter(c => c.status === 'done');

                  // Find operator assigned to this mat
                  const assignedOperator = staffList.find(s => 
                    s.role === 'score' && (s.assignedMats || []).some(m => m.toUpperCase() === mat.name.toUpperCase() || m.toLowerCase() === mat.id.toLowerCase())
                  );

                  const isCurrentUserStation = (assignedMats || []).some(m => m.toUpperCase() === mat.name.toUpperCase() || m.toLowerCase() === mat.id.toLowerCase());

                  return (
                    <div
                      key={mat.id}
                      className={`mat-card ${isLive ? 'live' : 'standby'} ${isCurrentUserStation ? 'assigned-station' : ''}`}
                      onClick={() => handleSelectMat(mat.id)}
                    >
                      {/* Card Header */}
                      <div className="mat-header">
                        <div>
                          <span className="mat-number">{mat.name}</span>
                          {isCurrentUserStation && (
                            <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--status-live)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              ★ YOUR STATION
                            </span>
                          )}
                        </div>
                        {isLive ? (
                          <span className="status-chip status-live">Live</span>
                        ) : upcomingCats.length > 0 ? (
                          <span className="status-chip" style={{ background: '#bbf7d0', color: '#166534' }}>
                            {upcomingCats.length} Scheduled
                          </span>
                        ) : (
                          <span className="status-chip status-done">Standby</span>
                        )}
                      </div>

                      {/* Card Body */}
                      {isLive ? (
                        <>
                          <div className="category-label">Current Match</div>
                          <div className="category-title">
                            {liveState.category || liveState.currentCategory || liveCat?.name || 'Kumite'}
                            <br />
                            <span style={{ color: 'var(--neutral-500)', fontWeight: 600, fontSize: '13px' }}>
                              {liveState.currentMatch || liveState.matchDisplayId || 'Active Match'}
                            </span>
                          </div>

                          <div className="score-board">
                            <div className="score-side aka">
                              <div className="score-label aka">AKA</div>
                              <div className="score-value aka">{liveState.scores?.aka || 0}</div>
                              <div style={{ fontSize: '11px', color: 'var(--aka)', fontWeight: 700, marginTop: '2px', textAlign: 'center', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {liveState.aka?.name || 'AKA'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div className="score-divider">PTS</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--neutral-600)', marginTop: '4px' }}>
                                {liveState.timeRemaining || '03:00'}
                              </div>
                            </div>
                            <div className="score-side ao">
                              <div className="score-label ao">AO</div>
                              <div className="score-value ao">{liveState.scores?.ao || 0}</div>
                              <div style={{ fontSize: '11px', color: 'var(--ao)', fontWeight: 700, marginTop: '2px', textAlign: 'center', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {liveState.ao?.name || 'AO'}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ flex: 1, minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          {assignedCats.length > 0 ? (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                Assigned Categories ({assignedCats.length})
                              </div>
                              {assignedCats.slice(0, 3).map((c, i) => (
                                <div key={i} style={{ padding: '6px 10px', background: 'var(--neutral-50)', borderRadius: '6px', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--neutral-700)', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{c.name}</span>
                                  <span style={{ color: 'var(--neutral-400)', fontSize: '11px' }}>{c.entries} ATH</span>
                                </div>
                              ))}
                              {assignedCats.length > 3 && (
                                <div style={{ fontSize: '11px', color: 'var(--neutral-400)', textAlign: 'center', marginTop: '4px' }}>
                                  +{assignedCats.length - 3} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: '20px 0' }}>
                              <Coffee size={28} style={{ margin: '0 auto 8px' }} />
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>No Categories Active</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Operator Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--neutral-600)', marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid var(--neutral-100)' }}>
                        <User size={13} style={{ color: assignedOperator ? 'var(--status-live)' : 'var(--neutral-400)' }} />
                        <span>
                          {assignedOperator ? (
                            <strong>Operator: {assignedOperator.displayName || assignedOperator.name || assignedOperator.email}</strong>
                          ) : (
                            <span style={{ color: 'var(--neutral-400)' }}>No Operator Assigned</span>
                          )}
                        </span>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mat-footer" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-action"
                          onClick={() => handleSelectMat(mat.id)}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Spectate Live →
                        </button>

                        {(isAdmin || isCurrentUserStation) && (
                          <Link
                            href={`/competitions/${id}/operator?mat=${mat.id}`}
                            className="btn-action primary"
                            style={{ marginLeft: '8px' }}
                          >
                            Operate
                          </Link>
                        )}
                      </div>

                      {/* Admin-only Mat Password */}
                      {isAdmin && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--neutral-100)', paddingTop: '10px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral-500)' }}>
                              Mat Password
                            </label>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            {(() => {
                              const effectivePwd = mat.displayPassword || (!/^[a-f0-9]{64}$/i.test(mat.password || '') ? (mat.password || '') : '');
                              const currentVal = tempPasswords[mat.id] !== undefined ? tempPasswords[mat.id] : effectivePwd;
                              return (
                                <input 
                                  type={showPasswordMap[mat.id] ? "text" : "password"} 
                                  value={currentVal}
                                  onChange={e => setTempPasswords(prev => ({...prev, [mat.id]: e.target.value}))}
                                  onBlur={() => {
                                    if (tempPasswords[mat.id] !== undefined && tempPasswords[mat.id] !== effectivePwd) {
                                      saveMatPassword(mat.id, tempPasswords[mat.id]);
                                    }
                                  }}
                                  placeholder={effectivePwd ? "Enter mat password" : "Set password..."}
                                  style={{ width: '100%', padding: '4px 28px 4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--neutral-300)', background: 'var(--shiro)' }}
                                />
                              );
                            })()}
                            <button 
                              type="button" 
                              onClick={() => togglePassword(mat.id)}
                              style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', color: 'var(--neutral-500)', cursor: 'pointer', padding: 0 }}
                            >
                              {showPasswordMap[mat.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </main>
</>
);
}
