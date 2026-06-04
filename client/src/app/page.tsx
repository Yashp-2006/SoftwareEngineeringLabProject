'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({ active: 0, upcoming: 0, athletes: 1482, total: 0 });
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar');
  const [timeFilter, setTimeFilter] = useState('6M');
  const [liveCompetitions, setLiveCompetitions] = useState<any[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions'));
        
        let active = 0, upcoming = 0, total = 0;
        snap.forEach(doc => {
          const s = doc.data().status;
          if (s === 'live') active++;
          else if (s === 'upcoming') upcoming++;
          total++;
        });
        
        setStats({ active, upcoming, athletes: 1482, total });
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    const loadLive = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, query, where, onSnapshot } = await import('firebase/firestore');
        const q = query(collection(db, 'competitions'), where('status', 'in', ['live', 'upcoming']));
        return onSnapshot(q, (snap) => {
          setLiveCompetitions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      } catch (err) {
        console.error(err);
        return () => {};
      }
    };
    let unsub: any;
    loadLive().then(u => { unsub = u; });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }

    const gsap = (window as any).gsap;
    let ctx: any;
    
    if (gsap) {
      ctx = gsap.context(() => {
        gsap.from('.stagger-in', {
          y: 20,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out'
        });
      });
    }

    setLoading(false);

    return () => {
      if (ctx) ctx.revert(); // Fixes React Strict Mode double-firing bug
    };
  }, []);

  useEffect(() => {
    const gsap = (window as any).gsap;
    let ctx: any;
    if (gsap) {
      ctx = gsap.context(() => {
        if (chartType === 'bar') {
          gsap.fromTo('.bar-inner', 
            { scaleY: 0 },
            { scaleY: 1, duration: 0.8, stagger: 0.05, ease: 'power3.out', transformOrigin: 'bottom' }
          );
        } else {
          gsap.fromTo('.graph-element',
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'back.out(1.5)' }
          );
        }
      });
    }
    return () => { if (ctx) ctx.revert(); };
  }, [chartType, timeFilter]);

  const generateDynamicData = () => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const currentMonthIndex = new Date().getMonth(); 
    const baseVals = [320, 480, 640, 850, 560, 720, 800, 600, 500, 900, 750, 1050];
    
    return Array.from({ length: 12 }).map((_, i) => {
      // Calculate month index ending with current month
      const mIndex = (currentMonthIndex - 11 + i + 12) % 12;
      const val = baseVals[i];
      return {
        label: months[mIndex],
        val: val,
        peak: val >= 850
      };
    });
  };
  const fullChartData = generateDynamicData();
  const chartData = timeFilter === '12M' ? fullChartData : fullChartData.slice(-6);
  const maxVal = Math.max(...chartData.map(d => d.val));
  const totalVal = chartData.reduce((sum, d) => sum + d.val, 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-bento {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: var(--space-5);
          margin-bottom: var(--space-7);
        }
        .bento-card {
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 16px;
          padding: var(--space-5);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .bento-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
          border-color: var(--neutral-300);
        }
        .col-span-3 { grid-column: span 3; }
        .col-span-6 { grid-column: span 6; }
        @media (max-width: 1024px) {
          .col-span-3 { grid-column: span 6; }
          .col-span-6 { grid-column: span 12; }
        }
        @media (max-width: 600px) {
          .col-span-3, .col-span-6 { grid-column: span 12; }
        }
        .stat-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--neutral-500);
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: var(--space-3);
        }
        .stat-value {
          font-family: var(--font-display);
          font-size: 56px;
          line-height: 1;
          color: var(--neutral-900);
          margin-bottom: var(--space-2);
        }
        .stat-footer {
          font-size: 13px;
          color: var(--neutral-500);
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }
        .table-container {
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          overflow: hidden;
        }
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th {
          background: var(--neutral-50); color: var(--neutral-500); font-size: 12px;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
          padding: var(--space-4) var(--space-5); text-align: left; border-bottom: 1px solid var(--neutral-200);
        }
        .modern-table td {
          padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--neutral-100); transition: background 0.2s;
        }
        .modern-table tr:hover td { background: var(--neutral-50); }
        .modern-table tr:last-child td { border-bottom: none; }
        .event-title { font-weight: 700; color: var(--neutral-900); margin-bottom: 2px; transition: color 0.2s; }
        .modern-table tr:hover .event-title { color: var(--aka); }
        .chart-controls { display: flex; gap: var(--space-2); }
        .select-minimal {
          appearance: none; background: var(--neutral-50); border: 1px solid var(--neutral-200);
          border-radius: 8px; padding: 6px 14px 6px 12px; font-size: 12px; font-weight: 500;
          color: var(--neutral-700); cursor: pointer; outline: none; transition: all 0.2s;
        }
        .select-minimal:hover, .select-minimal:focus { background: var(--shiro); border-color: var(--ao); }
        
        .bar-group { flex: 1; height: 100%; position: relative; display: flex; align-items: flex-end; margin: 0 4px; }
        .bar-inner { width: 100%; border-radius: 6px 6px 0 0; position: relative; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .bar-inner:hover { transform: scaleY(1.05); transform-origin: bottom; }
        .bar-inner:hover .bar-label { opacity: 1; }
        .bar-label { position: absolute; top: -24px; left: 50%; transform: translateX(-50%); text-align: center; font-size: 11px; font-weight: 700; color: var(--neutral-600); opacity: 0; transition: opacity 0.2s; }
      `}} />

      <main className="container">
        <header className="page-header stagger-in">
          <div>
            <div className="breadcrumb">Admin / Dashboard</div>
            <h1>Operations Hub</h1>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary">
              <i data-lucide="download" style={{ width: '18px' }}></i> Export Report
            </button>
            <Link href="/setup/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <i data-lucide="plus" style={{ width: '18px' }}></i> New Competition
            </Link>
          </div>
        </header>

        <section className="dashboard-bento stagger-in">
          <div className="bento-card col-span-3">
            <div>
              <div className="stat-header">
                <i data-lucide="activity" style={{ width: '16px', color: 'var(--aka)' }}></i>
                Active Now
              </div>
              <div className="stat-value" style={{ color: 'var(--aka)' }}>{stats.active}</div>
            </div>
            <div className="stat-footer">
              <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--aka)', borderRadius: '50%' }}></span>
              Running on 8 mats
            </div>
          </div>

          <div className="bento-card col-span-3">
            <div>
              <div className="stat-header">
                <i data-lucide="calendar" style={{ width: '16px', color: 'var(--status-upcoming)' }}></i>
                Upcoming
              </div>
              <div className="stat-value">{stats.upcoming}</div>
            </div>
            <div className="stat-footer">
              Next: Kyoto 2026 Finals
            </div>
          </div>

          <div className="bento-card col-span-3">
            <div>
              <div className="stat-header">
                <i data-lucide="users" style={{ width: '16px', color: 'var(--neutral-500)' }}></i>
                Total Athletes
              </div>
              <div className="stat-value">{stats.athletes.toLocaleString()}</div>
            </div>
            <div className="stat-footer">
              <i data-lucide="map-pin" style={{ width: '14px' }}></i>
              Across 42 clubs globally
            </div>
          </div>

          <div className="bento-card col-span-3">
            <div>
              <div className="stat-header">
                <i data-lucide="trophy" style={{ width: '16px', color: 'var(--neutral-500)' }}></i>
                All Time Events
              </div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-footer">
              <span style={{ color: 'var(--status-live)', fontWeight: 700 }}>+2</span> this month
            </div>
          </div>

          {/* Participation Trends (Wide) */}
          <div className="bento-card col-span-12" style={{ minHeight: '360px' }}>
            <div className="flex-between mb-4">
              <div className="stat-header" style={{ margin: 0 }}>
                <i data-lucide="trending-up" style={{ width: '16px', color: 'var(--ao)' }}></i>
                Participation Trends
              </div>
              <div className="chart-controls">
                <select className="select-minimal" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                  <option value="bar">Bar Graph</option>
                  <option value="line">Line Graph</option>
                </select>
                <select className="select-minimal" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                  <option value="6M">Last 6 Months</option>
                  <option value="12M">This Year</option>
                </select>
              </div>
            </div>
            
            <div style={{ flex: 1, position: 'relative', minHeight: '220px', display: 'flex', alignItems: chartType === 'bar' ? 'flex-end' : 'stretch', justifyContent: chartType === 'bar' ? 'space-between' : 'stretch' }}>
              {chartType === 'bar' && chartData.map((d, i) => {
                const heightPct = (d.val / maxVal) * 100;
                const barColor = d.peak ? 'var(--aka)' : 'var(--neutral-300)';
                return (
                  <div key={i} className="bar-group">
                    <div 
                      className="bar-inner" 
                      style={{ height: `${heightPct}%`, background: barColor }}
                      title={`${d.label}: ${d.val} Athletes`}
                    >
                      <div className="bar-label">{d.val}</div>
                    </div>
                  </div>
                );
              })}
              
              {chartType === 'line' && (
                <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'absolute', bottom: 0 }}>
                  {chartData.slice(1).map((d, i) => {
                    const prev = chartData[i];
                    const x1 = (i / (chartData.length - 1)) * 100;
                    const y1 = 100 - (prev.val / maxVal) * 100;
                    const x2 = ((i + 1) / (chartData.length - 1)) * 100;
                    const y2 = 100 - (d.val / maxVal) * 100;
                    return (
                      <line 
                        key={`line-${i}`}
                        className="graph-element"
                        x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
                        stroke="var(--neutral-300)" strokeWidth="3" strokeLinecap="round" 
                      />
                    );
                  })}
                  {chartData.map((d, i) => {
                    const x = (i / (chartData.length - 1)) * 100;
                    const y = 100 - (d.val / maxVal) * 100;
                    return (
                      <g key={`point-${i}`} className="graph-element">
                        <circle cx={`${x}%`} cy={`${y}%`} r="5" fill={d.peak ? 'var(--aka)' : 'var(--ao)'} stroke="var(--shiro)" strokeWidth="2" />
                        <text x={`${x}%`} y={`calc(${y}% - 14px)`} textAnchor="middle" fontSize="11px" fontWeight="700" fill="var(--neutral-600)">{d.val}</text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="flex-between" style={{ fontSize: '10px', fontWeight: 600, color: 'var(--neutral-400)', paddingTop: 'var(--space-3)', marginTop: 'auto' }}>
              {chartData.map(d => <span key={d.label} style={{ flex: 1, textAlign: 'center' }}>{d.label}</span>)}
            </div>
          </div>
        </section>

        <section className="stagger-in">
          <div className="flex-between mb-4">
            <h2>Live Competition Stream</h2>
            <Link href="/competitions" className="btn btn-ghost" style={{ fontSize: '13px', fontWeight: 600, padding: '6px 12px', color: 'var(--ao)', textDecoration: 'none' }}>
              View Directory <i data-lucide="arrow-right" style={{ width: '14px' }}></i>
            </Link>
          </div>
          
          <div className="table-container">
            <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Competition</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Active Mat</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {liveCompetitions.map(comp => (
                  <tr key={comp.id}>
                    <td>
                      <Link href={`/competitions/${comp.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                        <div className="event-title">{comp.name || 'Unnamed Competition'}</div>
                        <div className="text-small">{comp.type || 'Tournament'}</div>
                      </Link>
                    </td>
                    <td>
                      {comp.status === 'live' ? (
                        <span style={{ fontWeight: 500 }}>Live Categories Active</span>
                      ) : (
                        <span style={{ fontWeight: 500, color: 'var(--neutral-500)' }}>Awaiting Categories...</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-chip status-${comp.status}`}>{comp.status === 'live' ? 'Live' : 'Upcoming'}</span>
                    </td>
                    <td>
                      {comp.status === 'live' ? (
                        <div className="mat-pill active" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, alignItems: 'center', gap: '6px', background: 'var(--aka-light)', color: 'var(--aka)', border: '1px solid var(--aka)' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--aka)', borderRadius: '50%' }}></span>
                          Active Mats
                        </div>
                      ) : (
                        <div className="mat-pill" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, alignItems: 'center', gap: '6px', background: 'var(--neutral-100)', color: 'var(--neutral-500)', border: '1px solid var(--neutral-300)' }}>
                          Standby
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {comp.status === 'live' ? (
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <Link href={`/competitions/${comp.id}/mats`} className="btn btn-ghost" style={{ padding: '8px', borderRadius: '8px', background: 'var(--neutral-50)' }}><i data-lucide="layout-grid" style={{ width: '18px' }}></i></Link>
                          <Link href={`/competitions/${comp.id}`} className="btn btn-primary" style={{ padding: '8px', borderRadius: '8px' }}><i data-lucide="monitor" style={{ width: '18px' }}></i></Link>
                        </div>
                      ) : (
                        <Link href={`/competitions/${comp.id}`} className="btn btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', textDecoration: 'none' }}>
                          <i data-lucide="settings" style={{ width: '16px' }}></i> Setup
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {liveCompetitions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--neutral-500)' }}>
                      No active or upcoming competitions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
