'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { Lock, Unlock, Users, Calendar, Layout, Award, Edit3, Share2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import OnSpotEntryModal from '@/components/OnSpotEntryModal';
import { Download, Search } from 'lucide-react';
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

  // Admins or users with join link bypass passcode
  const joinParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('join') === 'true';
  const joinedStorage = typeof window !== 'undefined' && localStorage.getItem(`joined_${id}`) === 'true';

  // Move auth side-effect out of render body (React rule: no setState during render)
  useEffect(() => {
    if (!isAuthenticated && (user || joinParam || joinedStorage)) {
      if (joinParam || user) {
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

  useEffect(() => {
    let unsubCats: () => void;
    const fetchComp = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, onSnapshot } = await import('firebase/firestore');

        // Fetch from cached API Gateway instead of direct Firestore getDoc
        const res = await fetch(`/api/competitions/${id}/public`);
        if (res.ok) {
          const data = await res.json();
          setCompData(data);
        }

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

          setRecentMatches(allMatches.reverse().slice(0, 5));
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
    fetchComp();
    return () => unsubCats?.();
  }, [id]);


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


  // Show password gate for unauthenticated viewers
  if (!isAuthenticated && !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'var(--shiro)', padding: '40px 48px', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 8px 32px rgba(0,0,0,0.10)', border: '1px solid var(--neutral-200)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '14px', background: 'rgba(217, 38, 44, 0.08)', borderRadius: '50%', color: 'var(--aka)', marginBottom: '20px' }}>
            <Lock size={28} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>{compData?.name || 'This Competition'}</h2>
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
                  width: '100%', 
                  height: '44px', 
                  padding: '0 44px 0 14px', 
                  border: `1.5px solid ${error ? 'var(--aka)' : 'var(--neutral-300)'}`, 
                  borderRadius: '10px', 
                  fontSize: '14px', 
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: 'var(--shiro)',
                  color: 'var(--neutral-900)',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={checkingPassword}
              style={{ width: '100%', justifyContent: 'center' }}
            >
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

  return (
    <main className="container">
      <header className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Overview
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1>{compData?.name || id}</h1>
            <span className={`status-chip status-${compData?.status || 'live'}`}>
              {compData?.status === 'done' ? 'Completed' : compData?.status === 'upcoming' ? 'Upcoming' : 'Live'}
            </span>
          </div>
        </div>
        <div className="page-header-actions">

          {role === 'admin' && (
            <>
              <button className="btn btn-secondary" onClick={handleShareLink}>
                <Share2 size={16} style={{ marginRight: '8px' }} /> Share Join Link
              </button>
              <button className="btn btn-secondary" onClick={handleExportPreset}>
                <Download size={16} style={{ marginRight: '8px' }} /> Export Preset
              </button>
              <Link href={`/setup/${id}`} className="btn btn-primary">
                <Edit3 size={16} /> Setup Wizard
              </Link>
            </>
          )}
          {role === 'admin' && (
            <>
              <button className="btn btn-secondary" onClick={() => setOnSpotModalOpen(true)}>
                + On-Spot Entry
              </button>
              <button className="btn btn-primary">
                <Layout size={16} style={{ marginRight: '8px' }} /> Start Next Match
              </button>
            </>
          )}
        </div>
      </header>

      <div className="bento-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card bento-tile">
          <div className="text-micro">Total Entries</div>
          <div className="display-large">{compData?.athletesCount || 'N/A'}</div>
          <div className="text-small">{compData?.categoriesCount || 0} categories</div>
        </div>
        <div className="card bento-tile">
          <div className="text-micro">Active Mats</div>
          <div className="display-large" style={{ color: 'var(--aka)' }}>{compData?.mats || 'N/A'}</div>
          <div className="text-small">Configured capacity</div>
        </div>
        <div className="card bento-tile">
          <div className="text-micro">Matches Completed</div>
          <div className="display-large">0</div>
          <div className="text-small">0% of tournament</div>
        </div>
        <div className="card bento-tile">
          <div className="text-micro">Est. Finish Time</div>
          <div className="display-large">N/A</div>
          <div className="text-small">Not started</div>
        </div>
      </div>

      <div className="comp-detail-grid">
        <section className="comp-detail-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(217,38,44,0.08)', color: 'var(--aka)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--aka)', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
              LIVE
            </span>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Live Now — {liveCategories.length} categor{liveCategories.length === 1 ? 'y' : 'ies'}</h2>
          </div>
          
          {liveCategories.length > 0 ? (
            <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: 'var(--space-6)', border: '2px solid rgba(217,38,44,0.25)' }}>
              {liveCategories.map((cat, idx) => {
                const totalMatches = cat.matches?.length || 0;
                const completedMatches = cat.matches?.filter((m: any) => m.status === 'completed').length || 0;
                const pct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
                const isKata = cat.name?.toLowerCase().includes('kata');
                return (
                  <div key={cat.id} style={{ padding: '14px 24px', borderBottom: idx < liveCategories.length - 1 ? '1px solid var(--neutral-100)' : 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--aka)', display: 'inline-block', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }}></span>
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
                        View Bracket →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ padding: '32px', textAlign: 'center', marginBottom: 'var(--space-6)', border: '1px dashed var(--neutral-300)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--neutral-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Layout size={24} style={{ color: 'var(--neutral-400)' }} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--neutral-700)' }}>No Live Categories</h3>
              <p className="text-small" style={{ marginTop: '8px' }}>Categories will appear here once they are started from the operator panel.</p>
            </div>
          )}

          {upcomingCategories.length > 0 && (
            <>
              <h2 style={{ marginBottom: 'var(--space-2)' }}>Upcoming Categories (Next 5)</h2>
              <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
                {upcomingCategories.slice(0, 5).map(cat => (
                  <div key={cat.id} style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{cat.name}</span>
                    <span style={{ color: 'var(--neutral-500)' }}>{cat.mat || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {finishedCategories.length > 0 && (
            <>
              <h2 style={{ marginBottom: 'var(--space-2)' }}>Finished Categories (Last 5)</h2>
              <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
                {finishedCategories.slice(0, 5).map(cat => (
                  <div key={cat.id} style={{ padding: '12px 24px', borderBottom: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{cat.name}</span>
                    <span style={{ color: 'var(--neutral-500)' }}>{cat.mat || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex-between" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <h2>Recent Results</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--neutral-300)', padding: '0 8px', fontSize: '12px' }}
              >
                <option value="all">All Types</option>
                <option value="kata">Kata</option>
                <option value="kumite">Kumite</option>
              </select>
              <select 
                value={filterGender} 
                onChange={e => setFilterGender(e.target.value)}
                style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--neutral-300)', padding: '0 8px', fontSize: '12px' }}
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="mixed">Mixed</option>
              </select>
              <select 
                value={filterMat} 
                onChange={e => setFilterMat(e.target.value)}
                style={{ height: '32px', borderRadius: '6px', border: '1px solid var(--neutral-300)', padding: '0 8px', fontSize: '12px' }}
              >
                <option value="all">All Mats</option>
                {compData?.mats && Array.from({ length: compData.mats }).map((_, i) => {
                  const m = `MAT ${String(i + 1).padStart(2, '0')}`;
                  return <option key={m} value={m}>{m}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-300)' }}>
                <tr>
                  <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'left' }}>Category</th>
                  <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'left' }}>Aka (Red)</th>
                  <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'left' }}>Ao (Blue)</th>
                  <th className="text-micro" style={{ padding: '12px 24px', textAlign: 'right' }}>Winner</th>
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
                    if (filterGender !== 'all') {
                      const isFemale = nameLower.includes('female') || nameLower.includes('women');
                      const isMale = !isFemale && (nameLower.includes('male') || nameLower.includes('men'));
                      const isMixed = nameLower.includes('mixed') || nameLower.includes('team');
                      if (filterGender === 'female' && !isFemale) return false;
                      if (filterGender === 'male' && !isMale) return false;
                      if (filterGender === 'mixed' && !isMixed) return false;
                    }
                    if (filterMat !== 'all' && m.mat !== filterMat) return false;
                    return true;
                  });

                  if (filteredMatches.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                          No matches found.
                        </td>
                      </tr>
                    );
                  }

                  return filteredMatches.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--neutral-200)' }}>
                      <td style={{ padding: '12px 24px', fontSize: '13px', fontWeight: 500 }}>{m.categoryName} <span style={{ fontSize: '10px', color: 'var(--neutral-400)', display: 'block' }}>{m.mat}</span></td>
                      <td style={{ padding: '12px 24px', fontSize: '14px' }}>{m.aka?.name || '-'}</td>
                      <td style={{ padding: '12px 24px', fontSize: '14px' }}>{m.ao?.name || '-'}</td>
                      <td style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 600, textAlign: 'right', color: m.winnerId === m.aka?.playerId ? 'var(--aka)' : 'var(--ao)' }}>
                        {m.winnerId === m.aka?.playerId ? (m.aka?.name === 'Empty Slot' ? 'advanced via BYE' : m.aka?.name) : (m.ao?.name === 'Empty Slot' ? 'advanced via BYE' : m.ao?.name)}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        <section className="comp-detail-sidebar">
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Mat Leaderboards</h2>
          {Object.keys(matLeaderboards).length === 0 ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
              No medals awarded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.keys(matLeaderboards).map(mat => (
                <div key={mat} className="card" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid var(--neutral-200)', paddingBottom: '8px' }}>{mat}</h3>
                  {matLeaderboards[mat].map((entry, idx) => (
                    <div key={entry.academy} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: idx < matLeaderboards[mat].length - 1 ? '1px solid var(--neutral-100)' : 'none' }}>
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

          <h2 style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>WKF 102 Katas</h2>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '400px' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
              <input
                type="text"
                placeholder="Search Kata (e.g. Suparinpei)..."
                value={kataSearchQuery}
                onChange={(e) => setKataSearchQuery(e.target.value)}
                style={{ width: '100%', height: '36px', paddingLeft: '32px', borderRadius: '6px', border: '1px solid var(--neutral-300)', fontSize: '13px' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {KATA_LIST.filter(k => k.name.toLowerCase().includes(kataSearchQuery.toLowerCase())).map(k => (
                <div key={k.number} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--neutral-100)', fontSize: '13px' }}>
                  <span style={{ fontWeight: 600 }}>{k.name}</span>
                  <span style={{ color: 'var(--neutral-500)', fontSize: '11px', fontWeight: 800 }}>#{String(k.number).padStart(3, '0')}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {onSpotModalOpen && (
        <OnSpotEntryModal
          competitionId={id}
          categories={[...liveCategories, ...upcomingCategories, ...finishedCategories]}
          onClose={() => setOnSpotModalOpen(false)}
        />
      )}
    </main>
  );
}

