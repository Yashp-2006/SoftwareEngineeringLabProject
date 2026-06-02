'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

const ROLE_MAP: Record<string, string> = {
  'admin': 'Admin',
  'mat_operator': 'Scoreboard Controller',
  'attendance_volunteer': 'Attendance Volunteer',
  'medal_distributor': 'Medal Distributor',
  'guest_viewer': 'Viewer'
};

const ROLES = Object.keys(ROLE_MAP);

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "admin": "Full control (Read/Write)",
  "mat_operator": "Score mat, manage tiesheet, points",
  "attendance_volunteer": "Athlete page, ready status, disqualify",
  "medal_distributor": "Filter state/country, distribute",
  "guest_viewer": "Read-only access"
};

const getNormalizedRole = (role: string) => {
  if (!role) return 'guest_viewer';
  if (role === 'Viewer') return 'guest_viewer';
  if (role === 'Admin') return 'admin';
  if (role === 'Scoreboard Controller') return 'mat_operator';
  if (role === 'Attendance Volunteer') return 'attendance_volunteer';
  if (role === 'Medal Distributor') return 'medal_distributor';
  return role;
};

const ACADEMIES = [
  "No Academy",
  "Kyoto Shotokan Club",
  "Osaka Budokan Academy",
  "Tokyo Seido Dojo",
  "Nara Combat Academy",
  "Kobe Wadoryu Center",
  "International Guest Team",
  "Madrid Elite Karate",
  "São Paulo Strikers",
  "Cairo Champions Club",
  "USA National Dev Team"
];

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  academy: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [academyFilter, setAcademyFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let unsub: () => void;
    const setup = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query } = await import('firebase/firestore');

      const q = query(collection(db, 'users'));
      unsub = onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || 'Unknown User',
          email: d.data().email || 'No email',
          role: getNormalizedRole(d.data().role),
          academy: d.data().academy || 'No Academy'
        })) as User[];
        setUsers(data);
        setLoading(false);
      });
    };
    setup();
    return () => { if (unsub) unsub(); };
  }, []);

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const textMatch = !query || 
      user.name.toLowerCase().includes(query) || 
      user.email.toLowerCase().includes(query) || 
      user.academy.toLowerCase().includes(query);
    const roleMatch = roleFilter === "all" || user.role === roleFilter;
    const academyMatch = academyFilter === "all" || user.academy === academyFilter;
    return textMatch && roleMatch && academyMatch;
  });

  const updateUserField = async (id: string, field: 'role' | 'academy', value: string) => {
    // Optimistic
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
    
    // Persist
    try {
      const { db } = await import('@lib/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, { [field]: value });
      
      // Flash saved
      setSavedStatus(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setSavedStatus(prev => ({ ...prev, [id]: false }));
      }, 1000);
    } catch (err) {
      console.error('Failed to update user', err);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .users-panel {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }
        .users-header {
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--neutral-300);
          background: var(--neutral-50);
          display: grid;
          gap: var(--space-3);
          grid-template-columns: minmax(320px, 1fr) 220px 220px;
          align-items: center;
        }
        .search-wrap { position: relative; }
        .search-wrap i {
          position: absolute; left: 12px; top: 11px; width: 16px; color: var(--neutral-500);
        }
        .search-input, .filter-select, .role-select, .academy-select {
          height: 40px; border: 1.5px solid var(--neutral-300); border-radius: 8px;
          font-family: var(--font-body); font-size: 13px; color: var(--neutral-900);
          background: var(--shiro); outline: none;
        }
        .search-input { width: 100%; padding: 0 12px 0 38px; }
        .filter-select, .role-select, .academy-select { width: 100%; padding: 0 10px; }
        .search-input:focus, .filter-select:focus, .role-select:focus, .academy-select:focus {
          border-color: var(--ao); box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12);
        }
        .users-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .users-table th {
          text-align: left; padding: 12px 24px; background: var(--neutral-50);
          border-bottom: 1px solid var(--neutral-300); white-space: nowrap;
        }
        .users-table td {
          padding: 14px 24px; border-bottom: 1px solid var(--neutral-100); vertical-align: middle;
        }
        .users-table tr:hover { background: var(--neutral-50); }
        .name-cell {
          font-weight: 600; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .email-cell {
          font-weight: 500; color: var(--neutral-700); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-family: var(--font-mono); font-size: 12px;
        }
        .role-select, .academy-select { min-width: 0; }
        .empty-state { padding: var(--space-6); text-align: center; color: var(--neutral-500); font-size: 14px; }
        .saved-chip {
          font-size: 11px; font-weight: 700; color: var(--status-live);
          text-transform: uppercase; letter-spacing: 0.04em;
          opacity: 0; transition: opacity 0.2s ease;
        }
        .saved-chip.visible { opacity: 1; }
        @media (max-width: 1100px) {
          .users-header { grid-template-columns: 1fr; }
          .users-panel { overflow-x: auto; }
          .users-table { min-width: 980px; }
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div>
            <div className="breadcrumb">Admin / Users</div>
            <h1>User Assignment</h1>
          </div>
        </header>

        <section className="users-panel">
          <div className="users-header">
            <div className="search-wrap">
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--neutral-500)' }} />
              <input 
                className="search-input" 
                type="text" 
                placeholder="Search by name, email, or academy..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">Filter by Role (All)</option>
              {ROLES.map(role => (
                <option key={role} value={role}>{ROLE_MAP[role]}</option>
              ))}
            </select>
            <select className="filter-select" value={academyFilter} onChange={e => setAcademyFilter(e.target.value)}>
              <option value="all">Filter by Academy (All)</option>
              {ACADEMIES.map(academy => (
                <option key={academy} value={academy}>{academy}</option>
              ))}
            </select>
          </div>

          <div className="table-responsive">
          <table className="users-table">
            <colgroup>
              <col style={{ width: '20%' }} />
              <col style={{ width: '27%' }} />
              <col style={{ width: '22.5%' }} />
              <col style={{ width: '22.5%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-micro">User Name</th>
                <th className="text-micro">User Email / Gmail</th>
                <th className="text-micro">Role</th>
                <th className="text-micro">Academy</th>
                <th className="text-micro">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="empty-state">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="empty-state">No users match the selected filters.</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td className="name-cell">{user.name}</td>
                    <td className="email-cell">{user.email}</td>
                    <td>
                      <select 
                        className="role-select" 
                        value={user.role} 
                        onChange={e => updateUserField(user.id, 'role', e.target.value)}
                      >
                        {ROLES.map(role => <option key={role} value={role}>{ROLE_MAP[role]}</option>)}
                      </select>
                      <div style={{ fontSize: '11px', color: 'var(--neutral-500)', marginTop: '6px', lineHeight: 1.3 }}>
                        {ROLE_DESCRIPTIONS[user.role]}
                      </div>
                    </td>
                    <td>
                      <select 
                        className="academy-select" 
                        value={user.academy} 
                        onChange={e => updateUserField(user.id, 'academy', e.target.value)}
                      >
                        {ACADEMIES.map(academy => <option key={academy} value={academy}>{academy}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`saved-chip ${savedStatus[user.id] ? 'visible' : ''}`}>Saved</span>
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
