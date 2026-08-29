'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Edit, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/modules/auth/components/AuthProvider';
import PageSkeleton from '@/modules/core/layout/PageSkeleton';

interface AthleteRecord {
  categoryId: string;
  categoryName: string;
  id: string; // playerId
  name: string;
  gender: string;
  age: number;
  weight: number;
  academy: string;
  state: string;
  coachName?: string;
  phone?: string;
  email?: string;
}

export default function PlayerRecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { role } = useAuth();
  const [records, setRecords] = useState<AthleteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingRecord, setEditingRecord] = useState<AthleteRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [originalCategoryId, setOriginalCategoryId] = useState<string>('');
  const [formOfPlaying, setFormOfPlaying] = useState<'kata' | 'kumite' | 'custom'>('kumite');

  // Filter & Pagination States
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterAgeRange, setFilterAgeRange] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const setup = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');

      const catQ = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      let debounceTimer: NodeJS.Timeout | null = null;
      unsubscribe = onSnapshot(catQ, (catSnap) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        const docs = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        debounceTimer = setTimeout(() => {
          const allRecords: AthleteRecord[] = [];
          setCategoriesList(docs);
          
          docs.forEach(d => {
            const rawAthletes: any[] = d.athletes || [];
            
            rawAthletes.forEach(a => {
              allRecords.push({
                categoryId: d.id,
                categoryName: d.name || '',
                id: a.playerId || a.name,
                name: a.name || '',
                gender: a.gender || 'male',
                age: a.age || 0,
                weight: a.weight || 0,
                academy: a.academy || '',
                state: a.state || '',
                coachName: a.coachName || '',
                phone: a.phone || '',
                email: a.email || ''
              });
            });
          });

          // Sort alphabetically by name
          allRecords.sort((a, b) => a.name.localeCompare(b.name));
          setRecords(allRecords);
          setLoading(false);
        }, 200);
      });
    };

    setup();
    return () => unsubscribe();
  }, [id]);

  const uniqueStates = Array.from(new Set(records.map(r => r.state).filter(Boolean))).sort();

  const filteredRecords = records.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = r.name.toLowerCase().includes(q) || r.academy.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    if (filterGender !== 'all') {
      if (r.gender.toLowerCase() !== filterGender.toLowerCase()) return false;
    }

    if (filterAgeRange !== 'all') {
      const age = r.age;
      if (filterAgeRange === 'u12' && age >= 12) return false;
      if (filterAgeRange === '12-14' && (age < 12 || age > 14)) return false;
      if (filterAgeRange === '15-17' && (age < 15 || age > 17)) return false;
      if (filterAgeRange === '18+' && age < 18) return false;
    }

    if (filterState !== 'all') {
      if (r.state.toLowerCase() !== filterState.toLowerCase()) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / 10);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * 10, currentPage * 10);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) {
        end = 3;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 2;
      }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');

      pages.push(totalPages);
    }
    return pages;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || role !== 'admin') return;
    setSaving(true);
    
    try {
      const { db } = await import('@lib/firebase');
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');

      if (editingRecord.categoryId !== originalCategoryId) {
        // Move athlete between categories
        const oldCatRef = doc(db, 'competitions', id, 'categories', originalCategoryId);
        const oldCatSnap = await getDoc(oldCatRef);
        if (!oldCatSnap.exists()) throw new Error('Old category not found');
        const oldCatData = oldCatSnap.data();
        
        // Remove athlete from old category
        const oldAthletes = (oldCatData.athletes || []).filter((a: any) => a.playerId !== editingRecord.id && a.name !== editingRecord.id);
        await updateDoc(oldCatRef, { athletes: oldAthletes });
        
        // Load new category
        const newCatRef = doc(db, 'competitions', id, 'categories', editingRecord.categoryId);
        const newCatSnap = await getDoc(newCatRef);
        if (!newCatSnap.exists()) throw new Error('New category not found');
        const newCatData = newCatSnap.data();
        
        // Create the athlete payload
        const newAthlete = {
          playerId: editingRecord.id,
          name: editingRecord.name,
          gender: editingRecord.gender,
          age: Number(editingRecord.age),
          weight: Number(editingRecord.weight),
          academy: editingRecord.academy,
          state: editingRecord.state,
          coachName: editingRecord.coachName || '',
          phone: editingRecord.phone || '',
          email: editingRecord.email || ''
        };
        
        // Add to new category
        const newAthletes = [...(newCatData.athletes || []), newAthlete];
        await updateDoc(newCatRef, { athletes: newAthletes });
        
        // Call regenerate for old category (if it has athletes left)
        if (oldAthletes.length > 0) {
          await fetch(`/api/competitions/${id}/brackets/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: originalCategoryId })
          });
        } else {
          // If no athletes are left, clear matches
          await updateDoc(oldCatRef, { matches: [] });
        }
        
        // Call regenerate for new category
        await fetch(`/api/competitions/${id}/brackets/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: editingRecord.categoryId })
        });
      } else {
        const catRef = doc(db, 'competitions', id, 'categories', editingRecord.categoryId);
        const catSnap = await getDoc(catRef);
        
        if (!catSnap.exists()) throw new Error('Category not found');
  
        const data = catSnap.data();
        
        // Update athletes array
        const updatedAthletes = (data.athletes || []).map((a: any) => {
          if (a.playerId === editingRecord.id || a.name === editingRecord.id) {
            return { 
              ...a, 
              name: editingRecord.name,
              gender: editingRecord.gender,
              age: Number(editingRecord.age),
              weight: Number(editingRecord.weight),
              academy: editingRecord.academy,
              state: editingRecord.state,
              coachName: editingRecord.coachName,
              phone: editingRecord.phone,
              email: editingRecord.email
            };
          }
          return a;
        });
  
        // Update matches array (both aka and ao)
        const updatedMatches = (data.matches || []).map((m: any) => {
          const newM = { ...m };
          if (m.aka && (m.aka.playerId === editingRecord.id || m.aka.name === editingRecord.id)) {
            newM.aka = { 
              ...m.aka, 
              name: editingRecord.name,
              gender: editingRecord.gender,
              age: Number(editingRecord.age),
              weight: Number(editingRecord.weight),
              academy: editingRecord.academy
            };
          }
          if (m.ao && (m.ao.playerId === editingRecord.id || m.ao.name === editingRecord.id)) {
            newM.ao = { 
              ...m.ao, 
              name: editingRecord.name,
              gender: editingRecord.gender,
              age: Number(editingRecord.age),
              weight: Number(editingRecord.weight),
              academy: editingRecord.academy
            };
          }
          return newM;
        });
  
        await updateDoc(catRef, { athletes: updatedAthletes, matches: updatedMatches });
      }
      toast.success('Record updated successfully');
      setEditingRecord(null);
    } catch (err: any) {
      toast.error('Failed to update record: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .records-panel {
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          overflow: hidden;
          margin-top: var(--space-4);
        }
        .records-header {
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--neutral-300);
          background: var(--neutral-50);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .search-wrap {
          position: relative;
          width: 320px;
        }
        .search-input {
          width: 100%;
          height: 38px;
          border: 1.5px solid var(--neutral-300);
          border-radius: 8px;
          padding: 0 12px 0 32px;
          font-size: 13px;
        }
        .search-input:focus {
          border-color: var(--ao);
          box-shadow: 0 0 0 3px rgba(26,77,181,0.12);
        }
        table.records-table {
          width: 100%;
          border-collapse: collapse;
        }
        .records-table thead th {
          text-align: left;
          padding: 12px 24px;
          background: var(--neutral-50);
          border-bottom: 1px solid var(--neutral-300);
          font-size: 11px;
          text-transform: uppercase;
          color: var(--neutral-500);
        }
        .records-table tbody td {
          padding: 14px 24px;
          border-bottom: 1px solid var(--neutral-100);
          font-size: 14px;
        }
        .records-table tbody tr:hover { background: var(--neutral-50); }
        .edit-btn {
          background: none; border: none; color: var(--ao); cursor: pointer;
          display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600;
        }
        .edit-btn:hover { text-decoration: underline; }
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal {
          background: white; border-radius: 12px; width: 100%; max-width: 600px;
          padding: var(--space-6); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 10px; border: 1px solid var(--neutral-300); border-radius: 6px; }

        /* Filter Button & Dropdown */
        .filter-btn {
          height: 38px;
          padding: 0 16px;
          background: var(--shiro);
          border: 1.5px solid var(--neutral-300);
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--neutral-700);
          cursor: pointer;
          transition: background 160ms var(--ease-out), border-color 160ms var(--ease-out);
        }
        .filter-btn:hover {
          background: var(--neutral-50);
          border-color: var(--neutral-400);
        }
        .filter-btn.active {
          border-color: var(--ao);
          color: var(--ao);
          background: rgba(26, 77, 181, 0.05);
        }
        .filter-dropdown {
          position: absolute;
          top: 46px;
          right: 0;
          background: var(--shiro);
          border: 1px solid var(--neutral-300);
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          padding: 16px;
          width: 280px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: filter-slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes filter-slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .filter-group label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--neutral-500);
          letter-spacing: 0.05em;
        }
        .filter-select {
          height: 34px;
          padding: 0 8px;
          border: 1px solid var(--neutral-300);
          border-radius: 6px;
          font-size: 13px;
          background: var(--shiro);
          outline: none;
        }
        .filter-select:focus {
          border-color: var(--ao);
        }

        /* Pagination Controls */
        .pagination-wrap {
          padding: var(--space-4) var(--space-5);
          border-top: 1px solid var(--neutral-200);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--neutral-50);
        }
        .pagination-info {
          font-size: 13px;
          color: var(--neutral-500);
        }
        .pagination-buttons {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .page-btn {
          height: 32px;
          min-width: 32px;
          padding: 0 8px;
          border: 1px solid var(--neutral-300);
          border-radius: 6px;
          background: var(--shiro);
          font-size: 13px;
          font-weight: 600;
          color: var(--neutral-700);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 160ms var(--ease-out), border-color 160ms var(--ease-out);
        }
        .page-btn:active:not(:disabled) { transform: scale(0.97); }
        .page-btn:hover:not(:disabled) {
          background: var(--neutral-100);
          border-color: var(--neutral-400);
        }
        .page-btn.active {
          background: var(--ao);
          border-color: var(--ao);
          color: white;
        }
        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}} />

      <main className="container">
        <header className="page-header">
          <div className="breadcrumb">
            <Link href="/competitions" style={{ color: 'inherit', textDecoration: 'none' }}>Competitions</Link> / {id} / Operations
          </div>
          <h1>Player Records</h1>
        </header>

        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="records-panel">
            <div className="records-header">
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>All Athletes</h2>
                <div style={{ fontSize: '13px', color: 'var(--neutral-500)' }}>
                  {filteredRecords.length !== records.length ? `${filteredRecords.length} filtered of ` : ''}
                  {records.length} total registered athletes
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
                <div className="search-wrap">
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)' }} />
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search by name, academy..."
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <button
                  type="button"
                  className={`filter-btn ${(filterGender !== 'all' || filterAgeRange !== 'all' || filterState !== 'all') ? 'active' : ''}`}
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <Filter size={14} />
                  Filters
                </button>

                {filterOpen && (
                  <div className="filter-dropdown">
                    <div className="filter-group">
                      <label>Gender</label>
                      <select
                        className="filter-select"
                        value={filterGender}
                        onChange={e => {
                          setFilterGender(e.target.value);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="all">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label>Age Group</label>
                      <select
                        className="filter-select"
                        value={filterAgeRange}
                        onChange={e => {
                          setFilterAgeRange(e.target.value);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="all">All Ages</option>
                        <option value="u12">Under 12</option>
                        <option value="12-14">12 - 14 yrs</option>
                        <option value="15-17">15 - 17 yrs</option>
                        <option value="18+">18+ (Senior)</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label>State / District</label>
                      <select
                        className="filter-select"
                        value={filterState}
                        onChange={e => {
                          setFilterState(e.target.value);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="all">All States</option>
                        {uniqueStates.map(st => (
                          <option key={st} value={st.toLowerCase()}>{st}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--neutral-500)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        onClick={() => {
                          setFilterGender('all');
                          setFilterAgeRange('all');
                          setFilterState('all');
                          setCurrentPage(1);
                          setFilterOpen(false);
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="table-responsive">
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Academy</th>
                    <th>Age / Weight / Gender</th>
                    <th>Contact</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--neutral-500)' }}>
                        No records found matching your search or filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map(record => (
                      <tr key={`${record.categoryId}-${record.id}`}>
                        <td style={{ fontWeight: 500 }}>{record.name}</td>
                        <td style={{ fontSize: '13px', color: 'var(--neutral-600)' }}>{record.categoryName}</td>
                        <td style={{ fontSize: '13px' }}>{record.academy}</td>
                        <td style={{ fontSize: '13px', color: 'var(--neutral-600)' }}>
                          {record.age} yrs • {record.weight} kg • <span style={{textTransform:'capitalize'}}>{record.gender}</span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--neutral-500)' }}>
                          <div>{record.phone || '—'}</div>
                          <div>{record.email || ''}</div>
                        </td>
                        <td>
                          {role === 'admin' && (
                            <button className="edit-btn" onClick={() => {
                              setEditingRecord({...record});
                              setOriginalCategoryId(record.categoryId);
                              const cat = categoriesList.find(c => c.id === record.categoryId);
                              let form: 'kata' | 'kumite' | 'custom' = 'kumite';
                              if (cat?.isSpecial) form = 'custom';
                              else if (cat?.isKata) form = 'kata';
                              setFormOfPlaying(form);
                            }}>
                              <Edit size={14} /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredRecords.length > 10 && (
              <div className="pagination-wrap">
                <div className="pagination-info">
                  Showing <strong>{(currentPage - 1) * 10 + 1}</strong> to{' '}
                  <strong>{Math.min(currentPage * 10, filteredRecords.length)}</strong> of{' '}
                  <strong>{filteredRecords.length}</strong> athletes
                </div>
                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    Prev
                  </button>
                  
                  {getPageNumbers().map((p, idx) => {
                    if (p === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} style={{ padding: '0 8px', color: 'var(--neutral-400)' }}>
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={`page-${p}`}
                        type="button"
                        className={`page-btn ${currentPage === p ? 'active' : ''}`}
                        onClick={() => setCurrentPage(Number(p))}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className="page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {editingRecord && (
          <div className="modal-overlay" onClick={() => !saving && setEditingRecord(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2 style={{ marginBottom: '20px' }}>Edit Player Record</h2>
              <form onSubmit={handleSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input required className="form-input" value={editingRecord.name} onChange={e => setEditingRecord({...editingRecord, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Academy / Dojo</label>
                    <input required className="form-input" value={editingRecord.academy} onChange={e => setEditingRecord({...editingRecord, academy: e.target.value})} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Age</label>
                    <input required type="number" className="form-input" value={editingRecord.age} onChange={e => setEditingRecord({...editingRecord, age: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input required type="number" step="0.1" className="form-input" value={editingRecord.weight} onChange={e => setEditingRecord({...editingRecord, weight: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select className="form-input" value={editingRecord.gender} onChange={e => setEditingRecord({...editingRecord, gender: e.target.value})}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" className="form-input" value={editingRecord.phone || ''} onChange={e => setEditingRecord({...editingRecord, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" className="form-input" value={editingRecord.email || ''} onChange={e => setEditingRecord({...editingRecord, email: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label>State / Region</label>
                  <input className="form-input" value={editingRecord.state || ''} onChange={e => setEditingRecord({...editingRecord, state: e.target.value})} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                  <div className="form-group">
                    <label>Form of Playing</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="formOfPlaying"
                          value="kata"
                          checked={formOfPlaying === 'kata'}
                          onChange={() => {
                            setFormOfPlaying('kata');
                            const firstKata = categoriesList.find(c => c.isKata && !c.isSpecial);
                            if (firstKata) {
                              setEditingRecord({ ...editingRecord, categoryId: firstKata.id, categoryName: firstKata.name });
                            } else {
                              setEditingRecord({ ...editingRecord, categoryId: '', categoryName: '' });
                            }
                          }}
                        />
                        Kata
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="formOfPlaying"
                          value="kumite"
                          checked={formOfPlaying === 'kumite'}
                          onChange={() => {
                            setFormOfPlaying('kumite');
                            const firstKumite = categoriesList.find(c => !c.isKata && !c.isSpecial);
                            if (firstKumite) {
                              setEditingRecord({ ...editingRecord, categoryId: firstKumite.id, categoryName: firstKumite.name });
                            } else {
                              setEditingRecord({ ...editingRecord, categoryId: '', categoryName: '' });
                            }
                          }}
                        />
                        Kumite
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="formOfPlaying"
                          value="custom"
                          checked={formOfPlaying === 'custom'}
                          onChange={() => {
                            setFormOfPlaying('custom');
                            const firstCustom = categoriesList.find(c => c.isSpecial);
                            if (firstCustom) {
                              setEditingRecord({ ...editingRecord, categoryId: firstCustom.id, categoryName: firstCustom.name });
                            } else {
                              setEditingRecord({ ...editingRecord, categoryId: '', categoryName: '' });
                            }
                          }}
                        />
                        Custom/Special
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      className="form-input"
                      value={editingRecord.categoryId}
                      onChange={e => {
                        const targetId = e.target.value;
                        const cat = categoriesList.find(c => c.id === targetId);
                        if (cat) {
                          setEditingRecord({ ...editingRecord, categoryId: targetId, categoryName: cat.name });
                        }
                      }}
                      style={{ overflowY: 'auto' }}
                    >
                      <option value="">Select Category...</option>
                      {categoriesList
                        .filter(c => {
                          if (formOfPlaying === 'kata') return c.isKata && !c.isSpecial;
                          if (formOfPlaying === 'kumite') return !c.isKata && !c.isSpecial;
                          return c.isSpecial;
                        })
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingRecord(null)} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
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
