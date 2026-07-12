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
  }, [id]);

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
      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-bento {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        .bento-card {
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 16px;
          padding: var(--space-4);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .bento-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
          border-color: var(--neutral-300);
        }
        .col-span-3 { grid-column: span 3; }
        .col-span-4 { grid-column: span 4; }
        .col-span-8 { grid-column: span 8; }
        .col-span-12 { grid-column: span 12; }

        @media (max-width: 1024px) {
          .col-span-3, .col-span-4 { grid-column: span 6; }
          .col-span-8, .col-span-12 { grid-column: span 12; }
          .dashboard-bento { gap: var(--space-3); }
        }
        @media (max-width: 768px) {
          .col-span-3, .col-span-4, .col-span-8, .col-span-12 { grid-column: span 12; }
          .dashboard-bento { gap: var(--space-3); }
          .bento-card { border-radius: 12px; }
        }
        
        .stat-header {
          display: flex; align-items: center; gap: var(--space-2);
          color: var(--neutral-500); font-size: 13px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--space-3);
        }
        .stat-value {
          font-family: var(--font-display); font-size: 42px; line-height: 1;
          color: var(--neutral-900); margin-bottom: var(--space-1);
        }
        .stat-footer {
          font-size: 13px; color: var(--neutral-500); display: flex; align-items: center; gap: var(--space-1);
          margin-top: auto; padding-top: var(--space-3);
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}} />

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
                <button className="btn btn-secondary" onClick={handleShareLink} style={{ padding: '8px 16px' }}>
                  <Share2 size={16} style={{ marginRight: '6px' }} /> Share Join Link
                </button>
                <Link href={`/competitions/${id}/operator`} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                  <Layout size={16} style={{ marginRight: '6px' }} /> Operator Panel
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="dashboard-bento stagger-in">
          {/* TOP STATS */}
          <div className="bento-card col-span-3">
            <div style={{ flex: 1 }}>
              <div className="stat-header"><Users size={16} style={{ color: 'var(--ao)' }}/> Total Entries</div>
              <div className="stat-value">{compData ? (compData.athletesCount || 0) : '-'}</div>
            </div>
            <div className="stat-footer">{compData ? (compData.categoriesCount || 0) : '-'} categories</div>
          </div>
          <div className="bento-card col-span-3">
            <div style={{ flex: 1 }}>
              <div className="stat-header"><Layout size={16} style={{ color: 'var(--aka)' }}/> Active Mats</div>
              <div className="stat-value" style={{ color: 'var(--aka)' }}>{compData ? (compData.mats || 1) : '-'}</div>
            </div>
            <div className="stat-footer">Configured capacity</div>
          </div>
          <div className="bento-card col-span-3">
            <div style={{ flex: 1 }}>
              <div className="stat-header"><Award size={16} style={{ color: 'var(--status-live)' }}/> Matches Completed</div>
              <div className="stat-value">{compData ? allCatCompleted : '-'}</div>
            </div>
            <div className="stat-footer">{compData ? percentCompleted : 0}% of tournament</div>
          </div>
          <div className="bento-card col-span-3">
            <div style={{ flex: 1 }}>
              <div className="stat-header"><Calendar size={16} style={{ color: 'var(--neutral-500)' }}/> Est. Finish Time</div>
              <div className="stat-value">N/A</div>
            </div>
            <div className="stat-footer">Not calculated yet</div>
          </div>

          {/* ROW 2: LIVE & UPCOMING */}
          <div className="bento-card col-span-8" style={{ border: liveCategories.length > 0 ? '2px solid rgba(217,38,44,0.25)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-4)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(217,38,44,0.08)', color: 'var(--aka)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--aka)', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                LIVE
              </span>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Live Now — {liveCategories.length} categor{liveCategories.length === 1 ? 'y' : 'ies'}</h2>
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
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>{cat.name}</span>
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px', background: isKata ? '#eff6ff' : '#1d4ed8', color: isKata ? '#1d4ed8' : '#be123c', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {isKata ? 'KATA' : 'KUMITE'}
                          </span>
                        </div>
                        {totalMatches > 0 && (
                          <div style={{ marginTop: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--neutral-500)' }}>{completedMatches}/{totalMatches} matches done</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--aka)' }}>{pct}%</span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--neutral-100)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'var(--aka)', borderRadius: '2px', width: `${pct}%`, transition: 'width 0.3s' }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginTop: '12px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--neutral-600)', background: 'var(--neutral-100)', padding: '4px 10px', borderRadius: '6px' }}>{cat.mat || 'Unassigned'}</span>
                        <Link href={`/competitions/${id}/brackets?cat=${cat.id}`} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--aka)', border: '1px solid rgba(217,38,44,0.3)' }}>
                          Bracket →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--neutral-300)', borderRadius: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--neutral-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Layout size={24} style={{ color: 'var(--neutral-400)' }} />
                </div>
                <h3 style={{ margin: 0, color: 'var(--neutral-700)' }}>No Live Categories</h3>
                <p className="text-small" style={{ marginTop: '8px' }}>Categories will appear here once they are started from the operator panel.</p>
              </div>
            )}
          </div>

          <div className="bento-card col-span-4">
            <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-4)' }}>Upcoming (Next 5)</h2>
            {upcomingCategories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcomingCategories.slice(0, 5).map(cat => (
                  <div key={cat.id} style={{ paddingBottom: '12px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{cat.name}</span>
                    <span style={{ color: 'var(--neutral-500)', fontSize: '12px', fontWeight: 600, padding: '4px 8px', background: 'var(--neutral-50)', borderRadius: '6px' }}>{cat.mat || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '13px' }}>No upcoming categories.</div>
            )}
          </div>

          {/* ROW 3: RECENT RESULTS & FINISHED */}
          <div className="bento-card col-span-8">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '18px', margin: 0 }}>Recent Results</h2>
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

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--neutral-50)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aka (Red)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ao (Blue)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Winner</th>
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
                          <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '13px' }}>
                            No matches found.
                          </td>
                        </tr>
                      );
                    }

                    return filteredMatches.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>
                          {m.categoryName} <span style={{ fontSize: '10px', color: 'var(--neutral-400)', display: 'block', marginTop: '2px' }}>{m.mat}</span>
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

          <div className="bento-card col-span-4">
            <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-4)' }}>Finished (Last 5)</h2>
            {finishedCategories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {finishedCategories.slice(0, 5).map(cat => (
                  <div key={cat.id} style={{ paddingBottom: '12px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{cat.name}</span>
                    <span style={{ color: 'var(--neutral-500)', fontSize: '12px', fontWeight: 600, padding: '4px 8px', background: 'var(--neutral-50)', borderRadius: '6px' }}>{cat.mat || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '13px' }}>No finished categories.</div>
            )}
          </div>

          {/* ROW 4: MAT LEADERBOARDS & KATA LIST */}
          <div className="bento-card col-span-8">
            <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-4)' }}>Mat Leaderboards</h2>
            {Object.keys(matLeaderboards).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '13px' }}>
                No medals awarded yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                {Object.keys(matLeaderboards).map(mat => (
                  <div key={mat} style={{ border: '1px solid var(--neutral-200)', borderRadius: '12px', padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid var(--neutral-100)', paddingBottom: '8px' }}>{mat}</h3>
                    {matLeaderboards[mat].map((entry, idx) => (
                      <div key={entry.academy} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: idx < matLeaderboards[mat].length - 1 ? '1px solid var(--neutral-50)' : 'none' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#d97706' : '#f3f4f6', color: idx < 3 ? 'white' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
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

          <div className="bento-card col-span-4" style={{ height: '400px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-4)' }}>WKF 102 Katas</h2>
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
                  <span style={{ color: 'var(--neutral-400)', fontSize: '11px', fontWeight: 800 }}>#{String(k.number).padStart(3, '0')}</span>
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
