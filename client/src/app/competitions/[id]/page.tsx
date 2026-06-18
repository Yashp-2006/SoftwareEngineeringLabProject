'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { Lock, Unlock, Users, Calendar, Layout, Award, Edit3, Share2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function CompetitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const searchParams = useSearchParams();
  const { user, role } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`joined_${id}`) === 'true';
    }
    return false;
  });
  const [error, setError] = useState('');

  const [compData, setCompData] = useState<any>(null);

  // Admins or users with join link bypass passcode
  useEffect(() => {
    if (user || searchParams.get('join') === 'true') {
      if (searchParams.get('join') === 'true') {
        localStorage.setItem(`joined_${id}`, 'true');
      }
      if (user) {
        localStorage.setItem(`joined_${id}`, 'true');
      }
      setIsAuthenticated(true);
    }
  }, [user, searchParams, id]);

  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [matLeaderboards, setMatLeaderboards] = useState<Record<string, any[]>>({});
  
  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterMat, setFilterMat] = useState('all');

  useEffect(() => {
    let unsubCats: () => void;
    const fetchComp = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { doc, getDoc, collection, onSnapshot } = await import('firebase/firestore');
        const d = await getDoc(doc(db, 'competitions', id));
        if (d.exists()) {
          setCompData(d.data());
        }

        unsubCats = onSnapshot(collection(db, 'competitions', id, 'categories'), (snap) => {
          let allMatches: any[] = [];
          let matStats: Record<string, Record<string, { gold: number, silver: number, bronze: number, points: number }>> = {};

          snap.docs.forEach(docSnap => {
            const cat = docSnap.data();
            const matName = (cat.mat || 'Unassigned').toUpperCase();

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
        console.error("Failed to load competition", err);
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

  if (!isAuthenticated) {
    return (
      <main className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: 'var(--space-6)' }}>
          <Lock style={{ width: '48px', height: '48px', color: 'var(--neutral-400)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Private Event</h2>
          <p className="text-small" style={{ marginBottom: 'var(--space-5)' }}>Please use the public join link provided by the tournament organizer to view live results.</p>
        </div>
      </main>
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
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>

          {role === 'admin' && (
            <>
              <button className="btn btn-secondary" onClick={handleShareLink}>
                <Share2 size={16} style={{ marginRight: '8px' }} /> Share Join Link
              </button>
              <Link href={`/setup/${id}`} className="btn btn-primary">
                <Edit3 size={16} /> Setup Wizard
              </Link>
            </>
          )}
          {role === 'admin' && (
            <button className="btn btn-primary">
              <Layout size={16} style={{ marginRight: '8px' }} /> Start Next Match
            </button>
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
        </section>
      </div>
    </main>
  );
}
