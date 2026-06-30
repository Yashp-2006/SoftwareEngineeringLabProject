'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, Filter } from 'lucide-react';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ArchiveDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [compData, setCompData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [leaderboardFilter, setLeaderboardFilter] = useState('academy');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [downloadingTiesheets, setDownloadingTiesheets] = useState(false);

  useEffect(() => {
    ChartJS.defaults.font.family = "var(--font-body), sans-serif";
    ChartJS.defaults.color = "#737373";
  }, []);

  const openModal = (catId?: string) => {
    setActiveCategoryId(catId || categories[0]?.id || null);
    setModalOpen(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { collection, getDocs, doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@lib/firebase');
        
        const compDoc = await getDoc(doc(db, 'competitions', id));
        if (compDoc.exists()) {
          setCompData(compDoc.data());
        }

        const catSnap = await getDocs(collection(db, 'competitions', id, 'categories'));
        const cats = [];
        for (const catDoc of catSnap.docs) {
          cats.push({ id: catDoc.id, ...catDoc.data() });
        }
        setCategories(cats);

        const staffSnap = await getDocs(collection(db, 'competitions', id, 'staff'));
        setStaff(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const athSnap = await getDocs(collection(db, 'competitions', id, 'athletes'));
        setAthletes(athSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDownloadTiesheets = async () => {
    if (downloadingTiesheets) return;
    setDownloadingTiesheets(true);
    try {
      if (categories.length === 0) {
        alert('No categories found for this competition.');
        return;
      }
      const { exportTiesheetsPDF } = await import('@taikaix/backend/services/tiesheet-pdf-exporter');
      
      const compDate = compData?.startDate ? new Date(compData.startDate).toLocaleDateString() : '';

      await exportTiesheetsPDF({
        competitionName: compData?.name || 'Archived Competition',
        categories: categories.map((c: any) => ({
          name: c.name,
          matches: c.matches ?? [],
          athletes: c.athletes ?? [],
          matNo: c.mat || '',
          isKata: c.isKata === true || (typeof c.name === 'string' && c.name.toLowerCase().includes('kata')),
        })),
        isArchived: true,
        venue: compData?.venue || '',
        date: compDate,
      });
    } catch (e: any) {
      alert('Failed to generate tiesheets: ' + e.message);
    } finally {
      setDownloadingTiesheets(false);
    }
  };

  const categoryLabels = categories.map(c => c.name);
  const categoryCounts = categories.map(c => (c.athletes || []).length);
  const pieColors = categories.map((_, i) => `hsl(${(i * 360) / Math.max(1, categories.length)}, 70%, 50%)`);

  const athletesData = {
    labels: categoryLabels.length > 0 ? categoryLabels : ['No Data'],
    datasets: [{
      label: 'Athletes',
      data: categoryCounts.length > 0 ? categoryCounts : [1],
      backgroundColor: categoryCounts.length > 0 ? pieColors : ['#e0e0e0'],
      borderWidth: 1,
    }]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { position: 'right' as const, labels: { boxWidth: 12 } },
    },
  };

  const leaderboards: Record<string, Record<string, { gold: number, silver: number, bronze: number, points: number }>> = {
    academy: {},
    state: {},
    country: {},
  };

  const medalistsList: any[] = [];

  categories.forEach(cat => {
    let g: any = null, s: any = null, b1: any = null, b2: any = null;

    if (cat.athletes) {
      cat.athletes.forEach((ath: any) => {
        if (!ath.medal) return;
        
        const acad = ath.academy || 'Unknown';
        const st = ath.state || 'Unknown';
        const ctry = ath.country || 'Unknown';

        const addMedal = (level: string, type: string) => {
          if (!leaderboards[level][type]) {
            leaderboards[level][type] = { gold: 0, silver: 0, bronze: 0, points: 0 };
          }
          if (ath.medal === 'gold') {
            leaderboards[level][type].gold += 1;
            leaderboards[level][type].points += 3;
          } else if (ath.medal === 'silver') {
            leaderboards[level][type].silver += 1;
            leaderboards[level][type].points += 2;
          } else if (ath.medal === 'bronze') {
            leaderboards[level][type].bronze += 1;
            leaderboards[level][type].points += 1;
          }
        };

        addMedal('academy', acad);
        addMedal('state', st);
        addMedal('country', ctry);

        if (ath.medal === 'gold') g = ath;
        else if (ath.medal === 'silver') s = ath;
        else if (ath.medal === 'bronze' && !b1) b1 = ath;
        else if (ath.medal === 'bronze') b2 = ath;
      });
    }

    medalistsList.push({ categoryName: cat.name, gold: g, silver: s, bronze1: b1, bronze2: b2 });
  });

  const getSortedLeaderboard = (level: string) => {
    const arr = Object.entries(leaderboards[level]).map(([name, stats]) => ({ name, ...stats }));
    return arr.sort((a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
  };

  const currentLeaderboard = getSortedLeaderboard(leaderboardFilter);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .tab-pane { display: none; }
        .tab-pane.active { display: block; animation: fadeIn 0.3s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .bento-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
        .bento-tile { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-5); }
        .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-5); margin-bottom: var(--space-6); }
        .chart-card { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-5); }
        .chart-card h3 { font-size: 16px; margin-bottom: var(--space-4); color: var(--neutral-800); }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th { text-align: left; padding: 12px 24px; border-bottom: 2px solid var(--neutral-100); background: var(--neutral-50); }
        .data-table td { padding: 16px 24px; border-bottom: 1px solid var(--neutral-100); }
        .tiesheet-card { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 8px; padding: var(--space-4); display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; }
        .tiesheet-card:hover { border-color: var(--neutral-400); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .tiesheet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: var(--space-4); }
        .medal-icon { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; margin-right: 8px; }
        .medal-gold { background: #FFD700; color: #B8860B; }
        .medal-silver { background: #E0E0E0; color: #808080; }
        .medal-bronze { background: #CD7F32; color: #8B4513; }
      `}} />

      <div className="sub-nav">
        <a href="#" className={`sub-nav-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('overview'); }}>Overview</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'tiesheets' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('tiesheets'); }}>Tiesheets</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('leaderboard'); }}>Leaderboard</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'medalists' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('medalists'); }}>Medalists per Category</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'records' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('records'); }}>Records</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'staff' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('staff'); }}>Staff</a>
        <div style={{ flex: 1 }}></div>
      </div>

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">Archives / {compData?.name || id}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <h1>{compData?.name || id} {compData?.createdAt ? new Date(compData.createdAt).getFullYear() : ''}</h1>
              <span className="status-chip status-done" style={{ background: 'var(--neutral-200)', color: 'var(--neutral-600)' }}>Completed</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary" onClick={handleDownloadTiesheets} disabled={downloadingTiesheets || categories.length === 0}>
              <Download size={16} style={{ marginRight: '6px' }} /> {downloadingTiesheets ? 'Generating...' : 'Download Tiesheets PDF'}
            </button>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Loading...</div>
        ) : (
          <>
            <div className={`tab-pane ${activeTab === 'overview' ? 'active' : ''}`}>
              <h2 style={{ marginBottom: 'var(--space-4)' }}>Tournament Summary</h2>
              <div className="bento-grid">
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Active Mats</div>
                  <div className="display-large">{compData?.mats || 0}</div>
                  <div className="text-small">{compData?.venue || 'Venue'}</div>
                </div>
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Total Staff</div>
                  <div className="display-large">{staff.length}</div>
                  <div className="text-small">Operators & Volunteers</div>
                </div>
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Total Entries</div>
                  <div className="display-large">{compData?.athletesCount || athletes.length}</div>
                  <div className="text-small">Athletes registered</div>
                </div>
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Categories</div>
                  <div className="display-large">{categories.length}</div>
                  <div className="text-small">Across age & weight</div>
                </div>
              </div>

              <div className="charts-grid bento-reveal">
                <div className="chart-card">
                  <h3>Category Distribution</h3>
                  <div style={{ height: '300px', width: '100%', position: 'relative' }}>
                    <Pie data={athletesData} options={pieOptions} />
                  </div>
                </div>
              </div>
            </div>

            <div className={`tab-pane ${activeTab === 'tiesheets' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2>All Tiesheets</h2>
              </div>
              <div className="tiesheet-grid">
                {categories.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: 'var(--space-6)', textAlign: 'center', border: '1px solid var(--neutral-300)', borderRadius: '12px' }}>
                    No categories found.
                  </div>
                ) : categories.map((cat) => {
                  const finalMatch = cat.matches?.filter((m: any) => m.status === 'completed')?.sort((a: any, b: any) => b.round - a.round)[0];
                  const winner = finalMatch?.winnerId ? (finalMatch.aka?.playerId === finalMatch.winnerId ? finalMatch.aka : finalMatch.ao) : null;
                  
                  return (
                    <div className="tiesheet-card" key={cat.id}>
                      <div>
                        <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>{cat.name}</h3>
                        <div className="text-small" style={{ marginBottom: '4px' }}>
                          <span className="medal-icon medal-gold"></span> Winner: <strong>{winner && winner.name !== 'Empty Slot' ? `${winner.name} (${winner.country || '?'})` : 'TBD'}</strong>
                        </div>
                        {cat.updatedAt && (
                          <div className="text-micro" style={{ color: 'var(--neutral-500)' }}>
                            Finished: {new Date(cat.updatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <button onClick={() => openModal(cat.id)} className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`tab-pane ${activeTab === 'leaderboard' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2 style={{ marginBottom: 0 }}>Tournament Leaderboard</h2>
                <div style={{ position: 'relative' }}>
                  <select value={leaderboardFilter} onChange={e => setLeaderboardFilter(e.target.value)} style={{ height: '36px', borderRadius: '6px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', minWidth: '200px', background: 'white', cursor: 'pointer', outline: 'none' }}>
                    <option value="academy">View by Academy / Dojo</option>
                    <option value="state">View by State</option>
                    <option value="country">View by Country</option>
                  </select>
                </div>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-micro">Rank</th>
                      <th className="text-micro">{leaderboardFilter === 'academy' ? 'Academy / Dojo' : leaderboardFilter === 'state' ? 'State' : 'Country'}</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Gold</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Silver</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Bronze</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                          No medals have been awarded yet.
                        </td>
                      </tr>
                    ) : currentLeaderboard.map((entry, idx) => (
                      <tr key={entry.name}>
                        <td style={{ fontWeight: 700, color: idx === 0 ? 'var(--aka)' : 'inherit' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{entry.name}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{entry.gold}</td>
                        <td style={{ textAlign: 'center' }}>{entry.silver}</td>
                        <td style={{ textAlign: 'center' }}>{entry.bronze}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{entry.gold + entry.silver + entry.bronze}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className={`tab-pane ${activeTab === 'medalists' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2>Medalist List Per Category</h2>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-micro">Category</th>
                      <th className="text-micro"><span className="medal-icon medal-gold"></span> Gold</th>
                      <th className="text-micro"><span className="medal-icon medal-silver"></span> Silver</th>
                      <th className="text-micro"><span className="medal-icon medal-bronze"></span> Bronze (x2)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medalistsList.length === 0 ? (
                       <tr>
                         <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                           No categories found.
                         </td>
                       </tr>
                    ) : medalistsList.map((cat, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>{cat.categoryName}</td>
                        <td>
                          {cat.gold ? (
                            <><strong>{cat.gold.name}</strong><br/><span className="text-micro">{cat.gold.academy}</span></>
                          ) : <span className="text-micro" style={{color: 'var(--neutral-400)'}}>-</span>}
                        </td>
                        <td>
                          {cat.silver ? (
                            <><strong>{cat.silver.name}</strong><br/><span className="text-micro">{cat.silver.academy}</span></>
                          ) : <span className="text-micro" style={{color: 'var(--neutral-400)'}}>-</span>}
                        </td>
                        <td>
                          {cat.bronze1 && <div style={{ marginBottom: '4px' }}><strong>{cat.bronze1.name}</strong> <span className="text-micro">{cat.bronze1.academy}</span></div>}
                          {cat.bronze2 && <div><strong>{cat.bronze2.name}</strong> <span className="text-micro">{cat.bronze2.academy}</span></div>}
                          {(!cat.bronze1 && !cat.bronze2) && <span className="text-micro" style={{color: 'var(--neutral-400)'}}>-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className={`tab-pane ${activeTab === 'records' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2>Tournament Records</h2>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-micro">Athlete</th>
                      <th className="text-micro">Gender/Age/Weight</th>
                      <th className="text-micro">Academy</th>
                      <th className="text-micro">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athletes.length === 0 ? (
                       <tr>
                         <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                           No records found.
                         </td>
                       </tr>
                    ) : athletes.map((ath, idx) => (
                      <tr key={ath.id || idx}>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>
                          {ath.name}
                          <br />
                          <span className="text-micro" style={{ color: 'var(--neutral-500)' }}>ID: {ath.playerId || ath.id}</span>
                        </td>
                        <td>{ath.gender} | {ath.age}y | {ath.weight}kg</td>
                        <td>
                          {ath.academy}
                          <br />
                          <span className="text-micro">{ath.state}, {ath.country}</span>
                        </td>
                        <td>
                          {ath.coachName && <div><span className="text-micro">Coach:</span> {ath.coachName}</div>}
                          {ath.phone && <div><span className="text-micro">Phone:</span> {ath.phone}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div className={`tab-pane ${activeTab === 'staff' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2>Tournament Staff</h2>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-micro">Staff Member</th>
                      <th className="text-micro">Role</th>
                      <th className="text-micro">Scope / Assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.length === 0 ? (
                       <tr>
                         <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--neutral-500)' }}>
                           No staff found.
                         </td>
                       </tr>
                    ) : staff.map((member, idx) => (
                      <tr key={member.id || idx}>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>
                          {member.operator}
                          {member.operatorSubtitle && <><br/><span className="text-micro">{member.operatorSubtitle}</span></>}
                        </td>
                        <td>
                           <span className="status-chip" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)' }}>{member.role || member.type}</span>
                        </td>
                        <td>
                          <strong>{member.scope}</strong>
                          {member.scopeSubtitle && <span style={{ marginLeft: '8px', color: 'var(--neutral-500)' }}>({member.scopeSubtitle})</span>}
                          {member.coverage && <div className="text-micro" style={{ marginTop: '4px' }}>Coverage: {member.coverage}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

          </>
        )}
      </main>

      {/* Fullscreen Modal */}
      {modalOpen && (
        <FullscreenBracketModal
          categories={categories}
          initialCategoryId={activeCategoryId || undefined}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
