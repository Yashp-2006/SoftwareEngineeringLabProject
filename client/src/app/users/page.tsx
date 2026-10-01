'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';

const ROLE_MAP: Record<string, string> = {
  'admin': 'Admin',
  'mat_operator': 'Mat Operator',
  'attendance_volunteer': 'Attendance Volunteer',
  'judge': 'Kata Judge',
  'guest_viewer': 'Guest Viewer',
  'viewer': 'Viewer',
  'medal_distributor': 'Medal Distributor',
};

const ROLES = [
  'admin',
  'mat_operator',
  'attendance_volunteer',
  'judge',
  'guest_viewer',
  'viewer',
  'medal_distributor',
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "admin": "Full access: manage users, settings, and all tournament data",
  "mat_operator": "Run mat scoring, manage tiesheet, and match timers",
  "attendance_volunteer": "Mark athlete attendance, set ready status, and call mats",
  "judge": "Submit scoring decisions and judgments for kata matches",
  "guest_viewer": "Elevated view-only: view mats, tiesheets, categories, and setup without write permissions",
  "viewer": "Audience viewer: public viewing access only to live brackets and matches",
  "medal_distributor": "Distribute medals to top finishers after each pool completes",
};

const ROLE_ALIASES: Record<string, string> = {
  admin: 'admin',
  score: 'mat_operator',
  mat: 'mat_operator',
  mat_operator: 'mat_operator',
  operator: 'mat_operator',
  attendance: 'attendance_volunteer',
  attendance_volunteer: 'attendance_volunteer',
  medal: 'medal_distributor',
  medal_distributor: 'medal_distributor',
  judge: 'judge',
  kata_judge: 'judge',
  guest_viewer: 'guest_viewer',
  guest: 'guest_viewer',
  viewer: 'viewer',
  audience: 'viewer',
};

const getNormalizedRole = (role?: string | null): string => {
  if (!role) return 'viewer';
  const lower = role.toLowerCase().trim();
  return ROLE_ALIASES[lower] || (ROLE_MAP[role] ? role : 'viewer');
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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [section, setSection] = useState<'staff' | 'viewers' | 'all'>('staff');
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let unsub: () => void;
    const setup = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query } = await import('firebase/firestore');

      const q = query(collection(db, 'users'));
      unsub = onSnapshot(q, (snap) => {
        const data = snap.docs
          .filter(d => {
            // Exclude anonymous PIN users — they have no email/displayName
            // or are explicitly flagged as anonymous. They must not appear here.
            const isAnon = d.data().isAnonymous || (!d.data().email && !d.data().displayName);
            return !isAnon;
          })
          .map(d => ({
            id: d.id,
            name: d.data().displayName || d.data().name || (d.data().email ? d.data().email.split('@')[0] : 'Unknown User'),
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

  const staffCount = users.filter(u => u.role !== 'viewer').length;
  const viewersCount = users.filter(u => u.role === 'viewer').length;
  const totalCount = users.length;

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const textMatch = !query || 
      user.name.toLowerCase().includes(query) || 
      user.email.toLowerCase().includes(query) || 
      user.academy.toLowerCase().includes(query);

    let sectionMatch = true;
    if (section === 'staff') {
      sectionMatch = user.role !== 'viewer';
    } else if (section === 'viewers') {
      sectionMatch = user.role === 'viewer';
    }

    let roleMatch = true;
    if (roleFilter !== 'all') {
      roleMatch = user.role === roleFilter;
    }

    return textMatch && sectionMatch && roleMatch;
  });

  const handleDeleteUser = async (id: string) => {
    if (currentUser?.uid === id) {
      alert("You cannot delete your own account.");
      return;
    }
    const confirmDelete = window.confirm("Are you sure you want to completely remove this user? This cannot be undone.");
    if (!confirmDelete) return;
    
    try {
      const { db } = await import('@lib/firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

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
          grid-template-columns: minmax(320px, 1fr) 220px;
          align-items: center;
        }
        .search-wrap { position: relative; }
        .search-wrap svg {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--neutral-500); pointer-events: none;
        }
        .search-input, .filter-select {
          height: 40px; border: 1.5px solid var(--neutral-300); border-radius: 8px;
          font-family: var(--font-body); font-size: 13px; color: var(--neutral-900);
          background: var(--shiro); outline: none; transition: border-color 160ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 160ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .search-input { width: 100%; padding: 0 12px 0 38px; }
        .filter-select { width: 100%; padding: 0 10px; cursor: pointer; }
        .search-input:focus, .filter-select:focus {
          border-color: var(--ao); box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12);
        }
        .users-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
        .users-table th {
          text-align: left; padding: 14px 24px; background: var(--neutral-50);
          border-bottom: 1px solid var(--neutral-300); white-space: nowrap;
          color: var(--neutral-600); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .users-table td {
          padding: 16px 24px; border-bottom: 1px solid var(--neutral-200); vertical-align: top;
          background: var(--shiro); transition: background-color 160ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .users-table tr:last-child td { border-bottom: none; }
        .users-table tr:hover td { background: var(--neutral-50); }
        .name-cell {
          font-weight: 600; color: var(--neutral-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-top: 22px !important;
        }
        .email-cell {
          font-weight: 500; color: var(--neutral-600); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-family: var(--font-mono); font-size: 12px; padding-top: 22px !important;
        }
        .inline-select-wrap { position: relative; width: fit-content; min-width: 160px; }
        .inline-select {
          width: 100%; appearance: none; padding: 8px 32px 8px 12px;
          border: 1.5px solid transparent; border-radius: 8px;
          font-family: var(--font-body); font-size: 13px; font-weight: 600; color: var(--neutral-900);
          background: transparent; outline: none; cursor: pointer;
          transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .inline-select:hover { background: var(--neutral-100); border-color: var(--neutral-200); }
        .inline-select:focus { background: var(--shiro); border-color: var(--ao); box-shadow: 0 0 0 3px rgba(26, 77, 181, 0.12); }
        .inline-select-wrap::after {
          content: ''; position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid var(--neutral-500);
          pointer-events: none; transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .inline-select:focus + .inline-select-wrap::after, .inline-select-wrap:focus-within::after { transform: translateY(-50%) rotate(180deg); }
        .role-desc { font-size: 11px; color: var(--neutral-500); margin-top: 6px; padding-left: 12px; line-height: 1.4; font-weight: 500; }
        
        .empty-state { padding: 80px 24px; text-align: center; }
        .empty-icon { margin: 0 auto 20px; width: 56px; height: 56px; color: var(--neutral-400); background: var(--neutral-100); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .empty-title { font-weight: 600; color: var(--neutral-900); font-size: 16px; margin-bottom: 6px; }
        .empty-desc { color: var(--neutral-500); font-size: 14px; }
        
        .action-cell {
           padding-top: 22px !important; text-align: right;
        }
        .action-cell-inner {
           display: flex; align-items: center; justify-content: flex-end; gap: 12px;
        }
        
        .saved-chip {
          display: inline-flex; align-items: center;
          font-size: 11px; font-weight: 700; color: var(--status-live);
          text-transform: uppercase; letter-spacing: 0.05em;
          background: rgba(39, 174, 96, 0.1); padding: 4px 8px; border-radius: 6px;
          opacity: 0; transform: translateY(4px); transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none; white-space: nowrap;
        }
        .saved-chip.visible { opacity: 1; transform: translateY(0); }
        @starting-style {
          .saved-chip.visible { opacity: 0; transform: translateY(4px); }
        }
        
        .delete-btn {
          background: transparent; border: none; color: var(--neutral-400); padding: 8px; border-radius: 8px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .delete-btn:hover:not(:disabled) { color: var(--aka); background: rgba(220, 38, 38, 0.08); }
        .delete-btn:active:not(:disabled) { transform: scale(0.92); }
        .delete-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .section-nav {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          background: var(--shiro);
          border-bottom: 1px solid var(--neutral-300);
        }
        .section-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1.5px solid transparent;
          background: transparent;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: var(--neutral-600);
          cursor: pointer;
          transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .section-btn:hover {
          background: var(--neutral-100);
          color: var(--neutral-900);
        }
        .section-btn.active {
          background: var(--neutral-900);
          color: var(--shiro);
        }
        .section-badge {
          display: inline-block;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.08);
          color: inherit;
        }
        .section-btn.active .section-badge {
          background: rgba(255, 255, 255, 0.2);
          color: var(--shiro);
        }
        .section-banner {
          padding: 12px 24px;
          background: #eff6ff;
          border-bottom: 1px solid #bfdbfe;
          font-size: 13px;
          line-height: 1.5;
          color: #1e40af;
          display: flex;
          align-items: center;
          gap: 10px;
        }

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
          {/* Section Navigation Tabs: Staff & Officials vs Audience Viewers vs All */}
          <div className="section-nav">
            <button 
              type="button"
              className={`section-btn ${section === 'staff' ? 'active' : ''}`}
              onClick={() => { setSection('staff'); setRoleFilter('all'); }}
            >
              Staff & Officials <span className="section-badge">{staffCount}</span>
            </button>
            <button 
              type="button"
              className={`section-btn ${section === 'viewers' ? 'active' : ''}`}
              onClick={() => { setSection('viewers'); setRoleFilter('all'); }}
            >
              Audience Viewers <span className="section-badge">{viewersCount}</span>
            </button>
            <button 
              type="button"
              className={`section-btn ${section === 'all' ? 'active' : ''}`}
              onClick={() => { setSection('all'); setRoleFilter('all'); }}
            >
              All Users <span className="section-badge">{totalCount}</span>
            </button>
          </div>

          {section === 'viewers' && (
            <div className="section-banner">
              <div>
                <strong>Audience Viewers ({viewersCount})</strong>: Registered audience who signed in to view tournament matches, live brackets, and schedules. They do not have access to administrative controls. You can elevate any viewer to an official role or Guest Viewer using the role selector below.
              </div>
            </div>
          )}

          <div className="users-header">
            <div className="search-wrap">
              <Search size={16} />
              <input 
                className="search-input" 
                type="text" 
                placeholder="Search by name, email, or academy..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              className="filter-select" 
              value={roleFilter} 
              onChange={e => {
                const val = e.target.value;
                setRoleFilter(val);
                if (val === 'viewer') {
                  setSection('viewers');
                } else if (val !== 'all' && section === 'viewers') {
                  setSection('staff');
                }
              }}
            >
              <option value="all">
                {section === 'staff' ? 'Filter by Role (All Staff & Officials)' : section === 'viewers' ? 'Filter by Role (All Viewers)' : 'Filter by Role (All Users)'}
              </option>
              {section === 'staff' && (
                <>
                  <option value="admin">Admin</option>
                  <option value="mat_operator">Mat Operator</option>
                  <option value="attendance_volunteer">Attendance Volunteer</option>
                  <option value="judge">Kata Judge</option>
                  <option value="guest_viewer">Guest Viewer</option>
                  <option value="medal_distributor">Medal Distributor</option>
                </>
              )}
              {section === 'viewers' && (
                <option value="viewer">Viewer</option>
              )}
              {section === 'all' && (
                ROLES.map(role => (
                  <option key={role} value={role}>{ROLE_MAP[role]}</option>
                ))
              )}
            </select>
          </div>

          <div className="table-responsive">
          <table className="users-table">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>User Name</th>
                <th>User Email / Gmail</th>
                <th>Role</th>
                <th>Academy</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-title">Loading users...</div>
                      <div className="empty-desc">Fetching user data from the database.</div>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <Search size={24} />
                      </div>
                      <div className="empty-title">
                        {section === 'viewers' ? 'No audience viewers found' : 'No users found'}
                      </div>
                      <div className="empty-desc">
                        {section === 'viewers'
                          ? 'Audience members who log in to the app will appear here.'
                          : 'Try adjusting your search or role filters.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td className="name-cell" title={user.name}>{user.name}</td>
                    <td className="email-cell" title={user.email}>{user.email}</td>
                    <td>
                      <div className="inline-select-wrap">
                        <select 
                          className="inline-select" 
                          value={user.role} 
                          onChange={e => updateUserField(user.id, 'role', e.target.value)}
                        >
                          {ROLES.map(role => <option key={role} value={role}>{ROLE_MAP[role]}</option>)}
                        </select>
                      </div>
                      <div className="role-desc">
                        {ROLE_DESCRIPTIONS[user.role]}
                      </div>
                    </td>
                    <td>
                      <div className="inline-select-wrap">
                        <select 
                          className="inline-select" 
                          value={user.academy} 
                          onChange={e => updateUserField(user.id, 'academy', e.target.value)}
                        >
                          {ACADEMIES.map(academy => <option key={academy} value={academy}>{academy}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="action-cell">
                      <div className="action-cell-inner">
                        <span className={`saved-chip ${savedStatus[user.id] ? 'visible' : ''}`}>Saved</span>
                        <button 
                          className="delete-btn"
                          onClick={() => handleDeleteUser(user.id)}
                          title={currentUser?.uid === user.id ? "Cannot delete yourself" : "Delete User"}
                          disabled={currentUser?.uid === user.id}
                        >
                          <Trash2 size={18} />
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
