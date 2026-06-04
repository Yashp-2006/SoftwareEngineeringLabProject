'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, Filter, ChevronDown } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [activeTab, setActiveTab] = useState('overview');
  const [leaderboardView, setLeaderboardView] = useState('dojo');
  const [compName, setCompName] = useState('Archived Competition');
  const [compVenue, setCompVenue] = useState('');
  const [compDate, setCompDate] = useState('');
  const [downloadingTiesheets, setDownloadingTiesheets] = useState(false);

  useEffect(() => {
    ChartJS.defaults.font.family = "var(--font-body), sans-serif";
    ChartJS.defaults.color = "#737373";
  }, []);

  // Load competition name from Firestore
  useEffect(() => {
    const load = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'competitions', id));
        if (snap.exists()) {
          const mainData = snap.data();
          setCompName(mainData.name || 'Archived Competition');
          if (mainData.venue) setCompVenue(mainData.venue);
          if (mainData.startDate) {
            const startDate = new Date(mainData.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            const endDate = mainData.endDate ? new Date(mainData.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
            setCompDate(endDate && startDate !== endDate ? `${startDate} - ${endDate}` : startDate);
          }
        }
      } catch {}
    };
    load();
  }, [id]);

  const handleDownloadTiesheets = async () => {
    if (downloadingTiesheets) return;
    setDownloadingTiesheets(true);
    try {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'competitions', id, 'categories'));
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      if (cats.length === 0) {
        alert('No categories found for this competition.');
        return;
      }
      const { exportTiesheetsPDF } = await import('@lib/tiesheet-pdf-exporter');
      await exportTiesheetsPDF({
        competitionName: compName,
        categories: cats.map((c: any) => ({
          name: c.name,
          matches: c.matches ?? [],
          athletes: c.athletes ?? [],
          matNo: c.mat || '',
        })),
        isArchived: true,
        venue: compVenue,
        date: compDate,
      });
    } catch (e: any) {
      alert('Failed to generate tiesheets: ' + e.message);
    } finally {
      setDownloadingTiesheets(false);
    }
  };

  const athletesData = {
    labels: ['Senior Male -75kg', 'Senior Female -55kg', 'U21 Male Kata', 'Junior Female +59kg', 'Senior Team Kata', 'Super Gold Open', 'Cadet Male -60kg', 'U14 Female -47kg'],
    datasets: [{
      label: 'Athletes',
      data: [42, 38, 24, 30, 12, 16, 45, 28],
      backgroundColor: '#0f62fe',
      borderRadius: 4,
    }]
  };

  const academyData = {
    labels: ['JKA Tokyo', 'Madrid Elite', 'São Paulo Strikers', 'Cairo Champions', 'USA Dev Team'],
    datasets: [
      { label: 'Gold', data: [12, 6, 4, 3, 3], backgroundColor: '#FFD700' },
      { label: 'Silver', data: [8, 5, 6, 2, 1], backgroundColor: '#E0E0E0' },
      { label: 'Bronze', data: [4, 7, 9, 5, 8], backgroundColor: '#CD7F32' }
    ]
  };

  const countryData = {
    labels: ['JPN', 'ESP', 'BRA', 'EGY', 'USA', 'ITA', 'FRA'],
    datasets: [
      { label: 'Gold', data: [16, 8, 5, 4, 3, 6, 2], backgroundColor: '#FFD700' },
      { label: 'Silver', data: [12, 7, 7, 3, 2, 5, 4], backgroundColor: '#E0E0E0' },
      { label: 'Bronze', data: [8, 7, 9, 7, 10, 7, 5], backgroundColor: '#CD7F32' }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e0e0e0' } },
      x: { grid: { display: false } }
    }
  };

  const stackedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, grid: { color: '#e0e0e0' } }
    }
  };

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
        .lb-tbody { display: none; }
        .lb-tbody.active { display: table-row-group; animation: fadeIn 0.3s ease forwards; }
      `}} />

      <div className="sub-nav">
        <a href="#" className={`sub-nav-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('overview'); }}>Overview</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'tiesheets' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('tiesheets'); }}>Tiesheets</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('leaderboard'); }}>Leaderboard</a>
        <a href="#" className={`sub-nav-link ${activeTab === 'medalists' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('medalists'); }}>Medalists per Category</a>
        <div style={{ flex: 1 }}></div>
      </div>

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">Archives / Tokyo Masters</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <h1>Tokyo Masters 2026</h1>
              <span className="status-chip status-done" style={{ background: 'var(--neutral-200)', color: 'var(--neutral-600)' }}>Completed</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary" onClick={handleDownloadTiesheets} disabled={downloadingTiesheets}>
              <Download size={16} /> {downloadingTiesheets ? 'Generating...' : 'Download Tiesheets'}
            </button>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="tab-pane active">
            <h2 style={{ marginBottom: 'var(--space-4)' }}>Tournament Summary</h2>
            <div className="bento-grid">
              <div className="bento-tile bento-reveal">
                <div className="text-micro">Active Mats</div>
                <div className="display-large">6</div>
                <div className="text-small">Nippon Budokan</div>
              </div>
              <div className="bento-tile bento-reveal">
                <div className="text-micro">Total Hosts / Staff</div>
                <div className="display-large">18</div>
                <div className="text-small">Operators & Volunteers</div>
              </div>
              <div className="bento-tile bento-reveal">
                <div className="text-micro">Total Entries</div>
                <div className="display-large">512</div>
                <div className="text-small">Athletes registered</div>
              </div>
              <div className="bento-tile bento-reveal">
                <div className="text-micro">Categories</div>
                <div className="display-large">32</div>
                <div className="text-small">Across age & weight</div>
              </div>
              <div className="bento-tile bento-reveal">
                <div className="text-micro">Total Winners</div>
                <div className="display-large" style={{ color: 'var(--aka)' }}>32</div>
                <div className="text-small">Gold medalists</div>
              </div>
            </div>

            <div className="charts-grid bento-reveal">
              <div className="chart-card full-width">
                <h3>Athletes per Category</h3>
                <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                  <Bar data={athletesData} options={chartOptions} />
                </div>
              </div>
              <div className="chart-card full-width">
                <h3>Medals by Academy</h3>
                <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                  <Bar data={academyData} options={stackedOptions} />
                </div>
              </div>
              <div className="chart-card full-width">
                <h3>Medals by Country / Region</h3>
                <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                  <Bar data={countryData} options={stackedOptions} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tiesheets' && (
          <div className="tab-pane active">
            <div className="flex-between mb-4">
              <h2>All Tiesheets</h2>
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="Search category..." style={{ height: '36px', borderRadius: '6px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', width: '250px', outline: 'none' }} />
              </div>
            </div>
            <div className="tiesheet-grid">
              <div className="tiesheet-card">
                <div>
                  <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>Senior Male Kumite -75kg</h3>
                  <div className="text-small"><span className="medal-icon medal-gold"></span> Winner: <strong>Kenji Sato (JPN)</strong></div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
              </div>
              <div className="tiesheet-card">
                <div>
                  <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>Senior Female Kumite -55kg</h3>
                  <div className="text-small"><span className="medal-icon medal-gold"></span> Winner: <strong>Maria Garcia (ESP)</strong></div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
              </div>
              <div className="tiesheet-card">
                <div>
                  <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>U21 Male Kata</h3>
                  <div className="text-small"><span className="medal-icon medal-gold"></span> Winner: <strong>Lucas Rossi (ITA)</strong></div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
              </div>
              <div className="tiesheet-card">
                <div>
                  <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>Junior Female Kumite +59kg</h3>
                  <div className="text-small"><span className="medal-icon medal-gold"></span> Winner: <strong>Amina Ndiaye (EGY)</strong></div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
              </div>
              <div className="tiesheet-card">
                <div>
                  <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>Senior Team Kata Male</h3>
                  <div className="text-small"><span className="medal-icon medal-gold"></span> Winner: <strong>Team Japan (JPN)</strong></div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
              </div>
              <div className="tiesheet-card">
                <div>
                  <h3 style={{ marginBottom: '4px', fontSize: '16px' }}>Super Gold Open</h3>
                  <div className="text-small"><span className="medal-icon medal-gold"></span> Winner: <strong>Rafael Silva (BRA)</strong></div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '8px' }}><ExternalLink size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="tab-pane active">
            <div className="flex-between mb-4">
              <h2 style={{ marginBottom: 0 }}>Tournament Leaderboard</h2>
              <div style={{ position: 'relative' }}>
                <select 
                  value={leaderboardView}
                  onChange={(e) => setLeaderboardView(e.target.value)}
                  style={{ height: '36px', borderRadius: '6px', border: '1.5px solid var(--neutral-300)', padding: '0 12px', fontFamily: 'var(--font-body)', minWidth: '200px', background: 'white', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="dojo">View by Dojo / Club</option>
                  <option value="country">View by Country (International)</option>
                  <option value="state">View by State (National)</option>
                </select>
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-micro">Rank</th>
                    <th className="text-micro">
                      {leaderboardView === 'dojo' ? 'Dojo / Club' : leaderboardView === 'country' ? 'Country' : 'State'}
                    </th>
                    <th className="text-micro" style={{ textAlign: 'center' }}>Gold</th>
                    <th className="text-micro" style={{ textAlign: 'center' }}>Silver</th>
                    <th className="text-micro" style={{ textAlign: 'center' }}>Bronze</th>
                    <th className="text-micro" style={{ textAlign: 'center' }}>Total</th>
                  </tr>
                </thead>
                {leaderboardView === 'dojo' && (
                  <tbody className="lb-tbody active">
                    <tr><td style={{ fontWeight: 700, color: 'var(--aka)' }}>1</td><td style={{ fontWeight: 600 }}>JKA Tokyo Honbu</td><td style={{ textAlign: 'center', fontWeight: 600 }}>12</td><td style={{ textAlign: 'center' }}>8</td><td style={{ textAlign: 'center' }}>4</td><td style={{ textAlign: 'center', fontWeight: 700 }}>24</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>2</td><td style={{ fontWeight: 600 }}>Madrid Elite Karate</td><td style={{ textAlign: 'center', fontWeight: 600 }}>6</td><td style={{ textAlign: 'center' }}>5</td><td style={{ textAlign: 'center' }}>7</td><td style={{ textAlign: 'center', fontWeight: 700 }}>18</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>3</td><td style={{ fontWeight: 600 }}>São Paulo Strikers</td><td style={{ textAlign: 'center', fontWeight: 600 }}>4</td><td style={{ textAlign: 'center' }}>6</td><td style={{ textAlign: 'center' }}>9</td><td style={{ textAlign: 'center', fontWeight: 700 }}>19</td></tr>
                  </tbody>
                )}
                {leaderboardView === 'country' && (
                  <tbody className="lb-tbody active">
                    <tr><td style={{ fontWeight: 700, color: 'var(--aka)' }}>1</td><td style={{ fontWeight: 600 }}>Japan (JPN)</td><td style={{ textAlign: 'center', fontWeight: 600 }}>16</td><td style={{ textAlign: 'center' }}>12</td><td style={{ textAlign: 'center' }}>8</td><td style={{ textAlign: 'center', fontWeight: 700 }}>36</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>2</td><td style={{ fontWeight: 600 }}>Spain (ESP)</td><td style={{ textAlign: 'center', fontWeight: 600 }}>8</td><td style={{ textAlign: 'center' }}>7</td><td style={{ textAlign: 'center' }}>7</td><td style={{ textAlign: 'center', fontWeight: 700 }}>22</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>3</td><td style={{ fontWeight: 600 }}>Italy (ITA)</td><td style={{ textAlign: 'center', fontWeight: 600 }}>6</td><td style={{ textAlign: 'center' }}>5</td><td style={{ textAlign: 'center' }}>7</td><td style={{ textAlign: 'center', fontWeight: 700 }}>18</td></tr>
                  </tbody>
                )}
                {leaderboardView === 'state' && (
                  <tbody className="lb-tbody active">
                    <tr><td style={{ fontWeight: 700, color: 'var(--aka)' }}>1</td><td style={{ fontWeight: 600 }}>Tokyo Prefecture</td><td style={{ textAlign: 'center', fontWeight: 600 }}>12</td><td style={{ textAlign: 'center' }}>8</td><td style={{ textAlign: 'center' }}>4</td><td style={{ textAlign: 'center', fontWeight: 700 }}>24</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>2</td><td style={{ fontWeight: 600 }}>Community of Madrid</td><td style={{ textAlign: 'center', fontWeight: 600 }}>6</td><td style={{ textAlign: 'center' }}>5</td><td style={{ textAlign: 'center' }}>7</td><td style={{ textAlign: 'center', fontWeight: 700 }}>18</td></tr>
                    <tr><td style={{ fontWeight: 700 }}>3</td><td style={{ fontWeight: 600 }}>São Paulo State</td><td style={{ textAlign: 'center', fontWeight: 600 }}>4</td><td style={{ textAlign: 'center' }}>6</td><td style={{ textAlign: 'center' }}>9</td><td style={{ textAlign: 'center', fontWeight: 700 }}>19</td></tr>
                  </tbody>
                )}
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'medalists' && (
          <div className="tab-pane active">
            <div className="flex-between mb-4">
              <h2>Medalist List Per Category</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                <Filter size={16} /> Filter
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
        )}

      </main>
    </>
  );
}
