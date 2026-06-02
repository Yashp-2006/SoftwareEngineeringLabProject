'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Medal, Download, ExternalLink, Filter } from 'lucide-react';
import FullscreenBracketModal from '@/components/FullscreenBracketModal';

export default function ArchiveDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [compData, setCompData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [leaderboardFilter, setLeaderboardFilter] = useState('dojo');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

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
          const data = catDoc.data();
          cats.push({
            id: catDoc.id,
            ...data,
            matches: data.matches || []
          });
        }
        setCategories(cats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .tab-pane { display: none; }
        .tab-pane.active { display: block; }
        .bento-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
        .bento-tile { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-5); }
        .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-5); margin-bottom: var(--space-6); }
        .chart-card { background: var(--shiro); border: 1px solid var(--neutral-300); border-radius: 12px; padding: var(--space-5); }
        .chart-card h3 { font-size: 16px; margin-bottom: var(--space-4); color: var(--neutral-800); }
        .chart-card.full-width { grid-column: 1 / -1; }
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
        <button className={`sub-nav-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px'}}>Overview</button>
        <button className={`sub-nav-link ${activeTab === 'tiesheets' ? 'active' : ''}`} onClick={() => setActiveTab('tiesheets')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px'}}>Tiesheets</button>
        <button className={`sub-nav-link ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px'}}>Leaderboard</button>
        <button className={`sub-nav-link ${activeTab === 'medalists' ? 'active' : ''}`} onClick={() => setActiveTab('medalists')} style={{background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px'}}>Medalists per Category</button>
      </div>

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">Archives / {compData?.name || id}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <h1>{compData?.name || id} {new Date(compData?.createdAt || Date.now()).getFullYear()}</h1>
              <span className="status-chip status-done" style={{ background: 'var(--neutral-200)', color: 'var(--neutral-600)' }}>Completed</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary">
              <Download size={16} style={{ marginRight: '6px' }} /> Export Report
            </button>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>Loading...</div>
        ) : (
          <>
            <div id="overview" className={`tab-pane ${activeTab === 'overview' ? 'active' : ''}`}>
              <h2 style={{ marginBottom: 'var(--space-4)' }}>Tournament Summary</h2>
              <div className="bento-grid">
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Active Mats</div>
                  <div className="display-large">{compData?.mats || 6}</div>
                  <div className="text-small">{compData?.venue || 'Nippon Budokan'}</div>
                </div>
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Total Hosts / Staff</div>
                  <div className="display-large">18</div>
                  <div className="text-small">Operators & Volunteers</div>
                </div>
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Total Entries</div>
                  <div className="display-large">{compData?.athletesCount || 512}</div>
                  <div className="text-small">Athletes registered</div>
                </div>
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Categories</div>
                  <div className="display-large">{compData?.categoriesCount || categories.length || 32}</div>
                  <div className="text-small">Across age & weight</div>
                </div>
                <div className="bento-tile bento-reveal">
                  <div className="text-micro">Total Winners</div>
                  <div className="display-large" style={{ color: 'var(--aka)' }}>{categories.length || 32}</div>
                  <div className="text-small">Gold medalists</div>
                </div>
              </div>

              <div className="charts-grid bento-reveal">
                <div className="chart-card full-width">
                  <h3>Athletes per Category</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '8px', paddingBottom: '20px', borderBottom: '1px solid var(--neutral-300)' }}>
                    {/* Placeholder bars */}
                    {[42, 38, 24, 30, 12, 16, 45, 28].map((val, i) => (
                      <div key={i} style={{ flex: 1, backgroundColor: 'var(--ao)', height: `${(val/45)*100}%`, borderRadius: '4px 4px 0 0', position: 'relative' }}>
                        <span style={{ position: 'absolute', bottom: '-24px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px' }}>Cat {i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div id="tiesheets" className={`tab-pane ${activeTab === 'tiesheets' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2>All Tiesheets</h2>
                <div style={{ position: 'relative' }}>
                  <input type="text" placeholder="Search category..." style={{ height: '36px', borderRadius: '6px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', width: '250px' }} />
                </div>
              </div>
              <div className="tiesheet-grid">
                {categories.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: 'var(--space-6)', textAlign: 'center', border: '1px solid var(--neutral-300)', borderRadius: '12px' }}>
                    No categories found.
                  </div>
                ) : categories.map((cat) => {
                  const finalMatch = cat.matches?.sort((a: any, b: any) => b.round - a.round)[0];
                  const winner = finalMatch?.winnerId ? (finalMatch.aka?.playerId === finalMatch.winnerId ? finalMatch.aka : finalMatch.ao) : null;
                  return (
                    <div className="tiesheet-card" key={cat.id}>
                      <div>
                        <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>{cat.name}</h3>
                        <div className="text-small"><span className="medal-icon medal-gold"></span> Winner: <strong>{winner ? `${winner.name} (${winner.country || '?'})` : 'TBD'}</strong></div>
                      </div>
                      <button onClick={() => openModal(cat.id)} className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div id="leaderboard" className={`tab-pane ${activeTab === 'leaderboard' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2 style={{ marginBottom: 0 }}>Tournament Leaderboard</h2>
                <div style={{ position: 'relative' }}>
                  <select value={leaderboardFilter} onChange={e => setLeaderboardFilter(e.target.value)} style={{ height: '36px', borderRadius: '6px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', minWidth: '200px', background: 'white', cursor: 'pointer', outline: 'none' }}>
                    <option value="dojo">View by Dojo / Club</option>
                    <option value="country">View by Country (International)</option>
                  </select>
                </div>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-micro">Rank</th>
                      <th className="text-micro">{leaderboardFilter === 'dojo' ? 'Dojo / Club' : 'Country'}</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Gold</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Silver</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Bronze</th>
                      <th className="text-micro" style={{ textAlign: 'center' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Placeholder data matching prototype */}
                    <tr>
                      <td style={{ fontWeight: 700, color: 'var(--aka)' }}>1</td>
                      <td style={{ fontWeight: 600 }}>{leaderboardFilter === 'dojo' ? 'JKA Tokyo Honbu' : 'Japan (JPN)'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>12</td>
                      <td style={{ textAlign: 'center' }}>8</td>
                      <td style={{ textAlign: 'center' }}>4</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>24</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>2</td>
                      <td style={{ fontWeight: 600 }}>{leaderboardFilter === 'dojo' ? 'Madrid Elite Karate' : 'Spain (ESP)'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>6</td>
                      <td style={{ textAlign: 'center' }}>5</td>
                      <td style={{ textAlign: 'center' }}>7</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>18</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>3</td>
                      <td style={{ fontWeight: 600 }}>{leaderboardFilter === 'dojo' ? 'São Paulo Strikers' : 'Italy (ITA)'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>4</td>
                      <td style={{ textAlign: 'center' }}>6</td>
                      <td style={{ textAlign: 'center' }}>9</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>19</td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            <div id="medalists" className={`tab-pane ${activeTab === 'medalists' ? 'active' : ''}`}>
              <div className="flex-between mb-4">
                <h2>Medalist List Per Category</h2>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                  <Filter size={16} style={{ marginRight: '6px' }} /> Filter
                </button>
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
                    {/* Placeholder matches prototype */}
                    <tr>
                      <td style={{ fontWeight: 600, fontSize: '14px' }}>Senior Male Kumite -75kg</td>
                      <td><strong>Kenji Sato</strong><br/><span className="text-micro">JKA Tokyo Honbu</span></td>
                      <td><strong>David Smith</strong><br/><span className="text-micro">USA National Dev Team</span></td>
                      <td>
                        <div style={{ marginBottom: '4px' }}><strong>Luiz Costa</strong> <span className="text-micro">São Paulo</span></div>
                        <div><strong>Omar Ali</strong> <span className="text-micro">Cairo Champions</span></div>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, fontSize: '14px' }}>Senior Female Kumite -55kg</td>
                      <td><strong>Maria Garcia</strong><br/><span className="text-micro">Madrid Elite Karate</span></td>
                      <td><strong>Yui Tanaka</strong><br/><span className="text-micro">JKA Tokyo Honbu</span></td>
                      <td>
                        <div style={{ marginBottom: '4px' }}><strong>Sarah Jones</strong> <span className="text-micro">USA National Dev</span></div>
                        <div><strong>Elena Rossi</strong> <span className="text-micro">Milan Dojo</span></div>
                      </td>
                    </tr>
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
