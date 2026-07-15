'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import PageSkeleton from '@/components/layout/PageSkeleton';
import { sortCategories } from '@/lib/categoryUtils';

interface Athlete {
  id: string;
  name: string;
  academy: string;
  attendance: 'present' | 'absent';
  readiness: 'ready' | 'not-ready';
  disqualified: boolean;
  pool: string;
  coachName?: string;
  phone?: string;
  state?: string;
}

interface Category {
  id: string;
  name: string;
  mat: string;
  status: string;
  athletes: Athlete[];
}

export default function AthletesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { user, role, loading: authLoading } = useAuth();
  const [verified, setVerified] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [poolFilter, setPoolFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const canWrite = role === 'admin' || role === 'attendance_volunteer' || staffRole === 'attendance_volunteer';

  useEffect(() => {
    if (authLoading) return;
    
    // Admins bypass staff check
    if (role === 'admin') {
      setVerified(true);
      return;
    }
    
    const checkStaff = async () => {
      try {
        const { db } = await import('@lib/firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        
        // 1. Check if matched by UID
        let q = query(collection(db, 'competitions', id, 'staff'), where('userId', '==', user.uid));
        let snap = await getDocs(q);
        
        if (snap.empty && user.email) {
          // 2. Check if matched by email
          q = query(collection(db, 'competitions', id, 'staff'), where('email', '==', user.email));
          snap = await getDocs(q);
        }

        if (snap.empty) {
          window.location.href = `/login?compId=${id}`;
          return;
        }
        
        const staffDoc = snap.docs[0];
        const staffData = staffDoc.data();
        
        if (staffData.approvalStatus === 'approved') {
          setStaffRole(staffData.role);
          // Auto-select their assigned category if it exists!
          if (staffData.assignedCategories && staffData.assignedCategories.length > 0) {
            // Find corresponding category ID later once loaded
          }
          setVerified(true);
        } else {
          window.location.href = `/login/pending?compId=${id}&staffId=${staffDoc.id}`;
        }
      } catch (err) {
        console.error('Error verifying staff assignment:', err);
        setVerified(true);
      }
    };
    
    checkStaff();
  }, [user, role, authLoading, id]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const addingAthleteRef = useRef(false);
  const [addForm, setAddForm] = useState({
    name: '', academy: '', age: '', weight: '', gender: 'Male', categoryId: '',
    phone: '', email: '', coachName: '', interestSpecialIds: [] as string[]
  });
  const [specialCategories, setSpecialCategories] = useState<any[]>([]);

  // Load categories from Firestore — extract athletes from matches
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const setup = async () => {
      const [{ db }, { collection, onSnapshot, query, orderBy }] = await Promise.all([
        import('@lib/firebase'),
        import('firebase/firestore')
      ]);

      const catQ = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubscribe = onSnapshot(catQ, (catSnap) => {
        const catList: Category[] = catSnap.docs.map(d => {
          const data = d.data();
          const rawAthletes: any[] = data.athletes || [];
          const matches: any[] = data.matches || [];

          const poolMap: Record<string, string> = {};
          matches.forEach((m: any) => {
            const p = m.pool || (m.id && m.id.includes('Pool') ? m.id.split('-')[0].replace('Pool', '') : '');
            if (p) {
              if (m.aka?.playerId) poolMap[m.aka.playerId] = p;
              else if (m.aka?.name) poolMap[m.aka.name] = p;
              if (m.ao?.playerId) poolMap[m.ao.playerId] = p;
              else if (m.ao?.name) poolMap[m.ao.name] = p;
            }
          });

          return {
            id: d.id,
            name: data.name || '',
            mat: data.mat || 'UNASSIGNED',
            status: data.status || 'upcoming',
            athletes: rawAthletes.map(a => ({
              id: a.playerId || a.name,
              name: a.name,
              academy: a.academy || '',
              attendance: a.attendance || 'present',
              readiness: a.readiness || 'not-ready',
              disqualified: a.disqualified || false,
              pool: poolMap[a.playerId || a.name] || '',
              coachName: a.coachName || '',
              phone: a.phone || '',
              state: a.state || '',
            })).sort((a, b) => a.name.localeCompare(b.name)),
          };
        });

        const sorted = sortCategories(catList);
        setCategories(sorted);
        setActiveCategoryId(prev => prev ?? sorted[0]?.id ?? null);
        setLoading(false);
      });
    };

    setup();
    return () => unsubscribe();
  }, [id]);

  // Load special categories for the radar selector
  useEffect(() => {
    const loadSpecials = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      try {
        const q = query(collection(db, 'competitions', id, 'categories'), where('isSpecial', '==', true));
        const snap = await getDocs(q);
        setSpecialCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        // If no special categories, silently ignore
      }
    };
    loadSpecials();
  }, [id]);

  const activeCategory = categories.find(c => c.id === activeCategoryId);

  const filteredAthletes = activeCategory?.athletes.filter(a => {
    if (poolFilter && a.pool !== poolFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.academy.toLowerCase().includes(q);
  }) || [];

  const handleUpdate = async (
    athleteId: string,
    field: keyof Athlete,
    value: string | boolean
  ) => {
    if (!canWrite) return;
    
    // Optimistic UI
    setCategories(prev =>
      prev.map(cat => {
        if (cat.id !== activeCategoryId) return cat;
        return {
          ...cat,
          athletes: cat.athletes.map(a => a.id === athleteId ? { ...a, [field]: value } : a),
        };
      })
    );

    // Persist to Firestore — update both athletes array and matches array
    try {
      const { db } = await import('@lib/firebase');
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      const catRef = doc(db, 'competitions', id, 'categories', activeCategoryId!);
      const catSnap = await getDoc(catRef);
      if (!catSnap.exists()) return;

      const data = catSnap.data();
      
      const updatedAthletes = (data.athletes || []).map((a: any) => {
        if (a.playerId === athleteId || a.name === athleteId) {
          return { ...a, [field]: value };
        }
        return a;
      });

      const updatedMatches = (data.matches || []).map((m: any) => {
        const newM = { ...m };
        if (m.aka && (m.aka.playerId === athleteId || m.aka.name === athleteId)) {
          newM.aka = { ...m.aka, [field]: value };
        }
        if (m.ao && (m.ao.playerId === athleteId || m.ao.name === athleteId)) {
          newM.ao = { ...m.ao, [field]: value };
        }
        return newM;
      });

      await updateDoc(catRef, { athletes: updatedAthletes, matches: updatedMatches });

      // AUTO-PROMOTE: if athlete is disqualified, find their first incomplete match and promote opponent
      if (field === 'disqualified' && value === true) {
        const dqMatch = updatedMatches.find((m: any) =>
          m.status !== 'completed' &&
          ((m.aka?.playerId === athleteId || m.aka?.name === athleteId) ||
           (m.ao?.playerId === athleteId || m.ao?.name === athleteId))
        );

        if (dqMatch) {
          const isAkaDq = dqMatch.aka?.playerId === athleteId || dqMatch.aka?.name === athleteId;
          const winnerId = isAkaDq ? (dqMatch.ao?.playerId || dqMatch.ao?.name) : (dqMatch.aka?.playerId || dqMatch.aka?.name);
          const byeFor: 'aka' | 'ao' = isAkaDq ? 'aka' : 'ao';

          if (winnerId) {
            await fetch(`/api/competitions/${id}/brackets/${activeCategoryId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchId: dqMatch.id, winnerId, byeFor }),
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to update athlete field', err);
    }
  };

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingAthleteRef.current) return; // prevent double-submit
    addingAthleteRef.current = true;
    setAddingAthlete(true);
    try {
      const res = await fetch(`/api/competitions/${id}/athletes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: addForm.categoryId,
          athleteData: {
            name: addForm.name,
            academy: addForm.academy,
            age: parseInt(addForm.age),
            weight: parseFloat(addForm.weight),
            gender: addForm.gender,
            phone: addForm.phone,
            email: addForm.email,
            coachName: addForm.coachName,
            interestSpecial: addForm.interestSpecialIds.join(', '),
          }
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setIsAddModalOpen(false);
      setAddForm({ name: '', academy: '', age: '', weight: '', gender: 'Male', categoryId: '',
        phone: '', email: '', coachName: '', interestSpecialIds: [] });
      toast.success('Athlete added successfully!');
    } catch (err: any) {
      toast.error(`Failed to add athlete: ${err.message}`);
    } finally {
      addingAthleteRef.current = false;
      setAddingAthlete(false);
    }
  };

  if (!verified && role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--neutral-50)' }}>
        <p style={{ color: 'var(--neutral-500)', fontSize: '14px', fontWeight: 600 }}>Verifying credentials and assignments...</p>
      </div>
    );
  }

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
          max-height: calc(100vh - 150px);
          overflow-y: auto;
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
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal {
          background: white; border-radius: 12px; width: 100%; max-width: 500px;
          padding: var(--space-6); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 10px; border: 1px solid var(--neutral-300); border-radius: 6px; }
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
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="breadcrumb">
              <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
            </div>
            <h1>Athletes Attendance</h1>
          </div>
          {role === 'admin' && (
            <button className="btn btn-primary" onClick={() => {
              setAddForm(p => ({ ...p, categoryId: activeCategoryId || '' }));
              setIsAddModalOpen(true);
            }}>
              Add On-Spot Entry
            </button>
          )}
        </header>

        {loading ? (
          <PageSkeleton />
        ) : categories.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--neutral-900)', marginBottom: '8px' }}>No Categories Found</h3>
            <p style={{ color: 'var(--neutral-500)' }}>Deploy the tournament setup to generate categories and athlete rosters.</p>
          </div>
        ) : (
          <section className="athletes-layout">
            <aside className="category-panel">
              <div style={{ padding: '12px', borderBottom: '1px solid var(--neutral-200)' }}>
                <input 
                  type="text" 
                  placeholder="Search categories..." 
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="search-input"
                  style={{ width: '100%', height: '32px' }}
                />
              </div>
              {categories.filter(cat => cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())).map(cat => (
                <button
                  key={cat.id}
                  className={`category-button ${cat.id === activeCategoryId ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    setSearchQuery('');
                  }}
                >
                  <div className="category-name">{cat.name}</div>
                  <div className="category-meta">
                    <span>{cat.mat}</span>
                    <span>{cat.status.toUpperCase()}</span>
                  </div>
                </button>
              ))}
            </aside>

            <div className="athletes-panel">
              <div className="athletes-panel-header">
                <div>
                  <h2>{activeCategory?.name}</h2>
                  <div className="text-small">
                    {activeCategory?.mat} • {activeCategory?.status.toUpperCase()} • {filteredAthletes.length} athletes
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select 
                    value={poolFilter}
                    onChange={e => setPoolFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--neutral-300)', fontSize: '13px', background: 'white' }}
                  >
                    <option value="">All Pools</option>
                    {Array.from(new Set(activeCategory?.athletes.map(a => a.pool).filter(Boolean)))
                      .sort((a, b) => parseInt(String(a)) - parseInt(String(b)))
                      .map(p => (
                      <option key={String(p)} value={String(p)}>Pool {String(p)}</option>
                    ))}
                  </select>
                  <div className="search-wrap">
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)' }} />
                    <input
                      className="search-input"
                      type="text"
                      placeholder="Search athlete or academy..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="table-responsive">
              <table className="athlete-table">
                <thead>
                  <tr>
                    <th className="text-micro">Athlete Name</th>
                    <th className="text-micro">Academy</th>
                    <th className="text-micro">Coach</th>
                    <th className="text-micro">Contact / State</th>
                    <th className="text-micro">Present / Absent</th>
                    <th className="text-micro">Ready / Not Ready</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        {activeCategory?.athletes.length === 0
                          ? 'No athletes registered for this category yet.'
                          : 'No athletes match your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAthletes.map(athlete => (
                      <tr key={athlete.id}>
                        <td>{athlete.name}</td>
                        <td className="academy-name">{athlete.academy}</td>
                        <td className="academy-name" style={{ fontSize: '13px', color: 'var(--neutral-600)' }}>{athlete.coachName || <span style={{color:'var(--neutral-400)',fontStyle:'italic'}}>—</span>}</td>
                        <td style={{ fontSize: '12px' }}>
                          <div>{athlete.phone || <span style={{color:'var(--neutral-400)',fontStyle:'italic'}}>—</span>}</div>
                          {athlete.state && <div style={{color:'var(--neutral-500)',fontSize:'11px'}}>{athlete.state}</div>}
                        </td>
                        <td>
                          <div className="attendance-control" style={{ opacity: role === 'guest_viewer' ? 0.6 : 1, pointerEvents: role === 'guest_viewer' ? 'none' : 'auto' }}>
                            <button
                              className={`attendance-btn present ${athlete.attendance === 'present' ? 'active' : ''}`}
                              onClick={() => handleUpdate(athlete.id, 'attendance', 'present')}
                              disabled={role === 'guest_viewer'}
                            >Present</button>
                            <button
                              className={`attendance-btn absent ${athlete.attendance === 'absent' ? 'active' : ''}`}
                              onClick={() => handleUpdate(athlete.id, 'attendance', 'absent')}
                              disabled={role === 'guest_viewer'}
                            >Absent</button>
                          </div>
                        </td>
                        <td>
                          <div className="attendance-control" style={{ opacity: role === 'guest_viewer' ? 0.6 : 1, pointerEvents: role === 'guest_viewer' ? 'none' : 'auto' }}>
                            <button
                              className={`attendance-btn present ${athlete.readiness === 'ready' ? 'active' : ''}`}
                              onClick={() => handleUpdate(athlete.id, 'readiness', 'ready')}
                              disabled={role === 'guest_viewer'}
                            >Ready</button>
                            <button
                              className={`attendance-btn neutral ${athlete.readiness === 'not-ready' ? 'active' : ''}`}
                              onClick={() => handleUpdate(athlete.id, 'readiness', 'not-ready')}
                              disabled={role === 'guest_viewer'}
                            >Not Ready</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </section>
        )}

        {isAddModalOpen && (
          <div className="modal-overlay" onClick={() => !addingAthlete && setIsAddModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: '20px' }}>Add On-Spot Entry</h2>
              <form onSubmit={handleAddAthlete}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input required className="form-input" value={addForm.name} onChange={e => setAddForm(p => ({...p, name: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>Academy / Dojo</label>
                  <input required className="form-input" value={addForm.academy} onChange={e => setAddForm(p => ({...p, academy: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>Coach Name</label>
                  <input className="form-input" placeholder="Coach's full name" value={addForm.coachName} onChange={e => setAddForm(p => ({...p, coachName: e.target.value}))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" className="form-input" placeholder="e.g. +91 98765 43210" value={addForm.phone} onChange={e => setAddForm(p => ({...p, phone: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="form-input" placeholder="athlete@email.com" value={addForm.email} onChange={e => setAddForm(p => ({...p, email: e.target.value}))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Age</label>
                    <input required type="number" className="form-input" value={addForm.age} onChange={e => setAddForm(p => ({...p, age: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input required type="number" step="0.1" className="form-input" value={addForm.weight} onChange={e => setAddForm(p => ({...p, weight: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select className="form-input" value={addForm.gender} onChange={e => setAddForm(p => ({...p, gender: e.target.value}))}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select required className="form-input" value={addForm.categoryId} onChange={e => setAddForm(p => ({...p, categoryId: e.target.value}))}>
                    <option value="" disabled>Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.athletes.length} athletes)</option>)}
                  </select>
                </div>
                {specialCategories.length > 0 && (
                  <div className="form-group">
                    <label>Interest in Special Categories</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', padding: '12px', border: '1px solid var(--neutral-300)', borderRadius: '8px', background: 'var(--neutral-50)' }}>
                      {specialCategories.map(sc => {
                        const checked = addForm.interestSpecialIds.includes(sc.id);
                        return (
                          <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                            <span style={{
                              width: '20px', height: '20px', border: `2px solid ${checked ? 'var(--ao)' : 'var(--neutral-300)'}`,
                              borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: checked ? 'var(--ao)' : 'white', flexShrink: 0, transition: 'all 0.15s'
                            }}>
                              {checked && <span style={{ color: 'white', fontWeight: 900, fontSize: '13px', lineHeight: 1 }}>&#10003;</span>}
                            </span>
                            <input type="checkbox" style={{ display: 'none' }} checked={checked} onChange={() => {
                              setAddForm(p => ({
                                ...p,
                                interestSpecialIds: checked
                                  ? p.interestSpecialIds.filter(x => x !== sc.id)
                                  : [...p.interestSpecialIds, sc.id]
                              }));
                            }} />
                            <span>{sc.name}</span>
                            {sc.medal && <span style={{ fontSize: '11px', color: 'var(--neutral-500)', fontWeight: 600 }}>({sc.medal})</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={addingAthlete}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={addingAthlete}>
                    {addingAthlete ? 'Adding...' : 'Add Athlete'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
