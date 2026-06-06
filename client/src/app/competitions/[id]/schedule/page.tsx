'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

interface CategorySchedule {
  id: string;
  category: string;
  mat: string;
  start: string;
  end: string;
  status: string;
  actualEndTime?: string;
}

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  
  const [scheduleData, setScheduleData] = useState<CategorySchedule[]>([]);
  const [compData, setCompData] = useState<{ name: string; dates: string; deployedAt?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [matFilter, setMatFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
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

  const fetchSchedule = async () => {
    setSyncing(true);
    try {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
      
      const q = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      const snapshot = await getDocs(q);
      const cats = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          category: data.name,
          mat: data.mat,
          start: data.scheduledStartTime,
          end: data.scheduledEndTime,
          status: data.status
        } as CategorySchedule;
      });
      setScheduleData(cats);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    const setupListener = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');
      
      const q = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const cats = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            category: data.name,
            mat: data.mat,
            start: data.scheduledStartTime,
            end: data.scheduledEndTime,
            status: data.status,
            actualEndTime: data.actualEndTime,
          } as CategorySchedule;
        });
        setScheduleData(cats);
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      });
    };
    setupListener();

    return () => unsubscribe();
  }, [id]);

  const toMinutes = (value: string) => {
    if (!value || !value.includes(":")) return Number.MAX_SAFE_INTEGER;
    const [h, m] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return Number.MAX_SAFE_INTEGER;
    return h * 60 + m;
  };

  const isScheduled = (item: CategorySchedule) => Boolean(item.start && item.end);

  const totalCategories = scheduleData.length;
  const scheduledCount = scheduleData.filter(isScheduled).length;
  const unscheduledCount = totalCategories - scheduledCount;

  const mats = Array.from(new Set(scheduleData.map(item => item.mat).filter(mat => mat && mat !== "—"))).sort();

  const filteredData = scheduleData.filter(row => {
    const query = searchQuery.toLowerCase();
    const matchesText = !query || 
      row.category.toLowerCase().includes(query) || 
      row.mat.toLowerCase().includes(query);
    const matchesMat = matFilter === "all" || row.mat === matFilter;
    return matchesText && matchesMat;
  }).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

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
          .schedule-summary { grid-template-columns: 1fr; }
          .search-wrap { width: 100%; }
          .schedule-tools { width: 100%; }
          .schedule-select { flex: 1; }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
            </div>
            <h1>Category Schedule</h1>
            {compData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '14px', color: 'var(--neutral-700)', fontWeight: 600 }}>{compData.name}</span>
                {compData.dates && (
                  <span style={{ fontSize: '13px', color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📅 {compData.dates}
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
              <h2 style={{ margin: 0 }}>Chronological Category Schedule</h2>
              <div className="text-small">Read-only list based on assignments saved in Categories.</div>
            </div>
            <div className="schedule-tools">
              <div className="search-wrap">
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)' }} />
                <input 
                  className="schedule-input" 
                  type="text" 
                  placeholder="Search category or mat..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
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
                  <th className="text-micro">Mat</th>
                  <th className="text-micro">Estimated Time</th>
                  <th className="text-micro">Live Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr><td colSpan={4} className="empty-row">No categories match the current filters.</td></tr>
                ) : (
                    filteredData.map(row => (
                    <tr key={row.id}>
                      <td>
                        <div className="category-name">{row.category}</div>
                        {row.status === 'done' && <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Finished</div>}
                        {row.status === 'live' && <div style={{ fontSize: '11px', color: 'var(--aka)', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Progress</div>}
                      </td>
                      <td><span className="mat-pill">{row.mat || '\u2014'}</span></td>
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
