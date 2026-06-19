'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import PageSkeleton from '@/components/layout/PageSkeleton';

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

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const setup = async () => {
      const { db } = await import('@lib/firebase');
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');

      const catQ = query(collection(db, 'competitions', id, 'categories'), orderBy('order'));
      unsubscribe = onSnapshot(catQ, (catSnap) => {
        const allRecords: AthleteRecord[] = [];
        
        catSnap.docs.forEach(d => {
          const data = d.data();
          const rawAthletes: any[] = data.athletes || [];
          
          rawAthletes.forEach(a => {
            allRecords.push({
              categoryId: d.id,
              categoryName: data.name || '',
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
      });
    };

    setup();
    return () => unsubscribe();
  }, [id]);

  const filteredRecords = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.academy.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || role === 'guest_viewer') return;
    setSaving(true);
    
    try {
      const { db } = await import('@lib/firebase');
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
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
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal {
          background: white; border-radius: 12px; width: 100%; max-width: 600px;
          padding: var(--space-6); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 10px; border: 1px solid var(--neutral-300); border-radius: 6px; }
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
                <div style={{ fontSize: '13px', color: 'var(--neutral-500)' }}>{records.length} total registered athletes</div>
              </div>
              <div className="search-wrap">
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-500)' }} />
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search by name, academy, or category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
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
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--neutral-500)' }}>
                        No records found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(record => (
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
                          {role !== 'guest_viewer' && (
                            <button className="edit-btn" onClick={() => setEditingRecord({...record})}>
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
