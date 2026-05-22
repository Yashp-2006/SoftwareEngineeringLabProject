'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

const ROLES = [
  "Admin",
  "Scoreboard Controller",
  "Attendance Volunteer",
  "Medal Distributor",
  "Viewer"
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Admin": "Full control (Read/Write)",
  "Scoreboard Controller": "Score mat, manage tiesheet, points",
  "Attendance Volunteer": "Athlete page, ready status, disqualify",
  "Medal Distributor": "Filter state/country, distribute",
  "Viewer": "Read-only access"
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

const INITIAL_USERS = [
  { id: "U001", name: "Naoki Tanaka", email: "naoki.admin@gmail.com", role: "Admin", academy: "Kyoto Shotokan Club" },
  { id: "U002", name: "Aiko Matsuda", email: "aiko.director@gmail.com", role: "Medal Distributor", academy: "Osaka Budokan Academy" },
  { id: "U003", name: "Ren Fujimoto", email: "ren.referee@gmail.com", role: "Scoreboard Controller", academy: "Tokyo Seido Dojo" },
  { id: "U004", name: "Mei Kuroda", email: "mei.operator@gmail.com", role: "Attendance Volunteer", academy: "Nara Combat Academy" },
  { id: "U005", name: "Takeshi Ono", email: "takeshi.coach@gmail.com", role: "Scoreboard Controller", academy: "Kyoto Shotokan Club" },
  { id: "U006", name: "Hana Watanabe", email: "hana.viewer@gmail.com", role: "Viewer", academy: "No Academy" },
  { id: "U007", name: "Sora Kimura", email: "sora.operator@gmail.com", role: "Attendance Volunteer", academy: "Kobe Wadoryu Center" },
  { id: "U008", name: "Emma Ricci", email: "emma.referee@gmail.com", role: "Viewer", academy: "International Guest Team" },
  { id: "U009", name: "Kenji Sato", email: "kenji.sato@example.com", role: "Scoreboard Controller", academy: "No Academy" },
  { id: "U010", name: "Maria Garcia", email: "maria.garcia@madridelite.es", role: "Viewer", academy: "Madrid Elite Karate" },
  { id: "U011", name: "Lucas Rossi", email: "lucas.r@gmail.com", role: "Viewer", academy: "International Guest Team" },
  { id: "U012", name: "Amina Ndiaye", email: "amina.ndiaye@cairochampions.eg", role: "Attendance Volunteer", academy: "Cairo Champions Club" },
  { id: "U013", name: "Rafael Silva", email: "rafa.silva@saopaulo.br", role: "Medal Distributor", academy: "São Paulo Strikers" },
  { id: "U014", name: "John Smith", email: "jsmith@usanational.org", role: "Admin", academy: "USA National Dev Team" },
  { id: "U015", name: "Yuki Takahashi", email: "yuki.t@gmail.com", role: "Scoreboard Controller", academy: "Tokyo Seido Dojo" },
  { id: "U016", name: "Chloe Dupont", email: "chloe.dupont@guest.fr", role: "Viewer", academy: "International Guest Team" },
  { id: "U017", name: "Hiroshi Nakamura", email: "hiroshi.nakamura@kyoto.jp", role: "Scoreboard Controller", academy: "Kyoto Shotokan Club" },
  { id: "U018", name: "Sakura Ito", email: "sakura.ito@osaka.jp", role: "Medal Distributor", academy: "Osaka Budokan Academy" },
  { id: "U019", name: "Daiki Kobayashi", email: "daiki.k@gmail.com", role: "Attendance Volunteer", academy: "Nara Combat Academy" },
  { id: "U020", name: "Yui Yamamoto", email: "yui.yamamoto@kobe.jp", role: "Scoreboard Controller", academy: "Kobe Wadoryu Center" },
  { id: "U021", name: "Carlos Mendez", email: "carlos.m@madridelite.es", role: "Attendance Volunteer", academy: "Madrid Elite Karate" },
  { id: "U022", name: "Isabella Costa", email: "isabella.c@saopaulo.br", role: "Viewer", academy: "São Paulo Strikers" },
  { id: "U023", name: "Omar Hassan", email: "omar.hassan@cairochampions.eg", role: "Attendance Volunteer", academy: "Cairo Champions Club" },
  { id: "U024", name: "Sarah Johnson", email: "sarah.j@usanational.org", role: "Scoreboard Controller", academy: "USA National Dev Team" },
  { id: "U025", name: "Kaito Suzuki", email: "kaito.suzuki@gmail.com", role: "Viewer", academy: "No Academy" }
];

export default function UsersPage() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [academyFilter, setAcademyFilter] = useState("all");

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

  const updateUserField = (id: string, field: 'role' | 'academy', value: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
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
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select className="filter-select" value={academyFilter} onChange={e => setAcademyFilter(e.target.value)}>
              <option value="all">Filter by Academy (All)</option>
              {ACADEMIES.map(academy => (
                <option key={academy} value={academy}>{academy}</option>
              ))}
            </select>
          </div>

          <table className="users-table">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '31%' }} />
              <col style={{ width: '22.5%' }} />
              <col style={{ width: '22.5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-micro">User Name</th>
                <th className="text-micro">User Email / Gmail</th>
                <th className="text-micro">Role</th>
                <th className="text-micro">Academy</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
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
                        {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
