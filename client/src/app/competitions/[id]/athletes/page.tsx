'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

interface Athlete {
  id: string;
  name: string;
  academy: string;
  attendance: 'present' | 'absent';
  readiness: 'ready' | 'not-ready';
  disqualified: boolean;
}

interface Category {
  id: string;
  name: string;
  mat: string;
  status: string;
  athletes: Athlete[];
}

const INITIAL_DATA: Category[] = [
  {
    id: "smk-75",
    name: "Senior Male Kumite -75kg",
    mat: "MAT 01",
    status: "LIVE",
    athletes: [
      { id: "A001", name: "Takumi Sato", academy: "Kyoto Shotokan Club", attendance: "present", readiness: "ready", disqualified: false },
      { id: "A002", name: "Miguel Rossi", academy: "Roma Karate Dojo", attendance: "present", readiness: "not-ready", disqualified: true },
      { id: "A003", name: "Jaden Smith", academy: "LA Combat Academy", attendance: "absent", readiness: "not-ready", disqualified: false },
      { id: "A004", name: "Leon Silva", academy: "Sao Paulo Kumite Lab", attendance: "present", readiness: "ready", disqualified: false }
    ]
  },
  {
    id: "sfk-55",
    name: "Senior Female Kumite -55kg",
    mat: "MAT 02",
    status: "LIVE",
    athletes: [
      { id: "B011", name: "Aiko Tanaka", academy: "Osaka Elite Dojo", attendance: "present", readiness: "ready", disqualified: false },
      { id: "B012", name: "Maria Garcia", academy: "Madrid Kensei Club", attendance: "present", readiness: "not-ready", disqualified: false },
      { id: "B013", name: "Elena Costa", academy: "Lisbon Karate Center", attendance: "absent", readiness: "not-ready", disqualified: false }
    ]
  },
  {
    id: "smk-67",
    name: "U21 Male Kumite -67kg",
    mat: "UNASSIGNED",
    status: "UPCOMING",
    athletes: [
      { id: "C031", name: "Ren Kobayashi", academy: "Nagoya Budo Academy", attendance: "present", readiness: "not-ready", disqualified: false },
      { id: "C032", name: "Arjun Mehta", academy: "Delhi Fighting Arts", attendance: "present", readiness: "ready", disqualified: false },
      { id: "C033", name: "Noah Kim", academy: "Seoul Kumite Studio", attendance: "present", readiness: "not-ready", disqualified: true },
      { id: "C034", name: "Luca Bruno", academy: "Torino Kata Works", attendance: "absent", readiness: "not-ready", disqualified: false }
    ]
  }
];

export default function AthletesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [categories, setCategories] = useState<Category[]>(INITIAL_DATA);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(INITIAL_DATA[0].id);
  const [searchQuery, setSearchQuery] = useState("");

  const activeCategory = categories.find(c => c.id === activeCategoryId);

  const filteredAthletes = activeCategory?.athletes.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.academy.toLowerCase().includes(q);
  }) || [];

  const handleUpdate = (athleteId: string, field: keyof Athlete, value: string | boolean) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        athletes: cat.athletes.map(a => a.id === athleteId ? { ...a, [field]: value } : a)
      };
    }));
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .athletes-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: var(--space-5);
          align-items: start;
        }
        .category-panel {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          padding: var(--space-4);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          position: sticky;
          top: 130px;
        }
        .category-button {
          width: 100%;
          border: 1px solid var(--neutral-300);
          background: var(--shiro);
          border-radius: 10px;
          padding: 12px;
          text-align: left;
          cursor: pointer;
          margin-bottom: var(--space-2);
          transition: all 0.2s;
        }
        .category-button:hover { border-color: var(--ao); }
        .category-button.active {
          border-color: var(--aka);
          background: var(--aka-light);
          box-shadow: 0 0 0 1px var(--aka-light);
        }
        .category-name {
          font-weight: 600;
          color: var(--neutral-900);
          font-size: 14px;
          margin-bottom: 4px;
        }
        .category-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--neutral-500);
          font-weight: 600;
        }
        .athletes-panel {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          overflow: hidden;
        }
        .athletes-panel-header {
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--neutral-300);
          background: var(--neutral-50);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
        }
        .athletes-panel-header h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        .search-wrap {
          position: relative;
          width: 320px;
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
        .search-input {
          width: 100%;
          height: 38px;
          border: 1.5px solid var(--neutral-300);
          border-radius: 8px;
          padding: 0 12px 0 32px;
          font-size: 13px;
          font-family: var(--font-body);
          color: var(--neutral-900);
          outline: none;
        }
        .search-input:focus {
          border-color: var(--ao);
          box-shadow: 0 0 0 3px rgba(26,77,181,0.12);
        }
        table.athlete-table {
          width: 100%;
          border-collapse: collapse;
        }
        .athlete-table thead th {
          text-align: left;
          padding: 12px 24px;
          background: var(--neutral-50);
          border-bottom: 1px solid var(--neutral-300);
        }
        .athlete-table tbody td {
          padding: 14px 24px;
          border-bottom: 1px solid var(--neutral-100);
          font-size: 14px;
          color: var(--neutral-900);
          vertical-align: middle;
        }
        .athlete-table tbody tr:hover { background: var(--neutral-50); }
        .athlete-table tbody tr:last-child td { border-bottom: none; }
        .academy-name {
          color: var(--neutral-500);
          font-size: 13px;
        }
        .attendance-control {
          display: inline-flex;
          border: 1px solid var(--neutral-300);
          border-radius: 999px;
          padding: 2px;
          background: var(--shiro);
          gap: 2px;
        }
        .attendance-btn {
          border: none;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          background: transparent;
          color: var(--neutral-500);
        }
        .attendance-btn.present.active {
          background: var(--status-live-bg);
          color: var(--status-live);
        }
        .attendance-btn.absent.active {
          background: var(--aka-light);
          color: var(--aka);
        }
        .attendance-btn.neutral.active {
          background: var(--neutral-200);
          color: var(--neutral-700);
        }
        .empty-state {
          padding: var(--space-6);
          text-align: center;
          color: var(--neutral-500);
          font-size: 14px;
        }
        @media (max-width: 1100px) {
          .athletes-layout { grid-template-columns: 1fr; }
          .category-panel {
            position: static;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: var(--space-2);
          }
          .category-button { margin-bottom: 0; }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
            </div>
            <h1>Athletes Attendance</h1>
          </div>
        </header>

        <section className="athletes-layout">
          <aside className="category-panel">
            {categories.map((cat) => (
              <button 
                key={cat.id} 
                className={`category-button ${cat.id === activeCategoryId ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategoryId(cat.id);
                  setSearchQuery("");
                }}
              >
                <div className="category-name">{cat.name}</div>
                <div className="category-meta">
                  <span>{cat.mat}</span>
                  <span>{cat.status}</span>
                </div>
              </button>
            ))}
          </aside>

          <div className="athletes-panel">
            <div className="athletes-panel-header">
              <div>
                <h2>{activeCategory?.name}</h2>
                <div className="text-small">{activeCategory?.mat} • {activeCategory?.status} • {filteredAthletes.length} athletes</div>
              </div>
              <div className="search-wrap">
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)' }} />
                <input 
                  className="search-input" 
                  type="text" 
                  placeholder="Search athlete or academy..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <table className="athlete-table">
              <thead>
                <tr>
                  <th className="text-micro">Athlete Name</th>
                  <th className="text-micro">Academy</th>
                  <th className="text-micro">Present / Absent</th>
                  <th className="text-micro">Ready / Not Ready</th>
                  <th className="text-micro">Disqualify</th>
                </tr>
              </thead>
              <tbody>
                {filteredAthletes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">No athletes found for this filter.</td>
                  </tr>
                ) : (
                  filteredAthletes.map((athlete) => (
                    <tr key={athlete.id}>
                      <td>{athlete.name}</td>
                      <td className="academy-name">{athlete.academy}</td>
                      <td>
                        <div className="attendance-control">
                          <button 
                            className={`attendance-btn present ${athlete.attendance === 'present' ? 'active' : ''}`}
                            onClick={() => handleUpdate(athlete.id, 'attendance', 'present')}
                          >
                            Present
                          </button>
                          <button 
                            className={`attendance-btn absent ${athlete.attendance === 'absent' ? 'active' : ''}`}
                            onClick={() => handleUpdate(athlete.id, 'attendance', 'absent')}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="attendance-control">
                          <button 
                            className={`attendance-btn present ${athlete.readiness === 'ready' ? 'active' : ''}`}
                            onClick={() => handleUpdate(athlete.id, 'readiness', 'ready')}
                          >
                            Ready
                          </button>
                          <button 
                            className={`attendance-btn neutral ${athlete.readiness === 'not-ready' ? 'active' : ''}`}
                            onClick={() => handleUpdate(athlete.id, 'readiness', 'not-ready')}
                          >
                            Not Ready
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="attendance-control">
                          <button 
                            className={`attendance-btn absent ${athlete.disqualified ? 'active' : ''}`}
                            onClick={() => handleUpdate(athlete.id, 'disqualified', !athlete.disqualified)}
                          >
                            {athlete.disqualified ? 'Disqualified' : 'Disqualify'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
