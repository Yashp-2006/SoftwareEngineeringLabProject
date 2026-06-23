'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Edit2, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '@lib/firebase';
import { toast } from 'react-hot-toast';

interface Athlete {
  playerId: string;
  name: string;
  gender?: string;
  weight?: number;
  age?: number;
  academy?: string;
  state?: string;
  country?: string;
}

interface EditCategoryModalProps {
  competitionId: string;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onCategoryUpdated: (newCat: any) => void;
}

export default function EditCategoryModal({ competitionId, categoryId, categoryName, onClose, onCategoryUpdated }: EditCategoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [nameInput, setNameInput] = useState(categoryName);
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Athlete>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const snap = await getDoc(doc(db, 'competitions', competitionId, 'categories', categoryId));
        if (snap.exists()) {
          const data = snap.data();
          setNameInput(data.name || categoryName);
          setAthletes(data.athletes || []);
        }
      } catch (err) {
        console.error('Failed to load category', err);
        toast.error('Failed to load category details');
      } finally {
        setLoading(false);
      }
    };
    fetchCategory();
  }, [competitionId, categoryId, categoryName]);

  const handleSaveCategoryName = async () => {
    if (!nameInput.trim() || nameInput === categoryName) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'competitions', competitionId, 'categories', categoryId), {
        name: nameInput.trim()
      });
      toast.success('Category renamed');
      onCategoryUpdated({ id: categoryId, name: nameInput.trim(), entries: athletes.length });
    } catch (err) {
      console.error('Error renaming', err);
      toast.error('Failed to rename category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAthlete = async (athlete: Athlete) => {
    if (!window.confirm(`Are you sure you want to remove ${athlete.name}?`)) return;
    try {
      const ref = doc(db, 'competitions', competitionId, 'categories', categoryId);
      await updateDoc(ref, {
        athletes: arrayRemove(athlete),
        entries: athletes.length - 1
      });
      const newAthletes = athletes.filter(a => a.playerId !== athlete.playerId);
      setAthletes(newAthletes);
      onCategoryUpdated({ id: categoryId, name: nameInput, entries: newAthletes.length });
      toast.success('Athlete removed');
    } catch (err) {
      console.error('Failed to remove athlete', err);
      toast.error('Failed to remove athlete');
    }
  };

  const startEdit = (athlete: Athlete) => {
    setEditingAthleteId(athlete.playerId);
    setEditForm({ ...athlete });
  };

  const saveEdit = async (oldAthlete: Athlete) => {
    if (!editForm.name?.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    
    try {
      const ref = doc(db, 'competitions', competitionId, 'categories', categoryId);
      
      // Update athlete in Firestore array
      // Firestore doesn't support updating a specific object in an array by property,
      // so we must arrayRemove the old and arrayUnion the new, or just fetch and replace the whole array.
      // Since we already have the full array, rewriting it is safest.
      const newAthletes = athletes.map(a => 
        a.playerId === oldAthlete.playerId ? { ...a, ...editForm } as Athlete : a
      );

      await updateDoc(ref, {
        athletes: newAthletes
      });
      
      setAthletes(newAthletes);
      setEditingAthleteId(null);
      toast.success('Athlete updated');
      
      // We don't necessarily need to trigger onCategoryUpdated unless name or entries changed,
      // but it's safe to do so.
    } catch (err) {
      console.error('Failed to update athlete', err);
      toast.error('Failed to update athlete');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '900px', width: '90vw', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 size={24} /> Manage Category
          </h2>
          <button className="btn-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          <div className="warning-banner" style={{ marginBottom: '24px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Tiesheet Regeneration Required</strong>
              <span style={{ fontSize: '13px' }}>If you modify athletes in this category, any existing tiesheets/brackets for this category will become outdated. You MUST click "Regenerate Tiesheets" in Phase 3 or Phase 4 before the tournament starts.</span>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label className="text-micro" style={{ display: 'block', marginBottom: '8px' }}>Category Name</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="input-field" 
                value={nameInput} 
                onChange={e => setNameInput(e.target.value)}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button 
                className="btn btn-secondary" 
                onClick={handleSaveCategoryName}
                disabled={isSaving || nameInput === categoryName}
              >
                <Save size={16} /> Save Name
              </button>
            </div>
          </div>

          <div>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Enrolled Athletes ({athletes.length})</h3>
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-500)' }}>Loading athletes...</div>
            ) : athletes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-500)', background: 'var(--neutral-100)', borderRadius: '8px' }}>No athletes found in this category.</div>
            ) : (
              <div className="table-responsive">
                <table className="cat-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Academy</th>
                      <th>Gender</th>
                      <th>Age</th>
                      <th>Weight</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athletes.map((athlete) => (
                      <tr key={athlete.playerId}>
                        {editingAthleteId === athlete.playerId ? (
                          <>
                            <td>
                              <input 
                                className="input-field" 
                                style={{ marginBottom: 0, padding: '4px 8px', height: '32px' }} 
                                value={editForm.name || ''} 
                                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                              />
                            </td>
                            <td>
                              <input 
                                className="input-field" 
                                style={{ marginBottom: 0, padding: '4px 8px', height: '32px' }} 
                                value={editForm.academy || ''} 
                                onChange={e => setEditForm({...editForm, academy: e.target.value})} 
                              />
                            </td>
                            <td>{athlete.gender || '-'}</td>
                            <td>{athlete.age || '-'}</td>
                            <td>
                              <input 
                                type="number"
                                className="input-field" 
                                style={{ marginBottom: 0, padding: '4px 8px', height: '32px', width: '70px' }} 
                                value={editForm.weight || ''} 
                                onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value)})} 
                              />
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--status-live)' }} onClick={() => saveEdit(athlete)}>
                                <CheckCircle size={18} />
                              </button>
                              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setEditingAthleteId(null)}>
                                <XCircle size={18} />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ fontWeight: 500 }}>{athlete.name}</td>
                            <td>{athlete.academy || '-'}</td>
                            <td>{athlete.gender || '-'}</td>
                            <td>{athlete.age || '-'}</td>
                            <td>{athlete.weight ? `${athlete.weight}kg` : '-'}</td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => startEdit(athlete)}>
                                <Edit2 size={16} />
                              </button>
                              <button className="btn btn-ghost" style={{ padding: '4px', color: '#be123c' }} onClick={() => handleRemoveAthlete(athlete)}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
