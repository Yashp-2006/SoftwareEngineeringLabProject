'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import {
  Plus,
  Activity,
  Calendar,
  Users,
  MapPin,
  Trophy,
  TrendingUp,
  PieChart as PieChartIcon,
  ArrowRight,
  LayoutGrid,
  Tv,
  Settings
} from 'lucide-react';
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
  const [selectedLiveCompId, setSelectedLiveCompId] = useState<string | null>(null);
  const [pieLoading, setPieLoading] = useState(false);

  const activeLiveTournaments = React.useMemo(() => {
    return liveCompetitions.filter(c => c.status === 'live');
  }, [liveCompetitions]);

  const currentLiveComp = React.useMemo(() => {
    if (!activeLiveTournaments.length) return null;
    return activeLiveTournaments.find(c => c.id === selectedLiveCompId) || activeLiveTournaments[0];
  }, [activeLiveTournaments, selectedLiveCompId]);

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
        
        const totalClubs = 0; 
        
        setStats({ active, upcoming, athletes, completed, activeMats, nextUpcomingName, eventsThisYear, totalClubs });

        // Process trend data
        compsForTrend.sort((a, b) => a.date - b.date); // Oldest to newest
        let finalTrends = compsForTrend.map(c => ({ label: c.label, val: c.val, peak: false }));
        if (finalTrends.length === 0) {
          // No competitions with athlete data yet — chart stays empty
          setTrendData([]);
        } else {
          const maxVal = Math.max(...finalTrends.map(t => t.val));
          finalTrends.forEach(t => t.peak = t.val === maxVal);
          setTrendData(finalTrends);
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

  // Sync selectedLiveCompId with active live tournaments
  useEffect(() => {
    if (activeLiveTournaments.length === 0) {
      if (selectedLiveCompId !== null) setSelectedLiveCompId(null);
    } else if (!selectedLiveCompId || !activeLiveTournaments.some(c => c.id === selectedLiveCompId)) {
      setSelectedLiveCompId(activeLiveTournaments[0].id);
    }
  }, [activeLiveTournaments, selectedLiveCompId]);

  // Real-time listener for categories of selected live tournament
  useEffect(() => {
    if (!selectedLiveCompId) {
      setPieData([]);
      setPieLoading(false);
      return;
    }

    setPieLoading(true);
    let unsub: any;

    const listenToCategories = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, onSnapshot } = await import('firebase/firestore');

        const colors = [
          'var(--aka)',
          'var(--ao)',
          'oklch(65% 0.18 50)',
          'oklch(60% 0.15 160)',
          'oklch(45% 0.12 280)',
          'oklch(80% 0.10 90)',
          'oklch(75% 0.05 220)'
        ];

        unsub = onSnapshot(collection(db, 'competitions', selectedLiveCompId, 'categories'), (catSnap) => {
          let pData: any[] = [];
          catSnap.forEach(catDoc => {
            const cData = catDoc.data();
            const count = Array.isArray(cData.athletes)
              ? cData.athletes.length
              : (typeof cData.entries === 'number'
                  ? cData.entries
                  : (typeof cData.athletesCount === 'number' ? cData.athletesCount : 0));
            if (count > 0) {
              pData.push({ label: cData.name || catDoc.id, val: count });
            }
          });

          pData.sort((a, b) => b.val - a.val);

          if (pData.length > 6) {
            const top = pData.slice(0, 5);
            const otherVal = pData.slice(5).reduce((sum, item) => sum + item.val, 0);
            pData = [...top, { label: 'Other Categories', val: otherVal }];
          }

          setPieData(pData.map((d, i) => ({ ...d, color: colors[i % colors.length] })));
          setPieLoading(false);
        }, (err) => {
          console.error('Failed to listen to live categories', err);
          setPieLoading(false);
        });
      } catch (err) {
        console.error(err);
        setPieLoading(false);
      }
    };

    listenToCategories();

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [selectedLiveCompId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }

    const ctx = gsap.context(() => {
      gsap.from('.stagger-in', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'expo.out'
      });
    });

    setLoading(false);

    return () => {
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
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
    return () => { ctx.revert(); };
  }, [chartType, timeFilter]);

  const chartData = timeFilter === '12M' ? trendData : trendData.slice(-6);
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.val)) : 100;
  
  // SVG Pie Chart Helper
  const renderPieChart = () => {
    if (pieLoading) {
      return (
        <div style={{ width: '140px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: '3px solid var(--neutral-200)', borderTopColor: 'var(--ao)', animation: 'spin 1s linear infinite' }} />
        </div>
      );
    }
    if (pieData.length === 0) {
      return (
        <div style={{ width: '140px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '2px dashed var(--neutral-300)', color: 'var(--neutral-400)', fontSize: '11px', textAlign: 'center', padding: '14px', boxSizing: 'border-box', lineHeight: 1.3 }}>
          No category entries
        </div>
      );
    }
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
          transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 160ms cubic-bezier(0.16, 1, 0.3, 1), border-color 160ms cubic-bezier(0.16, 1, 0.3, 1);
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
        
        /* Themed Metric Cards */
        .bento-card.theme-aka { border-top: 4px solid var(--aka); }
        .bento-card.theme-aka .stat-icon-wrap { background: var(--aka-light); color: var(--aka); }
        .bento-card.theme-aka .stat-value { color: var(--aka); }
        
        .bento-card.theme-ao { border-top: 4px solid var(--ao); }
        .bento-card.theme-ao .stat-icon-wrap { background: var(--ao-light); color: var(--ao); }
        .bento-card.theme-ao .stat-value { color: var(--ao); }

        .bento-card.theme-dark { border-top: 4px solid var(--neutral-900); }
        .bento-card.theme-dark .stat-icon-wrap { background: var(--neutral-100); color: var(--neutral-900); }
        .bento-card.theme-dark .stat-value { color: var(--neutral-900); }
        
        .bento-card.theme-neutral { border-top: 4px solid var(--neutral-400); }
        .bento-card.theme-neutral .stat-icon-wrap { background: var(--neutral-100); color: var(--neutral-600); }
        .bento-card.theme-neutral .stat-value { color: var(--neutral-900); }

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

        /* Mobile portrait & phone: 2x2 metric grid with fluid charts and scrollable table */
        @media (max-width: 768px) {
          .col-span-3 { grid-column: span 6 !important; }
          .col-span-4, .col-span-6, .col-span-8, .col-span-12 { grid-column: span 12 !important; }
          .dashboard-bento { gap: 10px; }
          .bento-card { border-radius: 14px; padding: 14px !important; }
          .stat-value { font-size: 32px !important; }
          .stat-header { font-size: 11px !important; margin-bottom: 8px !important; }
          .stat-footer { font-size: 11px !important; }
          .page-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
          .page-header-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .page-header-actions .btn {
            width: 100% !important;
            justify-content: center !important;
            min-height: 42px !important;
            padding: 8px 10px !important;
            font-size: 13px !important;
          }
          .chart-header-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .chart-header-row .chart-controls {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .pie-chart-wrap {
            flex-direction: column !important;
            align-items: center !important;
            gap: 14px !important;
          }
          .pie-chart-legend {
            width: 100% !important;
            max-height: 180px !important;
            padding-right: 0 !important;
          }
          .modern-table {
            min-width: 580px;
          }
          .modern-table th, .modern-table td {
            padding: 12px 14px !important;
          }
          .table-responsive {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 380px) {
          .col-span-3 { grid-column: span 12 !important; }
        }

        .stat-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--neutral-600);
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: var(--space-3);
        }
        .stat-icon-wrap {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .stat-value {
          font-family: var(--font-display);
          font-size: 48px;
          line-height: 1;
          margin-bottom: var(--space-1);
        }
        .stat-footer {
          font-size: 13px;
          font-weight: 500;
          color: var(--neutral-500);
          display: flex;
          align-items: center;
          gap: 6px;
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
        .modern-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
        .modern-table th {
          background: var(--neutral-50); color: var(--neutral-600); font-size: 11px;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
          padding: 14px 24px; text-align: left; border-bottom: 1px solid var(--neutral-300);
          white-space: nowrap;
        }
        .modern-table td {
          padding: 16px 24px; border-bottom: 1px solid var(--neutral-200); transition: background-color 160ms cubic-bezier(0.16, 1, 0.3, 1);
          vertical-align: middle; background: var(--shiro);
        }
        .modern-table tr:last-child td { border-bottom: none; }
        .modern-table tr:hover td { background: var(--neutral-50); }
        .event-title { font-weight: 700; color: var(--neutral-900); margin-bottom: 2px; transition: color 160ms cubic-bezier(0.16, 1, 0.3, 1); }
        .modern-table tr:hover .event-title { color: var(--ao); }
        
        .chart-controls { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .select-minimal {
          appearance: none; background: var(--neutral-50); border: 1.5px solid transparent;
          border-radius: 8px; padding: 0 32px 0 16px; height: 36px; font-size: 12px; font-weight: 700;
          color: var(--neutral-700); cursor: pointer; outline: none; transition: background 160ms cubic-bezier(0.16, 1, 0.3, 1), border-color 160ms cubic-bezier(0.16, 1, 0.3, 1);
          touch-action: manipulation;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
        }
        .select-minimal:hover { background-color: var(--neutral-100); border-color: var(--neutral-200); }
        .select-minimal:focus { background-color: var(--shiro); border-color: var(--ao); box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12); }

        .bar-group { flex: 1; height: 100%; position: relative; display: flex; align-items: flex-end; margin: 0 4px; min-width: 0; }
        .bar-inner { width: 100%; border-radius: 6px 6px 0 0; position: relative; cursor: pointer; transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1); }
        .bar-inner:hover { transform: scaleY(1.05); transform-origin: bottom; }
        .bar-inner:hover .bar-label { opacity: 1; transform: translate(-50%, 0); }
        .bar-label { position: absolute; top: -28px; left: 50%; transform: translate(-50%, 4px); text-align: center; font-size: 11px; font-weight: 700; color: var(--neutral-600); opacity: 0; transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1); }
        
        .action-btns { display: inline-flex; gap: 8px; }
        .action-btns .btn-ghost, .action-btns .btn-primary, .action-btns .btn-secondary { padding: 8px; border-radius: 8px; transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1); }
        .action-btns .btn-ghost { background: var(--neutral-50); border: 1px solid var(--neutral-200); }
        .action-btns .btn-ghost:hover { background: var(--neutral-100); }
        .action-btns a:active { transform: scale(0.92); }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />

      <main className="container">
        <header className="page-header stagger-in">
          <div>
            <div className="breadcrumb">Admin / Dashboard</div>
            <h1>Operations Hub</h1>
          </div>
          <div className="page-header-actions" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <Link
              href="/competitions"
              className="btn btn-primary"
              style={{
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={15} /> New Competition
            </Link>
          </div>
        </header>

        <section className="dashboard-bento stagger-in">
          <div className="bento-card col-span-3 theme-aka">
            <div>
              <div className="stat-header">
                <div className="stat-icon-wrap">
                  <Activity size={18} />
                </div>
                Active Now
              </div>
              <div className="stat-value">{stats.active}</div>
            </div>
            <div className="stat-footer">
              <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--aka)', borderRadius: '50%' }}></span>
              {stats.active > 0 ? `Running on ${stats.activeMats} mats` : 'No active events'}
            </div>
          </div>

          <div className="bento-card col-span-3 theme-ao">
            <div>
              <div className="stat-header">
                <div className="stat-icon-wrap">
                  <Calendar size={18} />
                </div>
                Upcoming
              </div>
              <div className="stat-value">{stats.upcoming}</div>
            </div>
            <div className="stat-footer">
              {stats.upcoming > 0 ? `Next: ${stats.nextUpcomingName}` : 'No upcoming events'}
            </div>
          </div>

          <div className="bento-card col-span-3 theme-dark">
            <div>
              <div className="stat-header">
                <div className="stat-icon-wrap">
                  <Users size={18} />
                </div>
                Total Athletes
              </div>
              <div className="stat-value">{stats.athletes.toLocaleString()}</div>
            </div>
            <div className="stat-footer">
              <MapPin size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
              Across {stats.totalClubs} clubs globally
            </div>
          </div>

          <div className="bento-card col-span-3 theme-neutral">
            <div>
              <div className="stat-header">
                <div className="stat-icon-wrap">
                  <Trophy size={18} />
                </div>
                Completed Events
              </div>
              <div className="stat-value">{stats.completed}</div>
            </div>
            <div className="stat-footer">
              <span style={{ color: 'var(--status-live)', fontWeight: 700 }}>{stats.eventsThisYear}</span> this year
            </div>
          </div>

          {/* Participation Trends (Wide or Full Width if no live tournament) */}
          <div className={`bento-card ${activeLiveTournaments.length > 0 ? 'col-span-8' : 'col-span-12'}`} style={{ minHeight: '260px' }}>
            <div className="flex-between mb-4 chart-header-row">
              <div className="stat-header" style={{ margin: 0 }}>
                <div className="stat-icon-wrap" style={{ width: '28px', height: '28px', background: 'var(--ao-light)', color: 'var(--ao)', marginRight: '4px' }}>
                  <TrendingUp size={16} />
                </div>
                Participation Trends
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
              {/* Y-axis Background Grid */}
              {chartData.length > 0 && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0 }}>
                  {[
                    { val: maxVal, top: '15%' },
                    { val: Math.round(maxVal / 2), top: '57.5%' },
                    { val: 0, top: '100%' }
                  ].map((tick, i) => (
                    <div key={i} style={{ position: 'absolute', top: tick.top, left: 0, right: 0, display: 'flex', alignItems: 'center', transform: 'translateY(-50%)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--neutral-400)', width: '28px', textAlign: 'right', paddingRight: '8px', fontWeight: 600 }}>{tick.val}</span>
                      <div style={{ flex: 1, height: '1px', borderTop: '1px dashed var(--neutral-200)' }}></div>
                    </div>
                  ))}
                </div>
              )}

              {chartData.length === 0 ? (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--neutral-500)', fontSize: '13px' }}>
                  No participation data yet.
                </div>
              ) : chartType === 'bar' ? chartData.map((d, i) => {
                const heightPct = (d.val / maxVal) * 85;
                const barColor = d.peak ? 'var(--aka)' : 'var(--ao)';
                return (
                  <div key={i} className="bar-group" style={{ zIndex: 1, marginLeft: i === 0 ? '36px' : '4px' }}>
                    <div 
                      className="bar-inner" 
                      style={{ height: `${Math.max(2, heightPct)}%`, background: barColor }}
                      title={`${d.label}: ${d.val} Athletes`}
                    >
                      <div className="bar-label">{d.val}</div>
                    </div>
                  </div>
                );
              }) : (
                <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'absolute', bottom: 0, zIndex: 1, left: '16px' }}>
                  {chartData.slice(1).map((d, i) => {
                    const prev = chartData[i];
                    const x1 = ((i + 0.5) / chartData.length) * 100;
                    const y1 = 100 - (prev.val / maxVal) * 85;
                    const x2 = ((i + 1.5) / chartData.length) * 100;
                    const y2 = 100 - (d.val / maxVal) * 85;
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
                    const y = 100 - (d.val / maxVal) * 85;
                    return (
                      <g key={`point-${i}`} className="graph-point">
                        <circle cx={`${x}%`} cy={`${y}%`} r="6" fill={d.peak ? 'var(--aka)' : 'var(--ao)'} stroke="var(--shiro)" strokeWidth="2.5" />
                        <text x={`${x}%`} y={`${y - 12}%`} textAnchor="middle" fontSize="11px" fontWeight="700" fill="var(--neutral-700)">{d.val}</text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="flex-between" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--neutral-500)', paddingTop: 'var(--space-3)', marginTop: 'auto', paddingLeft: '32px' }}>
              {chartData.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }} title={d.label}>{d.label}</span>)}
            </div>
          </div>

          {/* Category Distribution Pie Chart - Only displayed when at least 1 tournament is live */}
          {activeLiveTournaments.length > 0 && (
            <div className="bento-card col-span-4" style={{ minHeight: '260px' }}>
              <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: 'var(--space-2)', gap: '8px' }}>
                <div className="stat-header" style={{ margin: 0 }}>
                  <div className="stat-icon-wrap" style={{ width: '28px', height: '28px', background: 'var(--neutral-100)', color: 'var(--neutral-900)', marginRight: '4px' }}>
                    <PieChartIcon size={16} />
                  </div>
                  Category Distribution
                </div>
                {activeLiveTournaments.length > 1 && (
                  <select
                    className="select-minimal"
                    value={selectedLiveCompId || ''}
                    onChange={(e) => setSelectedLiveCompId(e.target.value)}
                    style={{ height: '30px', fontSize: '11px', padding: '0 26px 0 10px', maxWidth: '170px' }}
                    title="Select Live Tournament"
                  >
                    {activeLiveTournaments.map(comp => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name || 'Unnamed Tournament'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-small" style={{ color: 'var(--neutral-500)', marginBottom: 'var(--space-4)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentLiveComp ? `Athletes per category in ${currentLiveComp.name || 'Live Tournament'}` : 'Athletes per category in live tournament'}
              </p>
              
              <div className="pie-chart-wrap" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', height: '100%' }}>
                <div style={{ flexShrink: 0 }}>
                  {renderPieChart()}
                </div>
                <div className="pie-chart-legend" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '160px', paddingRight: '8px' }}>
                  {pieLoading ? (
                    <div style={{ color: 'var(--neutral-400)', fontSize: '12px', fontStyle: 'italic', padding: '16px 0' }}>
                      Loading categories...
                    </div>
                  ) : pieData.length === 0 ? (
                    <div style={{ color: 'var(--neutral-400)', fontSize: '12px', fontStyle: 'italic', padding: '16px 0' }}>
                      No athlete category entries found for this tournament.
                    </div>
                  ) : (
                    pieData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: d.color, flexShrink: 0 }}></span>
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--neutral-700)', fontWeight: 500 }} title={d.label}>{d.label}</span>
                        <span style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{d.val}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
        

        <section className="stagger-in" style={{ marginTop: 'var(--space-6)' }}>
          <div className="flex-between mb-4">
            <h2 style={{ fontSize: '20px', letterSpacing: '-0.02em' }}>Live Tournaments</h2>
            <Link href="/competitions" className="btn btn-ghost" style={{ fontSize: '13px', fontWeight: 700, padding: '8px 16px', color: 'var(--ao)', textDecoration: 'none', background: 'var(--ao-light)', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              View All Tournaments <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="table-container">
            <div className="table-responsive">
            <table className="modern-table">
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Mats</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {liveCompetitions.map(comp => (
                  <tr key={comp.id}>
                    <td>
                      <Link href={`/competitions/${comp.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                        <div className="event-title">{comp.name || 'Unnamed Tournament'}</div>
                        <div className="text-small">{comp.type || 'Tournament'}</div>
                      </Link>
                    </td>
                    <td>
                      {comp.status === 'live' ? (
                        <span style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>In Progress</span>
                      ) : (
                        <span style={{ fontWeight: 500, color: 'var(--neutral-500)' }}>Waiting to Start</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-chip status-${comp.status}`}>{comp.status === 'live' ? 'Live' : 'Upcoming'}</span>
                    </td>
                    <td>
                      {comp.status === 'live' ? (
                        <div className="mat-pill active" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, alignItems: 'center', gap: '6px', background: 'var(--aka-light)', color: 'var(--aka)', border: '1px solid var(--aka)' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--aka)', borderRadius: '50%' }}></span>
                          Active
                        </div>
                      ) : (
                        <div className="mat-pill" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, alignItems: 'center', gap: '6px', background: 'var(--neutral-100)', color: 'var(--neutral-500)', border: '1px solid var(--neutral-300)' }}>
                          Scheduled
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-btns" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {comp.status === 'live' ? (
                          <>
                            <Link
                              href={`/competitions/${comp.id}/mats`}
                              className="btn btn-ghost"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                padding: '6px 12px',
                                border: '1px solid var(--neutral-300)',
                                background: 'var(--shiro)',
                                color: 'var(--neutral-700)',
                                textDecoration: 'none',
                                height: '34px',
                                borderRadius: '8px',
                                fontWeight: 600
                              }}
                              title="View Mats"
                            >
                              <LayoutGrid size={14} /> Mats
                            </Link>
                            <Link
                              href={`/competitions/${comp.id}`}
                              className="btn btn-primary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                padding: '6px 14px',
                                textDecoration: 'none',
                                height: '34px',
                                borderRadius: '8px',
                                fontWeight: 600
                              }}
                              title="Live Stream"
                            >
                              <Tv size={14} /> Live
                            </Link>
                          </>
                        ) : (
                          <Link
                            href={`/competitions/${comp.id}`}
                            className="btn btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              padding: '6px 14px',
                              height: '34px',
                              textDecoration: 'none',
                              borderRadius: '8px',
                              fontWeight: 600
                            }}
                          >
                            <Settings size={14} /> Setup
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {liveCompetitions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--neutral-500)' }}>
                      No active or upcoming competitions right now.
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
