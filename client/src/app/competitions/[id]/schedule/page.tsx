'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Calendar, X } from 'lucide-react';

interface CategorySchedule {
  id: string;
  category: string;
  mat: string;
  start: string;
  end: string;
  status: string;
  actualEndTime?: string;
  day?: number;
  isKata?: boolean;
  gender?: string;
}

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  
  const [scheduleData, setScheduleData] = useState<CategorySchedule[]>([]);
  const [compData, setCompData] = useState<{ name: string; dates: any; deployedAt?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [matFilter, setMatFilter] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [lastSync, setLastSync] = useState<string>("--:--");

  // Fetch competition metadata
  useEffect(() => {
    const fetchComp = async () => {
      const { db } = await import('@lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      const d = await getDoc(doc(db, 'competitions', id));
      if (d.exists()) setCompData(d.data() as any);
    };
    fetchComp();
  }, [id]);

  // Schedule is driven entirely by the real-time Firestore listener below.
  // No manual fetch needed — onSnapshot keeps data live.

  useEffect(() => {
    let unsubscribe = () => {};
    const setupListener = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');
      
      const q = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const scheduleRows: CategorySchedule[] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const entries = data.athletes?.length ?? data.entries ?? 0;
          if (entries === 0) return;

          const isKata = Boolean(data.isKata || (typeof data.name === 'string' && data.name.toLowerCase().includes('kata')));
          const gender = data.gender || '';

          if (data.pools && Array.isArray(data.pools) && data.pools.length > 0) {
            data.pools.forEach((p: any) => {
              const label = p.pool === 'finals' ? 'Finals' : `Pool ${p.pool}`;
              scheduleRows.push({
                id: `${doc.id}_pool_${p.pool}`,
                category: `${data.name} - ${label}`,
                mat: p.mat || data.mat || '-',
                start: p.startTime || '-',
                end: p.endTime || '-',
                status: p.status || data.status || 'upcoming',
                actualEndTime: p.actualEndTime || undefined,
                day: p.day || data.day || 1,
                isKata,
                gender,
              });
            });
          } else {
            scheduleRows.push({
              id: doc.id,
              category: data.name,
              mat: data.mat || '-',
              start: data.scheduledStartTime || '-',
              end: data.scheduledEndTime || '-',
              status: data.status || 'upcoming',
              actualEndTime: data.actualEndTime || undefined,
              day: data.day || 1,
              isKata,
              gender,
            });
          }
        });
        setScheduleData(scheduleRows);
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      });
    };
    setupListener();

    return () => unsubscribe();
  }, [id]);


  const isScheduled = (item: CategorySchedule) => Boolean(item.start && item.end);

  const totalCategories = scheduleData.length;
  const scheduledCount = scheduleData.filter(isScheduled).length;
  const unscheduledCount = totalCategories - scheduledCount;

  const mats = Array.from(new Set(scheduleData.map(item => item.mat).filter(mat => mat && mat !== '-' && mat !== '—'))).sort();
  const daysList = Array.from(new Set(scheduleData.map(item => item.day).filter(Boolean))).sort((a, b) => Number(a) - Number(b));

  // BUG FIX: Do NOT re-sort by time here. The schedule is ordered by the `order` field
  // set during drag-and-drop in the Category Management page. Sorting by start time
  // would override the canonical run order (e.g. when start times are equal or unset).
  // The Firestore listener already fetches rows ordered by `order`, so we preserve that.
  const filteredData = scheduleData.filter(row => {
    const query = searchQuery.toLowerCase().trim();
    const nameLower = row.category.toLowerCase();
    
    const matchesText = !query || nameLower.includes(query) || row.mat.toLowerCase().includes(query);
    const matchesMat = matFilter === "all" || row.mat === matFilter;
    const matchesDay = dayFilter === "all" || String(row.day) === dayFilter;
    
    const isKata = Boolean(row.isKata || nameLower.includes('kata'));
    let matchesType = true;
    if (filterType !== 'all') {
      if (filterType === 'kata') matchesType = isKata;
      if (filterType === 'kumite') matchesType = !isKata;
    }
    
    let matchesGender = true;
    if (filterGender !== 'all') {
      const rawGender = (row.gender || '').toLowerCase();
      const isFemale = rawGender === 'female' || /\b(female|girls?|women)\b/.test(nameLower) || nameLower.includes('female');
      const isMale = rawGender === 'male' || (!isFemale && (/\b(male|boys?|men)\b/.test(nameLower) || nameLower.includes('male')));
      const isMixed = rawGender === 'mixed' || nameLower.includes('mixed') || nameLower.includes('team');
      
      if (filterGender === 'female') matchesGender = isFemale;
      if (filterGender === 'male') matchesGender = isMale;
      if (filterGender === 'mixed') matchesGender = isMixed;
    }
    
    return matchesText && matchesMat && matchesDay && matchesType && matchesGender;
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .schedule-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .summary-tile {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .summary-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--neutral-500);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .summary-value {
          font-family: var(--font-mono);
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
          color: var(--neutral-900);
        }
        .schedule-panel {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }
        .schedule-header {
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--neutral-300);
          background: var(--neutral-50);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          flex-wrap: wrap;
        }
        .schedule-tools {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        .search-wrap {
          position: relative;
          width: 280px;
          max-width: 100%;
        }
        .search-wrap i {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--neutral-500);
          width: 14px;
        }
        .schedule-input,
        .schedule-select {
          height: 38px;
          border: 1.5px solid var(--neutral-300);
          border-radius: 8px;
          font-size: 13px;
          font-family: var(--font-body);
          color: var(--neutral-900);
          background: var(--shiro);
          outline: none;
        }
        .schedule-input {
          width: 100%;
          padding: 0 12px 0 32px;
        }
        .schedule-select {
          min-width: 140px;
          padding: 0 10px;
        }
        .schedule-input:focus,
        .schedule-select:focus {
          border-color: var(--ao);
          box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12);
        }
        .schedule-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }
        .schedule-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 780px;
        }
        .schedule-table thead th {
          text-align: left;
          padding: 12px 24px;
          background: var(--neutral-50);
          border-bottom: 1px solid var(--neutral-300);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .schedule-table tbody td {
          padding: 14px 24px;
          border-bottom: 1px solid var(--neutral-100);
          vertical-align: middle;
        }
        .schedule-table tbody tr:hover {
          background: var(--neutral-50);
        }
        .schedule-table tbody tr:last-child td {
          border-bottom: none;
        }
        .category-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--neutral-900);
        }
        .mat-pill {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--neutral-300);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--neutral-700);
          background: var(--neutral-50);
        }
        .timeframe-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: var(--neutral-900);
        }
        .unscheduled-tag {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: var(--status-upcoming-bg);
          color: var(--status-upcoming);
        }
        .last-sync {
          color: var(--neutral-500);
          font-size: 12px;
          font-family: var(--font-mono);
        }
        .empty-row {
          padding: 28px 24px;
          text-align: center;
          color: var(--neutral-500);
          font-size: 14px;
        }
        @media (max-width: 980px) {
          .schedule-summary { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .search-wrap { width: 100%; }
          .schedule-tools { width: 100%; }
          .schedule-select { flex: 1; min-width: 130px; }
        }
        @media (max-width: 640px) {
          .schedule-summary {
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
          }
          .summary-tile {
            padding: 10px 8px;
            text-align: center;
          }
          .summary-label {
            font-size: 9px;
            letter-spacing: 0.04em;
          }
          .summary-value {
            font-size: 18px;
          }
          .schedule-header {
            padding: var(--space-3) var(--space-4);
          }
          .schedule-tools {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
          }
          .search-wrap {
            grid-column: span 2;
            width: 100%;
          }
          .schedule-select {
            min-width: 0;
            width: 100%;
            height: 38px;
            font-size: 13px;
          }
          .schedule-table thead th,
          .schedule-table tbody td {
            padding: 10px 14px;
          }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {compData?.name || id} / Schedule
            </div>
            <h1>Category Schedule</h1>
            {compData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '14px', color: 'var(--neutral-700)', fontWeight: 600 }}>{compData.name}</span>
                {compData.dates && (
                  <span style={{ fontSize: '13px', color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> {typeof compData.dates === 'string' ? compData.dates : (() => {
                      const s = compData.dates?.start || compData.dates?.startDate || '';
                      const e = compData.dates?.end || compData.dates?.endDate || '';
                      if (s && e && s !== e) return `${s} – ${e}`;
                      return String(s || e || '');
                    })()}
                  </span>
                )}
                {compData.deployedAt && (
                  <span style={{ fontSize: '11px', color: 'var(--neutral-400)' }}>
                    Deployed {new Date(compData.deployedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="schedule-summary">
          <article className="summary-tile">
            <div className="summary-label">Total Categories</div>
            <div className="summary-value">{totalCategories}</div>
          </article>
          <article className="summary-tile">
            <div className="summary-label">Scheduled</div>
            <div className="summary-value">{scheduledCount}</div>
          </article>
          <article className="summary-tile">
            <div className="summary-label">Unscheduled</div>
            <div className="summary-value">{unscheduledCount}</div>
          </article>
        </section>

        <section className="schedule-panel">
          <div className="schedule-header">
            <div>
              <h2 style={{ margin: 0 }}>Match Schedule</h2>
              <div className="text-small">Find your category, mat number, and match time.</div>
            </div>
            <div className="schedule-tools">
              <div className="search-wrap">
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)', pointerEvents: 'none' }} />
                <input 
                  className="schedule-input" 
                  type="text" 
                  placeholder="Search category or mat..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingRight: searchQuery ? '30px' : '12px' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--neutral-400)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <select className="schedule-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                <option value="kata">Kata</option>
                <option value="kumite">Kumite</option>
              </select>
              <select className="schedule-select" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="mixed">Mixed</option>
              </select>
              <select className="schedule-select" value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                <option value="all">All Days</option>
                {daysList.map(day => (
                  <option key={day} value={String(day)}>Day {day}</option>
                ))}
              </select>
              <select className="schedule-select" value={matFilter} onChange={e => setMatFilter(e.target.value)}>
                <option value="all">All Mats</option>
                {mats.map(mat => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="schedule-table-wrap">
            <div className="table-responsive">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th className="text-micro">Category Name</th>
                  <th className="text-micro">Day</th>
                  <th className="text-micro">Mat</th>
                  <th className="text-micro">Estimated Time</th>
                  <th className="text-micro">Live Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">No categories match the current filters.</td></tr>
                ) : (
                    filteredData.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}
                    >
                      <td>
                        <div className="category-name">{row.category}</div>
                        <div style={{ fontSize: '10px', color: 'var(--neutral-500)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                          {row.category.toLowerCase().includes('kata') ? 'KATA' : 'KUMITE'}
                        </div>
                        {row.status === 'done' && <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Finished</div>}
                        {row.status === 'live' && <div style={{ fontSize: '11px', color: 'var(--aka)', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Progress</div>}
                      </td>
                      <td><span style={{ fontWeight: 700, color: 'var(--neutral-700)', fontSize: '13px' }}>Day {row.day || 1}</span></td>
                      <td><span className="mat-pill">{row.mat || '-'}</span></td>
                      <td>
                        {row.start && row.end ? (
                          <div className="timeframe-chip">
                            <span className="data-mono">{row.start}</span>
                            <span className="text-small">to</span>
                            <span className="data-mono">{row.end}</span>
                          </div>
                        ) : (
                          <span className="unscheduled-tag">Unscheduled</span>
                        )}
                      </td>
                      <td>
                        {row.actualEndTime ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#10b981' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                            <span className="data-mono">{row.actualEndTime}</span>
                          </div>
                        ) : row.status === 'live' ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--aka)' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--aka)', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
                            <span style={{ fontSize: '12px' }}>In Progress</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--neutral-400)', fontSize: '12px' }}>--:--</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
          <div className="schedule-header" style={{ borderTop: '1px solid var(--neutral-200)', borderBottom: 'none', paddingTop: '10px', paddingBottom: '10px' }}>
            <div className="last-sync">Last sync: {lastSync}</div>
          </div>
        </section>
      </main>
    </>
  );
}
