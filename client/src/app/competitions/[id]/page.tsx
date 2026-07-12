'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Lock, Unlock, Users, Calendar, Layout, Award, Edit3, Share2, Eye, EyeOff, Download, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import OnSpotEntryModal from '@/components/OnSpotEntryModal';
import { KATA_LIST } from '@/lib/kata-list';

export default function CompetitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user, role } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);

  const [compData, setCompData] = useState<any>(null);
  const [onSpotModalOpen, setOnSpotModalOpen] = useState(false);

  const searchParams = useSearchParams();
  const joinParam = searchParams.get('join') === 'true';
  const joinedStorage = typeof window !== 'undefined' && localStorage.getItem(`joined_${id}`) === 'true';

  useEffect(() => {
    const isRegisteredUser = user && !user.isAnonymous;
    if (!isAuthenticated && (isRegisteredUser || joinParam || joinedStorage)) {
      if (joinParam) {
        localStorage.setItem(`joined_${id}`, 'true');
      }
      setIsAuthenticated(true);
    }
  }, [user, joinParam, joinedStorage, isAuthenticated, id]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setCheckingPassword(true);
    setError('');
    try {
      const { db } = await import('@lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'competitions', id));
      if (snap.exists()) {
        const actualPassword = snap.data().password;
        if (actualPassword && actualPassword === passwordInput) {
          localStorage.setItem(`joined_${id}`, 'true');
          setIsAuthenticated(true);
          setError('');
          toast.success('Access granted!');
        } else {
          setError('Incorrect password. Please try again.');
        }
      } else {
        setError('Competition not found.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setCheckingPassword(false);
    }
  };

  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [matLeaderboards, setMatLeaderboards] = useState<Record<string, any[]>>({});
  
  const [liveCategories, setLiveCategories] = useState<any[]>([]);
  const [upcomingCategories, setUpcomingCategories] = useState<any[]>([]);
  const [finishedCategories, setFinishedCategories] = useState<any[]>([]);

  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterMat, setFilterMat] = useState('all');
  const [kataSearchQuery, setKataSearchQuery] = useState('');

  // 1. Fetch competition data via onSnapshot instead of static fetch
  useEffect(() => {
    if (!user) return;

    let unsubComp: () => void;
    let unsubCats: () => void;

    const setupListeners = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { doc, collection, onSnapshot } = await import('firebase/firestore');

        unsubComp = onSnapshot(doc(db, 'competitions', id), (docSnap) => {
          if (docSnap.exists()) {
            setCompData({ id: docSnap.id, ...docSnap.data() });
          }
        });

        unsubCats = onSnapshot(collection(db, 'competitions', id, 'categories'), (snap) => {
          let allMatches: any[] = [];
          let matStats: Record<string, Record<string, { gold: number, silver: number, bronze: number, points: number }>> = {};
          let lCats: any[] = [];
          let uCats: any[] = [];
          let fCats: any[] = [];

          snap.docs.forEach(docSnap => {
            const cat = docSnap.data();
            cat.id = docSnap.id;
            const matName = (cat.mat || 'Unassigned').toUpperCase();

            if (cat.status === 'live') lCats.push(cat);
            else if (cat.status === 'done' || cat.status === 'completed') fCats.push(cat);
            else uCats.push(cat);

            if (cat.matches) {
              const completed = cat.matches.filter((m: any) => m.status === 'completed').map((m: any) => ({
                ...m,
                categoryName: cat.name,
                mat: cat.mat,
              }));
              allMatches.push(...completed);
            }

            if (!matStats[matName]) matStats[matName] = {};
            if (cat.athletes) {
              cat.athletes.forEach((ath: any) => {
                if (ath.medal) {
                  const academy = ath.academy || 'Unknown';
                  if (!matStats[matName][academy]) {
                    matStats[matName][academy] = { gold: 0, silver: 0, bronze: 0, points: 0 };
                  }
                  if (ath.medal === 'gold') {
                    matStats[matName][academy].gold += 1;
                    matStats[matName][academy].points += 3;
                  } else if (ath.medal === 'silver') {
                    matStats[matName][academy].silver += 1;
                    matStats[matName][academy].points += 2;
                  } else if (ath.medal === 'bronze') {
                    matStats[matName][academy].bronze += 1;
                    matStats[matName][academy].points += 1;
                  }
                }
              });
            }
          });

          setRecentMatches(allMatches.reverse());
          setLiveCategories(lCats);
          setUpcomingCategories(uCats);
          setFinishedCategories(fCats);

          const formattedBoards: Record<string, any[]> = {};
          for (const mat of Object.keys(matStats).sort()) {
            const arr = Object.entries(matStats[mat]).map(([academy, stats]) => ({ academy, ...stats }));
            arr.sort((a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
            if (arr.length > 0) {
              formattedBoards[mat] = arr;
            }
          }
          setMatLeaderboards(formattedBoards);
        });
      } catch (err) {
        console.error('Failed to load competition', err);
      }
    };
    setupListeners();

    return () => {
      unsubComp?.();
      unsubCats?.();
    };
  }, [id, user]);

  useEffect(() => {
    const gsap = (window as any).gsap;
    let ctx: any;
    if (gsap) {
      ctx = gsap.context(() => {
        gsap.from('.stagger-in', {
          y: 20,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'expo.out'
        });
      });
    }
    return () => { if (ctx) ctx.revert(); };
  }, [compData]); // Re-run when data loads

  const handleShareLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/competitions/${id}?join=true`;
      navigator.clipboard.writeText(url);
      toast.success('Public join link copied to clipboard!');
    }
  };

  const handleExportPreset = async () => {
    try {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'competitions', id, 'categories'));
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      const preset = cats.map(c => ({
        name: c.name,
        discipline: c.discipline,
        gender: c.gender,
        minAge: c.minAge,
        maxAge: c.maxAge,
        minWeight: c.minWeight,
        maxWeight: c.maxWeight,
        isKata: c.isKata,
        judgeCount: c.judgeCount,
        minGrade: c.minGrade,
        maxGrade: c.maxGrade
      }));

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(preset, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${compData?.name || 'custom'}_preset.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success('Preset exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export preset');
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'var(--shiro)', padding: '40px 48px', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 8px 32px rgba(0,0,0,0.10)', border: '1px solid var(--neutral-200)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '14px', background: 'rgba(217, 38, 44, 0.08)', borderRadius: '50%', color: 'var(--aka)', marginBottom: '20px' }}>
            <Lock size={28} />
          </div>
          {compData ? (
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>{compData.name}</h2>
          ) : (
            <div style={{ width: '200px', height: '28px', background: 'var(--neutral-200)', borderRadius: '6px', margin: '0 auto 8px auto', animation: 'pulse 1.5s infinite' }} />
          )}
          <p style={{ color: 'var(--neutral-500)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
            This is a private event. Enter the competition password to view live results, tiesheets, and mats.
          </p>
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type={showPasswordInput ? 'text' : 'password'}
                placeholder="Enter competition password..."
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                autoFocus
                style={{ 
                  width: '100%', height: '44px', padding: '0 44px 0 14px', 
                  border: `1.5px solid ${error ? 'var(--aka)' : 'var(--neutral-300)'}`, 
                  borderRadius: '10px', fontSize: '14px', fontFamily: 'inherit',
                  outline: 'none', background: 'var(--shiro)', color: 'var(--neutral-900)',
                  boxSizing: 'border-box', transition: 'border-color 0.2s'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPasswordInput(s => !s)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--neutral-500)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {showPasswordInput ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p style={{ color: 'var(--aka)', fontSize: '12px', marginBottom: '12px', textAlign: 'left' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={checkingPassword} style={{ width: '100%', justifyContent: 'center' }}>
              <Lock size={15} style={{ marginRight: '8px' }} />
              {checkingPassword ? 'Verifying...' : 'Access Competition'}
            </button>
          </form>
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--neutral-200)' }}>
            <p style={{ fontSize: '13px', color: 'var(--neutral-400)', marginBottom: '12px' }}>Have a join link?</p>
            <Link href="/login" style={{ fontSize: '13px', color: 'var(--ao)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in with your account instead →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalMatchesCount = compData?.matchesCount || 0; // if tracked
  // Or derive from matches
  let allCatMatches = 0;
  let allCatCompleted = 0;
  [...liveCategories, ...upcomingCategories, ...finishedCategories].forEach(cat => {
    if (cat.matches) {
      allCatMatches += cat.matches.length;
      allCatCompleted += cat.matches.filter((m:any) => m.status === 'completed').length;
    }
  });

  const percentCompleted = allCatMatches > 0 ? Math.round((allCatCompleted / allCatMatches) * 100) : 0;

  return (
    <>
      <main className="container">
        <header className="page-header stagger-in">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Overview
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {compData ? (
                <>
                  <h1>{compData.name}</h1>
                  <span className={`status-chip status-${compData.status || 'live'}`}>
                    {compData.status === 'done' ? 'Completed' : compData.status === 'upcoming' ? 'Upcoming' : 'Live'}
                  </span>
                </>
              ) : (
                <>
                  <div style={{ width: '240px', height: '40px', background: 'var(--neutral-200)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ width: '80px', height: '24px', background: 'var(--neutral-200)', borderRadius: '999px', animation: 'pulse 1.5s infinite' }} />
                </>
              )}
            </div>
          </div>
          <div className="page-header-actions">
            {role === 'admin' && (
              <>
                <button className="btn btn-secondary" onClick={handleShareLink}>
                  <Share2 size={16} /> Public Link
                </button>
                <Link href={`/competitions/${id}/operator`} className="btn btn-primary">
                  <Layout size={16} /> Operator Panel
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="bento-grid stagger-in">
          {/* TOP STATS */}
          <div className="bento-tile bento-reveal">
            <div className="text-micro">Total Entries</div>
            <div className="display-large">{compData ? (compData.athletesCount || 0) : '-'}</div>
            <div className="text-small">{compData ? (compData.categoriesCount || 0) : '-'} categories</div>
          </div>
          <div className="bento-tile bento-reveal">
            <div className="text-micro">Active Mats</div>
            <div className="display-large" style={{ color: 'var(--aka)' }}>{compData ? (compData.mats || 1) : '-'}</div>
            <div className="text-small">Configured capacity</div>
          </div>
          <div className="bento-tile bento-reveal">
            <div className="text-micro">Matches Completed</div>
            <div className="display-large">{compData ? allCatCompleted : '-'}</div>
            <div className="text-small">{compData ? percentCompleted : 0}% of tournament</div>
          </div>
          <div className="bento-tile bento-reveal">
            <div className="text-micro">Est. Finish Time</div>
            <div className="display-large">N/A</div>
            <div className="text-small">Not calculated yet</div>
          </div>

          {/* ROW 2: LIVE & UPCOMING */}
          <div className="bento-tile bento-reveal span-2-2" style={{ border: liveCategories.length > 0 ? '1.5px solid var(--aka)' : undefined }}>
            <div className="flex-between mb-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="status-chip status-live">Live</span>
                <span className="text-micro" style={{ color: 'var(--neutral-900)' }}>Live Now — {liveCategories.length} categor{liveCategories.length === 1 ? 'y' : 'ies'}</span>
              </div>
            </div>
            
            {liveCategories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {liveCategories.map((cat, idx) => {
                  const totalMatches = cat.matches?.length || 0;
                  const completedMatches = cat.matches?.filter((m: any) => m.status === 'completed').length || 0;
                  const pct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
                  const isKata = cat.name?.toLowerCase().includes('kata');
                  return (
                    <div key={cat.id} style={{ paddingBottom: '16px', borderBottom: idx < liveCategories.length - 1 ? '1px solid var(--neutral-100)' : 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{cat.name}</span>
                          <span className="text-micro" style={{ padding: '2px 6px', borderRadius: '4px', background: isKata ? 'var(--ao-light)' : 'var(--aka-light)', color: isKata ? 'var(--ao)' : 'var(--aka)' }}>
                            {isKata ? 'KATA' : 'KUMITE'}
                          </span>
                        </div>
                        {totalMatches > 0 && (
                          <div style={{ marginTop: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span className="text-small">{completedMatches}/{totalMatches} matches done</span>
                              <span className="text-small" style={{ fontWeight: 700, color: 'var(--aka)' }}>{pct}%</span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--neutral-100)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'var(--aka)', width: `${pct}%`, transition: 'width 0.3s' }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span className="data-mono text-small" style={{ fontWeight: 600 }}>{cat.mat || 'Unassigned'}</span>
                        <Link href={`/competitions/${id}/brackets?cat=${cat.id}`} className="btn btn-ghost" style={{ padding: '6px 12px' }}>
                          <Eye size={16} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Layout size={24} style={{ color: 'var(--neutral-400)', marginBottom: '12px' }} />
                <div className="text-small">No Live Categories</div>
              </div>
            )}
          </div>

          <div className="bento-tile bento-reveal span-2-2">
            <div className="text-micro mb-4">Upcoming (Next 5)</div>
            {upcomingCategories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcomingCategories.slice(0, 5).map((cat, idx) => (
                  <div key={cat.id} style={{ paddingBottom: '12px', borderBottom: idx < Math.min(upcomingCategories.length, 5) - 1 ? '1px solid var(--neutral-100)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{cat.name}</span>
                    <span className="data-mono text-small" style={{ fontWeight: 600 }}>{cat.mat || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '13px' }}>No upcoming categories.</div>
            )}
          </div>

          {/* ROW 3: RECENT RESULTS & FINISHED */}
          <div className="bento-tile bento-reveal" style={{ gridColumn: 'span 3' }}>
            <div className="flex-between mb-4">
              <div className="text-micro">Recent Results</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={filterType} 
                  onChange={e => setFilterType(e.target.value)}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--neutral-300)', padding: '0 8px', fontSize: '12px', outline: 'none' }}
                >
                  <option value="all">All Types</option>
                  <option value="kata">Kata</option>
                  <option value="kumite">Kumite</option>
                </select>
                <select 
                  value={filterMat} 
                  onChange={e => setFilterMat(e.target.value)}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--neutral-300)', padding: '0 8px', fontSize: '12px', outline: 'none' }}
                >
                  <option value="all">All Mats</option>
                  {compData?.mats && Array.from({ length: compData.mats }).map((_, i) => {
                    const m = `MAT ${String(i + 1).padStart(2, '0')}`;
                    return <option key={m} value={m}>{m}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="table-responsive" style={{ margin: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-300)' }}>
                  <tr>
                    <th className="text-micro" style={{ padding: '12px 16px', textAlign: 'left' }}>Category</th>
                    <th className="text-micro" style={{ padding: '12px 16px', textAlign: 'left' }}>Aka (Red)</th>
                    <th className="text-micro" style={{ padding: '12px 16px', textAlign: 'left' }}>Ao (Blue)</th>
                    <th className="text-micro" style={{ padding: '12px 16px', textAlign: 'right' }}>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredMatches = recentMatches.filter(m => {
                      if (!m.categoryName) return true;
                      const nameLower = m.categoryName.toLowerCase();
                      if (filterType !== 'all') {
                        if (filterType === 'kata' && !nameLower.includes('kata')) return false;
                        if (filterType === 'kumite' && !nameLower.includes('kumite')) return false;
                      }
                      if (filterMat !== 'all' && m.mat !== filterMat) return false;
                      return true;
                    }).slice(0, 10);

                    if (filteredMatches.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} style={{ padding: '24px', textAlign: 'center' }} className="text-small">
                            No matches found.
                          </td>
                        </tr>
                      );
                    }

                    return filteredMatches.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>
                          {m.categoryName} <span className="data-mono" style={{ color: 'var(--neutral-400)', display: 'block', marginTop: '2px', fontSize: '11px' }}>{m.mat}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{m.aka?.name || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{m.ao?.name || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, textAlign: 'right', color: m.winnerId === m.aka?.playerId ? 'var(--aka)' : 'var(--ao)' }}>
                          {m.winnerId === m.aka?.playerId ? (m.aka?.name === 'Empty Slot' ? 'BYE' : m.aka?.name) : (m.ao?.name === 'Empty Slot' ? 'BYE' : m.ao?.name)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bento-tile bento-reveal">
            <div className="text-micro mb-4">Finished (Last 5)</div>
            {finishedCategories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {finishedCategories.slice(0, 5).map((cat, idx) => (
                  <div key={cat.id} style={{ paddingBottom: '12px', borderBottom: idx < Math.min(finishedCategories.length, 5) - 1 ? '1px solid var(--neutral-100)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{cat.name}</span>
                    <span className="data-mono text-small" style={{ fontWeight: 600 }}>{cat.mat || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '13px' }}>No finished categories.</div>
            )}
          </div>

          {/* ROW 4: MAT LEADERBOARDS & KATA LIST */}
          <div className="bento-tile bento-reveal" style={{ gridColumn: 'span 3' }}>
            <div className="text-micro mb-4">Mat Leaderboards</div>
            {Object.keys(matLeaderboards).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '13px' }}>
                No medals awarded yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-5)' }}>
                {Object.keys(matLeaderboards).map(mat => (
                  <div key={mat} style={{ border: '1px solid var(--neutral-200)', borderRadius: '10px', padding: '16px' }}>
                    <h3 className="data-mono" style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid var(--neutral-100)', paddingBottom: '8px' }}>{mat}</h3>
                    {matLeaderboards[mat].map((entry, idx) => (
                      <div key={entry.academy} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: idx < matLeaderboards[mat].length - 1 ? '1px solid var(--neutral-50)' : 'none' }}>
                        <div className={`rank-badge ${idx < 3 ? 'rank-' + (idx + 1) : ''}`}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{entry.academy}</div>
                        <div style={{ display: 'flex', gap: '4px', fontSize: '12px', fontWeight: 500 }}>
                          <span style={{ color: '#d97706' }}>{entry.gold}</span>/
                          <span style={{ color: '#6b7280' }}>{entry.silver}</span>/
                          <span style={{ color: '#92400e' }}>{entry.bronze}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bento-tile bento-reveal" style={{ height: '400px' }}>
            <div className="text-micro mb-4">WKF 102 Katas</div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
              <input
                type="text"
                placeholder="Search Kata..."
                value={kataSearchQuery}
                onChange={(e) => setKataSearchQuery(e.target.value)}
                style={{ width: '100%', height: '36px', paddingLeft: '32px', borderRadius: '6px', border: '1px solid var(--neutral-300)', fontSize: '13px', outline: 'none' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
              {KATA_LIST.filter(k => k.name.toLowerCase().includes(kataSearchQuery.toLowerCase())).map(k => (
                <div key={k.number} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--neutral-50)', fontSize: '13px' }}>
                  <span style={{ fontWeight: 600 }}>{k.name}</span>
                  <span className="data-mono" style={{ color: 'var(--neutral-400)', fontSize: '11px', fontWeight: 800 }}>#{String(k.number).padStart(3, '0')}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {onSpotModalOpen && (
          <OnSpotEntryModal
            competitionId={id}
            categories={[...liveCategories, ...upcomingCategories, ...finishedCategories]}
            onClose={() => setOnSpotModalOpen(false)}
          />
        )}
      </main>
    </>
  );
}
