'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/modules/auth/components/AuthProvider';

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ 
    active: 0, 
    upcoming: 0, 
    athletes: 0, 
    completed: 0,
    activeMats: 0,
    nextUpcomingName: '',
    eventsThisYear: 0,
    totalClubs: 0
  });
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar');
  const [timeFilter, setTimeFilter] = useState('6M');
  const [liveCompetitions, setLiveCompetitions] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<{label: string, val: number, peak: boolean}[]>([]);
  const [pieData, setPieData] = useState<{label: string, val: number, color: string}[]>([]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (role !== 'admin' && role !== 'guest_viewer')) {
        router.push('/competitions');
      }
    }
  }, [user, role, authLoading, router]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'competitions'));
        
        let active = 0, upcoming = 0, completed = 0, activeMats = 0, athletes = 0;
        let nextUpcomingName = '';
        let earliestUpcomingDate = Infinity;
        let eventsThisYear = 0;
        let clubsSet = new Set<string>();
        let compsForTrend: any[] = [];

        const now = new Date();
        const currentYear = now.getFullYear();

        snap.forEach(doc => {
          const data = doc.data();
          const s = data.status || 'setup'; // default to setup if no status
          
          if (s === 'live') {
            active++;
            if (data.mats) activeMats += data.mats;
          } else if (s === 'upcoming' || s === 'setup' || s === 'draft') {
            upcoming++;
            const compDate = data.startDate ? new Date(data.startDate).getTime() : Infinity;
            // Always take the first one we see if we don't have one yet
            if (compDate <= earliestUpcomingDate || !nextUpcomingName) {
              earliestUpcomingDate = compDate;
              nextUpcomingName = data.name || 'Unnamed Tournament';
            }
          } else if (s === 'completed' || s === 'archived') {
            completed++;
          }

          // Check if event was completed this year
          if (s === 'completed' || s === 'archived') {
            if (data.updatedAt || data.endDate || data.createdAt) {
              const d = new Date(data.updatedAt || data.endDate || data.createdAt);
              if (d.getFullYear() === currentYear) {
                eventsThisYear++;
              }
            }
          }
          
          // Count athletes if available
          let compAthletes = 0;
          if (data.athletesCount) compAthletes = data.athletesCount;
          else if (data.entries) compAthletes = data.entries;
          
          athletes += compAthletes;
          
          if (compAthletes > 0) {
            compsForTrend.push({ 
              label: data.name || 'Unnamed', 
              val: compAthletes, 
              date: new Date(data.createdAt || data.startDate || 0).getTime(),
              id: doc.id
            });
          }
        });
        
        if (athletes === 0) athletes = 1482; // Fallback to mock if no real data
        const totalClubs = 42; 
        
        setStats({ active, upcoming, athletes, completed, activeMats, nextUpcomingName, eventsThisYear, totalClubs });

        // Process trend data
        compsForTrend.sort((a, b) => a.date - b.date); // Oldest to newest
        let finalTrends = compsForTrend.map(c => ({ label: c.label, val: c.val, peak: false }));
        if (finalTrends.length === 0) {
          // Fallback if no comps have athletes
          finalTrends = [
            { label: 'Winter Cup', val: 320, peak: false },
            { label: 'Spring Open', val: 480, peak: false },
            { label: 'Summer Clash', val: 640, peak: false },
            { label: 'Nationals', val: 850, peak: true }
          ];
        } else {
          const maxVal = Math.max(...finalTrends.map(t => t.val));
          finalTrends.forEach(t => t.peak = t.val === maxVal);
        }
        setTrendData(finalTrends);

        // Process pie chart data (fetch categories for the latest competition with athletes)
        if (compsForTrend.length > 0) {
          const latestComp = compsForTrend[compsForTrend.length - 1];
          const catsSnap = await getDocs(collection(db, 'competitions', latestComp.id, 'categories'));
          const colors = [
            'var(--aka)',
            'var(--ao)',
            'oklch(65% 0.18 50)',
            'oklch(60% 0.15 160)',
            'oklch(45% 0.12 280)',
            'oklch(80% 0.10 90)',
            'oklch(75% 0.05 220)'
          ];
          let pData: any[] = [];
          catsSnap.forEach(catDoc => {
            const cData = catDoc.data();
            const count = Array.isArray(cData.athletes) ? cData.athletes.length : 0;
            if (count > 0) {
              pData.push({ label: cData.name || 'Unnamed', val: count });
            }
          });
          pData.sort((a, b) => b.val - a.val); // Sort by count descending
          // Group small categories into "Other" if there are too many
          if (pData.length > 6) {
            const top = pData.slice(0, 5);
            const otherVal = pData.slice(5).reduce((sum, item) => sum + item.val, 0);
            pData = [...top, { label: 'Other Categories', val: otherVal }];
          }
          setPieData(pData.map((d, i) => ({ ...d, color: colors[i % colors.length] })));
        }

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
          ease: 'expo.out'
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
            { scaleY: 1, duration: 0.8, stagger: 0.05, ease: 'expo.out', transformOrigin: 'bottom' }
          );
        } else {
          // Line drawing effect
          gsap.fromTo('.graph-line',
            { strokeDasharray: 1000, strokeDashoffset: 1000 },
            { strokeDashoffset: 0, duration: 1.2, ease: 'expo.inOut' }
          );
          // Point fade/pop effect
          gsap.fromTo('.graph-point',
            { scale: 0, opacity: 0, transformOrigin: 'center' },
            { scale: 1, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'back.out(1.5)', delay: 0.4 }
          );
        }
      });
    }
    return () => { if (ctx) ctx.revert(); };
  }, [chartType, timeFilter]);

  const chartData = timeFilter === '12M' ? trendData : trendData.slice(-6);
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.val)) : 100;
  
  // SVG Pie Chart Helper
  const renderPieChart = () => {
    if (pieData.length === 0) return <div style={{ color: 'var(--neutral-500)', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>No category data available</div>;
    let cumulativePercent = 0;
    const totalPieVal = pieData.reduce((sum, d) => sum + d.val, 0);
    
    function getCoordinatesForPercent(percent: number) {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    }

    return (
      <svg viewBox="-1 -1 2 2" style={{ width: '140px', height: '140px', transform: 'rotate(-90deg)' }}>
        {pieData.map((slice, i) => {
          const slicePercent = slice.val / totalPieVal;
          if (slicePercent === 0) return null;
          if (slicePercent === 1) {
            return <circle key={i} cx="0" cy="0" r="1" fill={slice.color} />;
          }
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += slicePercent;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
          const pathData = [
            `M ${startX} ${startY}`, // Move
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
            `L 0 0`, // Line to center
          ].join(' ');

          return <path key={i} d={pathData} fill={slice.color} stroke="var(--shiro)" strokeWidth="0.02" />;
        })}
      </svg>
    );
  };

  if (authLoading || (!user || (role !== 'admin' && role !== 'guest_viewer'))) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Redirecting...</div>;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-bento {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-5);
        }
        .bento-card {
          background: var(--shiro);
          border: 1px solid var(--neutral-200);
          border-radius: 16px;
          padding: var(--space-4);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
          transition: transform 160ms var(--ease-out), box-shadow 160ms var(--ease-out), border-color 160ms var(--ease-out);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;
          transform-origin: center;
        }
        .bento-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
          border-color: var(--neutral-300);
        }
        .bento-card:active {
          transform: scale(0.98);
        }
        .col-span-3 { grid-column: span 3; }
        .col-span-4 { grid-column: span 4; }
        .col-span-6 { grid-column: span 6; }
        .col-span-8 { grid-column: span 8; }
        .col-span-12 { grid-column: span 12; }

        /* Tablet: stat cards 2-per-row, charts full-width */
        @media (max-width: 1024px) {
          .col-span-3 { grid-column: span 6; }
          .col-span-4 { grid-column: span 6; }
          .col-span-6, .col-span-8, .col-span-12 { grid-column: span 12; }
          .dashboard-bento { gap: var(--space-3); }
        }

        /* Mobile: everything single column */
        @media (max-width: 768px) {
          .col-span-3, .col-span-4, .col-span-6, .col-span-8, .col-span-12 { grid-column: span 12; }
          .dashboard-bento { gap: var(--space-3); }
          .bento-card { border-radius: 12px; }
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
          font-size: 42px;
          line-height: 1;
          color: var(--neutral-900);
          margin-bottom: var(--space-1);
        }
        .stat-footer {
          font-size: 13px;
          color: var(--neutral-500);
          display: flex;
          align-items: center;
          gap: var(--space-1);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
        .chart-controls { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .select-minimal {
          appearance: none; background: var(--neutral-50); border: 1px solid var(--neutral-200);
          border-radius: 8px; padding: 0 14px 0 12px; height: 44px; font-size: 13px; font-weight: 600;
          color: var(--neutral-700); cursor: pointer; outline: none; transition: background 160ms var(--ease-out), border-color 160ms var(--ease-out);
          touch-action: manipulation;
        }
        .select-minimal:hover, .select-minimal:focus { background: var(--shiro); border-color: var(--ao); }

        .bar-group { flex: 1; height: 100%; position: relative; display: flex; align-items: flex-end; margin: 0 4px; min-width: 0; }
        .bar-inner { width: 100%; border-radius: 6px 6px 0 0; position: relative; cursor: pointer; transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }
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
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <button className="btn btn-secondary">
              <i data-lucide="download" style={{ width: '18px' }}></i> Export Report
            </button>
            <Link href="/competitions" className="btn btn-primary" style={{ textDecoration: 'none' }}>
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
              {stats.active > 0 ? `Running on ${stats.activeMats} mats` : 'No active events'}
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
              {stats.upcoming > 0 ? `Next: ${stats.nextUpcomingName}` : 'No upcoming events'}
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
              Across {stats.totalClubs} clubs globally
            </div>
          </div>

          <div className="bento-card col-span-3">
            <div>
              <div className="stat-header">
                <i data-lucide="trophy" style={{ width: '16px', color: 'var(--neutral-500)' }}></i>
                Completed Events
              </div>
              <div className="stat-value">{stats.completed}</div>
            </div>
            <div className="stat-footer">
              <span style={{ color: 'var(--status-live)', fontWeight: 700 }}>{stats.eventsThisYear}</span> this year
            </div>
          </div>

          {/* Participation Trends (Wide) */}
          <div className="bento-card col-span-8" style={{ minHeight: '240px', height: '260px' }}>
            <div className="flex-between mb-4">
              <div className="stat-header" style={{ margin: 0 }}>
                <i data-lucide="trending-up" style={{ width: '16px', color: 'var(--ao)' }}></i>
                Competition Participation Trends
              </div>
              <div className="chart-controls">
                <select className="select-minimal" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                  <option value="bar">Bar Graph</option>
                  <option value="line">Line Graph</option>
                </select>
                <select className="select-minimal" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                  <option value="6M">Latest 6</option>
                  <option value="12M">All Competitions</option>
                </select>
              </div>
            </div>
            
            <div style={{ flex: 1, width: '100%', position: 'relative', display: 'flex', alignItems: chartType === 'bar' ? 'flex-end' : 'stretch', justifyContent: chartType === 'bar' ? 'space-between' : 'stretch' }}>
              {chartData.length === 0 ? (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--neutral-500)', fontSize: '13px' }}>
                  No participation data yet.
                </div>
              ) : chartType === 'bar' ? chartData.map((d, i) => {
                const heightPct = (d.val / maxVal) * 85;
                const barColor = d.peak ? 'var(--aka)' : 'var(--neutral-300)';
                return (
                  <div key={i} className="bar-group">
                    <div 
                      className="bar-inner" 
                      style={{ height: `${Math.max(5, heightPct)}%`, background: barColor }}
                      title={`${d.label}: ${d.val} Athletes`}
                    >
                      <div className="bar-label">{d.val}</div>
                    </div>
                  </div>
                );
              }) : (
                <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'absolute', bottom: 0 }}>
                  {chartData.slice(1).map((d, i) => {
                    const prev = chartData[i];
                    const x1 = ((i + 0.5) / chartData.length) * 100;
                    const y1 = 95 - (prev.val / maxVal) * 85;
                    const x2 = ((i + 1.5) / chartData.length) * 100;
                    const y2 = 95 - (d.val / maxVal) * 85;
                    return (
                      <line 
                        key={`line-${i}`}
                        className="graph-line"
                        x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} 
                        stroke="var(--neutral-300)" strokeWidth="3" strokeLinecap="round" 
                      />
                    );
                  })}
                  {chartData.map((d, i) => {
                    const x = ((i + 0.5) / chartData.length) * 100;
                    const y = 95 - (d.val / maxVal) * 85;
                    return (
                      <g key={`point-${i}`} className="graph-point">
                        <circle cx={`${x}%`} cy={`${y}%`} r="5" fill={d.peak ? 'var(--aka)' : 'var(--ao)'} stroke="var(--shiro)" strokeWidth="2" />
                        <text x={`${x}%`} y={`${y - 5}%`} textAnchor="middle" fontSize="11px" fontWeight="700" fill="var(--neutral-600)">{d.val}</text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="flex-between" style={{ fontSize: '10px', fontWeight: 600, color: 'var(--neutral-400)', paddingTop: 'var(--space-3)', marginTop: 'auto' }}>
              {chartData.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }} title={d.label}>{d.label}</span>)}
            </div>
          </div>

          {/* Category Distribution Pie Chart */}
          <div className="bento-card col-span-4" style={{ minHeight: '220px', height: '260px' }}>
            <div className="stat-header" style={{ margin: 0, marginBottom: 'var(--space-3)' }}>
              <i data-lucide="pie-chart" style={{ width: '16px', color: 'var(--neutral-500)' }}></i>
              Category Distribution
            </div>
            <p className="text-small" style={{ color: 'var(--neutral-500)', marginBottom: 'var(--space-3)' }}>Athletes per category in recent event</p>
            
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', height: '100%' }}>
              <div style={{ flexShrink: 0 }}>
                {renderPieChart()}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '140px', paddingRight: '8px' }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color, flexShrink: 0 }}></span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--neutral-700)' }} title={d.label}>{d.label}</span>
                    <span style={{ fontWeight: 700 }}>{d.val}</span>
                  </div>
                ))}
              </div>
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
