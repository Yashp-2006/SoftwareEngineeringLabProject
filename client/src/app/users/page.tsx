'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/modules/auth/components/AuthProvider';

const ROLE_MAP: Record<string, string> = {
  'admin': 'Admin',
  'mat_operator': 'Mat Operator',
  'attendance_volunteer': 'Attendance Volunteer',
  'medal_distributor': 'Medal Distributor',
  'guest_viewer': 'Guest Viewer',
  'judge': 'Judge'
};

const ROLES = Object.keys(ROLE_MAP);

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "admin": "Full control (Read/Write)",
  "mat_operator": "Score mat, manage tiesheet, points",
  "attendance_volunteer": "Athlete page, ready status, disqualify",
  "medal_distributor": "Filter state/country, distribute",
  "guest_viewer": "Read-only access",
  "judge": "Provide inputs for judging matches"
};

const getNormalizedRole = (role: string) => {
  if (!role) return 'guest_viewer';
  const lower = role.toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower.includes('score') || lower.includes('mat')) return 'mat_operator';
  if (lower.includes('attendance')) return 'attendance_volunteer';
  if (lower.includes('medal')) return 'medal_distributor';
  if (lower.includes('judge')) return 'judge';
  if (lower.includes('viewer') || lower.includes('audience')) return 'guest_viewer';
  
  if (ROLE_MAP[role]) return role;
  return 'guest_viewer'; // Prevent default select mismatch selecting admin
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
        const data = snap.docs.map(d => {
          const isAnon = d.data().isAnonymous || (!d.data().email && !d.data().displayName);
          return {
            id: d.id,
            name: isAnon ? 'Anonymous PIN Login' : (d.data().displayName || d.data().name || (d.data().email ? d.data().email.split('@')[0] : 'Unknown User')),
            email: d.data().email || 'No email',
            role: getNormalizedRole(d.data().role),
            academy: d.data().academy || 'No Academy'
          };
        }) as User[];
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
    return textMatch && roleMatch;
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
              <Search size={16} />
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
                      <div className="empty-title">No users found</div>
                      <div className="empty-desc">Try adjusting your search or role filters.</div>
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
